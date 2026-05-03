import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { MatchFilters, VimoXUser } from "../models/types";

export async function startMatching(user: VimoXUser, filters: MatchFilters) {
  // 1. D'abord on s'enqueue
  await enqueueUser(user, filters);

  // 2. Ensuite on cherche un partenaire
  const partner = await findPartner(user, filters);
  if (!partner) {
    return null; // On reste dans la file d'attente
  }

  // 3. On crée la room
  return createRoom(user.id, partner.id);
}

export async function nextMatch(
  user: VimoXUser,
  roomId: string | undefined,
  filters: MatchFilters,
) {
  await disconnect(user.id, roomId);
  return startMatching(user, filters);
}

export async function disconnect(userId: string, roomId?: string) {
  await deleteDoc(doc(db, "waitingUsers", userId)).catch(() => undefined);
  await updateDoc(doc(db, "users", userId), { activeMatchId: null }).catch(
    () => undefined,
  );
  if (roomId) {
    await setDoc(
      doc(db, "rooms", roomId),
      { isActive: false, endedAt: serverTimestamp() },
      { merge: true },
    );
  }
}

async function enqueueUser(user: VimoXUser, filters: MatchFilters) {
  await setDoc(
    doc(db, "waitingUsers", user.id),
    {
      uid: user.id,
      age: user.age,
      gender: user.gender,
      country: user.country,
      minAge: filters.minAge,
      maxAge: filters.maxAge,
      wantedGender: filters.gender,
      isSearching: true,
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}

async function findPartner(user: VimoXUser, filters: MatchFilters) {
  try {
    const q = query(
      collection(db, "waitingUsers"),
      where("isSearching", "==", true),
      limit(50),
    );

    const snapshot = await getDocs(q);

    const candidates = snapshot.docs.filter((candidate) => {
      if (candidate.id === user.id) return false;
      if (user.blockedUserIds.includes(candidate.id)) return false;
      const data = candidate.data();
      const ageOk = data.age >= filters.minAge && data.age <= filters.maxAge;
      const genderOk =
        filters.gender === "Tous" || data.gender === filters.gender;
      const countryOk =
        filters.country === "Tous" || data.country === filters.country;
      const wantedOk =
        data.wantedGender === "Tous" || data.wantedGender === user.gender;
      const myAgeOk =
        user.age >= (data.minAge ?? 16) && user.age <= (data.maxAge ?? 99);
      return ageOk && genderOk && countryOk && wantedOk && myAgeOk;
    });

    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  } catch (e) {
    console.error("Erreur findPartner:", e);
    return null;
  }
}

async function createRoom(userId: string, partnerId: string) {
  const roomRef = doc(collection(db, "rooms"));
  const batch = writeBatch(db);
  batch.set(roomRef, {
    participants: [userId, partnerId],
    isActive: true,
    createdAt: serverTimestamp(),
  });
  batch.delete(doc(db, "waitingUsers", userId));
  batch.delete(doc(db, "waitingUsers", partnerId));
  batch.set(
    doc(db, "users", userId),
    { activeMatchId: roomRef.id },
    { merge: true },
  );
  batch.set(
    doc(db, "users", partnerId),
    { activeMatchId: roomRef.id },
    { merge: true },
  );
  await batch.commit();
  return roomRef.id;
}

const MATCH_TIMEOUT_MS = 3 * 60 * 1000;

export function isMatchTimedOut(createdAt: Timestamp | null): boolean {
  if (!createdAt) return false;
  return Date.now() - createdAt.toMillis() > MATCH_TIMEOUT_MS;
}

export function subscribeToIncomingMatch(
  uid: string,
  onMatch: (roomId: string, partnerId: string) => void,
): () => void {
  const q = query(
    collection(db, "rooms"),
    where("participants", "array-contains", uid),
    where("isActive", "==", true),
    orderBy("createdAt", "desc"),
    limit(1),
  );

  return onSnapshot(q, (snapshot) => {
    if (snapshot.empty) return;
    const room = snapshot.docs[0];
    const data = room.data();
    const partnerId = (data.participants as string[]).find((p) => p !== uid);
    if (partnerId) onMatch(room.id, partnerId);
  });
}
