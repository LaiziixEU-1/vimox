import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from "../config/env";

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

export async function sendSnapToFriend(
  myUid: string,
  friendUid: string,
  imageURL: string,
): Promise<void> {
  const cid = getChatId(myUid, friendUid);
  await addDoc(collection(db, "friendChats", cid, "messages"), {
    text: "",
    imageURL,
    audioURL: null,
    isSnap: true,
    snapViewed: false,
    senderUid: myUid,
    sentAt: serverTimestamp(),
  });
  await recordSnapSent(cid, myUid, friendUid);
}

export async function markSnapViewed(
  chatId: string,
  messageId: string,
): Promise<void> {
  try {
    await updateDoc(doc(db, "friendChats", chatId, "messages", messageId), {
      snapViewed: true,
      imageURL: null,
    });
  } catch {}
}

export async function recordSnapSent(
  chatId: string,
  myUid: string,
  friendUid: string,
): Promise<void> {
  const ref = doc(db, "streaks", chatId);
  const snap = await getDoc(ref);
  const now = Date.now();
  const today = todayKey();

  if (!snap.exists()) {
    await setDoc(ref, {
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

  await updateDoc(ref, {
    [`lastSnapAt_${myUid}`]: now,
    streakCount,
    lastIncrementDate: newIncrementDate,
    totalSnaps,
    bestFriendSince,
    updatedAt: serverTimestamp(),
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
  });
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

export function getBestFriendEmoji(badge: BestFriendBadge): string {
  switch (badge) {
    case "bestie_long":
      return "❤️";
    case "bestie":
      return "💛";
    case "friend":
      return "😊";
    default:
      return "";
  }
}

export { getChatId };