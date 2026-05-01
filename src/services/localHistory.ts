import AsyncStorage from "@react-native-async-storage/async-storage";
import { ChatMessage } from "../models/types";

const key = (roomId: string) => `vimox.chat.history.${roomId}`;

export async function saveLocalHistory(roomId: string, messages: ChatMessage[]) {
  await AsyncStorage.setItem(key(roomId), JSON.stringify(messages.slice(-250)));
}

export async function loadLocalHistory(roomId: string): Promise<ChatMessage[]> {
  const raw = await AsyncStorage.getItem(key(roomId));
  return raw ? JSON.parse(raw) : [];
}

