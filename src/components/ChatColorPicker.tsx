import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import { colors } from "../theme/colors";
import { useAuth } from "../services/AuthContext";

// Vim+ : la couleur de MES messages dans les chats entre amis (vue aussi par mes amis)
export const CHAT_COLORS = [
  "#4D7CFE", // bleu (par défaut)
  "#FF2E4D", // rouge VimoX
  "#FF4FA3", // rose
  "#A35BFF", // violet
  "#14C38E", // vert
  "#00B8D9", // turquoise
  "#FFB020", // or
  "#FF7A00", // orange
  "#C9B98C", // sable
  "#FFFFFF", // blanc
];

export function ChatColorPicker() {
  const { profile } = useAuth();
  const current = ((profile as any)?.chatColor as string) ?? CHAT_COLORS[0];
  const [saving, setSaving] = useState<string | null>(null);

  async function pick(c: string) {
    if (!profile || saving) return;
    setSaving(c);
    try {
      await updateDoc(doc(db, "users", profile.id), { chatColor: c });
    } catch {
      Alert.alert("Couleur non enregistrée", "Vérifie ta connexion et réessaie.");
    } finally {
      setSaving(null);
    }
  }

  return (
    <View style={s.card}>
      <Text style={s.title}>🎨 Couleur de mes messages</Text>
      <View style={s.preview}>
        <View style={[s.bar, { backgroundColor: current }]} />
        <View>
          <Text style={[s.label, { color: current }]}>MOI</Text>
          <Text style={s.msg}>Voilà à quoi ressemblent mes messages ✨</Text>
        </View>
      </View>
      <View style={s.row}>
        {CHAT_COLORS.map((c) => {
          const on = c.toLowerCase() === current.toLowerCase();
          return (
            <Pressable
              key={c}
              onPress={() => pick(c)}
              accessibilityRole="button"
              accessibilityLabel={`Couleur ${c}`}
              accessibilityState={{ selected: on }}
              style={[s.dot, { backgroundColor: c }, on && s.dotOn]}
            >
              {on && <Ionicons name="checkmark" size={18} color={c === "#FFFFFF" ? "#000" : "#fff"} />}
            </Pressable>
          );
        })}
      </View>
      <Text style={s.hint}>Tes amis voient aussi cette couleur dans vos conversations.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    alignSelf: "stretch",
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
    marginTop: 18,
  },
  title: { color: colors.text, fontSize: 16, fontWeight: "800" },
  preview: { flexDirection: "row", gap: 10, paddingVertical: 4 },
  bar: { width: 3, borderRadius: 2, alignSelf: "stretch" },
  label: { fontSize: 11, fontWeight: "900", letterSpacing: 0.8 },
  msg: { color: colors.text, fontSize: 15, marginTop: 2 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  dot: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "transparent" },
  dotOn: { borderColor: "#fff" },
  hint: { color: colors.muted, fontSize: 12 },
});
