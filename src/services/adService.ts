import { Platform } from "react-native";

// ───────────────────────── Publicités du chat aléatoire ─────────────────────────
// Version gratuite : une publicité toutes les 3 personnes passées (« Suivant » / « Nouvel inconnu »).
// Premium : jamais de publicité.
//
// • Dans l'app installée (build EAS) avec react-native-google-mobile-ads et les identifiants AdMob
//   (EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID_IOS / _ANDROID dans .env) : vraie publicité AdMob plein écran,
//   après la fenêtre de consentement de Google (obligatoire en Europe et en Suisse).
//   Les moins de 18 ans reçoivent seulement des pubs NON personnalisées, contenu « Ados » maximum.
// • Sinon (Expo Go, AdMob pas configuré, pas de pub disponible) : « pub maison » Vim+.

export const SKIPS_PER_AD = 3;
const LOAD_TIMEOUT_MS = 6000;

let skips = 0;

let ads: any | undefined;
function admob(): any | null {
  if (ads !== undefined) return ads;
  try {
    ads = require("react-native-google-mobile-ads");
  } catch {
    ads = null;
  }
  return ads;
}

function unitId(): string | null {
  const m = admob();
  if (!m) return null;
  // Un identifiant par plateforme (AdMob en crée un pour iPhone et un pour Android)
  const id = (
    (Platform.OS === "ios" ? process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID_IOS : process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID_ANDROID) ??
    process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID ??
    ""
  ).trim();
  if (id) return id;
  // En développement : publicité de test officielle de Google
  return __DEV__ && m.TestIds?.INTERSTITIAL ? m.TestIds.INTERSTITIAL : null;
}

// Fenêtre de consentement de Google (une fois par session) : sans accord quand il est requis, pas de pub
let consentAsked = false;
let canRequestAds = true;
async function gatherConsent(): Promise<boolean> {
  const m = admob();
  if (!m?.AdsConsent) return true;
  if (consentAsked) return canRequestAds;
  consentAsked = true;
  try {
    const info = await m.AdsConsent.gatherConsent();
    canRequestAds = info?.canRequestAds !== false;
  } catch {
    // formulaire indisponible (pas de réseau…) : on n'affiche pas de pub plutôt que de risquer
    canRequestAds = false;
  }
  return canRequestAds;
}

// Bouton « Mes choix publicitaires » (paramètres) : rouvre le formulaire de Google
export function adPrivacyAvailable(): boolean {
  return !!admob()?.AdsConsent;
}
export async function openAdPrivacyOptions(): Promise<boolean> {
  const m = admob();
  if (!m?.AdsConsent) return false;
  try {
    await m.AdsConsent.showPrivacyOptionsForm();
    const info = await m.AdsConsent.getConsentInfo();
    canRequestAds = info?.canRequestAds !== false;
    return true;
  } catch {
    return false;
  }
}

let configuredMinor: boolean | null = null;
async function configure(minor: boolean) {
  const m = admob();
  if (!m || configuredMinor === minor) return;
  try {
    const mobileAds = m.default ?? m.mobileAds;
    await mobileAds().setRequestConfiguration({
      maxAdContentRating: minor ? m.MaxAdContentRating?.T ?? "T" : m.MaxAdContentRating?.MA ?? "MA",
      tagForUnderAgeOfConsent: minor,
      tagForChildDirectedTreatment: false,
    });
    await mobileAds().initialize();
    configuredMinor = minor;
  } catch {}
}

// Affiche une vraie publicité AdMob ; renvoie true si elle a été vue (et fermée)
async function showAdMob(minor: boolean): Promise<boolean> {
  const m = admob();
  const id = unitId();
  if (!m || !id) return false;
  if (!(await gatherConsent())) return false;
  await configure(minor);
  return new Promise<boolean>((resolve) => {
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      subs.forEach((u) => {
        try {
          u();
        } catch {}
      });
      resolve(ok);
    };
    const subs: (() => void)[] = [];
    const timer = setTimeout(() => finish(false), LOAD_TIMEOUT_MS);
    try {
      const ad = m.InterstitialAd.createForAdRequest(id, {
        requestNonPersonalizedAdsOnly: minor, // mineurs : jamais de pub ciblée
      });
      subs.push(
        ad.addAdEventListener(m.AdEventType.LOADED, () => {
          clearTimeout(timer);
          ad.show().catch(() => finish(false));
        }),
      );
      subs.push(ad.addAdEventListener(m.AdEventType.CLOSED, () => finish(true)));
      subs.push(ad.addAdEventListener(m.AdEventType.ERROR, () => finish(false)));
      ad.load();
    } catch {
      finish(false);
    }
  });
}

/**
 * À appeler à chaque personne passée. Renvoie :
 *  - "none"  : pas de pub cette fois (ou Premium)
 *  - "shown" : une vraie pub AdMob a été affichée et fermée
 *  - "house" : à toi d'afficher la pub maison (composant HouseAd)
 */
export async function registerSkipAndMaybeAd(
  isPremium: boolean,
  isMinor: boolean,
): Promise<"none" | "shown" | "house"> {
  if (isPremium) return "none";
  skips++;
  if (skips % SKIPS_PER_AD !== 0) return "none";
  const ok = await showAdMob(isMinor);
  return ok ? "shown" : "house";
}

// Nombre de personnes passées avant la prochaine pub (pour l'affichage)
export function skipsBeforeNextAd(): number {
  return SKIPS_PER_AD - (skips % SKIPS_PER_AD);
}
