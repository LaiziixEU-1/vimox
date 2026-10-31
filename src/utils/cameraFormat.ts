import { Dimensions, Platform, ViewStyle } from "react-native";

// ───────────── Cadrage des caméras, comme sur Snap ─────────────
// Le format « Photo » (4:3, presque carré) devait être fortement coupé pour remplir un écran haut et étroit :
// l'image paraissait zoomée. Le format 16:9 (1920×1080) colle à la forme de l'écran : on voit beaucoup plus
// large, et l'image ne « saute » plus quand on passe de la photo à la vidéo (qui est déjà en 16:9).
// Si un téléphone ne gère pas ce format, la caméra choisit d'elle-même le format le plus proche.
export const SNAP_CAMERA_PROPS: Record<string, any> =
  Platform.OS === "android" ? { ratio: "16:9", pictureSize: "1920x1080" } : { pictureSize: "1920x1080" };

// Android : avec un format imposé, l'aperçu s'ajuste dans la vue (bandes noires) au lieu de la remplir.
// On le place donc dans une zone 16:9 un peu plus large que l'écran, centrée : il remplit tout l'écran,
// exactement comme sur iPhone. (Le conteneur doit avoir overflow: "hidden".)
export function cameraFillStyle(): ViewStyle {
  if (Platform.OS !== "android") return { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 };
  const { width, height } = Dimensions.get("window");
  const w = Math.max(width, Math.round((height * 9) / 16));
  const h = Math.max(height, Math.round((width * 16) / 9));
  return { position: "absolute", width: w, height: h, left: (width - w) / 2, top: (height - h) / 2 };
}
