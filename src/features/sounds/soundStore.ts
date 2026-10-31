import type { SoundClip } from './soundService';

/**
 * « Utiliser ce son » depuis une Story ou un Snap : le son est mis de côté ici,
 * et la caméra le récupère dès qu'elle est affichée.
 */
let pending: SoundClip | null = null;
const listeners = new Set<() => void>();

export const soundStore = {
  setPending(clip: SoundClip) {
    pending = clip;
    listeners.forEach((l) => l());
  },
  take(): SoundClip | null {
    const c = pending;
    pending = null;
    return c;
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
