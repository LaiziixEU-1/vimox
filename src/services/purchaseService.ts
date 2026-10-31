import { Platform } from "react-native";
import { httpsCallable } from "firebase/functions";
import { functions } from "../config/firebase";

// ───────────────────────── Achats Vim+ (RevenueCat → App Store / Google Play) ─────────────────────────
// Actif seulement dans une version construite avec EAS, avec le module « react-native-purchases »
// ET la clé RevenueCat de la plateforme dans .env. Sinon l'écran Vim+ reste en mode démonstration.
// Le statut « abonné » du profil est écrit par le SERVEUR (fonction syncPremium), jamais par l'app.
// Mode d'emploi complet : ACTIVER-LES-PAIEMENTS.md

const IOS_KEY = (process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? "").trim();
const ANDROID_KEY = (process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? "").trim();
const API_KEY = Platform.OS === "ios" ? IOS_KEY : Platform.OS === "android" ? ANDROID_KEY : "";
// Nom de l'« entitlement » créé dans RevenueCat
const ENTITLEMENT = (process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT ?? "").trim() || "premium";

let cached: any | null | undefined;
function sdk(): any | null {
  if (cached !== undefined) return cached;
  try {
    const m = require("react-native-purchases");
    cached = m?.default ?? m ?? null;
  } catch {
    cached = null;
  }
  return cached;
}

export function isBillingReady(): boolean {
  return API_KEY.length > 0 && sdk() !== null;
}

export function hasPremium(info: any): boolean {
  return !!info?.entitlements?.active?.[ENTITLEMENT];
}

// Page du store où l'on gère / résilie son abonnement
export const MANAGE_URL =
  Platform.OS === "android" ? "https://play.google.com/store/account/subscriptions" : "https://apps.apple.com/account/subscriptions";
export const STORE_NAME = Platform.OS === "android" ? "Google Play" : "Apple";

let configuredFor: string | null = null;
export async function initPurchases(userId: string): Promise<boolean> {
  if (!isBillingReady()) return false;
  const P = sdk();
  try {
    if (configuredFor === null) P.configure({ apiKey: API_KEY, appUserID: userId });
    else if (configuredFor !== userId) await P.logIn(userId);
    configuredFor = userId;
    return true;
  } catch {
    return false;
  }
}

export async function logoutPurchases(): Promise<void> {
  if (!isBillingReady() || configuredFor === null) return;
  try {
    await sdk().logOut();
  } catch {}
  configuredFor = null;
}

export type PremiumOffer = {
  pkg: any;
  id: string;
  kind: "monthly" | "annual" | "weekly" | "other";
  title: string;
  priceString: string;
  price: number; // pour calculer l'économie de l'annuel
  period: string; // « /mois », « /an »…
  trial: string | null; // « 7 jours gratuits » si un essai est configuré dans le store
};

const PERIODS: Record<string, string> = {
  MONTHLY: "/mois",
  ANNUAL: "/an",
  WEEKLY: "/semaine",
  TWO_MONTH: "/2 mois",
  THREE_MONTH: "/3 mois",
  SIX_MONTH: "/6 mois",
  LIFETIME: " (une fois)",
};

function trialLabel(product: any): string | null {
  const intro = product?.introPrice;
  if (!intro || intro.price > 0) return null;
  const n = intro.periodNumberOfUnits ?? 1;
  const unit = String(intro.periodUnit ?? "").toUpperCase();
  const word = unit === "DAY" ? (n > 1 ? "jours" : "jour") : unit === "WEEK" ? (n > 1 ? "semaines" : "semaine") : unit === "MONTH" ? "mois" : unit === "YEAR" ? (n > 1 ? "ans" : "an") : "";
  return word ? `${n} ${word} gratuit${n > 1 && word !== "mois" ? "s" : ""}` : "Essai gratuit";
}

// Les formules affichées viennent TOUJOURS du store : prix, durée, monnaie et essai exacts
export async function getPremiumOffers(): Promise<PremiumOffer[]> {
  if (!isBillingReady()) return [];
  try {
    const offerings = await sdk().getOfferings();
    const pkgs: any[] = offerings?.current?.availablePackages ?? [];
    const kindOf = (t: string): PremiumOffer["kind"] => (t === "MONTHLY" ? "monthly" : t === "ANNUAL" ? "annual" : t === "WEEKLY" ? "weekly" : "other");
    const list = pkgs.map((p) => ({
      pkg: p,
      id: String(p.identifier),
      kind: kindOf(p.packageType),
      title: p.product?.title ?? "Vim+",
      priceString: p.product?.priceString ?? "",
      price: Number(p.product?.price ?? 0),
      period: PERIODS[p.packageType] ?? "",
      trial: trialLabel(p.product),
    }));
    // Ordre : annuel, mensuel, puis le reste
    const rank = { annual: 0, monthly: 1, weekly: 2, other: 3 } as const;
    return list.sort((a, b) => rank[a.kind] - rank[b.kind]);
  } catch {
    return [];
  }
}

// Ancien nom (une seule formule) : gardé pour compatibilité
export async function getPremiumOffer(): Promise<PremiumOffer | null> {
  const all = await getPremiumOffers();
  return all.find((o) => o.kind === "monthly") ?? all[0] ?? null;
}

// Économie de l'annuel par rapport à 12 mois au prix mensuel (ex. 37 pour « −37 % »)
export function annualSavings(offers: PremiumOffer[]): number | null {
  const m = offers.find((o) => o.kind === "monthly");
  const a = offers.find((o) => o.kind === "annual");
  if (!m || !a || m.price <= 0 || a.price <= 0) return null;
  const pct = Math.round((1 - a.price / (m.price * 12)) * 100);
  return pct > 0 ? pct : null;
}

