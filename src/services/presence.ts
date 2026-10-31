// Présence « en ligne » fiable.
// Le champ isOnline seul ne suffit pas : si l'app est fermée de force, il reste à « true ».
// On exige donc aussi un signe de vie récent (lastSeen), mis à jour toutes les minutes.

export const HEARTBEAT_MS = 60_000;
const FRESH_MS = 150_000;

export function toMs(v: any): number {
  if (!v) return 0;
  if (typeof v?.toMillis === "function") return v.toMillis();
  if (typeof v === "number") return v;
  if (typeof v?.seconds === "number") return v.seconds * 1000;
  return 0;
}

export function isReallyOnline(
  u?: { isOnline?: boolean; lastSeen?: any; showOnlineStatus?: boolean } | null,
  now = Date.now(),
): boolean {
  if (!u || u.isOnline !== true) return false;
  if (u.showOnlineStatus === false) return false;
  const seen = toMs(u.lastSeen);
  // lastSeen pas encore connu (écriture en cours) : on fait confiance à isOnline
  if (!seen) return true;
  return now - seen < FRESH_MS;
}
