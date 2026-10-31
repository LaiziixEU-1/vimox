// ───────────── Palette « VimoX Night » ─────────────
// Noirs profonds légèrement bleutés, rouge VimoX éclatant, or chaud pour Vim+.
export const darkColors = {
  black: "#09090C", // fond de l'app
  card: "#15151B", // cartes, feuilles, champs
  cardLight: "#1D1D25", // surfaces au-dessus des cartes
  border: "#24242E",
  borderLight: "#32323E",
  text: "#F7F7FA",
  muted: "#9B9BAA", // texte secondaire (plus lisible qu'avant)
  mutedDark: "#636372",
  neonRed: "#FF2E4D", // accent principal VimoX
  neonRedText: "#FF8FA0", // texte rouge sur fond sombre
  neonRedBg: "#2B0D15", // fond des pastilles rouges
  neonBlue: "#4E8DFF",
  panel: "rgba(255,255,255,0.05)",
  panelStrong: "#1F1F28",
  gold: "#FFC24B", // Vim+, records, séries
  goldDim: "#B88A2E",
};

// Variante claire : mêmes clés que le thème sombre
export const lightColors: typeof darkColors = {
  black: "#F6F6F9",
  card: "#FFFFFF",
  cardLight: "#EFEFF4",
  border: "#E3E3EA",
  borderLight: "#D2D2DC",
  text: "#121216",
  muted: "#666675",
  mutedDark: "#8C8C99",
  neonRed: "#F0163A",
  neonRedText: "#D0102F",
  neonRedBg: "#FFE4E9",
  neonBlue: "#2F6FE4",
  panel: "rgba(0,0,0,0.04)",
  panelStrong: "#EAEAF0",
  gold: "#D99A16",
  goldDim: "#A57210",
};

// Dégradés de la marque (boutons principaux, Vim+)
export const gradients = {
  brand: ["#FF2E4D", "#FF6B3D"] as const, // rouge → corail
  plus: ["#FFC24B", "#FF8A3D"] as const, // or → orange (Vim+)
  night: ["#1D1D25", "#09090C"] as const,
};

// Les écrans qui font `import { colors }` utilisent le thème sombre
export const colors = darkColors;