// Demande au serveur de vérifier l'abonnement auprès de RevenueCat et de mettre le profil à jour
export async function syncPremiumFromServer(): Promise<boolean | null> {
  try {
    const res: any = await httpsCallable(functions, "syncPremium")({});
    return res?.data?.active === true;
  } catch {
    return null;
  }
}

export type PurchaseResult = { ok: boolean; cancelled?: boolean; error?: string };

export async function buyPremium(pkg: any): Promise<PurchaseResult> {
  if (!isBillingReady() || !pkg) return { ok: false, error: "indisponible" };
  try {
    const res = await sdk().purchasePackage(pkg);
    const ok = hasPremium(res?.customerInfo);
    if (ok) await syncPremiumFromServer();
    return { ok };
  } catch (e: any) {
    if (e?.userCancelled) return { ok: false, cancelled: true };
    return { ok: false, error: String(e?.code ?? e?.message ?? "erreur").slice(0, 80) };
  }
}

// Obligatoire pour les stores : retrouver un achat fait sur un autre appareil ou après réinstallation
export async function restorePremium(): Promise<boolean> {
  if (!isBillingReady()) return false;
  try {
    const ok = hasPremium(await sdk().restorePurchases());
    await syncPremiumFromServer();
    return ok;
  } catch {
    return false;
  }
}

// Ancien nom : vérifie maintenant côté serveur
export async function syncPremiumFlag(_userId: string): Promise<boolean | null> {
  if (!isBillingReady()) return null;
  return syncPremiumFromServer();
}

// Une fois connecté : suit l'abonnement (renouvellement, expiration…) et fait vérifier le serveur
export function watchPremium(userId: string): () => void {
  if (!isBillingReady()) return () => {};
  let stopped = false;
  let listener: any = null;
  let last: boolean | null = null;
  (async () => {
    if (!(await initPurchases(userId)) || stopped) return;
    await syncPremiumFromServer();
    try {
      listener = (info: any) => {
        if (stopped) return;
        const active = hasPremium(info);
        if (active !== last) {
          last = active;
          syncPremiumFromServer().catch(() => {});
        }
      };
      sdk().addCustomerInfoUpdateListener(listener);
    } catch {}
  })();
  return () => {
    stopped = true;
    try {
      if (listener) sdk().removeCustomerInfoUpdateListener(listener);
    } catch {}
  };
}

// 🎁 Offrir 1 mois de Vim+ à un ami (3 Pass par an) : tout se passe côté serveur
export const VIM_PASSES_PER_YEAR = 3;
export function passesLeft(profile: any): number {
  const year = new Date().getUTCFullYear();
  const used = profile?.vimPassesYear === year ? Number(profile?.vimPassesUsed ?? 0) : 0;
  return Math.max(0, VIM_PASSES_PER_YEAR - used);
}
export async function giftVimPass(friendId: string): Promise<{ ok: boolean; message?: string }> {
  try {
    await httpsCallable(functions, "giftVimPass")({ friendId });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, message: String(e?.message ?? "").replace(/^.*?:\s*/, "") || "Le Pass n'a pas pu être offert." };
  }
}

// ───────────── Achats à l'unité (⚡ Boost, 🔥 restauration de flamme) ─────────────
export const ITEM_IDS = { boost: "vimox_boost_30", restore: "vimox_flame_restore" } as const;
export type StoreItem = { id: string; product: any; title: string; priceString: string };

// Prix et noms exacts, venus du store
export async function getStoreItems(): Promise<Partial<Record<keyof typeof ITEM_IDS, StoreItem>>> {
  if (!isBillingReady()) return {};
  try {
    const products: any[] = await sdk().getProducts(Object.values(ITEM_IDS), "NON_SUBSCRIPTION");
    const out: Partial<Record<keyof typeof ITEM_IDS, StoreItem>> = {};
    (Object.keys(ITEM_IDS) as (keyof typeof ITEM_IDS)[]).forEach((k) => {
      const p = products.find((x) => x?.identifier === ITEM_IDS[k]);
      if (p) out[k] = { id: p.identifier, product: p, title: p.title ?? "", priceString: p.priceString ?? "" };
    });
    return out;
  } catch {
    return {};
  }
}

// Le serveur crédite les achats à l'unité (une seule fois par transaction)
export async function claimPurchases(): Promise<boolean> {
  try {
    await httpsCallable(functions, "claimPurchases")({});
    return true;
  } catch {
    return false;
  }
}

export async function buyItem(item: StoreItem): Promise<PurchaseResult> {
  if (!isBillingReady() || !item?.product) return { ok: false, error: "indisponible" };
  try {
    await sdk().purchaseStoreProduct(item.product);
    const ok = await claimPurchases();
    return ok ? { ok: true } : { ok: false, error: "verification" };
  } catch (e: any) {
    if (e?.userCancelled) return { ok: false, cancelled: true };
    return { ok: false, error: String(e?.code ?? e?.message ?? "erreur").slice(0, 80) };
  }
}

// 🔥 Restauration de flamme par le serveur (Vim+ : 2 par mois, sinon une restauration achetée)
export async function restoreFlameOnServer(friendId: string): Promise<{ ok: boolean; message?: string; code?: string }> {
  try {
    await httpsCallable(functions, "useFlameRestore")({ friendId });
    return { ok: true };
  } catch (e: any) {
    return {
      ok: false,
      code: String(e?.code ?? ""),
      message: String(e?.message ?? "").replace(/^.*?:\s*/, "") || "Restauration impossible.",
    };
  }
}
