import AsyncStorage from "@react-native-async-storage/async-storage";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../config/firebase";
import { getChatId } from "./snapService";
import type { ChatPreview } from "./chatListLogic";
import { computePreview, msOf } from "./chatListLogic";
import { getPrefs, subscribePrefs } from "./chatPrefsService";

// Suivi du dernier message de chaque conversation d'amis + de ce que j'ai déjà ouvert.
// Tout se calcule sur le téléphone : aucune donnée en plus dans la base, aucune règle à changer.

const MAX_OPENED = 300;
const OPEN_KEY = (me: string) => `vimox.chatOpened.${me}`;
const BASE_KEY = (me: string) => `vimox.chatBaseline.${me}`;

const opened = new Map<string, Record<string, number>>(); // moi → conversation → dernière ouverture (ms)
const baselines = new Map<string, number>(); // moi → date de première utilisation de cette fonction
const listeners = new Set<() => void>();
let persistTimer: ReturnType<typeof setTimeout> | null = null;

// (tests) remet l'état à zéro
export function resetChatState() {
  opened.clear();
  baselines.clear();
  listeners.clear();
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = null;
}

export async function loadChatState(me: string): Promise<void> {
  if (opened.has(me) && baselines.has(me)) return;
  try {
    const raw = await AsyncStorage.getItem(OPEN_KEY(me));
    opened.set(me, raw ? (JSON.parse(raw) as Record<string, number>) : {});
  } catch {
    opened.set(me, {});
  }
  // Date de référence : les messages antérieurs ne sont pas marqués « non lu » à la première utilisation
  let base = 0;
  try {
    base = Number(await AsyncStorage.getItem(BASE_KEY(me))) || 0;
  } catch {}
  if (!base) {
    base = Date.now();
    await AsyncStorage.setItem(BASE_KEY(me), String(base)).catch(() => {});
  }
  baselines.set(me, base);
}

function persist(me: string) {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    const m = opened.get(me) ?? {};
    const entries = Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, MAX_OPENED);
    AsyncStorage.setItem(OPEN_KEY(me), JSON.stringify(Object.fromEntries(entries))).catch(() => {});
  }, 300);
}

// À appeler quand la conversation est ouverte (et à chaque message qui y arrive tant qu'elle l'est)
// Dernière ouverture d'une conversation (0 si jamais ouverte) : sert à la ligne « Nouveaux messages »
export function getChatOpenedAt(me: string, friendId: string): number {
  return opened.get(me)?.[getChatId(me, friendId)] ?? 0;
}

export function markChatOpened(me: string, friendId: string, now = Date.now()) {
  if (!me || !friendId) return;
  const m = opened.get(me) ?? {};
  m[getChatId(me, friendId)] = now;
  opened.set(me, m);
  persist(me);
  listeners.forEach((l) => l());
}

export function subscribeChatPreviews(
  me: string,
  friendIds: string[],
  onUpdate: (previews: Record<string, ChatPreview>) => void,
): () => void {
  let alive = true;
  let scheduled = false;
  const last: Record<string, any | null> = {};
  const emit = () => {
    scheduled = false;
    if (!alive) return;
    const o = opened.get(me) ?? {};
    const base = baselines.get(me) ?? 0;
    const out: Record<string, ChatPreview> = {};
    const cleared = getPrefs(me).cleared;
    for (const fid of friendIds) {
      // Conversation effacée chez moi : seuls les messages plus récents comptent
      const m = last[fid] && msOf(last[fid].sentAt, Date.now()) > (cleared[fid] ?? 0) ? last[fid] : null;
      const p = computePreview(me, fid, m, o[getChatId(me, fid)] ?? 0, base);
      if (p) out[fid] = p;
    }
    onUpdate(out);
  };
  // Regroupe les mises à jour rapprochées (au démarrage, une par ami) en une seule
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    Promise.resolve().then(emit);
  };
  const unsubs: (() => void)[] = [];
  // Effacer une conversation (ou changer les préférences) met la liste à jour tout de suite
  const stopPrefs = subscribePrefs(me, () => schedule());
  loadChatState(me).then(() => {
    if (!alive) return;
    for (const fid of friendIds) {
      const cid = getChatId(me, fid);
      unsubs.push(
        onSnapshot(
          query(collection(db, "friendChats", cid, "messages"), orderBy("sentAt", "desc"), limit(1)),
          (snap) => {
            last[fid] = snap.docs[0]?.data() ?? null;
            schedule();
          },
          () => {},
        ),
      );
    }
    schedule();
  });
  listeners.add(schedule);
  return () => {
    alive = false;
    listeners.delete(schedule);
    stopPrefs();
    unsubs.forEach((u) => u());
  };
}
