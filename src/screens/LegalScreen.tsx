import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors } from "../theme/colors";
import { ScreenHeader } from "../components/ScreenHeader";
import { fillLegal } from "../config/legal";
import content from "../config/legalContent.json";
import { RootStackParamList } from "../models/types";

type Props = NativeStackScreenProps<RootStackParamList, "Legal">;

// Le texte seul, réutilisé par l'écran de consentement (avant la connexion)
export function LegalDocument({ type }: { type: "cgu" | "privacy" }) {
  return type === "cgu" ? <CGUContent /> : <PrivacyContent />;
}

export function LegalScreen({ route, navigation }: Props) {
  const { type } = route.params;
  const isCGU = type === "cgu";

  return (
    <LinearGradient
      colors={[colors.black, "#111122", "#16080D"]}
      style={styles.root}
    >
      <ScreenHeader
        title={isCGU ? "Conditions d'utilisation" : "Confidentialité"}
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.content}>
        {isCGU ? <CGUContent /> : <PrivacyContent />}
      </ScrollView>
    </LinearGradient>
  );
}

// Les textes vivent dans legalContent.json : UNE seule source pour l'application ET pour le site web
// (scripts/build-legal-site.mjs). Les espaces réservés {{…}} sont remplis avec les infos de l'éditeur.
function Sections({ items }: { items: { title: string; body: string }[] }) {
  return (
    <View style={styles.body}>
      <Text style={styles.updated}>{content.updated}</Text>
      {items.map((s) => (
        <View key={s.title}>
          <Text style={styles.h2}>{s.title}</Text>
          <Text style={styles.p}>{fillLegal(s.body)}</Text>
        </View>
      ))}
    </View>
  );
}

function CGUContent() {
  return <Sections items={content.cgu} />;
}

function PrivacyContent() {
  return <Sections items={content.privacy} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.panelStrong,
  },
  back: { color: colors.neonBlue, fontWeight: "700", marginBottom: 8 },
  title: { color: colors.text, fontSize: 20, fontWeight: "900" },
  content: { padding: 20 },
  body: { gap: 12 },
  updated: { color: colors.muted, fontSize: 12, marginBottom: 8 },
  h2: { color: colors.neonBlue, fontSize: 15, fontWeight: "800", marginTop: 8 },
  p: { color: colors.muted, fontSize: 14, lineHeight: 22 },
});
