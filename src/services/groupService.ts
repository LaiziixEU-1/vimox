import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  addDoc,
  arrayUnion,
  deleteDoc,
  deleteField,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { isReallyOnline } from "./presence";
import { uploadAudioFile, uploadToCloudinary } from "./storageService";
import { getSnapMusic, videoURLFromPoster } from "./snapService";

// ───────────────────────── Groupes (comme sur Snap) ─────────────────────────
// groups/{gid} = { name, emoji, members[], createdBy, createdAt, lastAt, lastText, lastBy }
// groups/{gid}/messages/{mid} = { senderUid, senderName, text, imageURL, type?, deleted?, sentAt }
// Sécurité (règles Firestore) : 3 à 8 membres, tous de la MÊME tranche d'âge que le créateur.

export const GROUP_MAX = 8; // toi compris
export const GROUP_MIN = 3;

export type Group = {
  id: string;
  name: string;
  emoji: string;
  members: string[];
  createdBy: string;
  lastAt: number;
  lastText: string;
  lastBy?: string;
  pinned?: { messageId: string; text: string; by: string } | null;
};

const ms = (v: any): number =>
  typeof v?.toMillis === "function" ? v.toMillis() : typeof v === "number" ? v : 0;

export function toGroup(id: string, d: any): Group {
  return {
    id,
    name: String(d?.name ?? "Groupe"),
    emoji: String(d?.emoji ?? "👥"),
    members: Array.isArray(d?.members) ? d.members : [],
    createdBy: d?.createdBy ?? "",
    lastAt: ms(d?.lastAt) || ms(d?.createdAt),
    lastText: String(d?.lastText ?? ""),
    lastBy: d?.lastBy,
    pinned: d?.pinned?.messageId ? { messageId: String(d.pinned.messageId), text: String(d.pinned.text ?? ""), by: String(d.pinned.by ?? "") } : null,
  };
}

export async function createGroup(
  me: { id: string; name: string },
  name: string,
  emoji: string,
  friendIds: string[],
): Promise<string> {
  const members = [me.id, ...new Set(friendIds.filter((x) => x && x !== me.id))].slice(0, GROUP_MAX);
  if (members.length < GROUP_MIN) throw new Error("Choisis au moins 2 amis.");
  const ref = doc(collection(db, "groups"));
  const clean = name.replace(/\s+/g, " ").trim().slice(0, 30) || "Groupe";
  await setDoc(ref, {
    name: clean,
    emoji: emoji || "👥",
    members,
    createdBy: me.id,
    createdAt: serverTimestamp(),
    lastAt: serverTimestamp(),
    lastText: `${me.name} a créé le groupe`,
    lastBy: me.id,
  });
  await addDoc(collection(db, "groups", ref.id, "messages"), {
    type: "system",
    text: `${me.name} a créé le groupe ${emoji} ${clean}`,
    senderUid: me.id,
    senderName: me.name,
    imageURL: null,
    sentAt: serverTimestamp(),
  }).catch(() => {});
  return ref.id;
}

export function subscribeMyGroups(uid: string, cb: (groups: Group[]) => void): () => void {
  return onSnapshot(
    query(collection(db, "groups"), where("members", "array-contains", uid)),
    (snap) => cb(snap.docs.map((d) => toGroup(d.id, d.data())).sort((a, b) => b.lastAt - a.lastAt)),
    () => cb([]),
  );
}

// ── Non lu : date de ma dernière ouverture de chaque groupe (sur le téléphone, rien dans la base) ──
const openedCache = new Map<string, Record<string, number>>();
const openedListeners = new Set<() => void>();
const OPENED_KEY = (uid: string) => `vimox.groupOpened.${uid}`;
export async function loadGroupOpened(uid: string): Promise<Record<string, number>> {
  const hit = openedCache.get(uid);
  if (hit) return hit;
  let v: Record<string, number> = {};
  try {
    v = JSON.parse((await AsyncStorage.getItem(OPENED_KEY(uid))) ?? "{}") ?? {};
  } catch {}
  openedCache.set(uid, v);
  return v;
}
export function markGroupOpened(uid: string, gid: string) {
  const m = { ...(openedCache.get(uid) ?? {}), [gid]: Date.now() };
  openedCache.set(uid, m);
  AsyncStorage.setItem(OPENED_KEY(uid), JSON.stringify(m)).catch(() => {});
  openedListeners.forEach((l) => l());
}
export function subscribeGroupOpened(uid: string, cb: (m: Record<string, number>) => void): () => void {
  let alive = true;
  const emit = () => alive && cb(openedCache.get(uid) ?? {});
  openedListeners.add(emit);
  loadGroupOpened(uid).then(emit);
  return () => {
    alive = false;
    openedListeners.delete(emit);
  };
}
export function isGroupUnread(g: Group, uid: string, opened: Record<string, number>): boolean {
  return !!g.lastAt && g.lastBy !== uid && g.lastAt > (opened[g.id] ?? 0);
}

