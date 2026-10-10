import React, { useState } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { GameType } from "./gameService";

const GAMES = [
  {
    type: "connect4" as GameType,
    label: "4 à la suite",
    emoji: "🔴",
    desc: "Aligne 4 jetons",
  },
  {
    type: "tictactoe" as GameType,
    label: "Morpion",
    emoji: "❌",
    desc: "3 en ligne pour gagner",
  },
  {
    type: "battleship" as GameType,
    label: "Bataille navale",
    emoji: "🚢",
    desc: "Coule la flotte ennemie",
  },
  {
    type: "checkers" as GameType,
    label: "Dames",
    emoji: "⚫",
    desc: "Capture toutes les pièces",
  },
  {
    type: "ludo" as GameType,
    label: "Ludo",
    emoji: "🎲",
    desc: "Amène tous tes pions",
  },
  {
    type: "uno" as GameType,
    label: "UNO",
    emoji: "🃏",
    desc: "Vide ta main en premier",
  },
  {
    type: "drawing" as GameType,
    label: "Dessin deviné",
    emoji: "🎨",
    desc: "Dessine et fais deviner",
  },
];

interface Props {
  onSelect: (type: GameType) => void;
}

export function GameLauncher({ onSelect }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <TouchableOpacity onPress={() => setVisible(true)} style={styles.btn}>
        <Text style={styles.btnText}>🎮</Text>
      </TouchableOpacity>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() => setVisible(false)}
      >
        <TouchableOpacity
          style={styles.backdrop}
          onPress={() => setVisible(false)}
          activeOpacity={1}
        >
          <View style={styles.sheet}>
            <Text style={styles.title}>Choisir un jeu</Text>
            {GAMES.map((g) => (
              <TouchableOpacity
                key={g.type}
                style={styles.row}
                onPress={() => {
                  setVisible(false);
                  onSelect(g.type);
                }}
              >
                <Text style={styles.emoji}>{g.emoji}</Text>
                <View>
                  <Text style={styles.label}>{g.label}</Text>
                  <Text style={styles.desc}>{g.desc}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  btnText: { fontSize: 22 },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginBottom: 8,
  },
  emoji: { fontSize: 28 },
  label: { color: "#fff", fontSize: 15, fontWeight: "600" },
  desc: { color: "#888", fontSize: 12, marginTop: 2 },
});