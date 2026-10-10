import React, { useState } from "react";
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { GameDoc, updateGame } from "./gameService";
import { GameResultModal } from "./GameResultModal";

const SHIPS = [4, 3, 3, 2, 2];
const SHIP_NAMES = [
  "Croiseur",
  "Destroyer A",
  "Destroyer B",
  "Patrouilleur A",
  "Patrouilleur B",
];
const { width } = Dimensions.get("window");
const CELL = Math.floor((width - 48) / 10);

interface Props {
  game: GameDoc;
  chatId: string;
  myId: string;
}

export function Battleship({ game, chatId, myId }: Props) {
  const navigation = useNavigation();
  const board = game.board;
  const isP1 = myId === game.player1;
  const myBK = isP1 ? "p1Board" : "p2Board";
  const enBK = isP1 ? "p2Board" : "p1Board";
  const myRK = isP1 ? "p1Ready" : "p2Ready";
  const enRK = isP1 ? "p2Ready" : "p1Ready";
  const mySK = isP1 ? "p2Shots" : "p1Shots";
  const enSK = isP1 ? "p1Shots" : "p2Shots";
  const myBoard: number[] = board[myBK];
  const enBoard: number[] = board[enBK];
  const myShots: number[] = board[mySK] || [];
  const enShots: number[] = board[enSK] || [];
  const myReady: boolean = board[myRK];
  const enReady: boolean = board[enRK];
  const isMyTurn = game.currentTurn === myId;
  const finished = game.status === "finished";
  const w = game.winner;
  const [placingIdx, setPlacingIdx] = useState(0);
  const [horiz, setHoriz] = useState(true);
  const [preview, setPreview] = useState<number[]>([]);

  function getPreviewCells(idx: number): number[] {
    if (placingIdx >= SHIPS.length) return [];
    const size = SHIPS[placingIdx];
    const row = Math.floor(idx / 10),
      col = idx % 10;
    const cells: number[] = [];
    for (let i = 0; i < size; i++) {
      if (horiz) {
        if (col + i >= 10) return [];
        cells.push(row * 10 + col + i);
      } else {
        if (row + i >= 10) return [];
        cells.push((row + i) * 10 + col);
      }
    }
    if (cells.some((c) => myBoard[c] === 1)) return [];
    return cells;
  }

  async function placeShip(idx: number) {
    if (myReady || placingIdx >= SHIPS.length) return;
    const cells = getPreviewCells(idx);
    if (!cells.length) return;
    const nb = [...myBoard];
    cells.forEach((c) => (nb[c] = 1));
    const done = placingIdx + 1 >= SHIPS.length;
    await updateGame(chatId, game.id, {
      board: { ...board, [myBK]: nb, [myRK]: done },
    });
    setPlacingIdx((p) => p + 1);
    setPreview([]);
  }

  async function shoot(idx: number) {
    if (!isMyTurn || finished || !myReady || !enReady || myShots.includes(idx))
      return;
    const ns = [...myShots, idx];
    const total = enBoard.filter((c) => c === 1).length;
    const hits = ns.filter((s) => enBoard[s] === 1).length;
    const won = hits >= total;
    const next =
      game.currentTurn === game.player1 ? game.player2 : game.player1;
    await updateGame(chatId, game.id, {
      board: { ...board, [mySK]: ns },
      currentTurn: won ? game.currentTurn : next,
      status: won ? "finished" : "playing",
      winner: won ? myId : null,
    });
  }

  const myHits = myShots.filter((s) => enBoard[s] === 1).length;
  const total = SHIPS.reduce((a, b) => a + b, 0);

  if (!myReady)
    return (
      <ScrollView contentContainerStyle={s.container}>
        <Text style={s.title}>🚢 Place tes navires</Text>
        {placingIdx < SHIPS.length ? (
          <>
            <Text style={s.subtitle}>
              {SHIP_NAMES[placingIdx]} — {SHIPS[placingIdx]} cases (
              {placingIdx + 1}/{SHIPS.length})
            </Text>
            <TouchableOpacity
              style={s.rotBtn}
              onPress={() => {
                setHoriz((h) => !h);
                setPreview([]);
              }}
            >
              <Text style={s.rotTxt}>
                {horiz ? "→ Horizontal" : "↓ Vertical"} — Appuie pour tourner
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={s.subtitle}>✅ Navires placés ! En attente...</Text>
        )}
        <View style={[s.grid, { width: CELL * 10 + 2 }]}>
          {Array(10)
            .fill(null)
            .map((_, row) => (
              <View key={row} style={s.gridRow}>
                {Array(10)
                  .fill(null)
                  .map((_, col) => {
                    const idx = row * 10 + col;
                    const isShip = myBoard[idx] === 1;
                    const isPrev = preview.includes(idx);
                    return (
                      <TouchableOpacity
                        key={col}
                        style={[
                          s.cell,
                          { width: CELL, height: CELL },
                          isShip && s.shipCell,
                          isPrev && s.previewCell,
                        ]}
                        onPress={() => placeShip(idx)}
                        onPressIn={() => setPreview(getPreviewCells(idx))}
                        onPressOut={() => setPreview([])}
                      >
                        {isShip && <Text style={s.shipIcon}>🚢</Text>}
                      </TouchableOpacity>
                    );
                  })}
              </View>
            ))}
        </View>
      </ScrollView>
    );

  if (!enReady)
    return (
      <View style={s.container}>
        <Text style={s.title}>✅ Prêt au combat !</Text>
        <Text style={s.subtitle}>En attente de l'adversaire...</Text>
      </View>
    );

  return (
    <ScrollView contentContainerStyle={s.container}>
      <View
        style={[
          s.statusRow,
          { borderColor: (isMyTurn ? "#28F7A1" : "#aaa") + "55" },
        ]}
      >
        <Text style={[s.statusTxt, { color: isMyTurn ? "#28F7A1" : "#aaa" }]}>
          {finished
            ? "Partie terminée"
            : isMyTurn
              ? "🎯 Ton tour — tire !"
              : "⏳ Adversaire joue..."}
        </Text>
      </View>
      <View style={s.hitBar}>
        <Text style={s.hitTxt}>
          💥 {myHits}/{total} touches
        </Text>
        <View style={[s.hitProgress, { width: width - 80 }]}>
          <View style={[s.hitFill, { width: `${(myHits / total) * 100}%` }]} />
        </View>
      </View>
      <Text style={s.gridTitle}>🎯 Grille adversaire</Text>
      <View style={[s.grid, { width: CELL * 10 + 2 }]}>
        {Array(10)
          .fill(null)
          .map((_, row) => (
            <View key={row} style={s.gridRow}>
              {Array(10)
                .fill(null)
                .map((_, col) => {
                  const idx = row * 10 + col;
                  const shot = myShots.includes(idx);
                  const hit = shot && enBoard[idx] === 1;
                  return (
                    <TouchableOpacity
                      key={col}
                      style={[
                        s.cell,
                        { width: CELL, height: CELL },
                        hit && s.hitCell,
                        shot && !hit && s.missCell,
                      ]}
                      onPress={() => shoot(idx)}
                      disabled={shot || !isMyTurn || finished}
                      activeOpacity={0.7}
                    >
                      <Text style={s.cellIcon}>
                        {hit ? "💥" : shot ? "🌊" : ""}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            </View>
          ))}
      </View>
      <Text style={s.gridTitle}>🛡️ Ma grille</Text>
      <View style={[s.grid, { width: CELL * 10 + 2 }]}>
        {Array(10)
          .fill(null)
          .map((_, row) => (
            <View key={row} style={s.gridRow}>
              {Array(10)
                .fill(null)
                .map((_, col) => {
                  const idx = row * 10 + col;
                  const isShip = myBoard[idx] === 1;
                  const shot = enShots.includes(idx);
                  const hit = shot && isShip;
                  return (
                    <View
                      key={col}
                      style={[
                        s.cell,
                        { width: CELL, height: CELL },
                        isShip && s.myShipCell,
                        hit && s.hitCell,
                        shot && !hit && s.missCell,
                      ]}
                    >
                      <Text style={s.cellIcon}>
                        {hit ? "💥" : shot ? "🌊" : ""}
                      </Text>
                    </View>
                  );
                })}
            </View>
          ))}
      </View>

      <GameResultModal
        result={
          !finished ? null : w === "draw" ? "draw" : w === myId ? "win" : "lose"
        }
        onClose={() => navigation.goBack()}
      />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { padding: 16, alignItems: "center", gap: 12 },
  title: { color: "#fff", fontSize: 22, fontWeight: "800" },
  subtitle: { color: "#aaa", fontSize: 14, textAlign: "center" },
  statusRow: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  statusTxt: { fontSize: 16, fontWeight: "700" },
  hitBar: { gap: 6, width: "100%", paddingHorizontal: 16 },
  hitTxt: { color: "#fff", fontSize: 14, fontWeight: "700" },
  hitProgress: {
    height: 8,
    backgroundColor: "#222",
    borderRadius: 4,
    overflow: "hidden",
  },
  hitFill: { height: 8, backgroundColor: "#28F7A1", borderRadius: 4 },
  gridTitle: {
    color: "#888",
    fontSize: 13,
    fontWeight: "600",
    alignSelf: "flex-start",
  },
  grid: {
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 4,
    overflow: "hidden",
  },
  gridRow: { flexDirection: "row" },
  cell: {
    borderWidth: 0.5,
    borderColor: "#333",
    backgroundColor: "#0a1a2a",
    alignItems: "center",
    justifyContent: "center",
  },
  shipCell: { backgroundColor: "#1a3a2a" },
  myShipCell: { backgroundColor: "#1a2a3a" },
  previewCell: { backgroundColor: "#28F7A133" },
  hitCell: { backgroundColor: "#E8000A33" },
  missCell: { backgroundColor: "#ffffff11" },
  cellIcon: { fontSize: CELL > 25 ? 14 : 10 },
  rotBtn: {
    backgroundColor: "rgba(255,255,255,0.08)",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  rotTxt: { color: "#fff", fontSize: 13, fontWeight: "600" },
  shipIcon: { fontSize: 10 },
});
