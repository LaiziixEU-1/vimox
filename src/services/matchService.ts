import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { VimoXUser } from "../models/types";
import { logDenied } from "./firestoreErrors";

export type MatchMode = "text" | "video";

export interface Filters {
  gender?: string;
  country?: string;
  // Vim+ : plusieurs pays à la fois
  countries?: string[];
  ageMin: number;
  ageMax: number;
  mode?: MatchMode;
  interests?: string[];
}

// ─────────────────────────────────────────────────────────────
// SÉCURITÉ : tranches d'âge. Un mineur (16-17 ans) n'est JAMAIS mis en relation
// avec un adulte, quels que soient les filtres. C'est la règle non négociable de l'app.
// (Les règles Firestore l'imposent aussi côté serveur.)
// ─────────────────────────────────────────────────────────────
export type AgeBand = "minor" | "adult";
export function ageBandOf(age: number | undefined): AgeBand {
  return (age ?? 0) < 18 ? "minor" : "adult";
}
export function ageLimitsFor(age: number | undefined): { min: number; max: number } {
  return ageBandOf(age) === "minor" ? { min: 16, max: 17 } : { min: 18, max: 99 };
}

const COOLDOWN_MS = 30 * 60 * 1000; // pas la même personne avant 30 min
const WIDEN_COUNTRY_MS = 8000; // après 8 s, le pays devient une préférence
const WIDEN_GENDER_MS = 16000; // après 16 s, le genre devient une préférence
const WIDEN_INTERESTS_MS = 6000; // après 6 s, plus besoin d'intérêt commun
const GHOST_MS = 20000; // sans signe de vie depuis 20 s = recherche abandonnée
const POLL_FAST_MS = 2500;
const POLL_SLOW_MS = 6000; // après 1 min de recherche, on interroge moins souvent
const SLOW_AFTER_MS = 60000;
const CANDIDATES = 60;

// Derniers filtres utilisés : le bouton « Suivant » du chat relance avec les mêmes
let lastFilters: Filters | null = null;
export function getLastFilters(): Filters | null {
  return lastFilters;
}

export function normalizeInterests(list: string[] | undefined): string[] {
  const out = new Set<string>();
  (list ?? []).forEach((t) => {
    const v = t
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9 ]/g, "")
      .trim();
    if (v.length >= 2 && v.length <= 24) out.add(v);
  });
  return [...out].slice(0, 10);
}

// ⚡ Boost en cours ? (date écrite par le serveur après l'achat)
export function boostActive(profile: any): boolean {
  const v = profile?.boostUntil;
  const ms = typeof v?.toMillis === "function" ? v.toMillis() : typeof v === "number" ? v : 0;
  return ms > Date.now();
}

// Pays voulus par une personne (un seul pays, ou plusieurs avec Vim+)
function wantedCountries(single?: string | null, many?: string[] | null): string[] {
  if (many && many.length) return many;
  return single ? [single] : [];
}

function scoreCandidate(profile: VimoXUser, c: any, filters: Filters, mine: string[]): number {
  let score = 0;
  const common = (c.interests ?? []).filter((t: string) => mine.includes(t)).length;
  score += common * 30; // les intérêts communs passent avant tout
  if (filters.gender && c.gender === filters.gender) score += 25;
  if (c.filterGender && profile.gender === c.filterGender) score += 25;
  if (wantedCountries(filters.country, filters.countries).includes(c.country)) score += 10;
  if (wantedCountries(c.filterCountry, c.filterCountries).includes(profile.country)) score += 10;
  score += Math.max(0, 10 - Math.abs((c.age ?? 0) - (profile.age ?? 0)));
  // Vim+ ou Boost : priorité dans les matchs (proposé en premier aux autres)
  if (c.isPremium) score += 15;
  else if (c.boosted) score += 12;
  // Le plus ancien dans la file passe en priorité (équité)
  score += Math.min(10, (Date.now() - (c.searchStartedAt ?? Date.now())) / 3000);
  return score;
}

async function getCooldownExcludeSet(userId: string): Promise<Set<string>> {
  try {
    const snap = await getDocs(query(collection(db, "matchCooldowns"), where("user", "==", userId)));
    const now = Date.now();
    const excluded = new Set<string>();
    snap.docs.forEach((d) => {
      const data = d.data();
      if ((data.expiresAt ?? 0) > now) excluded.add(data.partner);
    });
    return excluded;
  } catch {
    return new Set();
  }
}

async function writeCooldown(userA: string, userB: string): Promise<void> {
  const expiresAt = Date.now() + COOLDOWN_MS;
  await Promise.all([
    setDoc(doc(db, "matchCooldowns", `${userA}_${userB}`), { user: userA, partner: userB, expiresAt }).catch(() => {}),
    setDoc(doc(db, "matchCooldowns", `${userB}_${userA}`), { user: userB, partner: userA, expiresAt }).catch(() => {}),
  ]);
}

