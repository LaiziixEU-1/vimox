import { Vibration } from "react-native";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp
} from "firebase/firestore";
import { db } from "../config/firebase";
import { ChatMessage } from "../models/types";
import { isSuspicious } from "./abuse";
import { saveLocalHistory } from "./localHistory";

export function listenMessages(roomId: string, onChange: (messages: ChatMessage[]) => void) {
  return onSnapshot(
    query(collection(db, "rooms", roomId, "messages"), orderBy("sentAt", "asc")),
    async (snapshot) => {
      const messages = snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          roomId,
          senderId: data.senderId,
          text: data.text,
          sentAt: data.sentAt instanceof Timestamp ? data.sentAt.toMillis() : Date.now(),
          isAbusive: Boolean(data.isAbusive)
        };
      });
      onChange(messages);
      await saveLocalHistory(roomId, messages);
    }
  );
}

export function listenRoom(roomId: string, currentUserId: string, onChange: (state: { isActive: boolean; partnerId?: string }) => void) {
  return onSnapshot(doc(db, "rooms", roomId), (snapshot) => {
    const data = snapshot.data();
    const participants = (data?.participants ?? []) as string[];
    onChange({
      isActive: data?.isActive !== false,
      partnerId: participants.find((id) => id !== currentUserId)
    });
  });
}

export async function sendMessage(roomId: string, senderId: string, text: string) {
  const clean = text.trim();
  if (!clean) return;
  await addDoc(collection(db, "rooms", roomId, "messages"), {
    roomId,
    senderId,
    text: clean,
    sentAt: serverTimestamp(),
    isAbusive: isSuspicious(clean)
  });
  Vibration.vibrate(12);
}
