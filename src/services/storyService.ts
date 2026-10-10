import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from "../config/env";

export interface Story {
  id: string;
  userId: string;
  userName: string;
  userPhoto: string | null;
  imageURL?: string | null;
  text?: string;
  bgColor?: string;
  textColor?: string;
  filterColor?: string | null;
  filterOpacity?: number;
  overlayText?: string;
  musicURL?: string | null;
  createdAt: number;
  expiresAt: number;
  viewedBy: string[];
}

export interface UserStories {
  userId: string;
  userName: string;
  userPhoto: string | null;
  stories: Story[];
  hasUnviewed: boolean;
}

const STORY_HOURS = 24;

export async function uploadStoryMusic(audioUri: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", {
    uri: audioUri,
    type: "audio/m4a",
    name: `story_music_${Date.now()}.m4a`,
  } as any);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("resource_type", "video"); // Cloudinary traite l'audio via "video"
  formData.append("folder", "story_music");
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`,
    { method: "POST", body: formData },
  );
  const data = await res.json();
  if (!data.secure_url) throw new Error("Upload musique échoué.");
  return data.secure_url as string;
}

export async function createPhotoStory(
  userId: string,
  userName: string,
  userPhoto: string | null | undefined,
  imageUri: string,
  overlayText?: string,
  filterColor?: string,
  filterOpacity?: number,
  musicURL?: string | null,
): Promise<void> {
  const formData = new FormData();
  formData.append("file", {
    uri: imageUri,
    type: "image/jpeg",
    name: `story_${Date.now()}.jpg`,
  } as any);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", `stories/${userId}`);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData },
  );
  const data = await res.json();
  if (!data.secure_url)
    throw new Error(
      "Upload Cloudinary échoué. Vérifie que le preset est bien en mode Unsigned.",
    );
  const now = Date.now();
  await addDoc(collection(db, "stories"), {
    userId,
    userName,
    userPhoto: userPhoto ?? null,
    imageURL: data.secure_url,
    overlayText: overlayText ?? "",
    filterColor: filterColor ?? null,
    filterOpacity: filterOpacity ?? 0,
    musicURL: musicURL ?? null,
    createdAt: serverTimestamp(),
    expiresAt: now + STORY_HOURS * 3600 * 1000,
    viewedBy: [],
  });
}

export async function createTextStory(
  userId: string,
  userName: string,
  userPhoto: string | null | undefined,
  text: string,
  bgColor: string,
  textColor: string,
): Promise<void> {
  const now = Date.now();
  await addDoc(collection(db, "stories"), {
    userId,
    userName,
    userPhoto: userPhoto ?? null,
    text,
    bgColor,
    textColor,
    createdAt: serverTimestamp(),
    expiresAt: now + STORY_HOURS * 3600 * 1000,
    viewedBy: [],
  });
}

export async function getFriendsStories(
  myUserId: string,
  friendIds: string[],
): Promise<UserStories[]> {
  const userIds = [myUserId, ...friendIds];
  if (userIds.length === 0) return [];
  const now = Date.now();
  const allStories: Story[] = [];
  for (let i = 0; i < userIds.length; i += 10) {
    const chunk = userIds.slice(i, i + 10);
    const q = query(collection(db, "stories"), where("userId", "in", chunk));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      const data = d.data();
      const expiresAt =
        data.expiresAt instanceof Timestamp
          ? data.expiresAt.toMillis()
          : (data.expiresAt ?? 0);
      if (expiresAt > now) {
        allStories.push({
          id: d.id,
          ...data,
          createdAt:
            data.createdAt instanceof Timestamp
              ? data.createdAt.toMillis()
              : (data.createdAt ?? now),
          expiresAt,
          viewedBy: data.viewedBy ?? [],
        } as Story);
      }
    }
  }
  const grouped: Record<string, Story[]> = {};
  for (const story of allStories) {
    if (!grouped[story.userId]) grouped[story.userId] = [];
    grouped[story.userId].push(story);
  }
  for (const uid of Object.keys(grouped)) {
    grouped[uid].sort((a, b) => a.createdAt - b.createdAt);
  }
  const result: UserStories[] = [];
  for (const uid of userIds) {
    if (!grouped[uid]) continue;
    const stories = grouped[uid];
    result.push({
      userId: uid,
      userName: stories[0].userName,
      userPhoto: stories[0].userPhoto,
      stories,
      hasUnviewed: stories.some((s) => !s.viewedBy.includes(myUserId)),
    });
  }
  return result;
}

export async function markStoryViewed(
  storyId: string,
  userId: string,
): Promise<void> {
  try {
    await updateDoc(doc(db, "stories", storyId), {
      viewedBy: arrayUnion(userId),
    });
  } catch {}
}
