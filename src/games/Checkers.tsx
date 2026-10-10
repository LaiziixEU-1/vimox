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

const { width } = Dimensions.get("window");
const BOARD_SIZE = Math.min(width - 32, 360);
const CELL = Math.floor(BOARD_SIZE / 8);

function toCells(raw: any): number[] {
  const result: number[] = [];
  for (let i = 0; i < 64; i++)
    result.push(Number(raw?.[i] ?? raw?.[String(i)] ?? 0));
  return result;
}

interface Move {
  to: number;
  capture?: number;
}

function getMoves(cells: number[], from: number, piece: number): Move[] {
  const row = Math.floor(from / 8),
    col = from % 8;
  const moves: Move[] = [];
  const isKing = piece === 3 || piece === 4;
  const isP1 = piece === 1 || piece === 3;
  const dirs: [number, number][] = [];
  if (isP1 || isKing) dirs.push([-1, -1], [-1, 1]);
  if (!isP1 || isKing) dirs.push([1, -1], [1, 1]);
  for (const [dr, dc] of dirs) {
    const r1 = row + dr,
      c1 = col + dc;
    if (r1 < 0 || r1 > 7 || c1 < 0 || c1 > 7) continue;
    const to = r1 * 8 + c1;
    if (cells[to] === 0) {
      moves.push({ to });
    } else {
      const isEnemy = isP1
        ? cells[to] === 2 || cells[to] === 4
        : cells[to] === 1 || cells[to] === 3;
      if (isEnemy) {
        const r2 = r1 + dr,
          c2 = c1 + dc;
        if (
          r2 >= 0 &&
          r2 <= 7 &&
          c2 >= 0 &&
          c2 <= 7 &&
          cells[r2 * 8 + c2] === 0
        )
          moves.push({ to: r2 * 8 + c2, capture: to });
      }
    }
  }
  return moves;
}

function getCaptures(
  cells: number[],
  piece: number,
): { from: number; move: Move }[] {
  const result: { from: number; move: Move }[] = [];
  for (let i = 0; i < 64; i++) {
    const p = cells[i];
    if (p !== piece && p !== piece + 2) continue;
    getMoves(cells, i, p)
      .filter((m) => m.capture !== undefined)
      .forEach((m) => result.push({ from: i, move: m }));
  }
  return result;
}

function isMineCell(cell: number, myPiece: number): boolean {
  return cell === myPiece || cell === myPiece + 2;
}

interface Props {
  game: GameDoc;
  chatId: string;
  myId: string;
}

