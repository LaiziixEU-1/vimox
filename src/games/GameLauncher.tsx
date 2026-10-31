import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GameType } from "./gameService";
import { G, haptic } from "./gameKit";

// ───────────── Menu des jeux ─────────────
// Chaque jeu a sa carte en dégradé, son emoji, sa durée moyenne, et le badge 🤖 s'il se joue contre l'ordinateur.
export const GAME_INFO: Record<
  GameType,
  { label: string; emoji: string; desc: string; minutes: string; colors: [string, string]; bot: boolean }
> = {
  uno: { label: "UNO", emoji: "🃏", desc: "Vide ta main en premier", minutes: "5 min", colors: ["#E3120B", "#8A0A06"], bot: true },
  ludo: { label: "Ludo", emoji: "🎲", desc: "Ramène tes 4 pions à la maison", minutes: "10 min", colors: ["#1A901A", "#0B4D0B"], bot: true },
  battleship: { label: "Bataille navale", emoji: "🚢", desc: "Coule la flotte ennemie", minutes: "8 min", colors: ["#1F4FD1", "#0B2470"], bot: true },
  connect4: { label: "4 à la suite", emoji: "🔴", desc: "Aligne 4 jetons", minutes: "3 min", colors: ["#2563EB", "#1E3A8A"], bot: true },
  checkers: { label: "Dames", emoji: "⚫", desc: "Prends toutes les pièces", minutes: "10 min", colors: ["#8B5A2B", "#4A2E14"], bot: true },
  tictactoe: { label: "Morpion", emoji: "❌", desc: "3 en ligne pour gagner", minutes: "1 min", colors: ["#7F5AF0", "#3F2A8C"], bot: true },
  drawing: { label: "Dessin deviné", emoji: "🎨", desc: "Dessine, fais deviner", minutes: "5 min", colors: ["#FF5F9E", "#9D2A63"], bot: false },
};
const ORDER: GameType[] = ["uno", "ludo", "battleship", "connect4", "checkers", "tictactoe", "drawing"];

interface Props {
  onSelect: (type: GameType, opts?: { bot?: boolean; level?: number }) => void;
  // « partenaire » (chat aléatoire) ou « ami » (chat entre amis)
  who?: "partenaire" | "ami";
}

const LEVELS = [
  { n: 1, label: "Facile", emoji: "🙂" },
  { n: 2, label: "Moyen", emoji: "😎" },
  { n: 3, label: "Difficile", emoji: "🔥" },
];

