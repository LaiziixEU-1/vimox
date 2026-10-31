import { useEffect, useState } from 'react';
import { collection, doc, increment, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './projectBindings';

/**
 * Vraies statistiques des lenses (comme sur Snap) : chaque photo ou vidéo prise avec une lens
 * compte une utilisation. « Tendance » est trié par ces chiffres.
 * Firestore : lensUsage/{lensId} = { count }
 */
export async function incrementLensUse(lensId: string): Promise<void> {
  try {
    await setDoc(doc(db, 'lensUsage', lensId), { count: increment(1) }, { merge: true });
  } catch {
    // règle Firestore pas encore ajoutée : on ignore
  }
}

/** Nombre d'utilisations de chaque lens, en direct. */
export function useLensUsage(): Record<string, number> {
  const [usage, setUsage] = useState<Record<string, number>>({});
  useEffect(() => {
    return onSnapshot(
      collection(db, 'lensUsage'),
      (snap) => {
        const out: Record<string, number> = {};
        snap.docs.forEach((d) => {
          out[d.id] = Number(d.data()?.count) || 0;
        });
        setUsage(out);
      },
      () => {},
    );
  }, []);
  return usage;
}
