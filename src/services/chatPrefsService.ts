import AsyncStorage from "@react-native-async-storage/async-storage";

// Préférences de la liste de conversations, stockées SUR LE TÉLÉPHONE (rien dans la base) :
// conversations épinglées, conversations effacées (chez soi), raccourcis d'envoi de Snaps,
// emojis des niveaux d'amis proches.

export type BadgeLevel = "friend" | "bestie" | "bestie_long";
export type Shortcut = { id: string; name: string; emoji: string; friendIds: string[] };

export type ChatPrefs = {
  pinned: string[]; // identifiants d'amis, dans l'ordre d'épinglage
  best: string[]; // amis épinglés « meilleur·e ami·e » (❤️)
  storyHidden: string[]; // amis à qui je cache MES stories
  storyMuted: string[]; // amis dont je ne vois PAS les stories
  cleared: Record<string, number>; // ami → date (ms) jusqu'à laquelle la conversation est effacée chez moi
  shortcuts: Shortcut[];
  emojis: Partial<Record<BadgeLevel, string>>;
};

export const MAX_PINS = 5;
export const MAX_BEST = 3;
const MAX_STORY_LIST = 500;
export const MAX_SHORTCUTS = 10;
export const MAX_SHORTCUT_MEMBERS = 20;
export const SHORTCUT_NAME_MAX = 20;
export const DEFAULT_EMOJIS: Record<BadgeLevel, string> = { friend: "😊", bestie: "💛", bestie_long: "❤️" };

export type PrefsProblem = "max-pins" | "max-best" | "name-empty" | "name-long" | "name-taken" | "members-few" | "members-many" | "max-shortcuts" | "emoji-invalid";
export class PrefsError extends Error {
  problem: PrefsProblem;
  constructor(problem: PrefsProblem) {
    super(problem);
    this.problem = problem;
  }
}

export const emptyPrefs = (): ChatPrefs => ({ pinned: [], best: [], storyHidden: [], storyMuted: [], cleared: {}, shortcuts: [], emojis: {} });

const KEY = (me: string) => `vimox.chatPrefs.${me}`;
const cache = new Map<string, ChatPrefs>();
const listeners = new Map<string, Set<(p: ChatPrefs) => void>>();

// (tests) remet l'état à zéro
export function resetChatPrefs() {
  cache.clear();
  listeners.clear();
}

function sanitize(raw: any): ChatPrefs {
  const p = emptyPrefs();
  if (Array.isArray(raw?.pinned)) p.pinned = raw.pinned.filter((x: any) => typeof x === "string").slice(0, MAX_PINS);
  const ids = (a: any, max: number): string[] =>
    Array.isArray(a) ? [...new Set<string>(a.filter((x: any) => typeof x === "string"))].slice(0, max) : [];
  p.best = ids(raw?.best, MAX_BEST);
  p.storyHidden = ids(raw?.storyHidden, MAX_STORY_LIST);
  p.storyMuted = ids(raw?.storyMuted, MAX_STORY_LIST);
  if (raw?.cleared && typeof raw.cleared === "object")
    for (const [k, v] of Object.entries(raw.cleared)) if (typeof v === "number") p.cleared[k] = v;
  if (Array.isArray(raw?.shortcuts))
    p.shortcuts = raw.shortcuts
      .filter((s: any) => s && typeof s.id === "string" && typeof s.name === "string" && Array.isArray(s.friendIds))
      .slice(0, MAX_SHORTCUTS)
      .map((s: any) => ({ id: s.id, name: String(s.name).slice(0, SHORTCUT_NAME_MAX), emoji: typeof s.emoji === "string" ? s.emoji : "⚡", friendIds: s.friendIds.filter((x: any) => typeof x === "string").slice(0, MAX_SHORTCUT_MEMBERS) }));
  if (raw?.emojis && typeof raw.emojis === "object")
    for (const lvl of ["friend", "bestie", "bestie_long"] as BadgeLevel[])
      if (typeof raw.emojis[lvl] === "string" && isSingleEmoji(raw.emojis[lvl])) p.emojis[lvl] = raw.emojis[lvl];
  return p;
}

export async function loadPrefs(me: string): Promise<ChatPrefs> {
  const hit = cache.get(me);
  if (hit) return hit;
  let p = emptyPrefs();
  try {
    const raw = await AsyncStorage.getItem(KEY(me));
    if (raw) p = sanitize(JSON.parse(raw));
  } catch {}
  if (!cache.has(me)) cache.set(me, p);
  return cache.get(me)!;
}

export function getPrefs(me: string): ChatPrefs {
  return cache.get(me) ?? emptyPrefs();
}

async function commit(me: string, next: ChatPrefs) {
  cache.set(me, next);
  listeners.get(me)?.forEach((l) => l(next));
  await AsyncStorage.setItem(KEY(me), JSON.stringify(next)).catch(() => {});
}

// Suit les préférences (appelle tout de suite avec les valeurs chargées, puis à chaque changement)
export function subscribePrefs(me: string, cb: (p: ChatPrefs) => void): () => void {
  let set = listeners.get(me);
  if (!set) listeners.set(me, (set = new Set()));
  set.add(cb);
  let alive = true;
  loadPrefs(me).then((p) => alive && cb(p));
  return () => {
    alive = false;
    set!.delete(cb);
  };
}

