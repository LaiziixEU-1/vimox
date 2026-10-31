// Notifications DANS l'app (bannière en haut), comme sur Snap :
// les écrans qui écoutent les conversations publient un événement, la bannière l'affiche.
export type InAppNotice = {
  key: string; // pour éviter d'afficher deux fois la même chose
  title: string;
  body: string;
  emoji?: string;
  photo?: string | null;
  target: { name: string; params?: any };
};

const listeners = new Set<(n: InAppNotice) => void>();
const seen = new Set<string>();

export const inAppBus = {
  show(n: InAppNotice) {
    if (seen.has(n.key)) return;
    seen.add(n.key);
    if (seen.size > 300) seen.clear();
    listeners.forEach((l) => l(n));
  },
  subscribe(l: (n: InAppNotice) => void): () => void {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};
