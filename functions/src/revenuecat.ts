// Accès à RevenueCat, partagé par les abonnements (premium.ts) et les achats à l'unité (store.ts)
import { defineSecret } from "firebase-functions/params";

export const RC_SECRET = defineSecret("REVENUECAT_SECRET_KEY");

// Fiche complète d'un client chez RevenueCat (abonnements + achats à l'unité)
export async function fetchSubscriber(uid: string): Promise<any> {
  const r = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`, {
    headers: { Authorization: `Bearer ${RC_SECRET.value()}`, "Content-Type": "application/json" },
  });
  if (!r.ok) throw new Error(`RevenueCat a répondu ${r.status}`);
  return r.json();
}
