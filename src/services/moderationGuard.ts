import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase";
import { CATEGORY_MESSAGE, checkText } from "./contentFilter";
import { REPORT_RETENTION_MS } from "./moderationService";

// Après 3 messages refusés en 10 minutes, l'envoi est mis en pause 2 minutes (frein à l'insistance).
const WINDOW_MS = 10 * 60 * 1000;
const MAX_STRIKES = 3;
const LOCK_MS = 2 * 60 * 1000;

let strikes: number[] = [];
let lockedUntil = 0;

export type Verdict = { ok: true } | { ok: false; message: string };

// Vérifie un texte avant envoi. Refusé → message à montrer à la personne ; un signalement
// automatique (catégorie seulement, JAMAIS le texte) est enregistré pour repérer les récidivistes.
export async function guardText(
  text: string,
  ctx: { userId: string; where: string },
): Promise<Verdict> {
  const now = Date.now();
  if (now < lockedUntil) {
    const s = Math.ceil((lockedUntil - now) / 1000);
    return {
      ok: false,
      message: `Plusieurs messages non autorisés d'affilée : réessaie dans ${s} s.`,
    };
  }
  const res = checkText(text);
  if (res.ok) return { ok: true };

  strikes = strikes.filter((t) => now - t < WINDOW_MS);
  strikes.push(now);
  if (strikes.length >= MAX_STRIKES) {
    lockedUntil = now + LOCK_MS;
    strikes = [];
  }
  addDoc(collection(db, "reports"), {
    type: "autoFilter",
    category: res.category,
    reporterId: ctx.userId,
    reportedId: ctx.userId,
    where: ctx.where,
    createdAt: serverTimestamp(),
    expireAt: new Date(Date.now() + REPORT_RETENTION_MS),
  }).catch(() => {});
  return { ok: false, message: CATEGORY_MESSAGE[res.category] };
}

// Pour les tests
export function __resetGuard() {
  strikes = [];
  lockedUntil = 0;
}
