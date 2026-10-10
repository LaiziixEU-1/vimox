import AsyncStorage from "@react-native-async-storage/async-storage";
import { useState } from "react";
import {
  Dimensions,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors } from "../theme/colors";

export const ONBOARDING_KEY = "vimox:onboarding_done";

const { width } = Dimensions.get("window");
const SLIDES = [
  {
    icon: "🌐",
    title: "Match anonyme mondial",
    desc: "Connecte-toi à des inconnus du monde entier. Aucun profil exposé avant que tu décides.",
    accent: "#E8000A",
  },
  {
    icon: "💬",
    title: "Chat · Audio · Vidéo · Jeux",
    desc: "Texte, messages vocaux, appels vidéo ou parties de jeux. Tout dans une seule app.",
    accent: "#0066FF",
  },
  {
    icon: "👥",
    title: "Amis & Stories",
    desc: "Ajoute les personnes qui te plaisent et partage ton quotidien via des stories 24h.",
    accent: "#8B00FF",
  },
  {
    icon: "🛡️",
    title: "Sécurité totale",
    desc: "Signalement, blocage, modération. Ta sécurité est notre priorité.",
    accent: "#00CC66",
  },
];

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
