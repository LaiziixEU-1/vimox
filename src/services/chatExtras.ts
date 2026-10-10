import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from "../config/env";

export async function uploadDocument(
  uri: string,
  name: string,
): Promise<string> {
  const formData = new FormData();
  formData.append("file", {
    uri,
    type: "application/octet-stream",
    name,
  } as any);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  formData.append("folder", "documents");
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/raw/upload`,
    { method: "POST", body: formData },
  );
  const data = await res.json();
  if (!data.secure_url) throw new Error("Upload du document échoué.");
  return data.secure_url as string;
}

export async function sendDocumentMessage(
  roomId: string,
  senderId: string,
  url: string,
  name: string,
) {
  await addDoc(collection(db, "rooms", roomId, "messages"), {
    type: "document",
    documentUrl: url,
    documentName: name,
    senderId,
    createdAt: serverTimestamp(),
    sentAt: Date.now(),
    readBy: [senderId],
  });
}

export async function sendLocationMessage(
  roomId: string,
  senderId: string,
  latitude: number,
  longitude: number,
) {
  await addDoc(collection(db, "rooms", roomId, "messages"), {
    type: "location",
    latitude,
    longitude,
    senderId,
    createdAt: serverTimestamp(),
    sentAt: Date.now(),
    readBy: [senderId],
  });
}

export async function sendContactMessage(
  roomId: string,
  senderId: string,
  contactName: string,
  phone: string,
) {
  await addDoc(collection(db, "rooms", roomId, "messages"), {
    type: "contact",
    contactName,
    phone,
    senderId,
    createdAt: serverTimestamp(),
    sentAt: Date.now(),
    readBy: [senderId],
  });
}

export async function sendReplyTextMessage(
  roomId: string,
  senderId: string,
  text: string,
  replyToId: string,
  replyToText: string,
  replyToSenderId: string,
) {
  await addDoc(collection(db, "rooms", roomId, "messages"), {
    type: "text",
    text,
    senderId,
    replyToId,
    replyToText,
    replyToSenderId,
    createdAt: serverTimestamp(),
    sentAt: Date.now(),
    readBy: [senderId],
  });
}

export async function editTextMessage(
  roomId: string,
  messageId: string,
  newText: string,
) {
  await updateDoc(doc(db, "rooms", roomId, "messages", messageId), {
    text: newText,
    edited: true,
  });
}

// Indicateurs "enregistre un audio...", "choisit un GIF...", "prend une photo..."
export async function setActivityStatus(
  roomId: string,
  userId: string,
  activity: "recording" | "gif" | "photo" | null,
) {
  const ref = doc(db, "rooms", roomId, "activity", userId);
  if (activity === null) {
    await deleteDoc(ref).catch(() => {});
  } else {
    await setDoc(ref, { activity, updatedAt: serverTimestamp() });
  }
}

export function subscribeActivity(
  roomId: string,
  otherUserId: string,
  onUpdate: (activity: string | null) => void,
) {
  return onSnapshot(
    doc(db, "rooms", roomId, "activity", otherUserId),
    (snap) => {
      if (!snap.exists()) {
        onUpdate(null);
        return;
      }
      onUpdate(snap.data()?.activity ?? null);
    },
  );
}
