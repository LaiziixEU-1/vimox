// Permet à n'importe quel écran de changer de page dans le pager principal
// (ex. « Ma story + » ouvre la caméra, « Mes amis » glisse vers la page Amis).
export type PagerPage = "Matching" | "Friends" | "Camera" | "StoriesFeed" | "Profile";

const listeners = new Set<(page: PagerPage) => void>();

let currentPage: PagerPage = "Camera";

export const pagerBus = {
  // Page affichée en ce moment (la bannière de notification ne s'affiche pas sur la liste des chats)
  get current(): PagerPage {
    return currentPage;
  },
  setCurrent(page: PagerPage) {
    currentPage = page;
  },
  go(page: PagerPage) {
    listeners.forEach((l) => l(page));
  },
  subscribe(listener: (page: PagerPage) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