// ── « … écrit » dans le groupe ──
export function setGroupTyping(gid: string, uid: string, typing: boolean) {
  const ref = doc(db, "groups", gid, "typing", uid);
  if (typing) setDoc(ref, { at: serverTimestamp() }).catch(() => {});
  else deleteDoc(ref).catch(() => {});
}
export function subscribeGroupTyping(gid: string, me: string, cb: (uids: string[]) => void): () => void {
  return onSnapshot(
    collection(db, "groups", gid, "typing"),
    (snap) => {
      const now = Date.now();
      cb(
        snap.docs
          .filter((d) => d.id !== me && now - (ms(d.data().at) || now) < 6000)
          .map((d) => d.id),
      );
    },
    () => cb([]),
  );
}

export function subscribeGroup(gid: string, cb: (g: Group | null) => void): () => void {
  return onSnapshot(
    doc(db, "groups", gid),
    (snap) => cb(snap.exists() ? toGroup(snap.id, snap.data()) : null),
    () => cb(null),
  );
}

export function subscribeGroupMessages(gid: string, cb: (msgs: any[]) => void): () => void {
  return onSnapshot(
    query(collection(db, "groups", gid, "messages"), orderBy("sentAt", "asc"), limit(400)),
    (snap) =>
      cb(
        snap.docs.map((d) => {
          const x = d.data();
          return { id: d.id, ...x, sentAt: ms(x.sentAt) || Date.now() };
        }),
      ),
    () => cb([]),
  );
}

async function touch(gid: string, meId: string, preview: string) {
  await updateDoc(doc(db, "groups", gid), {
    lastAt: serverTimestamp(),
    lastText: preview.slice(0, 80),
    lastBy: meId,
  }).catch(() => {});
}

export type GroupReply = { id: string; name: string; text: string };

export async function sendGroupText(
  g: Group,
  me: { id: string; name: string },
  text: string,
  replyTo?: GroupReply | null,
) {
  const clean = text.trim();
  if (!clean) return;
  await addDoc(collection(db, "groups", g.id, "messages"), {
    text: clean,
    imageURL: null,
    senderUid: me.id,
    senderName: me.name,
    ...(replyTo ? { replyTo } : {}),
    sentAt: serverTimestamp(),
  });
  await touch(g.id, me.id, `${me.name} : ${clean}`);
  notifyGroup(g, me, clean).catch(() => {});
}

export async function sendGroupImage(g: Group, me: { id: string; name: string }, uri: string) {
  const url = await uploadToCloudinary(uri, `groups/${g.id}`);
  await addDoc(collection(db, "groups", g.id, "messages"), {
    text: "",
    imageURL: url,
    senderUid: me.id,
    senderName: me.name,
    sentAt: serverTimestamp(),
  });
  await touch(g.id, me.id, `${me.name} : 📷 Photo`);
  notifyGroup(g, me, "📷 Photo").catch(() => {});
}

// Vim envoyé au groupe : chaque membre peut l'ouvrir une fois (viewedBy = qui l'a vu)
export async function sendGroupSnap(g: Group, me: { id: string; name: string }, imageURL: string, duration = 6) {
  const music = getSnapMusic(imageURL);
  await addDoc(collection(db, "groups", g.id, "messages"), {
    text: "",
    isSnap: true,
    imageURL,
    videoURL: videoURLFromPoster(imageURL),
    musicURL: music?.musicURL ?? null,
    musicMeta: music?.meta ?? null,
    duration,
    viewedBy: [],
    senderUid: me.id,
    senderName: me.name,
    sentAt: serverTimestamp(),
  });
  await touch(g.id, me.id, `${me.name} : 📸 Vim`);
  notifyGroup(g, me, "📸 a envoyé un Vim").catch(() => {});
}

