// Suspension de compte (posée côté serveur après plusieurs signalements, voir functions/).
// Le champ « suspendedUntil » du profil peut être un Timestamp Firestore, un nombre ou une Date.
export function suspendedUntilMs(profile: any): number {
  const v = profile?.suspendedUntil;
  if (!v) return 0;
  if (typeof v?.toMillis === "function") return v.toMillis();
  if (typeof v === "number") return v;
  if (v instanceof Date) return v.getTime();
  return 0;
}

export function isSuspended(profile: any, now: number = Date.now()): boolean {
  return suspendedUntilMs(profile) > now;
}

// Décision de suspension (utilisée par la fonction serveur ET testée ici) :
// 3 personnes différentes qui signalent en 24 h, ou 5 refus du filtre en 24 h.
export const SUSPEND_AFTER_REPORTERS = 3;
export const SUSPEND_AFTER_FILTER_HITS = 5;
export const SUSPENSION_HOURS = 24;

export function shouldSuspend(input: { distinctReporters: number; filterHits: number }): boolean {
  return (
    input.distinctReporters >= SUSPEND_AFTER_REPORTERS ||
    input.filterHits >= SUSPEND_AFTER_FILTER_HITS
  );
}
