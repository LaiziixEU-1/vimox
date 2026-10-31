/*VIMOX-V25*/
// Logique PURE de la liste des conversations d'amis (statuts façon Snapchat, « Non lu », tri).
// Aucune dépendance à Firebase : testée à part.

export type PreviewKind = "text" | "snap" | "audio" | "photo" | "call";

export type ChatPreview = {
  friendId: string;
  at: number; // heure du dernier message (ms)
  fromMe: boolean;
  kind: PreviewKind;
  snapViewed: boolean;
  unread: boolean;
};

export type ChatFilter = "all" | "unread" | "online";

export const msOf = (v: any, fallback = 0): number =>
  typeof v?.toMillis === "function" ? v.toMillis() : typeof v === "number" ? v : fallback;

export function kindOf(m: any): PreviewKind {
  if (m?.isSnap) return "snap";
  if (typeof m?.type === "string" && m.type.startsWith("call")) return "call";
  if (m?.audioURL) return "audio";
  if (m?.imageURL) return "photo";
  return "text";
}

// Dernier message d'une conversation → aperçu. « Non lu » = quelque chose de nouveau venant de l'ami :
// - un Snap pas encore ouvert (toujours non lu, même ancien) ;
// - un autre message plus récent que ma dernière ouverture de la conversation (et que la date d'installation,
//   pour ne pas tout marquer « non lu » à la première utilisation).
// Les appels ne comptent pas comme « non lu ».
export function computePreview(
  me: string,
  friendId: string,
  m: any | null,
  openedAt: number,
  baseline: number,
): ChatPreview | null {
  if (!m) return null;
  const at = msOf(m.sentAt, Date.now());
  const fromMe = m.senderUid === me;
  const kind = kindOf(m);
  const snapViewed = m.snapViewed === true;
  let unread = false;
  if (!fromMe && m.deleted !== true) {
    if (kind === "snap") unread = !snapViewed;
    else if (kind !== "call") unread = at > Math.max(openedAt, baseline);
  }
  return { friendId, at, fromMe, kind, snapViewed, unread };
}

export function relTime(ms: number, now = Date.now()): string {
  const mins = Math.floor((now - ms) / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} j`;
  return `${Math.floor(d / 7)} sem`;
}

// Ligne de statut sous le prénom (null : pas de message, on garde « En ligne » / « Vu il y a… »)
export function previewLabel(
  p: ChatPreview | undefined,
  now = Date.now(),
): { text: string; unread: boolean; snap: boolean } | null {
  if (!p || !p.at) return null;
  const when = relTime(p.at, now);
  if (p.kind === "call") return { text: `Appel · ${when}`, unread: false, snap: false };
  if (p.fromMe) {
    if (p.kind === "snap")
      return { text: `${p.snapViewed ? "Vim ouvert" : "Vim envoyé"} · ${when}`, unread: false, snap: true };
    return { text: `Envoyé · ${when}`, unread: false, snap: false };
  }
  if (p.kind === "snap") {
    return p.snapViewed
      ? { text: `Vim ouvert · ${when}`, unread: false, snap: true }
      : { text: `Nouveau Vim · ${when}`, unread: true, snap: true };
  }
  if (!p.unread) return { text: `Reçu · ${when}`, unread: false, snap: false };
  const noun = p.kind === "audio" ? "Nouveau message vocal" : p.kind === "photo" ? "Nouvelle photo" : "Nouveau message";
  return { text: `${noun} · ${when}`, unread: true, snap: false };
}

type ChatFriend = { id: string; name: string; isOnline?: boolean; lastSeen?: any };

// Conversations épinglées d'abord (dans l'ordre d'épinglage), puis les plus récentes ; à égalité (ou sans message) :
// en ligne, puis vu récemment, puis ordre alphabétique
export function sortChats<T extends ChatFriend>(
  friends: T[],
  previews: Record<string, ChatPreview>,
  pinned: string[] = [],
): T[] {
  return [...friends].sort((a, b) => {
    const ia = pinned.indexOf(a.id);
    const ib = pinned.indexOf(b.id);
    if ((ia >= 0) !== (ib >= 0)) return ia >= 0 ? -1 : 1;
    if (ia >= 0 && ib >= 0 && ia !== ib) return ia - ib;
    const pa = previews[a.id]?.at ?? 0;
    const pb = previews[b.id]?.at ?? 0;
    if (pa !== pb) return pb - pa;
    if (!!a.isOnline !== !!b.isOnline) return a.isOnline ? -1 : 1;
    const d = msOf(b.lastSeen) - msOf(a.lastSeen);
    if (d !== 0) return d;
    return a.name.localeCompare(b.name);
  });
}

export function filterChats<T extends ChatFriend>(
  friends: T[],
  previews: Record<string, ChatPreview>,
  filter: ChatFilter,
): T[] {
  if (filter === "unread") return friends.filter((f) => previews[f.id]?.unread);
  if (filter === "online") return friends.filter((f) => f.isOnline);
  return friends;
}

export function unreadCount(previews: Record<string, ChatPreview>, friendIds?: string[]): number {
  const ids = friendIds ? new Set(friendIds) : null;
  return Object.values(previews).filter((p) => p.unread && (!ids || ids.has(p.friendId))).length;
}
