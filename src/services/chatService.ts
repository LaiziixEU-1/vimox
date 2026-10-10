import { Vibration } from "react-native";
import {
  addDoc,
  arrayUnion,
  arrayRemove,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { ChatMessage } from "../models/types";
import { isSuspicious } from "./abuse";
import { saveLocalHistory } from "./localHistory";
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from "../config/env";

export function listenMessages(
  roomId: string,
  onChange: (messages: ChatMessage[]) => void,
) {
  return onSnapshot(
    query(
      collection(db, "rooms", roomId, "messages"),
      orderBy("sentAt", "asc"),
    ),
    async (snapshot) => {
      const messages = snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          roomId,
          senderId: data.senderId,
          text: data.deleted ? "🚫 Message supprimé" : (data.text ?? ""),
          imageURL: data.deleted ? null : (data.imageURL ?? null),
          sentAt:
            data.sentAt instanceof Timestamp
              ? data.sentAt.toMillis()
              : Date.now(),
          isAbusive: Boolean(data.isAbusive),
          readBy: (data.readBy ?? []) as string[],
          deleted: Boolean(data.deleted),
          reactions: data.reactions ?? {},
          ...(data.type && { type: data.type }),
          ...(data.audioUrl && { audioUrl: data.audioUrl }),
          ...(data.duration && { duration: data.duration }),
          ...(data.gameId && { gameId: data.gameId }),
          ...(data.gameType && { gameType: data.gameType }),
        } as any;
      });
      onChange(messages);
      await saveLocalHistory(roomId, messages);
    },
  );
}

export function listenRoom(
  roomId: string,
  currentUserId: string,
  onChange: (state: { isActive: boolean; partnerId?: string }) => void,
) {
  return onSnapshot(doc(db, "rooms", roomId), (snapshot) => {
    const data = snapshot.data();
    const participants = (data?.participants ?? []) as string[];
    onChange({
      isActive: data?.isActive !== false,
      partnerId: participants.find((id) => id !== currentUserId),
    });
  });
}

export async function sendMessage(
  roomId: string,
  senderId: string,
  text: string,
) {
  const clean = text.trim();
  if (!clean) return;
  await addDoc(collection(db, "rooms", roomId, "messages"), {
    roomId,
    senderId,
    text: clean,
    imageURL: null,
    sentAt: serverTimestamp(),
    isAbusive: isSuspicious(clean),
    readBy: [senderId],
    reported: false,
    deleted: false,
    reactions: {},
  });
  Vibration.vibrate(12);
}

// ── FIX : Cloudinary au lieu de Firebase Storage ──────────────────────────────
export async function sendImageMessage(
  roomId: string,
  senderId: string,
  localUri: string,
): Promise<void> {
  const formData = new FormData();
  formData.append("file", {
    uri: localUri,
    type: "image/jpeg",
    name: `chat_${Date.now()}.jpg`,
  } as any);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", `chats/${roomId}`);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    { method: "POST", body: formData },
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Erreur upload image");
  }

  const data = await response.json();
  const imageURL: string = data.secure_url;

  await addDoc(collection(db, "rooms", roomId, "messages"), {
    roomId,
    senderId,
    text: "",
    imageURL,
    sentAt: serverTimestamp(),
    isAbusive: false,
    readBy: [senderId],
    reported: false,
    deleted: false,
    reactions: {},
  });
  Vibration.vibrate(12);
}

export async function toggleReaction(
  roomId: string,
  messageId: string,
  userId: string,
  emoji: string,
): Promise<void> {
  const msgRef = doc(db, "rooms", roomId, "messages", messageId);
  const { getDoc } = await import("firebase/firestore");
  const snap = await getDoc(msgRef);
  const reactions = snap.data()?.reactions ?? {};
  const users: string[] = reactions[emoji] ?? [];
  const hasReacted = users.includes(userId);
  await updateDoc(msgRef, {
    [`reactions.${emoji}`]: hasReacted
      ? arrayRemove(userId)
      : arrayUnion(userId),
  });
}

export async function deleteMessage(
  roomId: string,
  messageId: string,
): Promise<void> {
  await updateDoc(doc(db, "rooms", roomId, "messages", messageId), {
    deleted: true,
    text: "",
    imageURL: null,
    audioUrl: null,
  });
}

export async function markMessagesAsRead(
  roomId: string,
  messageIds: string[],
  uid: string,
): Promise<void> {
  await Promise.all(
    messageIds.map((msgId) =>
      updateDoc(doc(db, "rooms", roomId, "messages", msgId), {
        readBy: arrayUnion(uid),
      }),
    ),
  );
}

export async function reportMessage(
  roomId: string,
  messageId: string,
): Promise<void> {
  await updateDoc(doc(db, "rooms", roomId, "messages", messageId), {
    reported: true,
  });
}

export async function setTypingStatus(
  roomId: string,
  uid: string,
  isTyping: boolean,
): Promise<void> {
  await updateDoc(doc(db, "rooms", roomId), { [`typing.${uid}`]: isTyping });
}

export function subscribeToTyping(
  roomId: string,
  myUid: string,
  onTyping: (isOtherTyping: boolean) => void,
): () => void {
  return onSnapshot(doc(db, "rooms", roomId), (snap) => {
    const data = snap.data();
    if (!data?.typing) return onTyping(false);
    const otherTyping = Object.entries(data.typing).some(
      ([uid, status]) => uid !== myUid && status === true,
    );
    onTyping(otherTyping);
  });
}

// ── FIX : try/catch pour afficher l'erreur si les règles bloquent ─────────────
export async function leaveRoom(roomId: string, uid: string): Promise<void> {
  try {
    await updateDoc(doc(db, "rooms", roomId), {
      isActive: false,
      endedBy: uid,
      endedAt: serverTimestamp(),
    });
  } catch (e) {
    console.error("leaveRoom error:", e);
    // On laisse quand même naviguer en arrière même si ça échoue
  }
}
