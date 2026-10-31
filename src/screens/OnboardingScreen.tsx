import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { LinearGradient } from "expo-linear-gradient";
import { MATCH_ENABLED } from "../services/ageGate";

export const ONBOARDING_KEY = "vimox:onboarding_done";

const { width } = Dimensions.get("window");
const ALL_SLIDES = [
  {
    icon: "📸",
    title: "Vims, stories et flammes",
    desc: "Prends une photo ou une vidéo, ajoute du texte, des autocollants et de la musique, puis envoie-la à tes amis.",
    accent: "#FF2E4D",
  },
  {
    icon: "💬",
    title: "Chat · Groupes · Jeux",
    desc: "Discute en messages ou en vocal, appelle tes amis et joue à 7 jeux, à deux ou contre l'ordinateur.",
    accent: "#0066FF",
  },
  {
    icon: "👥",
    title: "Tes amis d'abord",
    desc: "Ajoute tes amis avec leur pseudo ou un code QR, et partage ton quotidien avec des stories de 24 h.",
    accent: "#8B00FF",
  },
  {
    icon: "🌐",
    match: true,
    title: "Match (18 ans et +)",
    desc: "Les adultes peuvent aussi faire de nouvelles rencontres avec Match. Tu choisis le pays et l'âge de tes rencontres.",
    accent: "#FF7A00",
  },
  {
    icon: "🛡️",
    title: "Tu gardes la main",
    desc: "Signale ou bloque une personne à tout moment, et masque ton statut en ligne dans les paramètres.",
    accent: "#00CC66",
  },
];

// Sans Match (interrupteur de secours), la diapositive qui en parle disparaît
const SLIDES = ALL_SLIDES.filter((sl) => !("match" in sl) || MATCH_ENABLED);

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [idx, setIdx] = useState(0);
  const slide = SLIDES[idx];

  async function next() {
    if (idx < SLIDES.length - 1) {
      setIdx((i) => i + 1);
    } else {
      await AsyncStorage.setItem(ONBOARDING_KEY, "true");
      onDone();
    }
  }
  async function skip() {
    await AsyncStorage.setItem(ONBOARDING_KEY, "true");
    onDone();
  }

  return (
    <SafeAreaView style={s.root}>
      {/* Halo de couleur VimoX en haut de l'écran */}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(255,46,77,0.28)", "rgba(255,107,61,0.10)", "rgba(9,9,12,0)"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 360 }}
      />
      <ScrollView contentContainerStyle={s.slide}>
        <Text style={s.icon}>{slide.icon}</Text>
        <Text style={[s.title, { color: slide.accent }]}>{slide.title}</Text>
        <Text style={s.desc}>{slide.desc}</Text>
      </ScrollView>
      <View style={s.dots}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              s.dot,
              i === idx && { width: 20, backgroundColor: slide.accent },
            ]}
          />
        ))}
      </View>
      <View style={s.actions}>
        <Pressable
          onPress={next}
          style={[s.btn, { backgroundColor: slide.accent }]}
        >
          <Text style={s.btnTxt}>
            {idx < SLIDES.length - 1 ? "Suivant →" : "Commencer →"}
          </Text>
        </Pressable>
        {idx < SLIDES.length - 1 && (
          <Pressable onPress={skip} style={s.skipBtn}>
            <Text style={s.skipTxt}>Passer</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  slide: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 20,
  },
  icon: { fontSize: 64 },
  title: { fontSize: 26, fontWeight: "900", textAlign: "center" },
  desc: {
    color: colors.muted,
    fontSize: 16,
    textAlign: "center",
    lineHeight: 26,
  },
  dots: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingVertical: 20,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.border },
  actions: { padding: 24, gap: 12 },
  btn: { borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  btnTxt: { color: "#fff", fontSize: 15, fontWeight: "900", letterSpacing: 1 },
  skipBtn: { alignItems: "center", paddingVertical: 8 },
  skipTxt: { color: colors.muted, fontSize: 13 },
});
