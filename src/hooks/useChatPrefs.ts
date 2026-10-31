import { useEffect, useState } from "react";
import { ChatPrefs, emptyPrefs, getPrefs, subscribePrefs } from "../services/chatPrefsService";

// Préférences de la liste de conversations (épingles, raccourcis, emojis…), mises à jour en direct
export function useChatPrefs(me?: string): ChatPrefs {
  const [prefs, setPrefs] = useState<ChatPrefs>(() => (me ? getPrefs(me) : emptyPrefs()));
  useEffect(() => {
    if (!me) return;
    return subscribePrefs(me, setPrefs);
  }, [me]);
  return prefs;
}