// Réserve le partenaire ET crée la pièce dans la MÊME transaction :
// plus aucune pièce vide, et jamais deux réservations pour la même personne.
async function claimPair(
  meId: string,
  partnerId: string,
  common: string[],
  mode: MatchMode,
  band: AgeBand,
  ages: Record<string, number>,
): Promise<string | null> {
  const roomRef = doc(collection(db, "rooms"));
  try {
    await runTransaction(db, async (tx) => {
      const meRef = doc(db, "waitingUsers", meId);
      const partnerRef = doc(db, "waitingUsers", partnerId);
      const [me, partner] = await Promise.all([tx.get(meRef), tx.get(partnerRef)]);
      if (!me.exists() || !partner.exists()) throw new Error("gone");
      if (me.data()?.matchedRoomId || partner.data()?.matchedRoomId) throw new Error("taken");
      if (partner.data()?.band !== band) throw new Error("band"); // double sécurité
      tx.set(roomRef, {
        participants: [meId, partnerId],
        isActive: true,
        mode,
        band,
        commonInterests: common,
        // Âges des deux personnes : visibles SEULEMENT dans cette conversation (vérifiés par les règles)
        ages,
        createdAt: serverTimestamp(),
      });
      tx.update(meRef, { matchedRoomId: roomRef.id });
      tx.update(partnerRef, { matchedRoomId: roomRef.id });
    });
    return roomRef.id;
  } catch {
    return null;
  }
}

const activeSearches = new Map<string, { cancel: () => void }>();

// Sans argument : annule la recherche en cours de cet appareil
export function cancelFindMatch(userId?: string): void {
  if (userId) activeSearches.get(userId)?.cancel();
  else [...activeSearches.values()].forEach((s) => s.cancel());
}

/**
 * Cherche un inconnu, comme Omegle : la recherche continue tant qu'on ne l'annule pas,
 * en élargissant peu à peu les filtres (sauf l'âge et la sécurité, toujours stricts).
 */
