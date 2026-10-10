import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase";

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
