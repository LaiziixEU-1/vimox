// Informations de l'éditeur de l'application : elles apparaissent dans les textes légaux,
// l'écran de suspension et les Paramètres. À REMPLIR dans le fichier .env (voir .env.example).
// Tant qu'elles ne sont pas remplies, les textes affichent « à compléter » : c'est volontaire,
// pour ne jamais publier une fausse adresse de contact.
const clean = (v: string | undefined) => (v ?? "").trim();

export const LEGAL = {
  editorName: clean(process.env.EXPO_PUBLIC_EDITOR_NAME),
  editorAddress: clean(process.env.EXPO_PUBLIC_EDITOR_ADDRESS),
  supportEmail: clean(process.env.EXPO_PUBLIC_SUPPORT_EMAIL),
  privacyEmail: clean(process.env.EXPO_PUBLIC_PRIVACY_EMAIL) || clean(process.env.EXPO_PUBLIC_SUPPORT_EMAIL),
  // Droit applicable et tribunaux compétents : à définir avec ton juriste (ex. « Droit suisse, tribunaux de Lausanne »)
  governingLaw: clean(process.env.EXPO_PUBLIC_GOVERNING_LAW),
};

export const TODO = "[à compléter avant la publication]";

export function shown(value: string): string {
  return value || TODO;
}

// true quand l'éditeur a rempli son adresse de contact (sinon on ne propose pas de bouton e-mail)
export const hasSupportEmail = LEGAL.supportEmail.includes("@");

// Remplit les espaces réservés des textes légaux ({{EDITOR}}, {{SUPPORT_EMAIL}}…) avec les infos de l'éditeur.
export function fillLegal(text: string, v: typeof LEGAL = LEGAL): string {
  return text
    .replace(/\{\{EDITOR\}\}/g, `${shown(v.editorName)}, ${shown(v.editorAddress)}`)
    .replace(/\{\{SUPPORT_EMAIL\}\}/g, shown(v.supportEmail))
    .replace(/\{\{PRIVACY_EMAIL\}\}/g, shown(v.privacyEmail))
    .replace(/\{\{GOVERNING_LAW\}\}/g, shown(v.governingLaw))
    .replace(/\{\{TODO\}\}/g, TODO);
}
