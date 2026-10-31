import { useEffect, useState } from "react";

// Pastilles de la barre du bas (comme sur Snap) : nombre de choses nouvelles par onglet.
// Les écrans du pager (toujours montés) publient leur compte ; la barre l'affiche.
export type BadgeKey = "Matching" | "Friends" | "Camera" | "StoriesFeed" | "Profile";

const counts: Partial<Record<BadgeKey, number>> = {};
const listeners = new Set<() => void>();

export function setBadge(key: BadgeKey, n: number) {
  const v = Math.max(0, Math.floor(n || 0));
  if (counts[key] === v) return;
  counts[key] = v;
  listeners.forEach((l) => l());
}

export function useBadges(): Partial<Record<BadgeKey, number>> {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((x) => x + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return counts;
}
