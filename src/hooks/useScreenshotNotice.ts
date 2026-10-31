import { useEffect, useRef } from "react";

// Module chargé seulement s'il est installé (npx expo install expo-screen-capture) :
// sans lui, l'app marche normalement, simplement sans alerte de capture d'écran.
let ScreenCapture: any = null;
try {
  ScreenCapture = require("expo-screen-capture");
} catch {}

/**
 * Comme sur Snap : prévient quand la personne fait une capture d'écran de cet écran.
 * `onShot` est appelé au plus une fois toutes les 3 secondes (une rafale = une seule alerte).
 */
export function useScreenshotNotice(onShot: () => void, enabled = true) {
  const ref = useRef(onShot);
  ref.current = onShot;
  useEffect(() => {
    if (!enabled || !ScreenCapture?.addScreenshotListener) return;
    let last = 0;
    let sub: any = null;
    try {
      sub = ScreenCapture.addScreenshotListener(() => {
        const now = Date.now();
        if (now - last < 3000) return;
        last = now;
        ref.current();
      });
    } catch {}
    return () => {
      try {
        sub?.remove?.();
      } catch {}
    };
  }, [enabled]);
}