export async function findMatch(profile: VimoXUser, input: Filters): Promise<string> {
  // Match est réservé aux adultes (les règles Firebase le refusent aussi aux mineurs)
  if (ageBandOf(profile.age) !== "adult") throw new Error("Match est réservé aux personnes de 18 ans et plus.");
  activeSearches.get(profile.id)?.cancel();

  const band = ageBandOf(profile.age);
  const limits = ageLimitsFor(profile.age);
  const mode: MatchMode = input.mode ?? "text";
  const interests = normalizeInterests(input.interests);
  // L'âge recherché reste TOUJOURS dans la tranche de l'utilisateur
  const filters: Filters = {
    ...input,
    mode,
    interests,
    ageMin: Math.max(limits.min, Math.min(input.ageMin, limits.max)),
    ageMax: Math.min(limits.max, Math.max(input.ageMax, limits.min)),
  };
  lastFilters = filters;

  const waitRef = doc(db, "waitingUsers", profile.id);
  await deleteDoc(waitRef).catch(() => {});
  const searchStartedAt = Date.now();
  await setDoc(waitRef, {
    userId: profile.id,
    band,
    mode,
    interests,
    age: profile.age ?? 0,
    gender: profile.gender,
    country: profile.country,
    blockedUserIds: profile.blockedUserIds ?? [],
    isPremium: profile.isPremium === true, // Vim+ : priorité dans les matchs
    // ⚡ Boost acheté : priorité pendant 30 min (vérifié par les règles sur le profil)
    boosted: boostActive(profile),
    filterGender: filters.gender ?? null,
    filterCountry: filters.country ?? filters.countries?.[0] ?? null,
    filterCountries: filters.countries && filters.countries.length ? filters.countries.slice(0, 10) : null,
    filterAgeMin: filters.ageMin,
    filterAgeMax: filters.ageMax,
    addedAt: serverTimestamp(),
    searchStartedAt,
    heartbeatAt: searchStartedAt,
    matchedRoomId: null,
  });

  const cooldownExclude = await getCooldownExcludeSet(profile.id);

  return new Promise<string>((resolve, reject) => {
    let done = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let unsub: (() => void) | undefined;
    let busy = false;

    const me = { cancel: () => finish(new Error("Cancelled")) };
    activeSearches.set(profile.id, me);

    function finish(result: string | Error) {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      unsub?.();
      if (activeSearches.get(profile.id) === me) activeSearches.delete(profile.id);
      deleteDoc(waitRef).catch(() => {});
      if (typeof result === "string") resolve(result);
      else reject(result);
    }

    // Quelqu'un nous a réservés : on rejoint sa pièce
    unsub = onSnapshot(waitRef, (snap) => {
      if (done || !snap.exists()) return;
      const roomId = snap.data()?.matchedRoomId;
      if (roomId) finish(roomId);
    }, (e) => logDenied("file d'attente du match", e));

    async function tryMatch() {
      if (done || busy) return;
      busy = true;
      try {
        updateDoc(waitRef, { heartbeatAt: Date.now() }).catch(() => {});
        const elapsed = Date.now() - searchStartedAt;
        const relaxCountry = elapsed > WIDEN_COUNTRY_MS;
        const relaxGender = elapsed > WIDEN_GENDER_MS;
        const needCommon = interests.length > 0 && elapsed < WIDEN_INTERESTS_MS;

        // Seulement les personnes de la MÊME tranche d'âge et du même mode
        const snap = await getDocs(
          query(
            collection(db, "waitingUsers"),
            where("band", "==", band),
            where("mode", "==", mode),
            limit(CANDIDATES),
          ),
        );
        if (done) return;

        const now = Date.now();
        const compatible = snap.docs
          .map((d) => d.data())
          .filter((p) => {
            if (p.userId === profile.id) return false;
            if (p.band !== band) return false;
            if (p.matchedRoomId) return false;
            const alive = p.heartbeatAt ?? p.searchStartedAt;
            if (alive && now - alive > GHOST_MS) return false;
            // Blocage dans les deux sens et « pas la même personne » : toujours strict
            if (profile.blockedUserIds?.includes(p.userId)) return false;
            if (p.blockedUserIds?.includes(profile.id)) return false;
            if (cooldownExclude.has(p.userId)) return false;
            // Âge : toujours strict, dans les deux sens
            if ((p.age ?? 0) < filters.ageMin || (p.age ?? 99) > filters.ageMax) return false;
            if ((profile.age ?? 0) < (p.filterAgeMin ?? 0) || (profile.age ?? 0) > (p.filterAgeMax ?? 99)) return false;
            if (!relaxGender) {
              if (filters.gender && p.gender !== filters.gender) return false;
              if (p.filterGender && profile.gender !== p.filterGender) return false;
            }
            if (!relaxCountry) {
              const mine = wantedCountries(filters.country, filters.countries);
              if (mine.length && !mine.includes(p.country)) return false;
              const theirs = wantedCountries(p.filterCountry, p.filterCountries);
              if (theirs.length && !theirs.includes(profile.country)) return false;
            }
            if (needCommon && !(p.interests ?? []).some((t: string) => interests.includes(t))) return false;
            return true;
          });

        const ranked = compatible
          .map((p) => ({ p, s: scoreCandidate(profile, p, filters, interests) }))
          .sort((x, y) => y.s - x.s);

        for (const { p } of ranked) {
          if (done) return;
          const common = (p.interests ?? []).filter((t: string) => interests.includes(t));
          const roomId = await claimPair(profile.id, p.userId, common, mode, band, {
            [profile.id]: profile.age ?? 0,
            [p.userId]: p.age ?? 0,
          });
          if (!roomId) continue; // quelqu'un nous a devancés : on essaie le suivant
          writeCooldown(profile.id, p.userId).catch(() => {});
          finish(roomId);
          return;
        }
      } catch {
        // erreur réseau passagère : on réessaie au prochain tour
      } finally {
        busy = false;
        if (!done) {
          const slow = Date.now() - searchStartedAt > SLOW_AFTER_MS;
          timer = setTimeout(tryMatch, slow ? POLL_SLOW_MS : POLL_FAST_MS);
        }
      }
    }

    tryMatch();
  });
}

/** Nombre de personnes en recherche dans ta tranche d'âge (affiché « X en ligne »). */
export async function countSearching(age: number | undefined): Promise<number> {
  try {
    const snap = await getCountFromServer(
      query(collection(db, "waitingUsers"), where("band", "==", ageBandOf(age))),
    );
    return snap.data().count;
  } catch {
    return 0;
  }
}

export async function cancelSearch(roomId: string): Promise<void> {
  if (!roomId) return;
  try {
    await updateDoc(doc(db, "rooms", roomId), { isActive: false });
  } catch {}
}

export async function cleanupWaiting(userId: string): Promise<void> {
  await deleteDoc(doc(db, "waitingUsers", userId)).catch(() => {});
}

// « Suivant » : quitte la conversation et relance aussitôt avec les mêmes filtres
export async function skipToNext(currentRoomId: string, profile: VimoXUser, filters?: Filters): Promise<string> {
  await cancelSearch(currentRoomId).catch(() => {});
  const lim = ageLimitsFor(profile.age);
  const f = filters ?? lastFilters ?? { ageMin: lim.min, ageMax: lim.max };
  return findMatch(profile, f);
}
