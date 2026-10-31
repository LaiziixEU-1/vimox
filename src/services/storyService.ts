/*VIMOX-V25*/
/*VIMOX-V24*/
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { getChatId } from "./snapService";
import { loadPrefs } from "./chatPrefsService";
import { notifyFriendMessage } from "./notificationService";
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from "../config/env";
import type { MusicMeta } from "../features/sounds/soundService";

export interface Story {
  id: string;
  userId: string;
  userName: string;
  userPhoto: string | null;
  imageURL?: string | null;
  // Story vidéo : la vidéo (mp4). imageURL contient alors sa première image (aperçu).
  videoURL?: string | null;
  text?: string;
  bgColor?: string;
  textColor?: string;
  filterColor?: string | null;
  filterOpacity?: number;
  overlayText?: string;
  musicURL?: string | null;
  // Son façon Snap : titre, artiste, pochette, passage choisi et volumes
  musicSoundId?: string | null;
  musicTitle?: string | null;
  musicArtist?: string | null;
  musicCover?: string | null;
  musicDuration?: number | null;
  musicStart?: number | null;
  musicClip?: number | null;
  musicVolume?: number | null;
  videoVolume?: number | null;
  musicExternalURL?: string | null;
  createdAt: number;
  expiresAt: number;
  viewedBy: string[];
  // Personnes qui l'ont regardée plusieurs fois (visible par l'auteur avec Vim+)
  rewatchedBy?: string[];
}

export interface UserStories {
  userId: string;
  userName: string;
  userPhoto: string | null;
  stories: Story[];
  hasUnviewed: boolean;
}

const STORY_HOURS = 24;

// Champs Firestore du son (vides si pas de son)
export function musicFields(meta?: MusicMeta | null) {
  return {
    musicSoundId: meta?.soundId ?? null,
    musicTitle: meta?.title ?? null,
    musicArtist: meta?.artist ?? null,
    musicCover: meta?.coverURL ?? null,
    musicDuration: meta?.durationSec ?? null,
    musicStart: meta?.startSec ?? null,
    musicClip: meta?.clipSec ?? null,
    musicVolume: meta?.musicVolume ?? null,
    videoVolume: meta?.videoVolume ?? null,
    musicExternalURL: meta?.externalURL ?? null,
  };
}

// Relit les infos du son d'une Story (pour l'étiquette et « Utiliser ce son »)
export function musicMetaOf(s: Partial<Story>): MusicMeta | null {
  if (!s.musicURL) return null;
  return {
    soundId: s.musicSoundId ?? "",
    title: s.musicTitle ?? "Son original",
    artist: s.musicArtist ?? "",
    coverURL: s.musicCover ?? null,
    durationSec: s.musicDuration ?? 0,
    startSec: s.musicStart ?? 0,
    clipSec: s.musicClip ?? 15,
    musicVolume: s.musicVolume ?? 1,
    videoVolume: s.videoVolume ?? 1,
    externalURL: s.musicExternalURL ?? null,
  };
}

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
  musicMeta?: MusicMeta | null,
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
  const visibleTo = await visibleToOf(userId);
  await addDoc(collection(db, "stories"), {
    userId,
    userName,
    userPhoto: userPhoto ?? null,
    visibleTo,
    imageURL: data.secure_url,
    overlayText: overlayText ?? "",
    filterColor: filterColor ?? null,
    filterOpacity: filterOpacity ?? 0,
    musicURL: musicURL ?? null,
    ...musicFields(musicURL ? musicMeta : null),
    createdAt: serverTimestamp(),
    expiresAt: now + STORY_HOURS * 3600 * 1000,
    viewedBy: [],
  });
}

