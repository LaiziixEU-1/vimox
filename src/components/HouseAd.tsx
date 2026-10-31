import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors, gradients } from "../theme/colors";

// « Pub maison » plein écran : affichée quand aucune publicité AdMob n'est disponible
// (Expo Go, AdMob pas encore configuré...). Elle présente Vim+, fermable après 5 s.
const WAIT_S = 5;

export function HouseAd({
  visible,
  onClose,
  onPremium,
}: {
  visible: boolean;
  onClose: () => void;
  onPremium: () => void;
}) {
  const [left, setLeft] = useState(WAIT_S);

  useEffect(() => {
    if (!visible) return;
    setLeft(WAIT_S);
    const id = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [visible]);

  const canClose = left === 0;

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={() => {
      if (canClose) onClose();
    }}>
      <View style={s.root}>
        <View style={s.top}>
          <Text style={s.adLabel}>Publicité</Text>
          <Pressable
            onPress={onClose}
            disabled={!canClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={canClose ? "Fermer la publicité" : `Fermeture possible dans ${left} secondes`}
            style={[s.close, !canClose && { opacity: 0.8 }]}
          >
            {canClose ? (
              <Ionicons name="close" size={22} color="#fff" />
            ) : (
              <Text style={s.closeTxt}>{left}</Text>
            )}
          </Pressable>
        </View>

        <View style={s.center}>
          <Text style={s.star}>⭐</Text>
          <Text style={s.title}>Vim+</Text>
          <Text style={s.sub}>Enchaîne les rencontres sans aucune publicité.</Text>
          <View style={s.list}>
            {[
              ["🚫", "Aucune publicité, jamais"],
              ["🎯", "Priorité dans les matchs"],
              ["🔥", "2 flammes restaurées par mois"],
              ["⭐", "Badge Vim+ sur ton profil"],
            ].map(([i, t]) => (
              <View key={t} style={s.row}>
                <Text style={s.rowIcon}>{i}</Text>
                <Text style={s.rowTxt}>{t}</Text>
              </View>
            ))}
          </View>
        </View>

        <Pressable onPress={onPremium} style={({ pressed }) => [s.cta, pressed && { opacity: 0.85 }]} accessibilityRole="button">
          <LinearGradient
            colors={gradients.plus as unknown as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={[s.ctaTxt, { color: "#1A1000" }]}>Passer à Vim+</Text>
        </Pressable>
        <Pressable onPress={onClose} disabled={!canClose} style={s.later} accessibilityRole="button">
          <Text style={[s.laterTxt, !canClose && { opacity: 0.4 }]}>
            {canClose ? "Continuer gratuitement" : `Continuer dans ${left} s`}
          </Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#09090C", paddingHorizontal: 24, paddingTop: 56, paddingBottom: 40 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  adLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    textTransform: "uppercase",
  },
  close: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeTxt: { color: "#fff", fontSize: 15, fontWeight: "900" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  star: { fontSize: 64 },
  title: { color: "#fff", fontSize: 28, fontWeight: "900" },
  sub: { color: colors.muted, fontSize: 15, textAlign: "center", lineHeight: 22 },
  list: { marginTop: 18, gap: 12, alignSelf: "stretch" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowIcon: { fontSize: 20 },
  rowTxt: { color: "#fff", fontSize: 15, fontWeight: "700" },
  cta: { backgroundColor: "#FFC24B", borderRadius: 16, paddingVertical: 17, alignItems: "center", overflow: "hidden" },
  ctaTxt: { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 0.5 },
  later: { alignItems: "center", paddingTop: 16 },
  laterTxt: { color: colors.muted, fontSize: 14, fontWeight: "700" },
});
