import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase";
import { isBillingReady } from "./purchaseService";

// Tant qu'aucun paiement réel n'est branché (RevenueCat / StoreKit / Google Play Billing, qui
// demandent un build natif), le Premium est une DÉMONSTRATION gratuite : l'écran l'indique
// clairement. Passe cette constante à true quand l'achat intégré sera en place.
// true seulement dans une version construite avec la clé RevenueCat ET le module d'achat (voir ACTIVER-LES-PAIEMENTS.md)
export const BILLING_ENABLED = isBillingReady();

// Nombre de skips gratuits par session
const FREE_SKIPS = 5;

export function canUseUnlimitedSkip(
  isPremium: boolean,
  usedSkips: number,
): boolean {
  if (isPremium) return true;
  return usedSkips < FREE_SKIPS;
}

export async function activatePremiumDemo(userId: string): Promise<void> {
  await updateDoc(doc(db, "users", userId), {
    isPremium: true,
    premiumActivatedAt: serverTimestamp(),
  });
}

export async function deactivatePremium(userId: string): Promise<void> {
  await updateDoc(doc(db, "users", userId), {
    isPremium: false,
  });
}

/**
 * Vérifie si l'utilisateur a un abonnement actif
 * À connecter avec RevenueCat en production
 */
export async function checkPremiumStatus(userId: string): Promise<boolean> {
  try {
    // En production : utiliser Purchases.getCustomerInfo()
    // Pour l'instant on lit Firestore
    const { getDoc } = await import("firebase/firestore");
    const snap = await getDoc(doc(db, "users", userId));
    return snap.data()?.isPremium === true;
  } catch {
    return false;
  }
}
