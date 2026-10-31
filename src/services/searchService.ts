import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { normalizeHandle } from "./usernameService";

// ───────────────────────── Recherche d'amis et suggestions ─────────────────────────
// La liste de TOUS les profils n'est pas consultable (confidentialité). La recherche passe donc par un
// index MINIMAL et VOLONTAIRE (collection « searchIndex ») : prénom, photo et pays, rien d'autre, et
// seulement pour les personnes qui acceptent d'être trouvées (réglage « Apparaître dans la recherche »).
// - Adultes : visibles par défaut. Moins de 18 ans : invisibles par défaut (la personne peut l'activer).
// - Adultes et mineurs ne se trouvent pas entre eux (ni en recherche, ni en suggestions).
// - Suggestions : les personnes DÉJÀ RENCONTRÉES en match, puis (adultes seulement) des personnes du même pays.

export type PersonResult = {
  id: string;
  name: string;
  username?: string | null;
  photo: string | null;
  country: string;
};
export type Suggestion = PersonResult & { reason: "met" | "nearby" };

export const MIN_QUERY = 2;
const RESULT_LIMIT = 25;
const ROOMS_SAMPLE = 60; // salles lues pour retrouver les personnes rencontrées
const MAX_PROFILES = 20; // profils lus au maximum
const CACHE_MS = 5 * 60 * 1000;
const DISMISS_MAX = 300;

// « Élodie  » → « elodie » : sans accents, sans majuscules, espaces simplifiés
export function normalizeName(s: string): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 40);
}

export const isAdult = (age?: number) => (age ?? 0) >= 18;

// Par défaut : visible si adulte, invisible si mineur ; le réglage de la personne l'emporte
export function isDiscoverable(p: { age?: number; discoverable?: boolean }): boolean {
  return p.discoverable ?? isAdult(p.age);
}

// Paquet (0 à 9) stable, pour tirer des suggestions différentes à chaque ouverture sans index composé
export function bucketOf(uid: string): number {
  let sum = 0;
  for (const c of uid) sum += c.charCodeAt(0);
  return sum % 10;
}

type ProfileLike = {
  id: string;
  name: string;
  age?: number;
  country?: string;
  profilePhotoURL?: string | null;
  discoverable?: boolean;
  username?: string | null;
};

function indexFieldsOf(p: ProfileLike) {
  return {
    uid: p.id,
    name: String(p.name ?? "").slice(0, 40),
    nameLower: normalizeName(p.name),
    // Le pseudo n'est écrit que s'il existe (les règles vérifient qu'il appartient bien à la personne)
    ...(p.username ? { username: String(p.username) } : {}),
    photo: p.profilePhotoURL ?? null,
    country: String(p.country ?? "").slice(0, 60),
    adult: isAdult(p.age),
    bucket: bucketOf(p.id),
  };
}

const KEY = (uid: string) => `vimox.searchIndex.${uid}`;

// Aligne l'index sur le profil : crée / met à jour si la personne est trouvable, supprime sinon.
// N'écrit que si quelque chose a changé depuis la dernière fois (clé mémorisée sur le téléphone).
export async function syncSearchIndex(p: ProfileLike): Promise<"created" | "deleted" | "unchanged"> {
  const fields = indexFieldsOf(p);
  const on = isDiscoverable(p) && fields.nameLower.length > 0;
  const key = on ? JSON.stringify(fields) : "off";
  const last = await AsyncStorage.getItem(KEY(p.id)).catch(() => null);
  if (last === key) return "unchanged";
  if (on) await setDoc(doc(db, "searchIndex", p.id), { ...fields, updatedAt: serverTimestamp() });
  else await deleteDoc(doc(db, "searchIndex", p.id));
  await AsyncStorage.setItem(KEY(p.id), key).catch(() => {});
  return on ? "created" : "deleted";
}

// Suppression du compte : la personne disparaît de la recherche
export async function removeFromSearchIndex(uid: string): Promise<void> {
  await deleteDoc(doc(db, "searchIndex", uid)).catch(() => {});
  await AsyncStorage.removeItem(KEY(uid)).catch(() => {});
}

// ───────────────────────── Recherche par prénom ou par @pseudo ─────────────────────────
export async function searchPeople(
  text: string,
  me: { id: string; age?: number },
  hideIds: Iterable<string> = [],
): Promise<PersonResult[]> {
  const raw = String(text ?? "").trim();
  const handleMode = raw.startsWith("@"); // « @elif » : on cherche seulement des pseudos
  const q = handleMode ? "" : normalizeName(raw);
  const h = normalizeHandle(raw);
  const handleQ = /^[a-z0-9._]+$/.test(h) ? h : "";
  const wantName = q.length >= MIN_QUERY;
  const wantHandle = handleQ.length >= MIN_QUERY;
  if (!wantName && !wantHandle) return [];
  const hidden = new Set(hideIds);
  const col = collection(db, "searchIndex");
  const jobs = [];
  if (wantName)
    jobs.push(getDocs(query(col, where("nameLower", ">=", q), where("nameLower", "<", q + "\uf8ff"), limit(RESULT_LIMIT))));
  if (wantHandle)
    jobs.push(getDocs(query(col, where("username", ">=", handleQ), where("username", "<", handleQ + "\uf8ff"), limit(RESULT_LIMIT))));
  const snaps = await Promise.all(jobs);
  const myAdult = isAdult(me.age);
  const merged = new Map<string, any>();
  for (const snap of snaps) for (const d of snap.docs) merged.set(d.id, d.data());
  return [...merged.values()]
    .filter(
      (x) =>
        x.uid &&
        x.uid !== me.id &&
        !hidden.has(x.uid) &&
        x.adult === myAdult, // adultes et mineurs ne se trouvent pas entre eux
    )
    .sort((a, b) => {
      // pseudo exact, puis prénom exact, puis ordre alphabétique
      const rank = (x: any) => (handleQ && x.username === handleQ ? 0 : wantName && x.nameLower === q ? 1 : 2);
      const d = rank(a) - rank(b);
      if (d !== 0) return d;
      return String(a.nameLower).localeCompare(String(b.nameLower));
    })
    .map((x) => ({
      id: x.uid,
      name: x.name,
      username: x.username ?? null,
      photo: x.photo ?? null,
      country: x.country ?? "",
    }));
}

