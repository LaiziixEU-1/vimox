// ───────────── Match (rencontres avec des inconnus) : réservé aux adultes ─────────────
// Les mineurs (16-17 ans) gardent tout le reste : caméra, Vims, stories, amis, groupes, jeux.
// Cette barrière existe aux DEUX endroits : ici (onglet masqué) et dans les règles Firebase
// (file d'attente et salons de match refusés aux mineurs), pour qu'une app modifiée ne la contourne pas.
export const MATCH_MIN_AGE = 18;

// Interrupteur de secours : EXPO_PUBLIC_MATCH_ENABLED=false dans .env, puis un nouveau build, retire
// Match de l'app pour tout le monde (onglet, avantages Vim+, accueil). Utile si un store refuse l'app
// à cause du chat aléatoire : on peut alors publier sans Match et le réintroduire plus tard.
export const MATCH_ENABLED = (process.env.EXPO_PUBLIC_MATCH_ENABLED ?? "true").trim().toLowerCase() !== "false";

export function canUseMatch(profile: { age?: number } | null | undefined): boolean {
  return MATCH_ENABLED && typeof profile?.age === "number" && profile.age >= MATCH_MIN_AGE;
}
