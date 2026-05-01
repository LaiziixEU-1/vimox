import { doc, updateDoc } from "firebase/firestore";
import { db } from "../config/firebase";

export async function activatePremiumDemo(userId: string) {
  await updateDoc(doc(db, "users", userId), {
    isPremium: true,
    premiumActivatedAt: Date.now(),
    premiumSource: "demo"
  });
}

export function canUseUnlimitedSkip(isPremium: boolean, usedSkips: number) {
  return isPremium || usedSkips < 10;
}

