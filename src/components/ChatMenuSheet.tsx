import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { SHOW_SOON_ITEMS } from "../config/features";

export type ChatMenuKey = "newChat" | "group" | "shortcut" | "manageChats" | "manageFriends" | "emojis";

const ITEMS: { key: ChatMenuKey; label: string; icon: string; soon?: boolean }[] = [
  { key: "newChat", label: "Nouveau chat", icon: "create-outline" },
  { key: "group", label: "Nouveau chat à plusieurs", icon: "people-outline", soon: true },
  { key: "shortcut", label: "Nouveau raccourci", icon: "flash-outline" },
  { key: "manageChats", label: "Gérer les chats", icon: "chatbubbles-outline" },
  { key: "manageFriends", label: "Gérer les amitiés", icon: "person-outline" },
  { key: "emojis", label: "Personnaliser les emojis d'amis proches", icon: "happy-outline" },
];

// Menu du bouton « ⋯ » de la liste de conversations (feuille qui monte du bas)
export function ChatMenuSheet({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (key: ChatMenuKey) => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Fermer le menu" />
        <View style={[s.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={s.card}>
            {ITEMS.filter((it) => !it.soon || SHOW_SOON_ITEMS).map((it, i) => (
              <Pressable
                key={it.key}
                onPress={() => onSelect(it.key)}
                accessibilityRole="button"
                accessibilityLabel={it.soon ? `${it.label}, bientôt disponible` : it.label}
                style={({ pressed }) => [s.row, i > 0 && s.rowBorder, pressed && { backgroundColor: colors.cardLight }]}
              >
                <Ionicons name={it.icon as any} size={20} color={it.soon ? colors.mutedDark : colors.text} />
                <Text style={[s.label, it.soon && { color: colors.muted }]} numberOfLines={2}>
                  {it.label}
                </Text>
                {it.soon && (
                  <View style={s.soon}>
                    <Text style={s.soonTxt}>Bientôt</Text>
                  </View>
                )}
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Terminé"
            style={({ pressed }) => [s.done, pressed && { opacity: 0.8 }]}
          >
            <Text style={s.doneTxt}>Terminé</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  wrap: { paddingHorizontal: 12, gap: 10 },
  card: { backgroundColor: colors.card, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 18, minHeight: 54, paddingVertical: 8 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderLight },
  label: { flex: 1, color: colors.text, fontSize: 16, fontWeight: "600" },
  soon: { backgroundColor: colors.neonRedBg, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3 },
  soonTxt: { color: colors.neonRedText, fontSize: 11, fontWeight: "800" },
  done: { backgroundColor: colors.card, borderRadius: 16, height: 54, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  doneTxt: { color: colors.text, fontSize: 16, fontWeight: "800" },
});