// ───────────────────────── Suggestions ─────────────────────────
const toMs = (v: any): number =>
  typeof v?.toMillis === "function" ? v.toMillis() : typeof v === "number" ? v : 0;

export async function getDismissed(uid: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(`vimox.dismissed.${uid}`);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

// La croix d'une suggestion : elle ne reviendra plus
export async function dismissSuggestion(uid: string, otherId: string): Promise<void> {
  const set = await getDismissed(uid);
  set.delete(otherId);
  const list = [...set, otherId].slice(-DISMISS_MAX);
  await AsyncStorage.setItem(`vimox.dismissed.${uid}`, JSON.stringify(list)).catch(() => {});
  cache.delete(uid);
}

type MeLike = { id: string; age?: number; country?: string; blockedUserIds?: string[] };
const cache = new Map<string, { at: number; met: Suggestion[]; nearby: Suggestion[] }>();
export function clearSuggestionsCache() {
  cache.clear();
}

async function metBefore(me: MeLike, skip: Set<string>): Promise<Suggestion[]> {
  const snap = await getDocs(
    query(collection(db, "rooms"), where("participants", "array-contains", me.id), limit(ROOMS_SAMPLE)),
  );
  const last = new Map<string, number>();
  for (const r of snap.docs) {
    const data = r.data() as any;
    const other = (data.participants ?? []).find((p: string) => p !== me.id);
    if (!other || skip.has(other)) continue;
    const ms = toMs(data.createdAt);
    last.set(other, Math.max(last.get(other) ?? 0, ms));
  }
  const ids = [...last.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id).slice(0, MAX_PROFILES);
  const out: Suggestion[] = [];
  const now = Date.now();
  for (let i = 0; i < ids.length; i += 10) {
    const profiles = await Promise.all(ids.slice(i, i + 10).map((id) => getDoc(doc(db, "users", id))));
    profiles.forEach((s, k) => {
      const d = s.exists() ? (s.data() as any) : null;
      if (!d || !d.name) return;
      if ((d.blockedUserIds ?? []).includes(me.id)) return; // la personne m'a bloqué
      if (toMs(d.suspendedUntil) > now) return; // compte suspendu
      out.push({ id: ids[i + k], name: d.name, username: d.username ?? null, photo: d.profilePhotoURL ?? null, country: d.country ?? "", reason: "met" });
    });
  }
  return out;
}

async function nearby(me: MeLike, skip: Set<string>, rng: () => number): Promise<Suggestion[]> {
  // Réservé aux adultes : jamais de suggestion de personnes inconnues pour les moins de 18 ans
  if (!isAdult(me.age) || !me.country) return [];
  const buckets = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => rng() - 0.5).slice(0, 3);
  const out: Suggestion[] = [];
  const seen = new Set<string>();
  for (const b of buckets) {
    const snap = await getDocs(
      query(
        collection(db, "searchIndex"),
        where("country", "==", me.country),
        where("bucket", "==", b),
        limit(15),
      ),
    );
    for (const d of snap.docs) {
      const x = d.data() as any;
      if (!x.uid || x.uid === me.id || skip.has(x.uid) || seen.has(x.uid) || x.adult !== true) continue;
      seen.add(x.uid);
      out.push({ id: x.uid, name: x.name, username: x.username ?? null, photo: x.photo ?? null, country: x.country ?? "", reason: "nearby" });
    }
  }
  return out.sort(() => rng() - 0.5).slice(0, 12);
}

export async function loadSuggestions(
  me: MeLike,
  exclude: { friendIds: Iterable<string>; pendingIds: Iterable<string> },
  rng: () => number = Math.random,
): Promise<{ metBefore: Suggestion[]; nearby: Suggestion[] }> {
  const dismissed = await getDismissed(me.id);
  const skip = new Set<string>([
    me.id,
    ...exclude.friendIds,
    ...exclude.pendingIds,
    ...(me.blockedUserIds ?? []),
    ...dismissed,
  ]);
  let entry = cache.get(me.id);
  if (!entry || Date.now() - entry.at > CACHE_MS) {
    const met = await metBefore(me, skip);
    const metIds = new Set(met.map((m) => m.id));
    const near = (await nearby(me, new Set([...skip, ...metIds]), rng)).filter((n) => !metIds.has(n.id));
    entry = { at: Date.now(), met, nearby: near };
    cache.set(me.id, entry);
  }
  // Les exclusions « vivantes » (amis, demandes, croix) s'appliquent aussi aux résultats en cache
  const keep = (s: Suggestion) => !skip.has(s.id);
  return { metBefore: entry.met.filter(keep), nearby: entry.nearby.filter(keep) };
}