export function Checkers({ game, chatId, myId }: Props) {
  const navigation = useNavigation();
  const bd = game.board;
  const cells = toCells(bd.cells ?? bd);
  const isMyTurn = game.currentTurn === myId;
  const myPiece = myId === game.player1 ? 1 : 2;
  const finished = game.status === "finished";
  const w = game.winner;
  const [sel, setSel] = useState(-1);
  const mandatoryCaptures = isMyTurn ? getCaptures(cells, myPiece) : [];
  const mustCapture = mandatoryCaptures.length > 0;
  const capturableFrom = new Set(mandatoryCaptures.map((c) => c.from));

  async function press(idx: number) {
    if (!isMyTurn || finished) return;
    const piece = cells[idx];
    const isMine = piece === myPiece || piece === myPiece + 2;
    if (sel === -1) {
      if (!isMine) return;
      if (mustCapture && !capturableFrom.has(idx)) return;
      setSel(idx);
      return;
    }
    if (isMine) {
      if (mustCapture && !capturableFrom.has(idx)) return;
      setSel(idx);
      return;
    }
    const allMoves = getMoves(cells, sel, cells[sel]);
    const validMoves = mustCapture
      ? allMoves.filter((m) => m.capture !== undefined)
      : allMoves;
    const move = validMoves.find((m) => m.to === idx);
    if (!move) {
      setSel(-1);
      return;
    }
    const nc = [...cells];
    nc[move.to] = nc[sel];
    nc[sel] = 0;
    if (move.capture !== undefined) nc[move.capture] = 0;
    if (myPiece === 1 && Math.floor(move.to / 8) === 0) nc[move.to] = 3;
    if (myPiece === 2 && Math.floor(move.to / 8) === 7) nc[move.to] = 4;
    let nextTurn =
      game.currentTurn === game.player1 ? game.player2 : game.player1;
    let newSel = -1;
    if (move.capture !== undefined) {
      const further = getMoves(nc, move.to, nc[move.to]).filter(
        (m) => m.capture !== undefined,
      );
      if (further.length > 0) {
        nextTurn = game.currentTurn;
        newSel = move.to;
      }
    }
    const p1Left = nc.some((c) => c === 1 || c === 3);
    const p2Left = nc.some((c) => c === 2 || c === 4);
    const won = !p1Left || !p2Left;
    await updateGame(chatId, game.id, {
      board: { cells: nc, selected: newSel },
      currentTurn: won ? game.currentTurn : nextTurn,
      status: won ? "finished" : "playing",
      winner: won ? myId : null,
    });
    setSel(newSel);
  }

  const allMoves = sel !== -1 ? getMoves(cells, sel, cells[sel]) : [];
  const validMoves = mustCapture
    ? allMoves.filter((m) => m.capture !== undefined)
    : allMoves;
  const validTargets = new Set(validMoves.map((m) => m.to));
  const p1Count = cells.filter((c) => c === 1 || c === 3).length;
  const p2Count = cells.filter((c) => c === 2 || c === 4).length;
  const myCount = myPiece === 1 ? p1Count : p2Count;
  const enCount = myPiece === 1 ? p2Count : p1Count;
  const myColor = myPiece === 1 ? "#C1121F" : "#F0F0F0";
  const enColor = myPiece === 1 ? "#F0F0F0" : "#C1121F";
  const statusColor = finished
    ? w === myId
      ? "#28F7A1"
      : "#FF4444"
    : isMyTurn
      ? "#28F7A1"
      : "#666";

  return (
    <ScrollView contentContainerStyle={s.container}>
      <View style={[s.statusRow, { borderColor: statusColor + "55" }]}>
        <Text style={[s.statusTxt, { color: statusColor }]}>
          {finished
            ? "Partie terminée"
            : isMyTurn
              ? mustCapture
                ? "🔴 Capture obligatoire !"
                : sel !== -1
                  ? "🎯 Choisis une case"
                  : "Ton tour"
              : "⏳ Adversaire joue..."}
        </Text>
      </View>

      <View style={s.scoreRow}>
        <View style={s.scoreBox}>
          <View
            style={[
              s.scoreDisk,
              {
                backgroundColor: myColor,
                borderColor: myColor === "#F0F0F0" ? "#ccc" : "#8B0000",
              },
            ]}
          />
          <Text style={s.scoreNum}>{myCount}</Text>
          <Text style={s.scoreLbl}>Toi</Text>
        </View>
        <View style={s.scoreCenter}>
          <Text style={s.scoreVs}>VS</Text>
          {mustCapture && isMyTurn && (
            <View style={s.captureBadge}>
              <Text style={s.captureBadgeTxt}>⚡ Capture !</Text>
            </View>
          )}
        </View>
        <View style={s.scoreBox}>
          <View
            style={[
              s.scoreDisk,
              {
                backgroundColor: enColor,
                borderColor: enColor === "#F0F0F0" ? "#ccc" : "#8B0000",
              },
            ]}
          />
          <Text style={s.scoreNum}>{enCount}</Text>
          <Text style={s.scoreLbl}>Adversaire</Text>
        </View>
      </View>

      <View style={[s.boardWrap, { width: BOARD_SIZE + 6 }]}>
        <View style={s.colLabels}>
          {["A", "B", "C", "D", "E", "F", "G", "H"].map((l) => (
            <Text key={l} style={[s.label, { width: CELL }]}>
              {l}
            </Text>
          ))}
        </View>
        <View style={s.boardRow}>
          <View style={s.rowLabels}>
            {[8, 7, 6, 5, 4, 3, 2, 1].map((n) => (
              <Text key={n} style={[s.label, { height: CELL }]}>
                {n}
              </Text>
            ))}
          </View>
          <View style={[s.board, { width: CELL * 8, height: CELL * 8 }]}>
            {Array(8)
              .fill(null)
              .map((_, row) => (
                <View key={row} style={s.row}>
                  {Array(8)
                    .fill(null)
                    .map((_, col) => {
                      const i = row * 8 + col;
                      const cell = cells[i];
                      const dark = (row + col) % 2 === 1;
                      const isSelected = sel === i;
                      const isTarget = validTargets.has(i);
                      const isCapture =
                        validMoves.find((m) => m.to === i)?.capture !==
                        undefined;
                      const canSelect =
                        isMineCell(cell, myPiece) &&
                        isMyTurn &&
                        (!mustCapture || capturableFrom.has(i));
                      return (
                        <TouchableOpacity
                          key={col}
                          style={[
                            s.cell,
                            { width: CELL, height: CELL },
                            { backgroundColor: dark ? "#8B5E3C" : "#F0D9B5" },
                            isSelected && s.cellSelected,
                            isTarget && dark && s.cellTarget,
                            canSelect &&
                              !isSelected &&
                              dark && { backgroundColor: "#9B6E4C" },
                          ]}
                          onPress={() => press(i)}
                          activeOpacity={dark ? 0.85 : 1}
                        >
                          {isTarget && dark && !cell && (
                            <View
                              style={[
                                s.targetDot,
                                isCapture && s.targetCapture,
                              ]}
                            />
                          )}
                          {cell !== 0 && (
                            <View
                              style={[
                                s.piece,
                                {
                                  width: CELL - 6,
                                  height: CELL - 6,
                                  borderRadius: (CELL - 6) / 2,
                                },
                                {
                                  backgroundColor:
                                    cell === 1 || cell === 3
                                      ? "#C1121F"
                                      : "#F0F0F0",
                                },
                                {
                                  borderColor:
                                    cell === 1 || cell === 3
                                      ? "#7a0000"
                                      : "#999",
                                },
                                isSelected && s.pieceSelected,
                                mustCapture &&
                                  capturableFrom.has(i) &&
                                  s.pieceMustCapture,
                              ]}
                            >
                              <View style={s.pieceGlow} />
                              {(cell === 3 || cell === 4) && (
                                <Text
                                  style={[
                                    s.crown,
                                    {
                                      color: cell === 3 ? "#FFD700" : "#C1121F",
                                    },
                                  ]}
                                >
                                  ♛
                                </Text>
                              )}
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                </View>
              ))}
          </View>
        </View>
      </View>

      {isMyTurn && !finished && (
        <View style={s.rulesBox}>
          <Text style={s.rulesTxt}>
            {sel === -1
              ? mustCapture
                ? "⚡ Tu dois capturer !"
                : "👆 Sélectionne un pion rouge"
              : `Pion sélectionné — ${validTargets.size} mouvement${validTargets.size > 1 ? "s" : ""}`}
          </Text>
        </View>
      )}

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
  container: { alignItems: "center", padding: 16, gap: 12 },
  statusRow: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: "rgba(255,255,255,0.04)",
    width: "100%",
  },
  statusTxt: { fontSize: 14, fontWeight: "700", textAlign: "center" },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    width: "100%",
  },
  scoreBox: { alignItems: "center", gap: 4 },
  scoreDisk: { width: 28, height: 28, borderRadius: 14, borderWidth: 3 },
  scoreNum: { color: "#fff", fontSize: 22, fontWeight: "900" },
  scoreLbl: {
    color: "#444",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  scoreCenter: { alignItems: "center", gap: 4 },
  scoreVs: { color: "#333", fontSize: 14, fontWeight: "700" },
  captureBadge: {
    backgroundColor: "#E8000A",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  captureBadgeTxt: { color: "#fff", fontSize: 9, fontWeight: "800" },
  boardWrap: { alignItems: "flex-end" },
  colLabels: { flexDirection: "row", marginLeft: 16, marginBottom: 2 },
  boardRow: { flexDirection: "row" },
  rowLabels: {
    justifyContent: "space-around",
    alignItems: "center",
    width: 16,
    marginRight: 2,
  },
  label: {
    color: "#333",
    fontSize: 9,
    textAlign: "center",
    textAlignVertical: "center",
  },
  board: {
    borderWidth: 3,
    borderColor: "#5D3A1A",
    borderRadius: 3,
    overflow: "hidden",
  },
  row: { flexDirection: "row" },
  cell: { alignItems: "center", justifyContent: "center" },
  cellSelected: { backgroundColor: "#FFD700" + "88" },
  cellTarget: { backgroundColor: "#5a3a20" },
  targetDot: {
    width: CELL * 0.35,
    height: CELL * 0.35,
    borderRadius: CELL * 0.175,
    backgroundColor: "rgba(40,247,161,0.65)",
  },
  targetCapture: { backgroundColor: "rgba(232,0,10,0.7)" },
  piece: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2.5,
    overflow: "hidden",
  },
  pieceSelected: { borderColor: "#FFD700", borderWidth: 3 },
  pieceMustCapture: { borderColor: "#E8000A", borderWidth: 3 },
  pieceGlow: {
    position: "absolute",
    top: 4,
    left: 6,
    width: CELL * 0.3,
    height: CELL * 0.18,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  crown: { fontSize: Math.floor(CELL * 0.45), fontWeight: "900" },
  rulesBox: {
    backgroundColor: "#0f0f0f",
    borderRadius: 10,
    padding: 10,
    width: "100%",
  },
  rulesTxt: { color: "#333", fontSize: 11, textAlign: "center" },
});
