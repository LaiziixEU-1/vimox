import React from "react";
import {
  View,
  TouchableOpacity,
  Text,
  StyleSheet,
  Dimensions,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { GameDoc, updateGame } from "./gameService";
import { GameResultModal } from "./GameResultModal";

const { width } = Dimensions.get("window");
const CELL = Math.floor((width - 64) / 3);

function checkWinner(b: number[]): number | "draw" | null {
  for (const [a, bb, c] of [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ])
    if (b[a] && b[a] === b[bb] && b[a] === b[c]) return b[a];
  if (b.every((c) => c !== 0)) return "draw";
  return null;
}

interface Props {
  game: GameDoc;
  chatId: string;
  myId: string;
}

export function TicTacToe({ game, chatId, myId }: Props) {
  const navigation = useNavigation();
  const board: number[] = game.board;
  const isMyTurn = game.currentTurn === myId;
  const myPiece = myId === game.player1 ? 1 : 2;
  const mySymbol = myPiece === 1 ? "X" : "O";
  const finished = game.status === "finished";
  const w = game.winner;

  async function play(i: number) {
    if (!isMyTurn || board[i] || finished) return;
    const nb = [...board];
    nb[i] = myPiece;
    const res = checkWinner(nb);
    const next =
      game.currentTurn === game.player1 ? game.player2 : game.player1;
    await updateGame(chatId, game.id, {
      board: nb,
      currentTurn: res ? game.currentTurn : next,
      status: res ? "finished" : "playing",
      winner:
        res === 1
          ? game.player1
          : res === 2
            ? game.player2
            : res === "draw"
              ? "draw"
              : null,
    });
  }

  const statusColor = finished
    ? w === myId
      ? "#28F7A1"
      : w === "draw"
        ? "#FFD700"
        : "#FF4444"
    : isMyTurn
      ? "#fff"
      : "#aaa";

  const getSymbolColor = (cell: number) => (cell === 1 ? "#FF6B35" : "#4FC3F7");
  const getSymbol = (cell: number) =>
    cell === 1 ? "X" : cell === 2 ? "O" : "";

  return (
    <View style={s.container}>
      <View style={[s.statusRow, { borderColor: statusColor + "44" }]}>
        <Text style={[s.statusTxt, { color: statusColor }]}>
          {finished
            ? "Partie terminée"
            : isMyTurn
              ? `Ton tour — ${mySymbol}`
              : "Adversaire joue..."}
        </Text>
      </View>

      <View style={s.legend}>
        <View style={s.legendItem}>
          <Text style={[s.legendSym, { color: "#FF6B35" }]}>X</Text>
          <Text style={s.legendTxt}>
            {myPiece === 1 ? "Toi" : "Adversaire"}
          </Text>
        </View>
        <View style={s.legendItem}>
          <Text style={[s.legendSym, { color: "#4FC3F7" }]}>O</Text>
          <Text style={s.legendTxt}>
            {myPiece === 2 ? "Toi" : "Adversaire"}
          </Text>
        </View>
      </View>

      <View style={s.board}>
        {[0, 1, 2].map((row) => (
          <View key={row} style={s.row}>
            {[0, 1, 2].map((col) => {
              const i = row * 3 + col;
              const cell = board[i];
              const canPlay = !cell && isMyTurn && !finished;
              return (
                <TouchableOpacity
                  key={col}
                  style={[
                    s.cell,
                    { width: CELL, height: CELL },
                    col < 2 && s.borderR,
                    row < 2 && s.borderB,
                    canPlay && s.cellHover,
                    cell !== 0 && {
                      backgroundColor: getSymbolColor(cell) + "15",
                    },
                  ]}
                  onPress={() => play(i)}
                  disabled={!canPlay}
                  activeOpacity={0.7}
                >
                  {cell !== 0 && (
                    <Text style={[s.symbol, { color: getSymbolColor(cell) }]}>
                      {getSymbol(cell)}
                    </Text>
                  )}
                </TouchableOpacity>
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
    </View>
  );
}

const s = StyleSheet.create({
  container: { alignItems: "center", padding: 16, gap: 20 },
  statusRow: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  statusTxt: { fontSize: 16, fontWeight: "700" },
  legend: { flexDirection: "row", gap: 28 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 8 },
  legendSym: { fontSize: 22, fontWeight: "900" },
  legendTxt: { color: "#aaa", fontSize: 13 },
  board: {
    backgroundColor: "#1A237E",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#283593",
  },
  row: { flexDirection: "row" },
  cell: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1A237E",
  },
  cellHover: { backgroundColor: "rgba(255,255,255,0.05)" },
  borderR: { borderRightWidth: 2, borderRightColor: "#3949AB" },
  borderB: { borderBottomWidth: 2, borderBottomColor: "#3949AB" },
  symbol: { fontSize: 56, fontWeight: "900", lineHeight: 70 },
});
