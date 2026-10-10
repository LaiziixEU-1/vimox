import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { Friend, FriendRequest } from "../models/types";
import { notifyFriendRequest } from "./notificationService";

// ✅ Envoie une DEMANDE (pas un ajout direct)
export async function sendFriendRequest(
  fromUid: string,
  fromName: string,
  fromPhoto: string | null | undefined,
  toUid: string,
): Promise<void> {
  // Vérifier si déjà amis ou demande en cours
  const existing = await getDocs(
    query(
      collection(db, "friendRequests"),
      where("fromUid", "==", fromUid),
      where("toUid", "==", toUid),
      where("status", "==", "pending"),
    ),
  );
  if (!existing.empty) return; // Demande déjà envoyée

  await addDoc(collection(db, "friendRequests"), {
    fromUid,
    fromName,
    fromPhoto: fromPhoto ?? null,
    toUid,
    status: "pending",
    createdAt: serverTimestamp(),
  });

  // ✅ Notifie uniquement le destinataire de la NOUVELLE demande
  notifyFriendRequest(toUid, fromName).catch(() => {});
}

// ✅ Accepter une demande → crée la relation des deux côtés
// (pas de notification envoyée ici, volontairement)
export async function acceptFriendRequest(
  requestId: string,
  fromUid: string,
  toUid: string,
): Promise<void> {
  await updateDoc(doc(db, "friendRequests", requestId), { status: "accepted" });

  const { getDoc } = await import("firebase/firestore");
  const [fromSnap, toSnap] = await Promise.all([
    getDoc(doc(db, "users", fromUid)),
    getDoc(doc(db, "users", toUid)),
  ]);

  const fromData = fromSnap.data() ?? {};
  const toData = toSnap.data() ?? {};

  await Promise.all([
    addDoc(collection(db, "friends"), {
      userId: toUid,
      id: fromUid,
      name: fromData.name ?? "",
      profilePhotoURL: fromData.profilePhotoURL ?? null,
      country: fromData.country ?? "",
      isPremium: fromData.isPremium ?? false,
      isOnline: fromData.isOnline ?? false,
      createdAt: serverTimestamp(),
    }),
    addDoc(collection(db, "friends"), {
      userId: fromUid,
      id: toUid,
      name: toData.name ?? "",
      profilePhotoURL: toData.profilePhotoURL ?? null,
      country: toData.country ?? "",
      isPremium: toData.isPremium ?? false,
      isOnline: toData.isOnline ?? false,
      createdAt: serverTimestamp(),
    }),
  ]);
}

export async function declineFriendRequest(requestId: string): Promise<void> {
  await updateDoc(doc(db, "friendRequests", requestId), { status: "declined" });
}

export async function removeFriend(
  userId: string,
  friendId: string,
): Promise<void> {
  const q1 = await getDocs(
    query(
      collection(db, "friends"),
      where("userId", "==", userId),
      where("id", "==", friendId),
    ),
  );
  const q2 = await getDocs(
    query(
      collection(db, "friends"),
      where("userId", "==", friendId),
      where("id", "==", userId),
    ),
  );
  const deletes = [...q1.docs, ...q2.docs].map((d) => deleteDoc(d.ref));
  await Promise.all(deletes);
}

export function subscribeFriends(
  userId: string,
  onUpdate: (friends: Friend[]) => void,
) {
  return onSnapshot(
    query(collection(db, "friends"), where("userId", "==", userId)),
    (snap) => onUpdate(snap.docs.map((d) => ({ ...d.data() }) as Friend)),
  );
}

export function subscribeFriendRequests(
  userId: string,
  onUpdate: (reqs: FriendRequest[]) => void,
) {
  return onSnapshot(
    query(
      collection(db, "friendRequests"),
      where("toUid", "==", userId),
      where("status", "==", "pending"),
    ),
    (snap) =>
      onUpdate(
        snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FriendRequest),
      ),
  );
}
