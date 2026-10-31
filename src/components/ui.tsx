import { Children } from "react";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors, gradients } from "../theme/colors";

// Couleur de la pastille d'une icône (façon réglages iPhone) : toujours la même pour une icône donnée
const TINTS = ["#FF2E4D", "#4E8DFF", "#00C2A8", "#FFC24B", "#A35BFF", "#FF7A00", "#FF5F9E", "#2CB1FF"];
function tintOf(icon: string) {
  let h = 0;
  for (let i = 0; i < icon.length; i++) h = (h * 31 + icon.charCodeAt(i)) | 0;
  return TINTS[Math.abs(h) % TINTS.length];
}

// ── Titre de section en petites capitales ────────────────────────────
export function SectionTitle({ children }: { children: string }) {
  return <Text style={s.sectionTitle}>{children}</Text>;
}

// ── Groupe de lignes (une carte arrondie, lignes séparées par un trait fin) ──
export function ListGroup({ children }: { children: ReactNode }) {
  const items = Children.toArray(children).filter(Boolean);
  return (
    <View style={s.group}>
      {items.map((child, i) => (
        <View key={i}>
          {i > 0 && <View style={s.divider} />}
          {child}
        </View>
      ))}
    </View>
  );
}

// ── Ligne de menu : icône dans une pastille, texte, valeur, flèche ──
export function ListRow({
  icon,
  label,
  value,
  onPress,
  accent,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress: () => void;
  accent?: boolean;
}) {
  const tint = accent ? colors.gold : tintOf(icon);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.cardLight }]}
    >
      <View style={[s.iconWrap, { backgroundColor: tint + "26" }]}>
        <Ionicons name={icon as any} size={18} color={tint} />
      </View>
      <Text style={[s.rowLabel, accent && { color: colors.gold }]} numberOfLines={1}>
        {label}
      </Text>
      {value ? <Text style={s.rowValue}>{value}</Text> : null}
      <Ionicons name="chevron-forward" size={18} color={colors.mutedDark} />
    </Pressable>
  );
}

// ── Écran vide : icône, message, bouton facultatif ──
export function EmptyState({
  icon,
  title,
  text,
  actionLabel,
  onAction,
}: {
  icon: string;
  title: string;
  text?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={s.empty}>
      <LinearGradient
        colors={["rgba(255,46,77,0.22)", "rgba(255,107,61,0.08)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.emptyIcon}
      >
        <Ionicons name={icon as any} size={34} color={colors.neonRedText} />
      </LinearGradient>
      <Text style={s.emptyTitle}>{title}</Text>
      {text ? <Text style={s.emptyText}>{text}</Text> : null}
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          style={({ pressed }) => [s.emptyBtn, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }]}
        >
          <LinearGradient
            colors={gradients.brand as unknown as [string, string]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={s.emptyBtnTxt}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  sectionTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 22,
    marginBottom: 8,
    marginLeft: 6,
  },
  group: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 62,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowLabel: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "600" },
  rowValue: { color: colors.muted, fontSize: 14, fontWeight: "600" },
  empty: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 32, gap: 10 },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,46,77,0.35)",
    marginBottom: 6,
  },
  emptyTitle: { color: colors.text, fontSize: 17, fontWeight: "800", textAlign: "center" },
  emptyText: { color: colors.muted, fontSize: 14, textAlign: "center", lineHeight: 20 },
  emptyBtn: {
    marginTop: 10,
    backgroundColor: colors.neonRed,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 13,
    overflow: "hidden",
  },
  emptyBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
});