// Envoie une vidéo sur Cloudinary. Renvoie la vidéo en mp4 (lisible partout, même si
// le téléphone a filmé en webm) et sa première image en jpg (aperçu).
export async function uploadVideoToCloudinary(
  videoUri: string,
  folder: string,
): Promise<{ videoURL: string; posterURL: string }> {
  const isWebm = /\.webm($|\?)/i.test(videoUri);
  const formData = new FormData();
  formData.append("file", {
    uri: videoUri,
    type: isWebm ? "video/webm" : "video/mp4",
    name: `video_${Date.now()}.${isWebm ? "webm" : "mp4"}`,
  } as any);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", folder);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`,
    { method: "POST", body: formData },
  );
  const data = await res.json();
  const url: string | undefined = data.secure_url;
  if (!url)
    throw new Error(
      data?.error?.message ??
        "Upload vidéo échoué. Vérifie que le preset Cloudinary est en mode Unsigned.",
    );
  const base = url.replace(/\.[a-z0-9]+$/i, "");
  return {
    videoURL: `${base}.mp4`,
    // so_0 = image à 0 seconde
    posterURL: `${base.replace("/video/upload/", "/video/upload/so_0/")}.jpg`,
  };
}

export async function createVideoStory(
  userId: string,
  userName: string,
  userPhoto: string | null | undefined,
  videoUri: string,
  musicURL?: string | null,
  musicMeta?: MusicMeta | null,
): Promise<void> {
  const { videoURL, posterURL } = await uploadVideoToCloudinary(
    videoUri,
    `stories/${userId}`,
  );
  const now = Date.now();
  const visibleTo = await visibleToOf(userId);
  await addDoc(collection(db, "stories"), {
    userId,
    userName,
    userPhoto: userPhoto ?? null,
    visibleTo,
    videoURL,
    // L'aperçu est aussi rangé dans imageURL : un lecteur de Story qui ne gère pas
    // encore la vidéo affiche au moins la première image.
    imageURL: posterURL,
    overlayText: "",
    filterColor: null,
    filterOpacity: 0,
    musicURL: musicURL ?? null,
    ...musicFields(musicURL ? musicMeta : null),
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
  const visibleTo = await visibleToOf(userId);
  await addDoc(collection(db, "stories"), {
    userId,
    userName,
    userPhoto: userPhoto ?? null,
    visibleTo,
    text,
    bgColor,
    textColor,
    createdAt: serverTimestamp(),
    expiresAt: now + STORY_HOURS * 3600 * 1000,
    viewedBy: [],
  });
}

function toStory(d: any): Story {
  const data = d.data();
  const ms = (v: any, fallback: number) =>
    v instanceof Timestamp ? v.toMillis() : typeof v === "number" ? v : fallback;
  return {
    id: d.id,
    ...data,
    createdAt: ms(data.createdAt, Date.now()),
    expiresAt: ms(data.expiresAt, 0),
    viewedBy: data.viewedBy ?? [],
    rewatchedBy: data.rewatchedBy ?? [],
  } as Story;
}

// Stories à afficher : non expirées, groupées par personne (moi d'abord, puis les amis)
export function buildUserStories(
  stories: Story[],
  userIds: string[],
  myUserId: string,
  now = Date.now(),
): UserStories[] {
  const grouped: Record<string, Story[]> = {};
  for (const story of stories) {
    if (story.expiresAt <= now) continue;
    (grouped[story.userId] ??= []).push(story);
  }
  const result: UserStories[] = [];
  for (const uid of userIds) {
    const list = grouped[uid];
    if (!list) continue;
    list.sort((a, b) => a.createdAt - b.createdAt);
    result.push({
      userId: uid,
      userName: list[0].userName,
      userPhoto: list[0].userPhoto,
      stories: list,
      hasUnviewed: list.some((s) => !s.viewedBy.includes(myUserId)),
    });
  }
  return result;
}

// Qui peut voir une story : mes amis AU MOMENT de la publication. Cette liste est enregistrée dans la
// story (« visibleTo ») et les règles de sécurité n'autorisent la lecture qu'à ces personnes et à moi.
const MAX_VISIBLE = 1000;
export async function getFriendIds(userId: string): Promise<string[]> {
  const snap = await getDocs(
    query(collection(db, "friends"), where("userId", "==", userId)),
  );
  const ids = new Set<string>();
  snap.docs.forEach((d) => {
    const id = d.data().id;
    if (typeof id === "string" && id) ids.add(id);
  });
  return [...ids].slice(0, MAX_VISIBLE);
}

// Mes amis, sauf ceux à qui j'ai choisi de cacher mes stories (fiche d'ami > Réglages de la Story)
export async function visibleToOf(userId: string): Promise<string[]> {
  const [ids, prefs] = await Promise.all([getFriendIds(userId), loadPrefs(userId)]);
  const hidden = new Set(prefs.storyHidden);
  return ids.filter((id) => !hidden.has(id));
}

// Retire un ami de la liste de mes stories DÉJÀ publiées (les règles ne laissent modifier que les siennes)
export async function hideMyStoriesFrom(me: string, friendId: string, now = Date.now()): Promise<number> {
  const snap = await getDocs(query(collection(db, "stories"), where("userId", "==", me)));
  const mine = snap.docs.filter(
    (d) => toStory(d).expiresAt > now && ((d.data() as any).visibleTo ?? []).includes(friendId),
  );
  await Promise.all(mine.map((d) => updateDoc(d.ref, { visibleTo: arrayRemove(friendId) })));
  return mine.length;
}

export async function getFriendsStories(
  myUserId: string,
  friendIds: string[],
): Promise<UserStories[]> {
  const userIds = [myUserId, ...friendIds];
  const [others, mine] = await Promise.all([
    getDocs(query(collection(db, "stories"), where("visibleTo", "array-contains", myUserId))),
    getDocs(query(collection(db, "stories"), where("userId", "==", myUserId))),
  ]);
  const all = new Map<string, Story>();
  [...others.docs, ...mine.docs].forEach((d) => all.set(d.id, toStory(d)));
  return buildUserStories([...all.values()], userIds, myUserId);
}

// Stories EN DIRECT : une nouvelle story (ou une story vue) apparaît tout de suite,
// sans quitter l'écran ; les stories de plus de 24 h disparaissent toutes seules.
export function subscribeFriendsStories(
  myUserId: string,
  friendIds: string[],
  onUpdate: (stories: UserStories[]) => void,
): () => void {
  const userIds = [myUserId, ...friendIds];
  let others: Story[] = [];
  let mine: Story[] = [];
  const emit = () => {
    const all = new Map<string, Story>();
    [...others, ...mine].forEach((s) => all.set(s.id, s));
    onUpdate(buildUserStories([...all.values()], userIds, myUserId));
  };
  const u1 = onSnapshot(
    query(collection(db, "stories"), where("visibleTo", "array-contains", myUserId)),
    (snap) => {
      others = snap.docs.map(toStory);
      emit();
    },
    () => {},
  );
  const u2 = onSnapshot(
    query(collection(db, "stories"), where("userId", "==", myUserId)),
    (snap) => {
      mine = snap.docs.map(toStory);
      emit();
    },
    () => {},
  );
  const timer = setInterval(emit, 60000);
  return () => {
    u1();
    u2();
    clearInterval(timer);
  };
}

// Efface MES stories expirées (les règles ne laissent supprimer que ses propres stories) :
// la collection ne grossit pas indéfiniment, sans serveur ni index.
export async function purgeMyExpiredStories(
  userId: string,
  now = Date.now(),
): Promise<number> {
  const snap = await getDocs(
    query(collection(db, "stories"), where("userId", "==", userId)),
  );
  const expired = snap.docs.filter((d) => toStory(d).expiresAt <= now);
  await Promise.all(expired.map((d) => deleteDoc(d.ref)));
  return expired.length;
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

// Story regardée une nouvelle fois
export async function markStoryRewatched(storyId: string, userId: string): Promise<void> {
  try {
    await updateDoc(doc(db, "stories", storyId), { rewatchedBy: arrayUnion(userId) });
  } catch {}
}

// Supprime une de MES stories (elle disparaît pour tous mes amis)
export async function deleteStory(storyId: string): Promise<void> {
  await deleteDoc(doc(db, "stories", storyId));
}

// Répond à la story d'un ami : le message arrive dans votre conversation privée
export async function replyToStory(
  myId: string,
  myName: string,
  story: Story,
  text: string,
): Promise<void> {
  const clean = text.trim();
  if (!clean) return;
  const cid = getChatId(myId, story.userId);
  await addDoc(collection(db, "friendChats", cid, "messages"), {
    text: `📖 Réponse à ta story\n${clean}`,
    imageURL: null,
    audioURL: null,
    senderUid: myId,
    sentAt: serverTimestamp(),
  });
  notifyFriendMessage(story.userId, myId, myName, clean).catch(() => {});
}
