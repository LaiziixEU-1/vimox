/*VIMOX-V24*/
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { Friend, FriendRequest } from "../models/types";
import { notifyFriendRequest } from "./notificationService";
import { isReallyOnline } from "./presence";
import { logDenied } from "./firestoreErrors";

// ✅ Envoie une DEMANDE (pas un ajout direct)
export async function sendFriendRequest(
  fromUid: string,
  fromName: string,
  fromPhoto: string | null | undefined,
  toUid: string,
): Promise<void> {
  if (!fromUid || !toUid || fromUid === toUid) return;
  // Blocage dans un sens ou dans l'autre : on n'envoie rien (et on ne le dit pas à l'autre personne)
  try {
    const [mine, theirs] = await Promise.all([
      getDoc(doc(db, "users", fromUid)),
      getDoc(doc(db, "users", toUid)),
    ]);
    const iBlocked: string[] = mine.data()?.blockedUserIds ?? [];
    const theyBlocked: string[] = theirs.data()?.blockedUserIds ?? [];
    if (iBlocked.includes(toUid) || theyBlocked.includes(fromUid)) return;
  } catch {}

  // Déjà amis ? Rien à faire.
  const already = await getDocs(
    query(
      collection(db, "friends"),
      where("userId", "==", fromUid),
      where("id", "==", toUid),
    ),
  );
  if (!already.empty) return;

  // Demande déjà envoyée ? Rien à faire.
  const existing = await getDocs(
    query(
      collection(db, "friendRequests"),
      where("fromUid", "==", fromUid),
      where("toUid", "==", toUid),
      where("status", "==", "pending"),
    ),
  );
  if (!existing.empty) return;

  // L'autre personne nous a déjà demandé en ami : on accepte directement
  const reverse = await getDocs(
    query(
      collection(db, "friendRequests"),
      where("fromUid", "==", toUid),
      where("toUid", "==", fromUid),
      where("status", "==", "pending"),
    ),
  );
  if (!reverse.empty) {
    await acceptFriendRequest(reverse.docs[0].id, toUid, fromUid);
    return;
  }

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

// ✅ Accepter une demande → crée la relation des deux côtés, en une seule opération
// atomique et sans doublon possible (identifiants fixes : accepter deux fois ne change rien).
// (pas de notification envoyée ici, volontairement)
export async function acceptFriendRequest(
  requestId: string,
  fromUid: string,
  toUid: string,
): Promise<void> {
  const [fromSnap, toSnap] = await Promise.all([
    getDoc(doc(db, "users", fromUid)),
    getDoc(doc(db, "users", toUid)),
  ]);
  const fromData = fromSnap.data() ?? {};
  const toData = toSnap.data() ?? {};

  const batch = writeBatch(db);
  batch.update(doc(db, "friendRequests", requestId), { status: "accepted" });
  batch.set(doc(db, "friends", `${toUid}_${fromUid}`), {
    userId: toUid,
    id: fromUid,
    requestId,
    name: fromData.name ?? "",
    profilePhotoURL: fromData.profilePhotoURL ?? null,
    country: fromData.country ?? "",
    isPremium: fromData.isPremium ?? false,
    createdAt: serverTimestamp(),
  });
  batch.set(doc(db, "friends", `${fromUid}_${toUid}`), {
    userId: fromUid,
    id: toUid,
    requestId,
    name: toData.name ?? "",
    profilePhotoURL: toData.profilePhotoURL ?? null,
    country: toData.country ?? "",
    isPremium: toData.isPremium ?? false,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
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
  // Ma sourdine pour cet ami n'a plus de raison d'être (document à moi : je peux le supprimer)
  await deleteDoc(doc(db, "mutes", `${userId}_${friendId}`)).catch(() => {});
}

// Les documents « friends » sont une copie figée au moment de l'ajout : le statut en ligne,
// la photo et le nom y seraient vite faux. On suit donc en direct le profil de chaque ami.
export function subscribeFriends(
  userId: string,
  onUpdate: (friends: Friend[]) => void,
) {
  let base: Friend[] = [];
  const live: Record<string, any> = {};
  let unsubUsers: (() => void)[] = [];

  const emit = () =>
    onUpdate(
      base.map((f) => {
        const u = live[f.id];
        if (!u) return { ...f, isOnline: false };
        return {
          ...f,
          name: u.name ?? f.name,
          profilePhotoURL: u.profilePhotoURL ?? f.profilePhotoURL ?? null,
          country: u.country ?? f.country,
          isPremium: u.isPremium ?? f.isPremium,
          // Vim+ : couleur choisie pour ses messages
          chatColor: u.isPremium === true ? u.chatColor ?? null : null,
          isOnline: isReallyOnline(u),
          lastSeen: u.showOnlineStatus === false ? undefined : u.lastSeen,
        };
      }),
    );

  const unsubFriends = onSnapshot(
    query(collection(db, "friends"), where("userId", "==", userId)),
    (snap) => {
      // Un même ami ne doit apparaître qu'une fois (anciens doublons)
      const seen = new Set<string>();
      base = [];
      snap.docs.forEach((d) => {
        const f = { ...d.data() } as Friend;
        if (!f.id || seen.has(f.id)) return;
        seen.add(f.id);
        base.push(f);
      });

      unsubUsers.forEach((u) => u());
      unsubUsers = [];
      const ids = base.map((f) => f.id);
      for (const id of ids) {
        unsubUsers.push(
          onSnapshot(
            doc(db, "users", id),
            (s) => {
              if (s.exists()) live[id] = s.data();
              else delete live[id];
              emit();
            },
            () => {},
          ),
        );
      }
      emit();
    }, (e) => logDenied("liste d'amis", e),
  );

  return () => {
    unsubFriends();
    unsubUsers.forEach((u) => u());
  };
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
      ), (e) => logDenied("demandes d'ami", e),
  );
}

// Mes demandes envoyées et encore en attente : identifiants des personnes concernées
export function subscribeSentRequests(
  userId: string,
  onUpdate: (toUids: string[]) => void,
) {
  return onSnapshot(
    query(
      collection(db, "friendRequests"),
      where("fromUid", "==", userId),
      where("status", "==", "pending"),
    ),
    (snap) => onUpdate(snap.docs.map((d) => d.data().toUid as string).filter(Boolean)),
    () => {},
  );
}

// Identifiants de mes amis seulement (sans suivre leur présence) : pour les écrans qui n'en ont pas besoin
export function subscribeFriendIds(userId: string, onUpdate: (ids: string[]) => void) {
  return onSnapshot(
    query(collection(db, "friends"), where("userId", "==", userId)),
    (snap) =>
      onUpdate([...new Set(snap.docs.map((d) => d.data().id as string).filter(Boolean))]),
    () => {},
  );
}

// Mes demandes envoyées encore en attente, avec leur identifiant (pour pouvoir les annuler)
export function subscribeSentRequestDocs(
  userId: string,
  onUpdate: (reqs: { id: string; toUid: string }[]) => void,
) {
  return onSnapshot(
    query(
      collection(db, "friendRequests"),
      where("fromUid", "==", userId),
      where("status", "==", "pending"),
    ),
    (snap) =>
      onUpdate(
        snap.docs
          .map((d) => ({ id: d.id, toUid: d.data().toUid as string }))
          .filter((r) => !!r.toUid),
      ),
    () => {},
  );
}

// Annule une demande d'ami que j'ai envoyée (les règles ne laissent supprimer que ses propres demandes)
export async function cancelSentRequest(requestId: string): Promise<void> {
  await deleteDoc(doc(db, "friendRequests", requestId));
}

// Nom et photo d'une personne (lecture d'un seul profil), pour afficher une demande envoyée
export async function getUserBrief(uid: string): Promise<{ name: string; photo: string | null } | null> {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    const d = snap.data() as any;
    return d?.name ? { name: d.name, photo: d.profilePhotoURL ?? null } : null;
  } catch {
    return null;
  }
}
