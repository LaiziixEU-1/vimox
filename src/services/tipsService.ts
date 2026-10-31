import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Astuces « 💡 » : chaque astuce ne s'affiche qu'UNE fois (mémorisé sur le téléphone).
const KEY = "vimox.tipsSeen";
let seen: Set<string> | null = null;

async function load(): Promise<Set<string>> {
  if (seen) return seen;
  try {
    seen = new Set(JSON.parse((await AsyncStorage.getItem(KEY)) ?? "[]"));
  } catch {
    seen = new Set();
  }
  return seen;
}

export async function markTipSeen(id: string) {
  const s = await load();
  if (s.has(id)) return;
  s.add(id);
  AsyncStorage.setItem(KEY, JSON.stringify([...s])).catch(() => {});
}

// Renvoie la première astuce pas encore vue de la liste (après un petit délai), ou null.
export function useNextTip(tips: { id: string; text: string }[], enabled = true, delayMs = 1800) {
  const [tip, setTip] = useState<{ id: string; text: string } | null>(null);
  const ids = tips.map((t) => t.id).join("|");
  useEffect(() => {
    if (!enabled) {
      setTip(null);
      return;
    }
    let alive = true;
    const t = setTimeout(async () => {
      const s = await load();
      const next = tips.find((x) => !s.has(x.id)) ?? null;
      if (alive) setTip(next);
    }, delayMs);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [ids, enabled]);
  const dismiss = () => {
    if (tip) markTipSeen(tip.id);
    setTip(null);
  };
  return { tip, dismiss };
}
