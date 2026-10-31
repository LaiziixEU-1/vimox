// Icône de l'application au choix (avantage Vim+).
// Fonctionne dans l'app installée (build EAS) avec le module « expo-alternate-app-icons ».
// Dans Expo Go, le module n'existe pas : l'écran l'indique simplement.
export type AppIconId = "Classic" | "Gold" | "Neon" | "Glacier" | "Rose" | "Mint" | "Silver" | "Snow";

export const APP_ICONS: { id: AppIconId; label: string; thumb: any }[] = [
  { id: "Classic", label: "Classique", thumb: require("../../assets/app-icons/classic-thumb.png") },
  { id: "Gold", label: "Or", thumb: require("../../assets/app-icons/gold-thumb.png") },
  { id: "Neon", label: "Néon", thumb: require("../../assets/app-icons/neon-thumb.png") },
  { id: "Glacier", label: "Glacier", thumb: require("../../assets/app-icons/glacier-thumb.png") },
  { id: "Rose", label: "Rose", thumb: require("../../assets/app-icons/rose-thumb.png") },
  { id: "Mint", label: "Menthe", thumb: require("../../assets/app-icons/mint-thumb.png") },
  { id: "Silver", label: "Argent", thumb: require("../../assets/app-icons/silver-thumb.png") },
  { id: "Snow", label: "Neige", thumb: require("../../assets/app-icons/snow-thumb.png") },
];

let mod: any | null | undefined;
function icons(): any | null {
  if (mod !== undefined) return mod;
  try {
    mod = require("expo-alternate-app-icons");
  } catch {
    mod = null;
  }
  return mod;
}

export function appIconsSupported(): boolean {
  const m = icons();
  try {
    return !!m && m.supportsAlternateIcons !== false;
  } catch {
    return false;
  }
}

export function currentAppIcon(): AppIconId {
  const m = icons();
  try {
    return ((m?.getAppIconName?.() as AppIconId | null) ?? "Classic") || "Classic";
  } catch {
    return "Classic";
  }
}

export async function setAppIcon(id: AppIconId): Promise<boolean> {
  const m = icons();
  if (!m) return false;
  try {
    await m.setAlternateAppIcon(id === "Classic" ? null : id);
    return true;
  } catch {
    return false;
  }
}
