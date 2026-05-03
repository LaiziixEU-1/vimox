import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NeonButton } from "../components/NeonButton";
import { colors } from "../theme/colors";

export const CONSENT_KEY = "vimox_consent_v1";

interface Props {
  onAccept: () => void;
}

export function ConsentScreen({ onAccept }: Props) {
  const [accepted, setAccepted] = useState(false);

  async function handleAccept() {
    await AsyncStorage.setItem(CONSENT_KEY, "true");
    onAccept();
  }

  return (
    <LinearGradient
      colors={[colors.black, "#111122", "#16080D"]}
      style={styles.root}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Bienvenue sur VimoX 👋</Text>
        <Text style={styles.subtitle}>
          Avant de continuer, nous avons besoin de ton accord.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🍪 Cookies & données</Text>
          <Text style={styles.cardText}>
            VimoX utilise des cookies techniques nécessaires au bon
            fonctionnement de l'application. Nous ne collectons aucune donnée
            publicitaire.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>🔒 Tes données</Text>
          <Text style={styles.cardText}>
            Nous collectons uniquement les données nécessaires : nom, âge,
            genre, pays et email. Tu peux supprimer ton compte et toutes tes
            données à tout moment.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>👤 Âge minimum</Text>
          <Text style={styles.cardText}>
            VimoX est réservé aux personnes de 16 ans et plus. En continuant, tu
            confirmes avoir au moins 16 ans.
          </Text>
        </View>

        <Pressable
          onPress={() => setAccepted((v) => !v)}
          style={styles.checkRow}
        >
          <View style={[styles.checkbox, accepted && styles.checkboxActive]}>
            {accepted && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.checkText}>
            J'accepte les{" "}
            <Text style={styles.link}>Conditions d'utilisation</Text> et la{" "}
            <Text style={styles.link}>Politique de confidentialité</Text>
          </Text>
        </Pressable>

        <NeonButton
          title="Continuer"
          onPress={handleAccept}
          disabled={!accepted}
        />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 24, paddingTop: 80, gap: 20 },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
  },
  subtitle: {
    color: colors.muted,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: colors.panelStrong,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  cardTitle: { color: colors.text, fontWeight: "800", fontSize: 16 },
  cardText: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.neonBlue,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 2,
  },
  checkboxActive: { backgroundColor: colors.neonBlue },
  checkmark: { color: colors.text, fontWeight: "900", fontSize: 14 },
  checkText: { color: colors.muted, flex: 1, fontSize: 14, lineHeight: 21 },
  link: { color: colors.neonBlue, fontWeight: "700" },
});
