// Filtre de contenu : premier filet de sécurité appliqué AVANT l'envoi d'un message ou d'un texte public.
// Il fonctionne sur le téléphone (aucun texte n'est envoyé à un service externe).
// Ce n'est PAS une garantie : il complète les signalements, le blocage et la suspension des comptes.

export type FilterCategory = "minors" | "hate" | "threat" | "sexual" | "scam";

export const CATEGORY_MESSAGE: Record<FilterCategory, string> = {
  minors: "Ce message n'est pas autorisé : VimoX protège les mineurs.",
  hate: "Ce message contient des propos haineux ou discriminatoires.",
  threat: "Ce message contient une menace ou une incitation à la violence.",
  sexual: "Les messages sexuellement explicites ne sont pas autorisés.",
  scam: "Les messages publicitaires ou d'arnaque ne sont pas autorisés.",
};

// minuscules, sans accents, sans ponctuation : « Pédé !! » → « pede »
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’`]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Même texte mais lettres seules et « leet » défait (n1gg3r → nigger), sans espaces : « n i g g e r » → « nigger »
function compact(text: string): string {
  const map: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s" };
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[0134578@$]/g, (c) => map[c] ?? c)
    .replace(/[^a-z]/g, "");
}

// Insultes haineuses sans ambiguïté (comparées mot entier)
const HATE_WORDS = new Set([
  "nigger", "faggot", "kike", "chink", "tranny",
  "bougnoule", "bicot", "youpin", "pede", "gouine",
]);
// Mots longs détectés même séparés par des espaces ou des signes (« n.i.g.g.e.r »)
const HATE_COMPACT = ["nigger", "faggot", "bougnoule"];
const HATE_PHRASES = [
  /\bsales? (arabes?|noirs?|negres?|juifs?|pd|pedes?|gouines?|chinetoques?|rebeux?|blancs?)\b/,
  /\bretourne (dans|chez) (ton|ta) pays\b/,
  /\bmort aux (arabes|juifs|noirs|blancs|gays|pd|pedes)\b/,
];

const THREAT_PHRASES = [
  /\bje (vais|vas) (te |t )?(tuer|buter|violer|egorger|massacrer|crever|decouper)\b/,
  /\bsuicide ?toi\b/,
  /\bva (te )?(tuer|pendre)\b/,
  /\bkys\b/,
  /\bi (will|m gonna|am going to) (kill|rape) you\b/,
  /\bkill yourself\b/,
];

// Termes sexuels explicites : refusés seuls
const SEXUAL_WORDS = new Set([
  "nude", "nudes", "porno", "bite", "chatte", "fellation",
  "branler", "masturber", "masturbation",
]);
// Termes plus larges : refusés seulement quand le message évoque aussi un mineur
// (« coucher » retiré : « je vais me coucher » est une phrase de tous les jours)
const SEXUAL_LOOSE = new Set([...SEXUAL_WORDS, "sexe", "sex", "sexy", "seins", "sucer"]);
const SEXUAL_PHRASES = [
  /\b(envoie|envoi|montre|send|show)( moi| me)?( tes?| ta| your)? (nudes?|seins|cul|bite|chatte|photos? nues?)\b/,
  /\b(baise moi|fuck me|coucher avec moi|couche avec moi)\b/,
];

// Marqueurs de minorité (testés sur le texte d'origine, pour garder les chiffres)
const MINOR_AGE = /\b(?:[5-9]|1[0-5])\s?(?:ans|an|yo|y\/o|years? old|yrs?)\b/;
const MINOR_WORD = /\b(mineur|mineure|collegien|collegienne|ecolier|ecoliere|lyceen|lyceenne)s?\b/;

const SCAM_PHRASES = [
  /\bonlyfans\b/,
  /\bcash ?app\b/,
  /\bforex\b/,
  /\binvestissement (garanti|rapide)\b/,
  /\bgagn(e|er) (de l )?argent (facile|rapidement|vite)\b/,
];
const SHORTENERS = /\b(bit\.ly|tinyurl\.com|cutt\.ly|is\.gd|t\.me|wa\.me|discord\.gg)\//i;

export type FilterResult = { ok: true } | { ok: false; category: FilterCategory };

export function checkText(raw: string): FilterResult {
  const text = (raw ?? "").trim();
  if (!text) return { ok: true };
  const lower = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const norm = normalize(text);
  const words = norm.split(" ");
  const compacted = compact(text);

  const hasSexual =
    words.some((w) => SEXUAL_WORDS.has(w)) || SEXUAL_PHRASES.some((r) => r.test(norm));
  const hasMinor = MINOR_AGE.test(lower) || MINOR_WORD.test(norm);
  const hasSexualLoose =
    hasSexual || words.some((w) => SEXUAL_LOOSE.has(w));
  if (hasSexualLoose && hasMinor) return { ok: false, category: "minors" };

  if (
    words.some((w) => HATE_WORDS.has(w)) ||
    HATE_COMPACT.some((w) => compacted.includes(w)) ||
    HATE_PHRASES.some((r) => r.test(norm))
  ) {
    return { ok: false, category: "hate" };
  }
  if (THREAT_PHRASES.some((r) => r.test(norm))) return { ok: false, category: "threat" };
  if (hasSexual) return { ok: false, category: "sexual" };
  if (SCAM_PHRASES.some((r) => r.test(norm)) || SHORTENERS.test(lower)) {
    return { ok: false, category: "scam" };
  }
  return { ok: true };
}
