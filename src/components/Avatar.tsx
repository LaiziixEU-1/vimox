import { Text, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";

// Avatar : photo (mise en cache, apparition en fondu) ou initiales sur un dégradé propre à chaque personne
const PALETTE: [string, string][] = [
  ["#FF2E4D", "#FF6B3D"],
  ["#7F5AF0", "#2CB1FF"],
  ["#00C2A8", "#3EE07B"],
  ["#FF5F9E", "#B23A7A"],
  ["#F7971E", "#FFD200"],
  ["#4E8DFF", "#7FB3FF"],
  ["#E100FF", "#7F00FF"],
  ["#11998E", "#38EF7D"],
  ["#FF8A3D", "#FF2E4D"],
  ["#2B5876", "#4E4376"],
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function initials(name?: string) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const a = Array.from(parts[0])[0] ?? "";
  const b = parts.length > 1 ? Array.from(parts[parts.length - 1])[0] ?? "" : "";
  return (a + b).toUpperCase();
}

export function Avatar({ uri, name, size = 46 }: { uri?: string | null; name?: string; size?: number }) {
  if (uri) {
    return (
      <ExpoImage
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: "#1D1D25" }}
        contentFit="cover"
        transition={150}
        cachePolicy="memory-disk"
        accessibilityIgnoresInvertColors
      />
    );
  }
  const colors = PALETTE[hash(name ?? "?") % PALETTE.length];
  const label = initials(name);
  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center" }}
    >
      <View>
        <Text style={{ color: "#fff", fontWeight: "900", fontSize: size * (label.length > 1 ? 0.36 : 0.42), letterSpacing: 0.5 }}>
          {label}
        </Text>
      </View>
    </LinearGradient>
  );
}
