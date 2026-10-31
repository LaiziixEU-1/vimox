// Demande d'ouvrir la caméra en mode Scan (depuis « Ajouter des amis », par exemple)
const listeners = new Set<() => void>();
let pending = false;

export const scanBus = {
  request() {
    pending = true;
    listeners.forEach((l) => l());
  },
  // La caméra s'abonne ; si une demande attendait, elle est traitée tout de suite
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    if (pending) listener();
    return () => {
      listeners.delete(listener);
    };
  },
  consume() {
    pending = false;
  },
};