// ── Conversations épinglées ──
export async function togglePin(me: string, friendId: string): Promise<boolean> {
  const p = await loadPrefs(me);
  if (p.pinned.includes(friendId)) {
    await commit(me, { ...p, pinned: p.pinned.filter((x) => x !== friendId) });
    return false;
  }
  if (p.pinned.length >= MAX_PINS) throw new PrefsError("max-pins");
  await commit(me, { ...p, pinned: [...p.pinned, friendId] });
  return true;
}

// ── Meilleur·e ami·e épinglé·e (❤️) ──
export async function toggleBest(me: string, friendId: string): Promise<boolean> {
  const p = await loadPrefs(me);
  if (p.best.includes(friendId)) {
    await commit(me, { ...p, best: p.best.filter((x) => x !== friendId) });
    return false;
  }
  if (p.best.length >= MAX_BEST) throw new PrefsError("max-best");
  await commit(me, { ...p, best: [...p.best, friendId] });
  return true;
}

// ── Stories : masquer MES stories à un ami / ne plus voir SES stories ──
async function toggleInList(me: string, key: "storyHidden" | "storyMuted", friendId: string): Promise<boolean> {
  const p = await loadPrefs(me);
  const has = p[key].includes(friendId);
  const next = has ? p[key].filter((x) => x !== friendId) : [...p[key], friendId].slice(-MAX_STORY_LIST);
  await commit(me, { ...p, [key]: next });
  return !has;
}
export const toggleStoryHidden = (me: string, friendId: string) => toggleInList(me, "storyHidden", friendId);
export const toggleStoryMuted = (me: string, friendId: string) => toggleInList(me, "storyMuted", friendId);

// ── Effacer une conversation chez soi (l'autre personne la garde) ──
export async function clearConversation(me: string, friendId: string, now = Date.now()) {
  const p = await loadPrefs(me);
  await commit(me, { ...p, cleared: { ...p.cleared, [friendId]: now } });
}

// ── Raccourcis d'envoi de Snaps ──
export async function addShortcut(me: string, input: { name: string; emoji?: string; friendIds: string[] }): Promise<Shortcut> {
  const p = await loadPrefs(me);
  const name = input.name.replace(/\s+/g, " ").trim();
  if (!name) throw new PrefsError("name-empty");
  if (name.length > SHORTCUT_NAME_MAX) throw new PrefsError("name-long");
  if (p.shortcuts.some((s) => s.name.toLowerCase() === name.toLowerCase())) throw new PrefsError("name-taken");
  const friendIds = [...new Set(input.friendIds)].filter(Boolean);
  if (friendIds.length < 2) throw new PrefsError("members-few");
  if (friendIds.length > MAX_SHORTCUT_MEMBERS) throw new PrefsError("members-many");
  if (p.shortcuts.length >= MAX_SHORTCUTS) throw new PrefsError("max-shortcuts");
  const emoji = input.emoji && isSingleEmoji(input.emoji) ? input.emoji : "⚡";
  const sc: Shortcut = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name, emoji, friendIds };
  await commit(me, { ...p, shortcuts: [...p.shortcuts, sc] });
  return sc;
}

export async function deleteShortcut(me: string, id: string) {
  const p = await loadPrefs(me);
  await commit(me, { ...p, shortcuts: p.shortcuts.filter((s) => s.id !== id) });
}

// Membres d'un raccourci qui sont toujours mes amis (un ami supprimé en est retiré à l'usage)
export function activeMembers(sc: Shortcut, friendIds: Iterable<string>): string[] {
  const have = new Set(friendIds);
  return sc.friendIds.filter((id) => have.has(id));
}

// ── Emojis des niveaux d'amis proches ──
// Un seul emoji (éventuellement composé : drapeau, famille, teinte de peau…)
export function isSingleEmoji(s: string): boolean {
  const t = String(s ?? "").trim();
  if (!t || t.length > 16) return false;
  if (!/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(t)) return false;
  const Seg = (Intl as any).Segmenter;
  if (Seg) return [...new Seg(undefined, { granularity: "grapheme" }).segment(t)].length === 1;
  return true;
}

export async function setBestFriendEmoji(me: string, level: BadgeLevel, emoji: string) {
  if (!isSingleEmoji(emoji)) throw new PrefsError("emoji-invalid");
  const p = await loadPrefs(me);
  await commit(me, { ...p, emojis: { ...p.emojis, [level]: emoji.trim() } });
}

export async function resetBestFriendEmojis(me: string) {
  const p = await loadPrefs(me);
  await commit(me, { ...p, emojis: {} });
}

export const emojiFor = (level: BadgeLevel, emojis: ChatPrefs["emojis"]) => emojis[level] ?? DEFAULT_EMOJIS[level];

export function prefsProblemText(p: PrefsProblem): string {
  switch (p) {
    case "max-pins": return `Tu peux épingler ${MAX_PINS} conversations au maximum.`;
    case "max-best": return `Tu peux épingler ${MAX_BEST} meilleur·e·s ami·e·s au maximum.`;
    case "name-empty": return "Donne un nom au raccourci.";
    case "name-long": return `Le nom est limité à ${SHORTCUT_NAME_MAX} caractères.`;
    case "name-taken": return "Tu as déjà un raccourci avec ce nom.";
    case "members-few": return "Choisis au moins 2 amis.";
    case "members-many": return `Un raccourci peut contenir ${MAX_SHORTCUT_MEMBERS} amis au maximum.`;
    case "max-shortcuts": return `Tu peux créer ${MAX_SHORTCUTS} raccourcis au maximum : supprime-en un.`;
    case "emoji-invalid": return "Choisis un seul emoji.";
  }
}
