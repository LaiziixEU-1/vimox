// Remplace « expo-media-library » dans un NAVIGATEUR uniquement (voir metro.config.js).
// Ce module n'existe pas sur le web : cette version vide laisse l'application démarrer.
// Sur iPhone et Android, ce fichier n'est jamais utilisé.
const refusee = {
  granted: false,
  status: "denied",
  canAskAgain: false,
  expires: "never",
};

export type Asset = {
  id: string;
  uri: string;
  filename: string;
  mediaType: string;
  width: number;
  height: number;
  duration: number;
};

export function usePermissions(_options?: unknown) {
  return [refusee, async () => refusee, async () => refusee] as const;
}
export async function requestPermissionsAsync() {
  return refusee;
}
export async function getPermissionsAsync() {
  return refusee;
}
