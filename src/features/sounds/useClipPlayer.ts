import { useEffect, useRef } from 'react';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

export type ClipSource = {
  url: string;
  startSec: number;
  clipSec: number;
  volume: number;
};

/**
 * Joue un extrait de musique en boucle (de startSec à startSec + clipSec), comme sur Snap.
 * `playing` démarre / arrête la lecture ; chaque démarrage repart du début de l'extrait.
 */
export function useClipPlayer(src: ClipSource | null, playing: boolean) {
  const playerRef = useRef<AudioPlayer | null>(null);
  const srcRef = useRef(src);
  srcRef.current = src;
  const url = src?.url ?? null;

  useEffect(() => {
    if (!url) return;
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    const p = createAudioPlayer({ uri: url });
    playerRef.current = p;
    return () => {
      // Pause avant de libérer : sinon le son peut continuer sur certains téléphones
      try {
        p.pause();
      } catch {}
      try {
        p.remove();
      } catch {}
      if (playerRef.current === p) playerRef.current = null;
    };
  }, [url]);

  useEffect(() => {
    const p = playerRef.current;
    if (p && src) p.volume = Math.max(0, Math.min(1, src.volume));
  }, [url, src?.volume]);

  useEffect(() => {
    const p = playerRef.current;
    if (!p || !src) return;
    if (!playing) {
      try {
        p.pause();
      } catch {}
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        p.volume = Math.max(0, Math.min(1, src.volume));
        await p.seekTo(src.startSec);
        if (!cancelled) p.play();
      } catch {}
    })();
    // Boucle sur l'extrait choisi
    const id = setInterval(() => {
      const s = srcRef.current;
      if (!s || !p.playing) return;
      if (p.currentTime >= s.startSec + s.clipSec - 0.15) p.seekTo(s.startSec).catch(() => {});
    }, 200);
    return () => {
      cancelled = true;
      clearInterval(id);
      try {
        p.pause();
      } catch {}
    };
  }, [playing, url, src?.startSec, src?.clipSec]);
}
