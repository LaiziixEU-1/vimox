import { deleteField, doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../config/firebase";
import { checkText } from "./contentFilter";

// ───────────────────────── Pseudo unique (@pseudo) ─────────────────────────
// Un pseudo = un document « usernames/<pseudo> » { uid } : il n'en existe qu'un par pseudo, et les règles
// de sécurité interdisent de le modifier ou de le prendre à quelqu'un d'autre. Le pseudo est aussi copié dans
// le profil (« username ») et dans l'index de recherche, où les règles vérifient qu'il t'appartient bien.

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 20;

// Mots interdits (les règles de sécurité en tiennent la même liste)
export const RESERVED_HANDLES = [
  "admin", "administrator", "vimox", "support", "moderation", "moderator", "staff", "help", "aide",
  "contact", "team", "equipe", "officiel", "official", "system", "root", "null", "undefined", "anonymous",
];

// Mots clairement abusifs, comparés MOT ENTIER (le pseudo est coupé aux « . », « _ » et aux chiffres) :
// « nazi_88 » est refusé, mais « nazim » (un prénom) ou « essex » passent. Les signalements complètent la liste.
export const OFFENSIVE_TOKENS = new Set([
  "nazi", "hitler", "kkk", "pedo", "pedophile", "paedophile", "loli", "rape", "porn", "porno",
  "nigger", "nigga", "faggot", "isis", "daech",
  "salope", "pute", "putain", "connard", "connasse", "encule", "enculer", "nique", "niquer", "ntm", "fdp",
  "negre", "bougnoule", "youpin",
]);
export function hasOffensiveToken(handle: string): boolean {
  return handle.split(/[._]+|\d+/).some((tok) => tok.length > 0 && OFFENSIVE_TOKENS.has(tok));
}

export type HandleProblem = "short" | "long" | "start" | "chars" | "dots" | "reserved" | "offensive" | "taken";

export class HandleError extends Error {
  problem: HandleProblem;
  constructor(problem: HandleProblem) {
    super(problem);
    this.problem = problem;
  }
}

export const normalizeHandle = (s: string): string => String(s ?? "").trim().replace(/^@+/, "").toLowerCase();

export function validateHandle(
  input: string,
): { ok: true; handle: string } | { ok: false; problem: HandleProblem; handle: string } {
  const handle = normalizeHandle(input);
  const bad = (problem: HandleProblem) => ({ ok: false as const, problem, handle });
  if (handle.length < HANDLE_MIN) return bad("short");
  if (handle.length > HANDLE_MAX) return bad("long");
  if (!/^[a-z0-9._]+$/.test(handle)) return bad("chars");
  if (!/^[a-z]/.test(handle)) return bad("start");
  if (handle.includes("..") || handle.endsWith(".")) return bad("dots");
  if (RESERVED_HANDLES.includes(handle)) return bad("reserved");
  if (hasOffensiveToken(handle)) return bad("offensive");
  if (!checkText(handle).ok || !checkText(handle.replace(/[._]+/g, " ")).ok) return bad("offensive");
  return { ok: true, handle };
}

export function handleProblemText(p: HandleProblem): string {
  switch (p) {
    case "short":
      return `Au moins ${HANDLE_MIN} caractères.`;
    case "long":
      return `${HANDLE_MAX} caractères au maximum.`;
    case "start":
      return "Le pseudo doit commencer par une lettre.";
    case "chars":
      return "Seulement des lettres minuscules sans accent, des chiffres, « . » et « _ ».";
    case "dots":
      return "Pas de points consécutifs, ni de point à la fin.";
    case "reserved":
      return "Ce pseudo n'est pas disponible.";
    case "offensive":
      return "Ce pseudo n'est pas autorisé.";
    case "taken":
      return "Ce pseudo est déjà pris.";
  }
}

export type Availability = "available" | "mine" | "taken";

export async function checkHandleAvailable(handle: string, myId: string): Promise<Availability> {
  const snap = await getDoc(doc(db, "usernames", handle));
  if (!snap.exists()) return "available";
  return (snap.data() as any)?.uid === myId ? "mine" : "taken";
}

const isDenied = (e: any) => /permission|denied|already/i.test(String(e?.code ?? e?.message ?? ""));

// Prend (ou change) son pseudo, en une seule opération atomique : l'ancien est libéré, le nouveau réservé.
// Si quelqu'un l'a pris entre-temps, rien n'est modifié.
export async function claimUsername(uid: string, input: string, oldHandle?: string | null): Promise<string> {
  const v = validateHandle(input);
  if (!v.ok) throw new HandleError(v.problem);
  if (oldHandle && oldHandle === v.handle) return v.handle;
  const batch = writeBatch(db);
  if (oldHandle) batch.delete(doc(db, "usernames", oldHandle));
  batch.set(doc(db, "usernames", v.handle), { uid, createdAt: serverTimestamp() });
  batch.update(doc(db, "users", uid), { username: v.handle });
  try {
    await batch.commit();
  } catch (e) {
    if (isDenied(e)) throw new HandleError("taken");
    throw e;
  }
  return v.handle;
}

// Renonce à son pseudo : il redevient disponible
export async function releaseUsername(uid: string, handle: string): Promise<void> {
  const batch = writeBatch(db);
  batch.delete(doc(db, "usernames", handle));
  batch.update(doc(db, "users", uid), { username: deleteField() });
  await batch.commit();
}
