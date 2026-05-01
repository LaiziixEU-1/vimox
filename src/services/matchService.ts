import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";
import { db } from "../config/firebase";
import { MatchFilters, VimoXUser } from "../models/types";

export async function startMatching(user: VimoXUser, filters: MatchFilters) {
  const partner = await findPartner(user, filters);
  if (!partner) {
    await enqueueUser(user, filters);
    return null;
  }
  return createRoom(user.id, partner.id);
}

export async function nextMatch(user: VimoXUser, roomId: string | undefined, filters: MatchFilters) {
  await disconnect(user.id, roomId);
  return startMatching(user, filters);
}

export async function disconnect(userId: string, roomId?: string) {
  await deleteDoc(doc(db, "waitingUsers", userId)).catch(() => undefined);
  await updateDoc(doc(db, "users", userId), { activeMatchId: null }).catch(() => undefined);
  if (roomId) {
    await setDoc(
      doc(db, "rooms", roomId),
      { isActive: false, endedAt: serverTimestamp() },
      { merge: true }
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
      createdAt: serverTimestamp()
    },
    { merge: true }
  );
}

async function findPartner(user: VimoXUser, filters: MatchFilters) {
  const constraints = [
    where("isSearching", "==", true),
    where("age", ">=", filters.minAge),
    where("age", "<=", filters.maxAge),
    limit(20)
  ];

  const snapshot = await getDocs(query(collection(db, "waitingUsers"), ...constraints));
  const candidates = snapshot.docs.filter((candidate) => {
    if (candidate.id === user.id) return false;
    if (user.blockedUserIds.includes(candidate.id)) return false;
    const data = candidate.data();
    const genderOk = filters.gender === "Tous" || data.gender === filters.gender;
    const countryOk = filters.country === "Tous" || data.country === filters.country;
    const wantedOk = data.wantedGender === "Tous" || data.wantedGender === user.gender;
    const ageOk = user.age >= data.minAge && user.age <= data.maxAge;
    return genderOk && countryOk && wantedOk && ageOk;
  });

  return candidates[Math.floor(Math.random() * candidates.length)];
}

async function createRoom(userId: string, partnerId: string) {
  const roomRef = doc(collection(db, "rooms"));
  const batch = writeBatch(db);
  batch.set(roomRef, {
    participants: [userId, partnerId],
    isActive: true,
    createdAt: serverTimestamp()
  });
  batch.delete(doc(db, "waitingUsers", userId));
  batch.delete(doc(db, "waitingUsers", partnerId));
  batch.set(doc(db, "users", userId), { activeMatchId: roomRef.id }, { merge: true });
  batch.set(doc(db, "users", partnerId), { activeMatchId: roomRef.id }, { merge: true });
  await batch.commit();
  return roomRef.id;
}

