import AsyncStorage from "@react-native-async-storage/async-storage";
import { ChatMessage } from "../models/types";

const key = (roomId: string) => `vimox.chat.history.${roomId}`;

export async function saveLocalHistory(roomId: string, messages: ChatMessage[]) {
  await AsyncStorage.setItem(key(roomId), JSON.stringify(messages.slice(-250)));
}

export async function loadLocalHistory(roomId: string): Promise<ChatMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(key(roomId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return []; // copie illisible : on repart de zéro plutôt que de planter
  }
}

export async function clearLocalHistory(roomId: string) {
  await AsyncStorage.removeItem(key(roomId));
}

// Déconnexion / suppression de compte : plus aucune conversation ne reste sur le téléphone
export async function clearAllLocalHistory() {
  const keys = await AsyncStorage.getAllKeys();
  const mine = keys.filter((k) => k.startsWith("vimox.chat.history."));
  if (mine.length) await AsyncStorage.multiRemove(mine);
}

