/*VIMOX-V32*/
/*VIMOX-V11*/
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
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

// ══════ RÈGLES : DAMES (pures, testées) ══════
// Règles des Dames (sans React ni Firestore) : testables.
// Pions : 1 = joueur 1, 2 = joueur 2, 3 = dame du joueur 1, 4 = dame du joueur 2.
// Le joueur 1 monte (vers la ligne 0), le joueur 2 descend. Capture obligatoire.

export interface Move {
  from: number;
  to: number;
  capture?: number;
}

export function toCells(raw: any): number[] {
  const out: number[] = [];
  for (let i = 0; i < 64; i++) out.push(Number(raw?.[i] ?? raw?.[String(i)] ?? 0));
  return out;
}

export const owner = (c: number): 0 | 1 | 2 =>
  c === 1 || c === 3 ? 1 : c === 2 || c === 4 ? 2 : 0;
export const isKing = (c: number) => c === 3 || c === 4;

export function movesFrom(cells: number[], from: number): Move[] {
  const piece = cells[from];
  const who = owner(piece);
  if (!who) return [];
  const row = Math.floor(from / 8);
  const col = from % 8;
  const dirs: [number, number][] = [];
  if (who === 1 || isKing(piece)) dirs.push([-1, -1], [-1, 1]);
  if (who === 2 || isKing(piece)) dirs.push([1, -1], [1, 1]);
  const moves: Move[] = [];
  for (const [dr, dc] of dirs) {
    const r1 = row + dr;
    const c1 = col + dc;
    if (r1 < 0 || r1 > 7 || c1 < 0 || c1 > 7) continue;
    const to = r1 * 8 + c1;
    if (cells[to] === 0) {
      moves.push({ from, to });
    } else if (owner(cells[to]) !== who) {
      const r2 = r1 + dr;
      const c2 = c1 + dc;
      if (r2 >= 0 && r2 <= 7 && c2 >= 0 && c2 <= 7 && cells[r2 * 8 + c2] === 0) {
        moves.push({ from, to: r2 * 8 + c2, capture: to });
      }
    }
  }
  return moves;
}

// Coups légaux d'un joueur. forcedFrom : pièce qui DOIT continuer sa capture en chaîne.
export function legalMoves(cells: number[], who: 1 | 2, forcedFrom = -1): Move[] {
  const origins: number[] = [];
  if (forcedFrom >= 0) origins.push(forcedFrom);
  else for (let i = 0; i < 64; i++) if (owner(cells[i]) === who) origins.push(i);
  const all: Move[] = [];
  for (const i of origins) all.push(...movesFrom(cells, i));
  const captures = all.filter((m) => m.capture !== undefined);
  if (captures.length) return captures;
  return forcedFrom >= 0 ? [] : all;
}

export interface Applied {
  cells: number[];
  promoted: boolean;
  chain: boolean; // la même pièce doit capturer encore
}

export function applyMove(cells: number[], mv: Move): Applied {
  const nc = [...cells];
  const piece = nc[mv.from];
  const who = owner(piece);
  nc[mv.to] = piece;
  nc[mv.from] = 0;
  if (mv.capture !== undefined) nc[mv.capture] = 0;
  const rowTo = Math.floor(mv.to / 8);
  let promoted = false;
  if (!isKing(piece) && ((who === 1 && rowTo === 0) || (who === 2 && rowTo === 7))) {
    nc[mv.to] = who === 1 ? 3 : 4;
    promoted = true; // promotion = fin du tour
  }
  const chain =
    mv.capture !== undefined &&
    !promoted &&
    movesFrom(nc, mv.to).some((m) => m.capture !== undefined);
  return { cells: nc, promoted, chain };
}

// Si le joueur « next » n'a plus de pièce OU plus aucun coup, il perd.
export function winnerIfBlocked(cells: number[], next: 1 | 2): 0 | 1 | 2 {
  if (legalMoves(cells, next).length === 0) return next === 1 ? 2 : 1;
  return 0;
}

export function countPieces(cells: number[], who: 1 | 2): number {
  return cells.filter((c) => owner(c) === who).length;
}

// Nombre de demi-coups sans capture ni promotion avant égalité
// Règle officielle (dames anglaises 8×8) : 40 coups chacun sans prise ni promotion = nulle
export const QUIET_LIMIT = 80;

