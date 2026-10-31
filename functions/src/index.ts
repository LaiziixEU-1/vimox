import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { SUSPENSION_HOURS, decide } from "./decide";

initializeApp();
const db = getFirestore();

// À chaque nouveau signalement : on met à jour le compteur de la personne visée et on la suspend
// 24 h si plusieurs personnes différentes l'ont signalée (ou si le filtre l'a beaucoup refusée).
// La suspension se lève toute seule ; l'application affiche alors l'écran « Compte suspendu ».
export const onReportCreated = onDocumentCreated("reports/{reportId}", async (event) => {
  const report = event.data?.data();
  const reportedId = report?.reportedId as string | undefined;
  if (!reportedId) return;

  const snap = await db.collection("reports").where("reportedId", "==", reportedId).limit(200).get();
  const reports = snap.docs.map((d) => {
    const r = d.data();
    const created = r.createdAt as Timestamp | undefined;
    return {
      type: r.type as string | undefined,
      reporterId: r.reporterId as string | undefined,
      createdAtMs: created ? created.toMillis() : Date.now(),
    };
  });
  const verdict = decide(reports, reportedId, Date.now());

  const userRef = db.doc(`users/${reportedId}`);
  try {
    // « update » (et non « set ») : on ne crée jamais un faux profil pour un identifiant inexistant
    await userRef.update({ reportCount: FieldValue.increment(1) });
    if (verdict.suspend) {
      await userRef.update({
        suspendedUntil: Timestamp.fromMillis(Date.now() + SUSPENSION_HOURS * 3600 * 1000),
      });
    }
  } catch {
    // profil supprimé entre-temps : rien à faire
  }
});

// Vim+ : abonnement vérifié côté serveur
export { syncPremium, revenuecatWebhook, giftVimPass } from "./premium";
// Achats à l'unité : boost et restauration de flamme
export { claimPurchases, useFlameRestore } from "./store";
