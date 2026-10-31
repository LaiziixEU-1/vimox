// Fonctions annoncées mais pas encore disponibles (« Bientôt ») : visibles pendant le développement
// (Expo Go), CACHÉES automatiquement dans une version publiée (TestFlight, App Store) pour ne pas montrer
// de bouton qui ne fait rien (Apple le refuse).
export const SHOW_SOON_ITEMS: boolean = (globalThis as any).__SHOW_SOON__ ?? __DEV__;
