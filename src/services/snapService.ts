/*VIMOX-V30*/
import {
  addDoc,
  collection,
  query,
  where,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { notifyNewSnap } from "./notificationService";
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from "../config/env";
import type { MusicMeta } from "../features/sounds/soundService";
import { logDenied } from "./firestoreErrors";

function getChatId(a: string, b: string) {
  return [a, b].sort().join("_");
}

function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string) {
  const da = new Date(a + "T00:00:00Z").getTime();
  const dbb = new Date(b + "T00:00:00Z").getTime();
  return Math.round((dbb - da) / 86400000);
}

const STREAK_FLAME_MIN = 3;
const BEST_FRIEND_THRESHOLD = 5;
const BEST_FRIEND_LONGTIME_DAYS = 14;
const RESTORE_WINDOW_DAYS = 3; // comme Snap : tu as quelques jours pour restaurer

export async function uploadSnapImage(imageUri: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", {
    uri: imageUri,
    type: "image/jpeg",
    name: `snap_${Date.now()}.jpg`,
  } as any);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", "snaps");
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData },
  );
  const data = await res.json();
  if (!data.secure_url) throw new Error("Upload Cloudinary échoué.");
  return data.secure_url as string;
}

// --- Snaps vidéo ---
// Une vidéo est envoyée sur Cloudinary ; on obtient la vidéo en mp4 et sa première image (jpg).
// Cette image sert d'« imageURL » : l'écran « Envoyer à » et l'ancien affichage continuent de marcher,
// et la vidéo est retrouvée automatiquement à partir de cette image (même nom de fichier).
export async function uploadSnapVideo(
  videoUri: string,
): Promise<{ videoURL: string; posterURL: string }> {
  const isWebm = /\.webm($|\?)/i.test(videoUri);
  const formData = new FormData();
  formData.append("file", {
    uri: videoUri,
    type: isWebm ? "video/webm" : "video/mp4",
    name: `snap_${Date.now()}.${isWebm ? "webm" : "mp4"}`,
  } as any);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", "snaps");
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`,
    { method: "POST", body: formData },
  );
  const data = await res.json();
  const url: string | undefined = data.secure_url;
  if (!url) throw new Error(data?.error?.message ?? "Upload vidéo Cloudinary échoué.");
  const base = url.replace(/\.[a-z0-9]+$/i, "");
  return {
    videoURL: `${base}.mp4`,
    posterURL: `${base.replace("/video/upload/", "/video/upload/so_0/")}.jpg`,
  };
}

// Retrouve la vidéo à partir de sa première image Cloudinary (ou null si c'est une photo)
export function videoURLFromPoster(imageURL: string | null | undefined): string | null {
  if (!imageURL || !imageURL.includes("/video/upload/so_0/")) return null;
  return imageURL.replace("/video/upload/so_0/", "/video/upload/").replace(/\.jpg$/i, ".mp4");
}

// --- Son des Snaps ---
// La caméra enregistre ici le son choisi pour une image ; l'écran « Envoyer à »
// n'a rien à changer : sendSnapToFriend retrouve le son grâce à l'image.
const snapMusic = new Map<string, { musicURL: string; meta: MusicMeta }>();
export function registerSnapMusic(imageURL: string, musicURL: string, meta: MusicMeta) {
  snapMusic.set(imageURL, { musicURL, meta });
}

// Son choisi dans la caméra pour cette image (sert aussi aux Vims de groupe)
export function getSnapMusic(imageURL: string) {
  return snapMusic.get(imageURL) ?? null;
}

export async function sendSnapToFriend(
  myUid: string,
  friendUid: string,
  imageURL: string,
  duration = 6, // secondes d'affichage choisies par l'expéditeur
): Promise<void> {
  const cid = getChatId(myUid, friendUid);
  const videoURL = videoURLFromPoster(imageURL);
  const music = snapMusic.get(imageURL) ?? null;
  await addDoc(collection(db, "friendChats", cid, "messages"), {
    text: "",
    imageURL,
    videoURL,
    musicURL: music?.musicURL ?? null,
    musicMeta: music?.meta ?? null,
    audioURL: null,
    isSnap: true,
    snapViewed: false,
    duration,
    senderUid: myUid,
    sentAt: serverTimestamp(),
  });
  await recordSnapSent(cid, myUid, friendUid);
  // L'ami est prévenu (ses réglages de notification sont respectés)
  notifyNewSnap(friendUid, myUid).catch(() => {});
}

export async function markSnapViewed(
  chatId: string,
  messageId: string,
): Promise<void> {
  try {
    await updateDoc(doc(db, "friendChats", chatId, "messages", messageId), {
      snapViewed: true,
      imageURL: null,
      videoURL: null,
      musicURL: null,
      musicMeta: null,
    });
  } catch {}
}

export async function recordSnapSent(
  chatId: string,
  myUid: string,
  friendUid: string,
): Promise<void> {
  const ref = doc(db, "streaks", chatId);
  const now = Date.now();
  const today = todayKey();

  // Transaction : si les deux amis envoient un Snap au même instant, aucun compteur n'est perdu
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);

    if (!snap.exists()) {
      tx.set(ref, {
        users: [myUid, friendUid],
        [`lastSnapAt_${myUid}`]: now,
        [`lastSnapAt_${friendUid}`]: null,
        streakCount: 0,
        lastIncrementDate: null,
        totalSnaps: 1,
        bestFriendSince: null,
        updatedAt: serverTimestamp(),
      });
      return;
    }

    const data = snap.data() as any;
    const otherLastAt = data[`lastSnapAt_${friendUid}`] as number | null;
    const otherLastDate = otherLastAt ? todayKey(new Date(otherLastAt)) : null;
    const lastIncrementDate = data.lastIncrementDate as string | null;

    let streakCount = data.streakCount ?? 0;
    let newIncrementDate = lastIncrementDate;

    if (otherLastDate === today && lastIncrementDate !== today) {
      if (lastIncrementDate && daysBetween(lastIncrementDate, today) > 1) {
        streakCount = 1;
      } else {
        streakCount = (streakCount || 0) + 1;
      }
      newIncrementDate = today;
    }

    const totalSnaps = (data.totalSnaps ?? 0) + 1;
    let bestFriendSince = data.bestFriendSince ?? null;
    if (!bestFriendSince && totalSnaps >= BEST_FRIEND_THRESHOLD) {
      bestFriendSince = today;
    }

    tx.update(ref, {
      [`lastSnapAt_${myUid}`]: now,
      streakCount,
      lastIncrementDate: newIncrementDate,
      totalSnaps,
      bestFriendSince,
      updatedAt: serverTimestamp(),
    });
  });
}

// Réactive une flamme cassée récemment, sans perdre le compteur
export async function restoreStreak(chatId: string): Promise<void> {
  await updateDoc(doc(db, "streaks", chatId), {
    lastIncrementDate: todayKey(),
    updatedAt: serverTimestamp(),
  });
}

export type BestFriendBadge = "none" | "friend" | "bestie" | "bestie_long";

export interface StreakInfo {
  streakCount: number;
  totalSnaps: number;
  isAboutToExpire: boolean;
  bestFriendBadge: BestFriendBadge;
  canRestore: boolean;
}

export function subscribeStreakInfo(
  chatId: string,
  onUpdate: (info: StreakInfo) => void,
) {
  return onSnapshot(doc(db, "streaks", chatId), (snap) => {
    if (!snap.exists()) {
      onUpdate({
        streakCount: 0,
        totalSnaps: 0,
        isAboutToExpire: false,
        bestFriendBadge: "none",
        canRestore: false,
      });
      return;
    }
    const data = snap.data() as any;
    const lastIncrementDate = data.lastIncrementDate as string | null;
    const today = todayKey();
    const rawStreakCount = data.streakCount ?? 0;

    let streakCount = rawStreakCount;
    let canRestore = false;
    if (lastIncrementDate) {
      const gap = daysBetween(lastIncrementDate, today);
      if (gap > 1) {
        streakCount = 0;
        canRestore = rawStreakCount > 0 && gap <= RESTORE_WINDOW_DAYS + 1;
      }
    }

    const isAboutToExpire =
      streakCount > 0 &&
      lastIncrementDate !== today &&
      new Date().getHours() >= 20;

    const totalSnaps = data.totalSnaps ?? 0;
    const bestFriendSince = data.bestFriendSince as string | null;
    let bestFriendBadge: BestFriendBadge = "none";
    if (totalSnaps >= BEST_FRIEND_THRESHOLD) {
      bestFriendBadge =
        bestFriendSince &&
        daysBetween(bestFriendSince, today) >= BEST_FRIEND_LONGTIME_DAYS
          ? "bestie_long"
          : "bestie";
    } else if (totalSnaps > 0) {
      bestFriendBadge = "friend";
    }

    onUpdate({ streakCount, totalSnaps, isAboutToExpire, bestFriendBadge, canRestore });
  }, (e) => logDenied("flamme", e));
}

// ⚡ Score VimoX (comme le Snap Score) : tous les Vims échangés avec tes amis + ta meilleure flamme
export function subscribeMyScore(
  uid: string,
  cb: (r: { score: number; bestStreak: number }) => void,
): () => void {
  return onSnapshot(
    query(collection(db, "streaks"), where("users", "array-contains", uid)),
    (snap) => {
      let score = 0;
      let bestStreak = 0;
      snap.docs.forEach((d) => {
        const x: any = d.data();
        score += Number(x.totalSnaps) || 0;
        bestStreak = Math.max(bestStreak, Number(x.streakCount) || 0);
      });
      cb({ score, bestStreak });
    },
    () => cb({ score: 0, bestStreak: 0 }),
  );
}

// Flammes qui vont s'éteindre ce soir : la dernière journée comptée est hier (pas encore de Vim aujourd'hui)
export function subscribeStreaksAtRisk(
  uid: string,
  cb: (list: { otherUid: string; count: number }[]) => void,
): () => void {
  return onSnapshot(
    query(collection(db, "streaks"), where("users", "array-contains", uid)),
    (snap) => {
      const today = todayKey();
      const out: { otherUid: string; count: number }[] = [];
      snap.docs.forEach((d) => {
        const x: any = d.data();
        const count = Number(x.streakCount) || 0;
        const last = x.lastIncrementDate as string | null;
        if (count > 0 && last && last !== today && daysBetween(last, today) === 1) {
          const other = (x.users ?? []).find((u: string) => u !== uid);
          if (other) out.push({ otherUid: other, count });
        }
      });
      cb(out);
    },
    () => cb([]),
  );
}

export function getStreakDisplay(
  count: number,
  isAboutToExpire: boolean,
): { icon: string; show: boolean } {
  if (count < STREAK_FLAME_MIN) return { icon: "", show: false };
  if (isAboutToExpire) return { icon: "⏳", show: true };
  if (count >= 100) return { icon: "💯", show: true };
  return { icon: "🔥", show: true };
}

// `custom` : emojis choisis par la personne (Paramètres > « Personnaliser les emojis »)
export function getBestFriendEmoji(
  badge: BestFriendBadge,
  custom: Partial<Record<"friend" | "bestie" | "bestie_long", string>> = {},
): string {
  switch (badge) {
    case "bestie_long":
      return custom.bestie_long ?? "❤️";
    case "bestie":
      return custom.bestie ?? "💛";
    case "friend":
      return custom.friend ?? "😊";
    default:
      return "";
  }
}

export { getChatId };
