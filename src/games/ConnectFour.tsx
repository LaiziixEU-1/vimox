import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  Vibration,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { GameDoc, updateGame } from "./gameService";
import { GameResultModal } from "./GameResultModal";

const ROWS = 6,
  COLS = 7;
const { width } = Dimensions.get("window");
const CELL = Math.floor((width - 32) / COLS);
const PIECE = CELL * 0.78;

function toBoard(raw: any): number[][] {
  if (!raw)
    return Array(ROWS)
      .fill(null)
      .map(() => Array(COLS).fill(0));
  return Array.from({ length: ROWS }, (_, r) => {
    const rawRow = raw[r] ?? raw[String(r)] ?? [];
    return Array.from({ length: COLS }, (_, c) =>
      Number(rawRow[c] ?? rawRow[String(c)] ?? 0),
    );
  });
}

function checkWin(b: number[][], piece: number): boolean {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS - 3; c++)
      if ([0, 1, 2, 3].every((i) => b[r][c + i] === piece)) return true;
  for (let r = 0; r < ROWS - 3; r++)
    for (let c = 0; c < COLS; c++)
      if ([0, 1, 2, 3].every((i) => b[r + i][c] === piece)) return true;
  for (let r = 0; r < ROWS - 3; r++)
    for (let c = 0; c < COLS - 3; c++)
      if ([0, 1, 2, 3].every((i) => b[r + i][c + i] === piece)) return true;
  for (let r = 3; r < ROWS; r++)
    for (let c = 0; c < COLS - 3; c++)
      if ([0, 1, 2, 3].every((i) => b[r - i][c + i] === piece)) return true;
  return false;
}

function isDraw(b: number[][]): boolean {
  return b[0].every((c) => c !== 0);
}
function findRow(b: number[][], col: number): number {
  for (let r = ROWS - 1; r >= 0; r--) if (b[r][col] === 0) return r;
  return -1;
}

interface Props {
  game: GameDoc;
  chatId: string;
  myId: string;
}

export function ConnectFour({ game, chatId, myId }: Props) {
  const navigation = useNavigation();
  const board = toBoard(game.board);
  const isP1 = myId === game.player1;
  const myPiece = isP1 ? 1 : 2;
  const isMyTurn = game.currentTurn === myId;
  const finished = game.status === "finished";
  const w = game.winner;

  const dropAnims = useRef(
    Array(COLS)
      .fill(null)
      .map(() => new Animated.Value(0)),
  ).current;
  const [dropping, setDropping] = useState(false);

  const drop = useCallback(
    async (col: number) => {
      if (!isMyTurn || finished || dropping) return;
      const row = findRow(board, col);
      if (row === -1) return;
      setDropping(true);
      Vibration.vibrate(18);
      dropAnims[col].setValue(0);
      await new Promise<void>((res) =>
        Animated.timing(dropAnims[col], {
          toValue: 1,
          duration: 280,
          easing: Easing.bounce,
          useNativeDriver: true,
        }).start(() => res()),
      );
      dropAnims[col].setValue(0);
      const nb = board.map((r) => [...r]);
      nb[row][col] = myPiece;
      const boardObj: Record<string, number[]> = {};
      nb.forEach((r, i) => {
        boardObj[String(i)] = r;
      });
      const win = checkWin(nb, myPiece);
      const draw = !win && isDraw(nb);
      const next =
        game.currentTurn === game.player1 ? game.player2 : game.player1;
      try {
        await updateGame(chatId, game.id, {
          board: boardObj,
          currentTurn: win || draw ? game.currentTurn : next,
          status: win || draw ? "finished" : "playing",
          winner: win ? myId : draw ? "draw" : null,
        });
      } catch (e) {
        console.error("ConnectFour drop:", e);
      } finally {
        setDropping(false);
      }
    },
    [isMyTurn, finished, dropping, board, myPiece],
  );

  const myColor = isP1 ? "#E8000A" : "#FFD600";
  const enColor = isP1 ? "#FFD600" : "#E8000A";

  return (
    <View style={s.root}>
      <View
        style={[
          s.statusPill,
          {
            backgroundColor: finished
              ? w === myId
                ? "#28F7A122"
                : w === "draw"
                  ? "#55555522"
                  : "#FF444422"
              : isMyTurn
                ? "#E8000A22"
                : "#22222288",
          },
        ]}
      >
        <View
          style={[
            s.statusDot,
            { backgroundColor: isMyTurn && !finished ? "#E8000A" : "#666" },
          ]}
        />
        <Text style={s.statusTxt}>
          {finished
            ? "Partie terminée"
            : isMyTurn
              ? "🎯 Ton tour — Choisis une colonne"
              : "⌛ Tour de l'adversaire..."}
        </Text>
      </View>

      <View style={s.legend}>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: myColor }]} />
          <Text style={s.legendTxt}>Toi</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: enColor }]} />
          <Text style={s.legendTxt}>Adversaire</Text>
        </View>
      </View>

      <View style={s.arrowRow}>
        {Array(COLS)
          .fill(0)
          .map((_, c) => {
            const canDrop =
              isMyTurn && !finished && !dropping && findRow(board, c) !== -1;
            return (
              <TouchableOpacity
                key={c}
                style={s.arrowBtn}
                onPress={() => drop(c)}
                disabled={!canDrop}
                activeOpacity={0.6}
              >
                <Text style={[s.arrow, { color: canDrop ? myColor : "#333" }]}>
                  ▼
                </Text>
              </TouchableOpacity>
            );
          })}
      </View>

      <View style={s.board}>
        {board.map((row, r) => (
          <View key={r} style={s.row}>
            {row.map((cell, c) => {
              const dropScale = dropAnims[c].interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [1, 1.15, 1],
              });
              return (
                <TouchableOpacity
                  key={c}
                  onPress={() => drop(c)}
                  activeOpacity={0.8}
                >
                  <View style={s.cell}>
                    <Animated.View
                      style={[
                        s.piece,
                        cell === 0 && s.pieceEmpty,
                        cell === 1 && {
                          backgroundColor: isP1 ? myColor : enColor,
                        },
                        cell === 2 && {
                          backgroundColor: isP1 ? enColor : myColor,
                        },
                        { transform: [{ scale: cell === 0 ? 1 : dropScale }] },
                      ]}
                    />
                  </View>
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
  root: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#111",
    paddingTop: 12,
    gap: 10,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusTxt: { color: "#fff", fontSize: 13, fontWeight: "700" },
  legend: { flexDirection: "row", gap: 20 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 14, height: 14, borderRadius: 7 },
  legendTxt: { color: "#555", fontSize: 12, fontWeight: "600" },
  arrowRow: { flexDirection: "row", width: COLS * CELL },
  arrowBtn: { width: CELL, alignItems: "center", paddingVertical: 4 },
  arrow: { fontSize: 16, fontWeight: "900" },
  board: {
    backgroundColor: "#1565C0",
    borderRadius: 16,
    padding: 6,
    gap: 4,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  row: { flexDirection: "row", gap: 4 },
  cell: {
    width: CELL - 4,
    height: CELL - 4,
    backgroundColor: "#1050A0",
    borderRadius: (CELL - 4) / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  piece: { width: PIECE, height: PIECE, borderRadius: PIECE / 2 },
  pieceEmpty: { backgroundColor: "rgba(0,0,40,0.35)" },
});
