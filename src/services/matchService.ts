import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { VimoXUser } from "../models/types";

interface Filters {
  gender?: string;
  country?: string;
  ageMin: number;
  ageMax: number;
}

const COOLDOWN_MS = 30 * 60 * 1000; // 30 min avant de repropose la même personne
const WIDEN_STAGE_1_MS = 8000; // après 8s : le pays devient une préférence, plus un filtre strict
const WIDEN_STAGE_2_MS = 16000; // après 16s : le genre devient une préférence aussi

function scoreCandidate(
  profile: VimoXUser,
  candidate: any,
  filters: Filters,
): number {
  let score = 0;
  if (filters.gender && candidate.gender === filters.gender) score += 50;
  if (candidate.filterGender && profile.gender === candidate.filterGender)
    score += 50;
  if (filters.country && candidate.country === filters.country) score += 20;
  if (candidate.filterCountry && profile.country === candidate.filterCountry)
    score += 20;
  const ageDiff = Math.abs((candidate.age ?? 0) - (profile.age ?? 0));
  score += Math.max(0, 15 - ageDiff); // plus l'âge est proche, plus de points
  if (candidate.isPremium) score += 10;
  return score;
}

async function getCooldownExcludeSet(userId: string): Promise<Set<string>> {
  try {
    const snap = await getDocs(
      query(collection(db, "matchCooldowns"), where("user", "==", userId)),
    );
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
    setDoc(doc(db, "matchCooldowns", `${userA}_${userB}`), {
      user: userA,
      partner: userB,
      expiresAt,
    }).catch(() => {}),
    setDoc(doc(db, "matchCooldowns", `${userB}_${userA}`), {
      user: userB,
      partner: userA,
      expiresAt,
    }).catch(() => {}),
  ]);
}

export async function findMatch(
  profile: VimoXUser,
  filters: Filters,
): Promise<string> {
  await deleteDoc(doc(db, "waitingUsers", profile.id)).catch(() => {});

  await setDoc(doc(db, "waitingUsers", profile.id), {
    userId: profile.id,
    name: profile.name,
    age: profile.age ?? 0,
    gender: profile.gender,
    country: profile.country,
    isPremium: profile.isPremium ?? false,
    blockedUserIds: profile.blockedUserIds ?? [],
    filterGender: filters.gender ?? null,
    filterCountry: filters.country ?? null,
    filterAgeMin: filters.ageMin,
    filterAgeMax: filters.ageMax,
    addedAt: serverTimestamp(),
    searchStartedAt: Date.now(),
  });

  const searchStartedAt = Date.now();
  const cooldownExclude = await getCooldownExcludeSet(profile.id);

  return new Promise((resolve, reject) => {
    let done = false;
    const waitRef = doc(db, "waitingUsers", profile.id);

    const timer = setTimeout(async () => {
      if (done) return;
      done = true;
      unsub();
      clearInterval(retry);
      await deleteDoc(waitRef).catch(() => {});
      reject(new Error("Timeout"));
    }, 45000); // un peu plus long puisqu'on élargit progressivement

    const unsub = onSnapshot(waitRef, (snap) => {
      if (!snap.exists() || done) return;
      const roomId = snap.data()?.matchedRoomId;
      if (roomId) {
        done = true;
        clearTimeout(timer);
        clearInterval(retry);
        unsub();
        deleteDoc(waitRef).catch(() => {});
        resolve(roomId);
      }
    });

    async function tryMatch() {
      if (done) return;
      try {
        const elapsed = Date.now() - searchStartedAt;
        const relaxCountry = elapsed > WIDEN_STAGE_1_MS;
        const relaxGender = elapsed > WIDEN_STAGE_2_MS;

        const snap = await getDocs(
          query(
            collection(db, "waitingUsers"),
            where("userId", "!=", profile.id),
            limit(30),
          ),
        );

        const compatible = snap.docs.filter((d) => {
          const p = d.data();

          // Blocage dans les deux sens — toujours strict, jamais élargi
          if (profile.blockedUserIds?.includes(p.userId)) return false;
          if (p.blockedUserIds?.includes(profile.id)) return false;
          if (cooldownExclude.has(p.userId)) return false;

          // Âge — toujours strict, c'est le seul critère non négociable
          if ((p.age ?? 0) < filters.ageMin || (p.age ?? 99) > filters.ageMax)
            return false;
          if (
            profile.age < (p.filterAgeMin ?? 0) ||
            profile.age > (p.filterAgeMax ?? 99)
          )
            return false;

          // Genre — strict au début, préférence ensuite
          if (!relaxGender) {
            if (filters.gender && p.gender !== filters.gender) return false;
            if (p.filterGender && profile.gender !== p.filterGender)
              return false;
          }

          // Pays — strict au début, préférence ensuite
          if (!relaxCountry) {
            if (filters.country && p.country !== filters.country) return false;
            if (p.filterCountry && profile.country !== p.filterCountry)
              return false;
          }

          return true;
        });

        if (!compatible.length || done) return;

        // Choisir le meilleur score plutôt qu'un choix aléatoire
        let best = compatible[0];
        let bestScore = -1;
        for (const d of compatible) {
          const s = scoreCandidate(profile, d.data(), filters);
          if (s > bestScore) {
            bestScore = s;
            best = d;
          }
        }
        const partnerId = best.data().userId;

        const roomRef = await addDoc(collection(db, "rooms"), {
          participants: [profile.id, partnerId],
          isActive: true,
          createdAt: serverTimestamp(),
        });

        await updateDoc(doc(db, "waitingUsers", partnerId), {
          matchedRoomId: roomRef.id,
        }).catch(() => {});

        writeCooldown(profile.id, partnerId).catch(() => {});

        if (done) return;
        done = true;
        clearTimeout(timer);
        clearInterval(retry);
        unsub();
        await deleteDoc(waitRef).catch(() => {});
        resolve(roomRef.id);
      } catch {
        // Partenaire déjà pris entre-temps, on réessaiera au prochain tick
      }
    }

    tryMatch();
    const retry = setInterval(tryMatch, 2500);
  });
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

// "Suivant" — quitte la conversation actuelle et relance immédiatement une recherche
export async function skipToNext(
  currentRoomId: string,
  profile: VimoXUser,
  filters: Filters,
): Promise<string> {
  await cancelSearch(currentRoomId).catch(() => {});
  return findMatch(profile, filters);
}
