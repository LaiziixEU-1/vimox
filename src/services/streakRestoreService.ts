import { doc, getDoc, setDoc, updateDoc, increment } from "firebase/firestore";
import { db } from "../config/firebase";

export const FREE_RESTORES_PER_MONTH = 2;
export const RESTORE_PRICE_LABEL = "3,99 €"; // même prix que Snapchat+

function monthKey(d = new Date()) {
  return d.toISOString().slice(0, 7); // "YYYY-MM"
}

export async function getRestoreCreditsRemaining(
  userId: string,
  isPremium: boolean,
): Promise<number> {
  if (!isPremium) return 0; // pas de crédits gratuits sans abo Premium
  const ref = doc(db, "restoreCredits", `${userId}_${monthKey()}`);
  const snap = await getDoc(ref);
  const used = snap.exists() ? (snap.data().used ?? 0) : 0;
  return Math.max(0, FREE_RESTORES_PER_MONTH - used);
}

async function consumeFreeCredit(userId: string): Promise<void> {
  const ref = doc(db, "restoreCredits", `${userId}_${monthKey()}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { userId, month: monthKey(), used: 1 });
  } else {
    await updateDoc(ref, { used: increment(1) });
  }
}

// ⚠️ DÉMO — simule un paiement réussi. À remplacer par un vrai achat in-app
// (RevenueCat / StoreKit / Google Play Billing) avant la mise en production.
async function fakePurchase(): Promise<boolean> {
  return true;
}

export async function useStreakRestore(
  userId: string,
  isPremium: boolean,
): Promise<{ success: boolean; wasFree: boolean }> {
  if (isPremium) {
    const remaining = await getRestoreCreditsRemaining(userId, true);
    if (remaining > 0) {
      await consumeFreeCredit(userId);
      return { success: true, wasFree: true };
    }
  }
  const paid = await fakePurchase();
  return { success: paid, wasFree: false };
}
