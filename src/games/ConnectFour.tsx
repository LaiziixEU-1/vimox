import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { GameDoc, updateGame } from "./gameService";
import { GameResultModal } from "./GameResultModal";
import { G, PlayersBar, haptic, useFreshCells, usePulse } from "./gameKit";
import {
  C4_COLS,
  C4_ROWS,
  c4FindRow,
  c4IsDraw,
  c4ToBoard,
  c4ToDoc,
  c4WinningCells,
} from "./gameLogic";

const { width } = Dimensions.get("window");
const BOARD_W = Math.min(width - 24, 392);
const PAD = 10;
const CELL = Math.floor((BOARD_W - PAD * 2) / C4_COLS);
const PIECE = Math.round(CELL * 0.82);
const OFF = (CELL - PIECE) / 2;
const BOARD_H = CELL * C4_ROWS + PAD * 2;

function Piece({
  r,
  c,
  piece,
  fresh,
  win,
  dim,
}: {
  r: number;
  c: number;
  piece: number;
  fresh: boolean;
  win: boolean;
  dim: boolean;
}) {
  const v = useRef(new Animated.Value(fresh ? 0 : 1)).current;
  const pulse = usePulse(win);
  useEffect(() => {
    if (fresh) {
      Animated.timing(v, {
        toValue: 1,
        duration: 280 + r * 60,
        easing: Easing.bounce,
        useNativeDriver: true,
      }).start();
    }
  }, []);
  const color = piece === 1 ? G.p1 : G.p2;
  const transform: any[] = [
    {
      translateY: v.interpolate({
        inputRange: [0, 1],
        outputRange: [-(PAD + (r + 1) * CELL + 36), 0],
      }),
    },
  ];
  if (win) {
    transform.push({
      scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }),
    });
  }
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: PAD + c * CELL + OFF,
        top: PAD + r * CELL + OFF,
        width: PIECE,
        height: PIECE,
        opacity: dim ? 0.4 : 1,
        transform,
      }}
    >
      <View
        style={[
          s.disc,
          { backgroundColor: color, borderRadius: PIECE / 2 },
          win && s.discWin,
        ]}
      >
        <View style={[s.discRing, { borderRadius: PIECE / 2 }]} />
        <View style={s.discShine} />
      </View>
    </Animated.View>
  );
}

interface Props {
  game: GameDoc;
  chatId: string;
  myId: string;
}

export function ConnectFour({ game, chatId, myId }: Props) {
  const navigation = useNavigation();
  const board = c4ToBoard(game.board);
  const isP1 = myId === game.player1;
  const myPiece = isP1 ? 1 : 2;
  const myColor = isP1 ? G.p1 : G.p2;
  const isMyTurn = game.currentTurn === myId;
  const finished = game.status === "finished";
  const w = game.winner;
  const [sending, setSending] = useState(false);

  const flat = board.flat();
  const fresh = useFreshCells(flat);

  // Cases gagnantes (celles du gagnant)
  const winPiece = w === game.player1 ? 1 : w === game.player2 ? 2 : 0;
  const winCells = winPiece ? c4WinningCells(board, winPiece) : null;
  const winSet = new Set((winCells ?? []).map(([r, c]) => r * C4_COLS + c));

  const canDrop = isMyTurn && !finished && !sending;

  async function drop(col: number) {
    if (!canDrop) return;
    const row = c4FindRow(board, col);
    if (row === -1) {
      haptic("error");
      return;
    }
    haptic("tap");
    setSending(true);
    const nb = board.map((r) => [...r]);
    nb[row][col] = myPiece;
    const win = !!c4WinningCells(nb, myPiece);
    const draw = !win && c4IsDraw(nb);
    const next =
      game.currentTurn === game.player1 ? game.player2 : game.player1;
    try {
      await updateGame(chatId, game.id, {
        board: c4ToDoc(nb),
        currentTurn: win || draw ? game.currentTurn : next,
        status: win || draw ? "finished" : "playing",
        winner: win ? myId : draw ? "draw" : null,
      });
    } catch {
      haptic("error");
    } finally {
      setSending(false);
    }
  }

  const hint = finished
    ? w === "draw"
      ? "Égalité"
      : w === myId
        ? "Tu as gagné !"
        : "Ton adversaire a gagné"
    : isMyTurn
      ? "Touche une colonne pour lâcher ton pion"
      : "L'adversaire joue…";

  return (
    <View style={s.container}>
      <PlayersBar
        game={game}
        myId={myId}
        colorP1={G.p1}
        colorP2={G.p2}
      />

      <View>
        {/* Flèches au-dessus des colonnes */}
        <View style={s.arrows}>
          {Array.from({ length: C4_COLS }, (_, c) => (
            <View key={c} style={{ width: CELL, alignItems: "center" }}>
              <Ionicons
                name="chevron-down"
                size={18}
                color={myColor}
                style={{ opacity: canDrop && board[0][c] === 0 ? 0.85 : 0.12 }}
              />
            </View>
          ))}
        </View>

        <View style={[s.board, { width: BOARD_W, height: BOARD_H }]}>
          {/* Trous */}
          {board.map((row, r) =>
            row.map((_, c) => (
              <View
                key={`h${r}-${c}`}
                style={[
                  s.hole,
                  {
                    left: PAD + c * CELL + OFF,
                    top: PAD + r * CELL + OFF,
                    width: PIECE,
                    height: PIECE,
                    borderRadius: PIECE / 2,
                  },
                ]}
              />
            )),
          )}

          {/* Pions */}
          {board.map((row, r) =>
            row.map((cell, c) =>
              cell === 0 ? null : (
                <Piece
                  key={`p${r}-${c}`}
                  r={r}
                  c={c}
                  piece={cell}
                  fresh={fresh.has(r * C4_COLS + c)}
                  win={winSet.has(r * C4_COLS + c)}
                  dim={winSet.size > 0 && !winSet.has(r * C4_COLS + c)}
                />
              ),
            ),
          )}

          {/* Une zone tactile par colonne */}
          {Array.from({ length: C4_COLS }, (_, c) => (
            <Pressable
              key={`t${c}`}
              onPress={() => drop(c)}
              style={{
                position: "absolute",
                left: PAD + c * CELL,
                top: 0,
                width: CELL,
                height: BOARD_H,
              }}
            />
          ))}
        </View>
      </View>

      <Text style={[s.hint, finished && w === myId && { color: G.win }]}>
        {hint}
      </Text>

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
  container: { alignItems: "center", gap: 14, width: "100%" },
  arrows: {
    flexDirection: "row",
    paddingHorizontal: PAD,
    marginBottom: 2,
  },
  board: {
    borderRadius: 24,
    backgroundColor: "#1F4FD1",
    borderWidth: 1.5,
    borderColor: "#163A9C",
    overflow: "hidden",
  },
  hole: {
    position: "absolute",
    backgroundColor: G.bg,
    borderWidth: 2,
    borderColor: "#163A9C",
  },
  disc: { width: PIECE, height: PIECE, overflow: "hidden" },
  discWin: { borderWidth: 3, borderColor: "#fff" },
  discRing: {
    position: "absolute",
    top: "14%",
    left: "14%",
    right: "14%",
    bottom: "14%",
    borderWidth: 2.5,
    borderColor: "rgba(255,255,255,0.22)",
  },
  discShine: {
    position: "absolute",
    top: "8%",
    left: "12%",
    width: "40%",
    height: "28%",
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  hint: { color: G.muted, fontSize: 14, fontWeight: "700", marginTop: 4 },
});