// ══════ ÉCRAN ══════
const { width } = Dimensions.get("window");
const BOARD = Math.min(width - 24, 400);
const CELL = Math.floor(BOARD / 8);
const PIECE = Math.round(CELL * 0.8);

const LIGHT = "#E8C99B"; // cases claires (bois)
const DARK = "#8B5A2B"; // cases de jeu (bois foncé)

function Disc({
  cell,
  fresh,
  ring,
  mustCapture,
}: {
  cell: number;
  fresh: boolean;
  ring: boolean;
  mustCapture: boolean;
}) {
  const pulse = usePulse(mustCapture);
  const color = owner(cell) === 1 ? G.p1 : G.p2;
  return (
    <PopIn animate={fresh}>
      <Animated.View
        style={[
          s.disc,
          {
            width: PIECE,
            height: PIECE,
            borderRadius: PIECE / 2,
            backgroundColor: color,
          },
          ring && s.discSelected,
          mustCapture && {
            transform: [
              {
                scale: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.1],
                }),
              },
            ],
          },
        ]}
      >
        <View style={[s.discRing, { borderRadius: PIECE / 2 }]} />
        <View style={s.discShine} />
        {isKing(cell) && (
          <MaterialCommunityIcons
            name={"crown" as any}
            size={Math.round(PIECE * 0.5)}
            color="rgba(17,17,16,0.78)"
          />
        )}
      </Animated.View>
    </PopIn>
  );
}

