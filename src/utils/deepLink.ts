// Liens de profil : vimox://profile/<id>  (et, plus tard, https://vimox.app/profile/<id>)
const PROFILE_LINK =
  /^(?:vimox:\/\/|https?:\/\/(?:www\.)?vimox\.app\/)profile\/([A-Za-z0-9]{10,64})\/?(?:[?#].*)?$/;

export function profileLink(userId: string): string {
  return `vimox://profile/${userId}`;
}

// Renvoie l'identifiant du profil contenu dans un lien, ou null si ce n'en est pas un
export function parseProfileLink(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.trim().match(PROFILE_LINK);
  return m ? m[1] : null;
}