export async function markGroupSnapViewed(gid: string, messageId: string, uid: string) {
  await updateDoc(doc(db, "groups", gid, "messages", messageId), { viewedBy: arrayUnion(uid) });
}

// ✏️ Modifier un de ses messages (Vim+)
export async function editGroupMessage(gid: string, messageId: string, text: string) {
  await updateDoc(doc(db, "groups", gid, "messages", messageId), { text: text.trim(), editedAt: serverTimestamp() });
}

// 📌 Épingler un message pour tout le groupe (null = désépingler)
export async function pinGroupMessage(gid: string, pin: { messageId: string; text: string; by: string } | null) {
  await updateDoc(doc(db, "groups", gid), { pinned: pin ? { ...pin, text: pin.text.slice(0, 200) } : null });
}

// Message vocal dans le groupe
export async function sendGroupAudio(g: Group, me: { id: string; name: string }, uri: string, duration: number) {
  const url = await uploadAudioFile(uri, `groups/${g.id}`);
  await addDoc(collection(db, "groups", g.id, "messages"), {
    text: "",
    imageURL: null,
    audioURL: url,
    audioDuration: duration,
    senderUid: me.id,
    senderName: me.name,
    sentAt: serverTimestamp(),
  });
  await touch(g.id, me.id, `${me.name} : 🎤 Message vocal`);
  notifyGroup(g, me, "🎤 Message vocal").catch(() => {});
}

// Réaction (une par personne et par message) ; null = retirer
export async function reactGroupMessage(gid: string, messageId: string, uid: string, emoji: string | null) {
  await updateDoc(doc(db, "groups", gid, "messages", messageId), {
    [`reactions.${uid}`]: emoji ?? deleteField(),
  });
}

export async function addGroupSystem(gid: string, me: { id: string; name: string }, text: string, type = "system") {
  await addDoc(collection(db, "groups", gid, "messages"), {
    type,
    text,
    senderUid: me.id,
    senderName: me.name,
    imageURL: null,
    sentAt: serverTimestamp(),
  }).catch(() => {});
}

// Suppression façon Snap : le message disparaît pour TOUT le groupe, une petite ligne reste à sa place
export async function deleteGroupMessage(gid: string, msg: any) {
  await updateDoc(doc(db, "groups", gid, "messages", msg.id), {
    deleted: true,
    deletedKind: msg.isSnap ? "snap" : msg.audioURL ? "audio" : msg.imageURL ? "photo" : "chat",
    text: "",
    imageURL: null,
    videoURL: null,
    musicURL: null,
    musicMeta: null,
    audioURL: null,
    replyTo: null,
    reactions: {},
  });
}

export async function renameGroup(g: Group, me: { id: string; name: string }, name: string, emoji: string) {
  const clean = name.replace(/\s+/g, " ").trim().slice(0, 30);
  if (!clean) return;
  await updateDoc(doc(db, "groups", g.id), { name: clean, emoji: emoji || g.emoji });
  await addGroupSystem(g.id, me, `${me.name} a renommé le groupe en ${emoji || g.emoji} ${clean}`);
}

export async function leaveGroup(g: Group, me: { id: string; name: string }) {
  const batch = writeBatch(db);
  batch.set(doc(collection(db, "groups", g.id, "messages")), {
    type: "system",
    text: `${me.name} a quitté le groupe`,
    senderUid: me.id,
    senderName: me.name,
    imageURL: null,
    sentAt: serverTimestamp(),
  });
  batch.update(doc(db, "groups", g.id), { members: g.members.filter((m) => m !== me.id) });
  await batch.commit();
}

// Notification aux membres qui ne sont pas en ligne (leurs réglages de notification sont respectés)
async function notifyGroup(g: Group, me: { id: string; name: string }, preview: string) {
  const others = g.members.filter((m) => m !== me.id);
  await Promise.all(
    others.map(async (uid) => {
      try {
        const u: any = (await getDoc(doc(db, "users", uid))).data();
        if (!u?.pushToken || u.notifPush === false || isReallyOnline(u)) return;
        const body = u.notifPreview === false ? "Nouveau message" : `${me.name} : ${preview}`.slice(0, 90);
        await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({
            to: u.pushToken,
            title: `${g.emoji} ${g.name}`,
            body,
            sound: u.notifSounds === false ? null : "default",
            data: { type: "group", groupId: g.id, name: g.name },
            channelId: "default",
            priority: "high",
          }),
        });
      } catch {}
    }),
  );
}
