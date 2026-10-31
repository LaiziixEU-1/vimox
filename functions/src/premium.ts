// ───────────────────────── Vim+ : abonnement vérifié côté serveur ─────────────────────────
// L'application ne peut PAS se déclarer abonnée elle-même (règles Firestore). Ces deux fonctions
// demandent à RevenueCat l'état réel de l'abonnement, puis écrivent le statut dans le profil.
//
//  • syncPremium (appelée par l'app) : juste après un achat, une restauration, ou au démarrage.
//  • revenuecatWebhook (appelée par RevenueCat) : à chaque événement — renouvellement, résiliation,
//    expiration, remboursement, problème de paiement — même quand l'app est fermée.
//
// Secrets à créer une fois (voir ACTIVER-LES-PAIEMENTS.md) :
//   firebase functions:secrets:set REVENUECAT_SECRET_KEY   (clé secrète RevenueCat, « sk_… »)
//   firebase functions:secrets:set REVENUECAT_WEBHOOK_AUTH (mot de passe choisi par toi, recopié dans RevenueCat)
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { grantPurchases } from "./store";
import { RC_SECRET, fetchSubscriber } from "./revenuecat";


const RC_WEBHOOK_AUTH = defineSecret("REVENUECAT_WEBHOOK_AUTH");
// Nom de l'« entitlement » RevenueCat (le même que EXPO_PUBLIC_REVENUECAT_ENTITLEMENT dans l'app)
const ENTITLEMENT = defineString("REVENUECAT_ENTITLEMENT", { default: "premium" });



type Status = {
  active: boolean;
  expiresMs: number | null;
  willRenew: boolean | null;
  store: string | null;
  sinceMs: number | null; // première souscription (« Membre depuis le… »)
};

// État réel de l'abonnement, demandé à RevenueCat (source de vérité, alimentée par Apple et Google)
async function fetchStatus(uid: string): Promise<Status> {
  const j: any = await fetchSubscriber(uid);
  const ent = j?.subscriber?.entitlements?.[ENTITLEMENT.value()];
  if (!ent) return { active: false, expiresMs: null, willRenew: null, store: null, sinceMs: null };
  // Délai de grâce (paiement en cours de nouvelle tentative) : l'abonné garde ses avantages
  const expires = ent.grace_period_expires_date ?? ent.expires_date;
  const expiresMs = expires ? Date.parse(expires) : null; // null = achat à vie
  const sub = j?.subscriber?.subscriptions?.[ent.product_identifier];
  const since = sub?.original_purchase_date ?? ent.purchase_date ?? null;
  return {
    active: expiresMs === null || expiresMs > Date.now(),
    expiresMs,
    willRenew: sub ? !sub.unsubscribe_detected_at : null,
    store: sub?.store ?? (ent.store === "promotional" ? "gift" : null),
    sinceMs: since ? Date.parse(since) : null,
  };
}

async function applyStatus(uid: string, st: Status): Promise<void> {
  // « update » : on ne crée jamais de profil pour un identifiant inconnu
  await getFirestore()
    .doc(`users/${uid}`)
    .update({
      isPremium: st.active,
      premiumUntil: st.expiresMs ? Timestamp.fromMillis(st.expiresMs) : null,
      premiumWillRenew: st.willRenew,
      premiumStore: st.store,
      premiumSince: st.active && st.sinceMs ? Timestamp.fromMillis(st.sinceMs) : null,
      premiumCheckedAt: FieldValue.serverTimestamp(),
    });
}

// Appelée par l'app (utilisateur connecté) : met le profil à jour tout de suite
export const syncPremium = onCall({ secrets: [RC_SECRET] }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Connexion requise.");
  try {
    const st = await fetchStatus(req.auth.uid);
    await applyStatus(req.auth.uid, st);
    return { active: st.active, expiresMs: st.expiresMs, willRenew: st.willRenew };
  } catch (e: any) {
    throw new HttpsError("unavailable", "Vérification de l'abonnement impossible pour le moment.");
  }
});

