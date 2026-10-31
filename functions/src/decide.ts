// Décision de suspension : fonction pure (sans Firebase), donc testable.
// Les seuils sont les MÊMES que dans l'application (src/services/suspension.ts).
export const WINDOW_HOURS = 24;
export const SUSPEND_AFTER_REPORTERS = 3; // personnes différentes qui signalent
export const SUSPEND_AFTER_FILTER_HITS = 5; // messages refusés par le filtre
export const SUSPENSION_HOURS = 24;

export type ReportLite = {
  type?: string;
  reporterId?: string;
  createdAtMs: number;
};

export function decide(reports: ReportLite[], reportedId: string, now: number) {
  const since = now - WINDOW_HOURS * 3600 * 1000;
  const reporters = new Set<string>();
  let filterHits = 0;
  for (const r of reports) {
    if (r.createdAtMs < since) continue;
    if (r.type === "autoFilter") filterHits++;
    // On ne compte que les signalements faits par quelqu'un d'autre
    else if (r.reporterId && r.reporterId !== reportedId) reporters.add(r.reporterId);
  }
  const suspend =
    reporters.size >= SUSPEND_AFTER_REPORTERS || filterHits >= SUSPEND_AFTER_FILTER_HITS;
  return { distinctReporters: reporters.size, filterHits, suspend };
}
