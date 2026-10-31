import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";

interface Props {
  title: string;
  subtitle?: string;
  // Fourni : une flèche de retour bien visible apparaît à gauche
  onBack?: () => void;
  // Action à droite (ex. « Enregistrer », bouton de recherche)
  right?: ReactNode;
  // false si l'écran gère déjà la zone de l'encoche (SafeAreaView)
  safeArea?: boolean;
}

// En-tête commun à tous les écrans qu'on ouvre « par-dessus » les autres :
// flèche de retour ronde (zone de toucher confortable), titre centré, action à droite.
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
  safeArea = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const top = safeArea ? Math.max(insets.top, 14) + 6 : 10;
  return (
    <View style={[s.root, { paddingTop: top }]}>
      <View style={s.side}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Retour"
            style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
        ) : null}
      </View>
      <View style={s.center}>
        <Text style={s.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={s.sub} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={[s.side, s.sideRight]}>{right}</View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: colors.black,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  side: { minWidth: 56, justifyContent: "center" },
  sideRight: { alignItems: "flex-end" },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cardLight,
  },
  center: { flex: 1, alignItems: "center", paddingHorizontal: 6 },
  title: { color: colors.text, fontSize: 18, fontWeight: "900", letterSpacing: 0.2 },
  sub: { color: colors.muted, fontSize: 12, marginTop: 1 },
});