export function GameLauncher({ onSelect, who = "partenaire" }: Props) {
  const withWho = who === "ami" ? "Avec ton ami" : "Avec ton partenaire";
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<"friend" | "bot">("friend");
  const [level, setLevel] = useState(2);

  return (
    <>
      <Pressable
        onPress={() => {
          haptic("select");
          setVisible(true);
        }}
        style={({ pressed }) => [st.btn, pressed && { opacity: 0.7 }]}
        accessibilityRole="button"
        accessibilityLabel="Jouer à un jeu"
      >
        <Ionicons name={"game-controller-outline" as any} size={22} color={G.text} />
      </Pressable>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={() => setVisible(false)}>
        <View style={st.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setVisible(false)} accessibilityLabel="Fermer" />
          <View style={[st.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
            <View style={st.handle} />
            <View style={st.head}>
              <Text style={st.title}>🎮 Jouer</Text>
              <Pressable onPress={() => setVisible(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fermer">
                <Ionicons name="close" size={24} color={G.text} />
              </Pressable>
            </View>

            {/* Avec ton partenaire / contre l'ordinateur */}
            <View style={st.segment}>
              {(
                [
                  ["friend", "👥", withWho],
                  ["bot", "🤖", "Contre l'ordinateur"],
                ] as const
              ).map(([m, e, label]) => {
                const on = mode === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => {
                      haptic("select");
                      setMode(m);
                    }}
                    style={[st.segBtn, on && st.segBtnOn]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={{ fontSize: 15 }}>{e}</Text>
                    <Text style={[st.segTxt, on && st.segTxtOn]} numberOfLines={1}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {mode === "bot" && (
              <View style={st.levels}>
                {LEVELS.map((l) => {
                  const on = level === l.n;
                  return (
                    <Pressable
                      key={l.n}
                      onPress={() => {
                        haptic("select");
                        setLevel(l.n);
                      }}
                      style={[st.level, on && st.levelOn]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={{ fontSize: 14 }}>{l.emoji}</Text>
                      <Text style={[st.levelTxt, on && { color: "#1A1000" }]}>{l.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            <Text style={st.sub}>
              {mode === "bot"
                ? "Joue seul contre VimoX Bot 🤖"
                : who === "ami"
                  ? "Ton ami reçoit l'invitation dans votre conversation"
                  : "Ton partenaire reçoit l'invitation dans le chat"}
            </Text>

            <ScrollView contentContainerStyle={st.grid} showsVerticalScrollIndicator={false}>
              {ORDER.map((type) => {
                const g = GAME_INFO[type];
                const disabled = mode === "bot" && !g.bot;
                return (
                  <Pressable
                    key={type}
                    disabled={disabled}
                    onPress={() => {
                      haptic("select");
                      setVisible(false);
                      onSelect(type, mode === "bot" ? { bot: true, level } : undefined);
                    }}
                    style={({ pressed }) => [st.cardWrap, disabled && { opacity: 0.32 }, pressed && { transform: [{ scale: 0.97 }] }]}
                    accessibilityRole="button"
                    accessibilityLabel={`${g.label}, ${g.desc}`}
                    accessibilityState={{ disabled }}
                  >
                    <LinearGradient colors={g.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.card}>
                      <Text style={st.bigEmoji}>{g.emoji}</Text>
                      <Text style={st.cardTitle} numberOfLines={1}>{g.label}</Text>
                      <Text style={st.cardDesc} numberOfLines={2}>{g.desc}</Text>
                      <View style={st.chips}>
                        <View style={st.chip}>
                          <Text style={st.chipTxt}>⏱ {g.minutes}</Text>
                        </View>
                        {disabled ? (
                          <View style={st.chip}>
                            <Text style={st.chipTxt}>👥 À deux</Text>
                          </View>
                        ) : g.bot ? (
                          <View style={st.chip}>
                            <Text style={st.chipTxt}>🤖</Text>
                          </View>
                        ) : null}
                      </View>
                    </LinearGradient>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const st = StyleSheet.create({
  btn: { width: 40, height: 40, borderRadius: 20, backgroundColor: G.surface, alignItems: "center", justifyContent: "center" },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    maxHeight: "90%",
    backgroundColor: G.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: G.border,
  },
  handle: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: G.borderLight, marginBottom: 10 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  title: { color: G.text, fontSize: 22, fontWeight: "900" },
  segment: { flexDirection: "row", backgroundColor: G.bg, borderRadius: 16, padding: 4, gap: 4 },
  segBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 40, borderRadius: 12 },
  segBtnOn: { backgroundColor: G.accent },
  segTxt: { color: G.muted, fontSize: 13, fontWeight: "800" },
  segTxtOn: { color: "#fff" },
  levels: { flexDirection: "row", gap: 8, marginTop: 10 },
  level: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 36,
    borderRadius: 12,
    backgroundColor: G.bg,
    borderWidth: 1,
    borderColor: G.border,
  },
  levelOn: { backgroundColor: G.gold, borderColor: G.gold },
  levelTxt: { color: G.text, fontSize: 13, fontWeight: "800" },
  sub: { color: G.muted, fontSize: 13, textAlign: "center", marginVertical: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingBottom: 6 },
  cardWrap: { width: "48.5%" },
  card: { borderRadius: 20, padding: 14, minHeight: 150, justifyContent: "flex-end", overflow: "hidden" },
  bigEmoji: { fontSize: 34, position: "absolute", top: 12, right: 12 },
  cardTitle: { color: "#fff", fontSize: 17, fontWeight: "900" },
  cardDesc: { color: "rgba(255,255,255,0.82)", fontSize: 12, marginTop: 3, lineHeight: 16 },
  chips: { flexDirection: "row", gap: 6, marginTop: 10 },
  chip: { backgroundColor: "rgba(0,0,0,0.28)", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  chipTxt: { color: "#fff", fontSize: 11, fontWeight: "800" },
});
