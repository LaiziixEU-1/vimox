// Lecture Firebase refusée ou impossible : on l'écrit clairement dans le terminal (au lieu d'une erreur
// rouge « Uncaught Error in snapshot listener ») et l'écran continue de fonctionner.
// « permission-denied » = les règles publiées dans la console Firebase ne permettent pas cette lecture
// (le plus souvent : le fichier firestore.rules du projet n'a pas encore été publié).
const seen = new Set<string>();
export function logDenied(where: string, e: any): void {
  const code = String(e?.code ?? e?.message ?? "erreur");
  const key = where + "|" + code;
  if (seen.has(key)) return; // une seule fois par cause, pour ne pas inonder le terminal
  seen.add(key);
  console.warn(`[VimoX] Lecture refusée : ${where} (${code})`);
}
