import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { NeonButton } from "./NeonButton";

// Charte de sécurité de la rencontre aléatoire : affichée une seule fois, avant le premier match.
const KEY = "vimox.safetyCharter.v1";

export async function hasAcceptedCharter(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === "1";
  } catch {
    return false;
  }
}

const RULES: { icon: string; title: string; text: string }[] = [
  { icon: "heart-outline", title: "Sois respectueux", text: "Pas d'insultes, de harcèlement ni de contenu choquant. Les messages déplacés sont bloqués automatiquement." },
  { icon: "lock-closed-outline", title: "Garde tes infos pour toi", text: "Ne donne jamais ton adresse, ton école, ton numéro ou tes réseaux à un inconnu." },
  { icon: "eye-off-outline", title: "Rien d'intime", text: "N'envoie et n'accepte aucune photo ou vidéo intime. Personne n'a le droit de te le demander." },
  { icon: "flag-outline", title: "Un doute ? Signale et passe", text: "Le bouton ⚑ signale la personne et passe à quelqu'un d'autre en un geste. Les comptes signalés sont suspendus." },
  { icon: "people-outline", title: "Match, c'est entre adultes", text: "Il faut avoir 18 ans ou plus. Si quelqu'un te paraît mineur, signale-le tout de suite." },
];

export function SafetyCharter({ visible, onAccept, onClose }: { visible: boolean; onAccept: () => void; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    if (visible) setChecked(false);
  }, [visible]);

  async function accept() {
    try {
      await AsyncStorage.setItem(KEY, "1");
    } catch {}
    onAccept();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={st.overlay}>
        <View style={[st.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <View style={st.head}>
            <View style={st.shield}>
              <Ionicons name="shield-checkmark" size={30} color={colors.neonRed} />
            </View>
            <Text style={st.title}>Avant ta première rencontre</Text>
            <Text style={st.sub}>Match te met en relation avec des inconnus de 18 ans et plus. Quelques règles pour que ça reste sympa et sûr :</Text>
          </View>
          <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 12 }}>
            {RULES.map((r) => (
              <View key={r.title} style={st.rule}>
                <View style={st.ruleIcon}>
                  <Ionicons name={r.icon as any} size={20} color={colors.text} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.ruleTitle}>{r.title}</Text>
                  <Text style={st.ruleText}>{r.text}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
          <Pressable
            onPress={() => setChecked((v) => !v)}
            style={st.check}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
          >
            <View style={[st.box, checked && st.boxOn]}>{checked && <Ionicons name="checkmark" size={16} color="#fff" />}</View>
            <Text style={st.checkTxt}>J'ai lu et je respecterai ces règles</Text>
          </Pressable>
          <NeonButton title="C'EST PARTI" onPress={accept} disabled={!checked} />
          <Pressable onPress={onClose} style={st.later} accessibilityRole="button">
            <Text style={st.laterTxt}>Plus tard</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 22,
    gap: 14,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  head: { alignItems: "center", gap: 8 },
  shield: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.neonRedBg, alignItems: "center", justifyContent: "center" },
  title: { color: colors.text, fontSize: 20, fontWeight: "900", textAlign: "center" },
  sub: { color: colors.muted, fontSize: 13, textAlign: "center", lineHeight: 19 },
  rule: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  ruleIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.cardLight, alignItems: "center", justifyContent: "center" },
  ruleTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  ruleText: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  check: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: colors.borderLight, alignItems: "center", justifyContent: "center" },
  boxOn: { backgroundColor: colors.neonRed, borderColor: colors.neonRed },
  checkTxt: { color: colors.text, fontSize: 14, fontWeight: "700", flex: 1 },
  later: { alignItems: "center", paddingVertical: 6 },
  laterTxt: { color: colors.muted, fontSize: 13, fontWeight: "700" },
});
