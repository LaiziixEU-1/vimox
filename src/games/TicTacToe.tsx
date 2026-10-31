import {
  Animated,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { GameDoc, updateGame } from "./gameService";
import { GameResultModal } from "./GameResultModal";
import {
  G,
  PlayersBar,
  PopIn,
  haptic,
  useFreshCells,
  usePulse,
} from "./gameKit";
import { tttResult, tttWinningLine } from "./gameLogic";

const { width } = Dimensions.get("window");
const BOARD = Math.min(width - 40, 360);
const GAP = 10;
const CELL = Math.floor((BOARD - GAP * 2) / 3);

// Croix et rond dessinés en vues : nets à toutes les tailles
function Mark({ piece, size }: { piece: number; size: number }) {
  const thick = Math.max(6, Math.round(size * 0.17));
  if (piece === 1) {
    const bar = {
      position: "absolute" as const,
      width: size,
      height: thick,
      borderRadius: thick / 2,
      backgroundColor: G.p1,
      top: (size - thick) / 2,
      left: 0,
    };
    return (
      <View style={{ width: size, height: size }}>
        <View style={[bar, { transform: [{ rotate: "45deg" }] }]} />
        <View style={[bar, { transform: [{ rotate: "-45deg" }] }]} />
      </View>
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: thick,
        borderColor: G.p2,
      }}
    />
  );
}

interface Props {
  game: GameDoc;
  chatId: string;
  myId: string;
}

export function TicTacToe({ game, chatId, myId }: Props) {
  const navigation = useNavigation();
  const board: number[] = Array.isArray(game.board)
    ? game.board
    : Array(9).fill(0);
  const isMyTurn = game.currentTurn === myId;
  const myPiece = myId === game.player1 ? 1 : 2;
  const finished = game.status === "finished";
  const w = game.winner;

  const fresh = useFreshCells(board);
  const winLine = tttWinningLine(board);
  const pulse = usePulse(!!winLine);

  async function play(i: number) {
    if (!isMyTurn || board[i] || finished) return;
    haptic("tap");
    const nb = [...board];
    nb[i] = myPiece;
    const res = tttResult(nb);
    const next =
      game.currentTurn === game.player1 ? game.player2 : game.player1;
    try {
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
    } catch {
      haptic("error");
    }
  }

  const hint = finished
    ? w === "draw"
      ? "Égalité"
      : w === myId
        ? "Tu as gagné !"
        : "Ton adversaire a gagné"
    : isMyTurn
      ? "Touche une case pour jouer"
      : "L'adversaire joue…";

  return (
    <View style={s.container}>
      <PlayersBar
        game={game}
        myId={myId}
        colorP1={G.p1}
        colorP2={G.p2}
      />

      <View style={[s.board, { width: BOARD, height: BOARD }]}>
        {board.map((cell, i) => {
          const isWin = !!winLine && winLine.includes(i);
          const dim = !!winLine && !isWin;
          const canPlay = !cell && isMyTurn && !finished;
          return (
            <Pressable
              key={i}
              onPress={() => play(i)}
              disabled={!canPlay}
              style={({ pressed }) => [
                s.cell,
                { width: CELL, height: CELL },
                isWin && s.cellWin,
                dim && { opacity: 0.35 },
                canPlay && pressed && s.cellPressed,
              ]}
            >
              {cell !== 0 && (
                <PopIn animate={fresh.has(i)}>
                  <Animated.View
                    style={
                      isWin
                        ? {
                            transform: [
                              {
                                scale: pulse.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [1, 1.14],
                                }),
                              },
                            ],
                          }
                        : undefined
                    }
                  >
                    <Mark piece={cell} size={Math.round(CELL * 0.56)} />
                  </Animated.View>
                </PopIn>
              )}
            </Pressable>
          );
        })}
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
  container: { alignItems: "center", gap: 22, width: "100%" },
  board: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: GAP,
  },
  cell: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: G.surface,
    borderWidth: 1.5,
    borderColor: G.border,
  },
  cellPressed: { backgroundColor: G.surface2, borderColor: G.borderLight },
  cellWin: {
    borderColor: G.win,
    backgroundColor: "rgba(74,222,128,0.10)",
  },
  hint: { color: G.muted, fontSize: 14, fontWeight: "700" },
});