// Appelée par RevenueCat à chaque événement d'abonnement
export const revenuecatWebhook = onRequest({ secrets: [RC_SECRET, RC_WEBHOOK_AUTH] }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("POST seulement");
    return;
  }
  const auth = req.get("Authorization") ?? "";
  const expected = RC_WEBHOOK_AUTH.value();
  if (!expected || (auth !== expected && auth !== `Bearer ${expected}`)) {
    res.status(401).send("Non autorisé");
    return;
  }
  const ev: any = req.body?.event ?? {};
  // Tous les comptes concernés (achat, transfert d'un compte à un autre, alias)
  const ids = new Set<string>(
    [ev.app_user_id, ev.original_app_user_id, ...(ev.aliases ?? []), ...(ev.transferred_from ?? []), ...(ev.transferred_to ?? [])].filter(
      (x: any) => typeof x === "string" && x.length > 0 && !x.startsWith("$RCAnonymousID"),
    ),
  );
  for (const uid of ids) {
    try {
      await applyStatus(uid, await fetchStatus(uid));
      // Achat à l'unité (boost, restauration de flamme) : on le crédite
      if (ev.type === "NON_RENEWING_PURCHASE") await grantPurchases(uid);
    } catch {
      // compte inexistant ou RevenueCat momentanément indisponible : RevenueCat réessaiera
    }
  }
  res.status(200).send("ok");
});

// ───────────── 🎁 Pass Vim+ : offrir 1 mois de Vim+ à un ami (3 par an) ─────────────
// L'abonné choisit un ami : RevenueCat lui accorde 1 mois de Vim+ (« promotional entitlement »),
// puis le profil de l'ami est mis à jour et un message apparaît dans votre conversation.
export const VIM_PASSES_PER_YEAR = 3;

export const giftVimPass = onCall({ secrets: [RC_SECRET] }, async (req) => {
  if (!req.auth) throw new HttpsError("unauthenticated", "Connexion requise.");
  const uid = req.auth.uid;
  const friendId = String(req.data?.friendId ?? "");
  if (!friendId || friendId === uid) throw new HttpsError("invalid-argument", "Ami invalide.");
  const db = getFirestore();
  const meRef = db.doc(`users/${uid}`);
  const [meSnap, friendSnap, linkSnap] = await Promise.all([
    meRef.get(),
    db.doc(`users/${friendId}`).get(),
    db.doc(`friends/${uid}_${friendId}`).get(),
  ]);
  const me: any = meSnap.data();
  if (!me?.isPremium) throw new HttpsError("permission-denied", "Les Pass sont réservés aux abonnés Vim+.");
  if (!friendSnap.exists || !linkSnap.exists) throw new HttpsError("failed-precondition", "Vous devez être amis.");
  if ((friendSnap.data() as any)?.isPremium) throw new HttpsError("already-exists", "Ton ami a déjà Vim+.");
  const year = new Date().getUTCFullYear();
  const used = me.vimPassesYear === year ? Number(me.vimPassesUsed ?? 0) : 0;
  if (used >= VIM_PASSES_PER_YEAR) throw new HttpsError("resource-exhausted", "Tu as utilisé tes 3 Pass de l'année.");

  // 1 mois offert, accordé par RevenueCat
  const r = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(friendId)}/entitlements/${encodeURIComponent(ENTITLEMENT.value())}/promotional`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${RC_SECRET.value()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ duration: "monthly" }),
    },
  );
  if (!r.ok) throw new HttpsError("unavailable", "Le Pass n'a pas pu être offert pour le moment. Réessaie plus tard.");

  await meRef.update({ vimPassesYear: year, vimPassesUsed: used + 1 });
  try {
    await applyStatus(friendId, await fetchStatus(friendId));
  } catch {}
  // Message dans la conversation des deux amis
  const cid = [uid, friendId].sort().join("_");
  await db
    .collection(`friendChats/${cid}/messages`)
    .add({
      type: "gift",
      text: `🎁 ${me.name ?? "Ton ami"} t'a offert 1 mois de Vim+ !`,
      senderUid: uid,
      imageURL: null,
      audioURL: null,
      saved: true,
      sentAt: FieldValue.serverTimestamp(),
    })
    .catch(() => {});
  return { ok: true, left: VIM_PASSES_PER_YEAR - (used + 1) };
});
