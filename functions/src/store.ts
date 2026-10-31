// ───────────────────────── Achats à l'unité (vérifiés côté serveur) ─────────────────────────
//  • ⚡ Boost : 30 minutes de priorité dans les matchs (vimox_boost_30)
//  • 🔥 Restauration de flamme : rallumer une flamme éteinte depuis moins de 3 jours (vimox_flame_restore)
// L'achat passe par Apple / Google ; RevenueCat le confirme ; ce serveur le crédite UNE seule fois
// (chaque transaction est notée dans users/{uid}/purchases/{transaction}).
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { RC_SECRET, fetchSubscriber } from "./revenuecat";

export const PRODUCTS: Record<string, { kind: "boost"; minutes: number } | { kind: "restore" }> = {
  vimox_boost_30: { kind: "boost", minutes: 30 },
  vimox_flame_restore: { kind: "restore" },
};
const VIMPLUS_FREE_RESTORES = 2; // par mois, inclus dans Vim+
const RESTORE_WINDOW_DAYS = 3; // comme dans l'app

const todayKey = (d = new Date()) => d.toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);

// Crédite tous les achats à l'unité pas encore comptés (appelé par l'app et par le webhook)
export async function grantPurchases(uid: string): Promise<{ boosts: number; restores: number }> {
  const db = getFirestore();
  const sub: any = await fetchSubscriber(uid);
  const non: Record<string, any[]> = sub?.subscriber?.non_subscriptions ?? {};
  let boosts = 0;
  let restores = 0;
  for (const [productId, txs] of Object.entries(non)) {
    const prod = PRODUCTS[productId];
    if (!prod) continue;
    for (const tx of txs ?? []) {
      const txId = String(tx?.id ?? tx?.store_transaction_id ?? "");
      if (!txId) continue;
      const userRef = db.doc(`users/${uid}`);
      const txRef = db.doc(`users/${uid}/purchases/${txId}`);
      const granted = await db.runTransaction(async (t) => {
        const [txSnap, userSnap] = await Promise.all([t.get(txRef), t.get(userRef)]);
        if (txSnap.exists || !userSnap.exists) return false; // déjà compté (ou compte supprimé)
        if (prod.kind === "boost") {
          const cur = (userSnap.data() as any)?.boostUntil as Timestamp | undefined;
          const base = Math.max(Date.now(), cur ? cur.toMillis() : 0);
          t.update(userRef, { boostUntil: Timestamp.fromMillis(base + prod.minutes * 60000) });
        } else {
          t.update(userRef, { paidRestores: FieldValue.increment(1) });
        }
        t.create(txRef, { productId, at: FieldValue.serverTimestamp(), store: tx?.store ?? null, sandbox: !!tx?.is_sandbox });
        return true;
      });
      if (granted) prod.kind === "boost" ? boosts++ : restores++;
    }
  }
  return { boosts, restores };
}

// Appelée par l'app juste après un achat à l'unité
export const claimPurchases = onCall({ secrets: [RC_SECRET] }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Connexion requise.");
  try {
    return await grantPurchases(req.auth.uid);
  } catch {
    throw new HttpsError("unavailable", "Vérification de l'achat impossible pour le moment.");
  }
});

// 🔥 Restaurer une flamme : utilise d'abord une restauration Vim+ du mois (2), sinon une restauration achetée
export const useFlameRestore = onCall(async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Connexion requise.");
  const uid = req.auth.uid;
  const friendId = String(req.data?.friendId ?? "");
  if (!friendId || friendId === uid) throw new HttpsError("invalid-argument", "Ami invalide.");
  const db = getFirestore();
  const cid = [uid, friendId].sort().join("_");
  const month = todayKey().slice(0, 7);
  const userRef = db.doc(`users/${uid}`);
  const streakRef = db.doc(`streaks/${cid}`);
  const creditRef = db.doc(`restoreCredits/${uid}_${month}`);
  const linkRef = db.doc(`friends/${uid}_${friendId}`);

  return db.runTransaction(async (t) => {
    const [userSnap, streakSnap, creditSnap, linkSnap] = await Promise.all([
      t.get(userRef),
      t.get(streakRef),
      t.get(creditRef),
      t.get(linkRef),
    ]);
    if (!linkSnap.exists) throw new HttpsError("failed-precondition", "Vous devez être amis.");
    const st: any = streakSnap.data();
    const last = st?.lastIncrementDate as string | undefined;
    const gap = last ? daysBetween(last, todayKey()) : 0;
    const canRestore = !!st && (st.streakCount ?? 0) > 0 && gap > 1 && gap <= RESTORE_WINDOW_DAYS + 1;
    if (!canRestore) throw new HttpsError("failed-precondition", "Cette flamme ne peut plus être restaurée.");
    const user: any = userSnap.data() ?? {};
    const usedThisMonth = Number((creditSnap.data() as any)?.used ?? 0);
    let source: "vimplus" | "paid";
    if (user.isPremium === true && usedThisMonth < VIMPLUS_FREE_RESTORES) {
      source = "vimplus";
      t.set(creditRef, { userId: uid, month, used: usedThisMonth + 1 }, { merge: true });
    } else if (Number(user.paidRestores ?? 0) > 0) {
      source = "paid";
      t.update(userRef, { paidRestores: FieldValue.increment(-1) });
    } else {
      throw new HttpsError("resource-exhausted", "Aucune restauration disponible.");
    }
    t.update(streakRef, { lastIncrementDate: todayKey(), updatedAt: FieldValue.serverTimestamp() });
    return { ok: true, source };
  });
});
