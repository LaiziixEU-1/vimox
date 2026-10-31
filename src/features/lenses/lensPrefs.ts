import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './projectBindings';

const FAVORITES_KEY = 'vimox:lenses:favorites';
const RECENTS_KEY = 'vimox:lenses:recents';
const MAX_RECENTS = 24;

async function readList(key: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeList(key: string, list: string[]) {
  AsyncStorage.setItem(key, JSON.stringify(list)).catch(() => {});
}

/** Favoris et lenses récentes, stockés sur l'appareil. */
export function useLensPrefs() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => {
    readList(FAVORITES_KEY).then(setFavorites);
    readList(RECENTS_KEY).then(setRecents);
  }, []);

  const toggleFavorite = useCallback(
    (lensId: string): boolean => {
      const added = !favorites.includes(lensId);
      const next = added ? [lensId, ...favorites] : favorites.filter((id) => id !== lensId);
      setFavorites(next);
      writeList(FAVORITES_KEY, next);
      return added;
    },
    [favorites],
  );

  const pushRecent = useCallback((lensId: string) => {
    setRecents((prev) => {
      const next = [lensId, ...prev.filter((id) => id !== lensId)].slice(0, MAX_RECENTS);
      writeList(RECENTS_KEY, next);
      return next;
    });
  }, []);

  return { favorites, recents, toggleFavorite, pushRecent };
}

/**
 * Statut Premium en temps réel depuis users/{uid}.
 * Adapte le nom du champ si ton premiumService en utilise un autre.
 * Quand RevenueCat sera branché, remplace par Purchases.getCustomerInfo()
 * (entitlement "premium").
 */
export function useIsPremium(): boolean {
  const [isPremium, setIsPremium] = useState(false);

  useEffect(() => {
    let unsubDoc: (() => void) | undefined;
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubDoc?.();
      unsubDoc = undefined;
      if (!user) {
        setIsPremium(false);
        return;
      }
      unsubDoc = onSnapshot(
        doc(db, 'users', user.uid),
        (snap) => {
          const data = snap.data();
          const until = data?.premiumUntil?.toMillis?.();
          setIsPremium(!!data?.isPremium && (!until || until > Date.now()));
        },
        () => setIsPremium(false),
      );
    });
    return () => {
      unsubDoc?.();
      unsubAuth();
    };
  }, []);

  return isPremium;
}