// Le pion joué glisse depuis sa case de départ (chez les deux joueurs)
function Slide({ dx, dy, children }: { dx: number; dy: number; children: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View
      style={{
        zIndex: 5,
        transform: [
          { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [dx, 0] }) },
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [dy, 0] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

interface Props {
  game: GameDoc;
  chatId: string;
  myId: string;
}

export function Checkers({ game, chatId, myId }: Props) {
  const navigation = useNavigation();
  const bd = game.board ?? {};
  const cells = toCells(bd.cells ?? bd);
  const forced: number = typeof bd.selected === "number" ? bd.selected : -1;
  const quiet: number = typeof bd.quiet === "number" ? bd.quiet : 0;
  const last: { from: number; to: number } | null = bd.last ?? null;
  const moveId: number = typeof bd.moveId === "number" ? bd.moveId : 0;
  const myPiece: 1 | 2 = myId === game.player1 ? 1 : 2;
  const isMyTurn = game.currentTurn === myId;
  const finished = game.status === "finished";
  const w = game.winner;
  const [sel, setSel] = useState(-1);
  const [busy, setBusy] = useState(false);
  const fresh = useFreshCells(cells);

  // Le plateau est retourné pour le joueur 2 : tes pions sont toujours en bas
  const flip = myPiece === 2;
  const idxOf = (r: number, c: number) =>
    flip ? (7 - r) * 8 + (7 - c) : r * 8 + c;

  const moves: Move[] =
    isMyTurn && !finished ? legalMoves(cells, myPiece, forced) : [];
  const movable = new Set(moves.map((m) => m.from));
  const mustCapture = moves.some((m) => m.capture !== undefined);
  const active = forced >= 0 && isMyTurn ? forced : sel;
  const targets = moves.filter((m) => m.from === active);
  const targetSet = new Map(targets.map((m) => [m.to, m]));

  // Sélection oubliée si ce n'est plus mon tour ou si la pièce ne peut plus bouger
  useEffect(() => {
    if (sel >= 0 && (!isMyTurn || !movable.has(sel))) setSel(-1);
  }, [isMyTurn, game.board]);

  async function play(mv: Move) {
    if (busy) return;
    setBusy(true);
    haptic(mv.capture !== undefined ? "success" : "tap");
    const a = applyMove(cells, mv);
    const opp: 1 | 2 = myPiece === 1 ? 2 : 1;
    const lost = a.chain ? 0 : winnerIfBlocked(a.cells, opp);
    const nq = mv.capture !== undefined || a.promoted ? 0 : quiet + 1;
    const drawn = !a.chain && !lost && nq >= QUIET_LIMIT;
    const over = !!lost || drawn;
    const next = a.chain ? myId : myPiece === 1 ? game.player2 : game.player1;
    try {
      await updateGame(chatId, game.id, {
        board: { cells: a.cells, selected: a.chain ? mv.to : -1, quiet: nq, last: { from: mv.from, to: mv.to }, moveId: moveId + 1 },
        currentTurn: over ? game.currentTurn : next,
        status: over ? "finished" : "playing",
        winner: lost ? (lost === 1 ? game.player1 : game.player2) : drawn ? "draw" : null,
      });
      setSel(-1);
    } catch {
      haptic("error");
    } finally {
      setBusy(false);
    }
  }

  function press(i: number) {
    if (!isMyTurn || finished || busy) return;
    const mv = targetSet.get(i);
    if (active >= 0 && mv) {
      play(mv);
      return;
    }
    if (forced >= 0) return; // chaîne de captures : on ne change pas de pièce
    if (movable.has(i)) {
      haptic("select");
      setSel(i);
      return;
    }
    if (sel >= 0) setSel(-1);
  }

  const hint = finished
    ? w === "draw"
      ? "Égalité"
      : w === myId
        ? "Tu as gagné !"
        : "Ton adversaire a gagné"
    : !isMyTurn
      ? "L'adversaire joue…"
      : forced >= 0
        ? "Continue ta capture avec le même pion"
        : mustCapture
          ? "Capture obligatoire : choisis un pion qui brille"
          : active >= 0
            ? "Touche une case verte pour jouer"
            : "Choisis un pion";

  return (
    <ScrollView
      contentContainerStyle={s.container}
      showsVerticalScrollIndicator={false}
    >
      <PlayersBar
        game={game}
        myId={myId}
        colorP1={G.p1}
        colorP2={G.p2}
        scoreP1={countPieces(cells, 1)}
        scoreP2={countPieces(cells, 2)}
      />

      <View style={[s.board, { width: CELL * 8 + 6, height: CELL * 8 + 6 }]}>
        {Array.from({ length: 8 }, (_, r) => (
          <View
            key={r}
            style={[
              s.row,
              last && Array.from({ length: 8 }, (_, c) => idxOf(r, c)).includes(last.to) && { zIndex: 10, elevation: 10 },
            ]}
          >
            {Array.from({ length: 8 }, (_, c) => {
              const i = idxOf(r, c);
              const cell = cells[i];
              const playable = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
              const target = targetSet.get(i);
              const isSel = active === i;
              const glow = mustCapture && movable.has(i) && active !== i;
              return (
                <Pressable
                  key={c}
                  onPress={() => press(i)}
                  disabled={!playable}
                  style={[
                    s.cell,
                    { width: CELL, height: CELL },
                    { backgroundColor: playable ? DARK : LIGHT },
                    isSel && s.cellSel,
                  ]}
                >
                  {target && !cell && (
                    <View
                      style={[
                        s.dot,
                        target.capture !== undefined && s.dotCapture,
                      ]}
                    />
                  )}
                  {cell !== 0 &&
                    (last && last.to === i ? (
                      <Slide
                        key={moveId}
                        dx={((flip ? 7 - (last.from % 8) : last.from % 8) - (flip ? 7 - (i % 8) : i % 8)) * CELL}
                        dy={((flip ? 7 - Math.floor(last.from / 8) : Math.floor(last.from / 8)) - (flip ? 7 - Math.floor(i / 8) : Math.floor(i / 8))) * CELL}
                      >
                        <Disc cell={cell} fresh={false} ring={isSel} mustCapture={glow} />
                      </Slide>
                    ) : (
                      <Disc cell={cell} fresh={fresh.has(i)} ring={isSel} mustCapture={glow} />
                    ))}
                </Pressable>
              );
            })}
          </View>
        ))}
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
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 16,
    paddingVertical: 16,
    flexGrow: 1,
    justifyContent: "center",
  },
  board: {
    borderWidth: 3,
    borderColor: "#5C3A1E",
    borderRadius: 14,
    overflow: "hidden",
  },
  row: { flexDirection: "row" },
  cell: { alignItems: "center", justifyContent: "center" },
  cellSel: { backgroundColor: "rgba(255,194,75,0.28)" },
  dot: {
    width: CELL * 0.3,
    height: CELL * 0.3,
    borderRadius: CELL * 0.15,
    backgroundColor: "rgba(74,222,128,0.8)",
  },
  dotCapture: {
    width: CELL * 0.42,
    height: CELL * 0.42,
    borderRadius: CELL * 0.21,
    backgroundColor: "rgba(255,77,109,0.9)",
  },
  disc: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  discSelected: { borderWidth: 3, borderColor: G.gold },
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
  hint: { color: G.muted, fontSize: 14, fontWeight: "700", textAlign: "center", paddingHorizontal: 20 },
});
