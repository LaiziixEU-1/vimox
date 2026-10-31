/*VIMOX-V32*/
/*VIMOX-V11*/
import { useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { GameDoc, updateGame } from "./gameService";
import { GameResultModal } from "./GameResultModal";
import { G, PlayersBar, PopIn, haptic } from "./gameKit";

// ══════ RÈGLES : BATAILLE NAVALE (pures, testées) ══════
// Règles de la Bataille navale (pures, testables).
// Un plateau = 100 cases. 0 = eau ; k > 0 = case du navire n°k (1 à 5).

export const SIZE = 10;
// Flotte officielle de la Bataille navale (17 cases)
export const SHIPS = [5, 4, 3, 3, 2];
export const SHIP_NAMES = [
  "Porte-avions",
  "Cuirassé",
  "Croiseur",
  "Sous-marin",
  "Torpilleur",
];
export const TOTAL_CELLS = SHIPS.reduce((a, b) => a + b, 0);

// Cases d'un navire posé depuis « origin » (null si ça sort de la grille)
export function shipCells(origin: number, size: number, horiz: boolean): number[] | null {
  const row = Math.floor(origin / SIZE);
  const col = origin % SIZE;
  const out: number[] = [];
  for (let i = 0; i < size; i++) {
    if (horiz) {
      if (col + i >= SIZE) return null;
      out.push(row * SIZE + col + i);
    } else {
      if (row + i >= SIZE) return null;
      out.push((row + i) * SIZE + col);
    }
  }
  return out;
}

export function canPlace(board: number[], cells: number[] | null): boolean {
  return !!cells && cells.every((c) => board[c] === 0);
}

// Nombre de navires déjà posés (chaque navire a son numéro dans les cases)
export function placedCount(board: number[]): number {
  return new Set(board.filter((c) => c > 0)).size;
}

// Numéros des navires entièrement touchés
export function sunkShips(board: number[], shots: number[]): number[] {
  const shot = new Set(shots);
  const out: number[] = [];
  for (let id = 1; id <= SHIPS.length; id++) {
    const cells = board.map((c, i) => (c === id ? i : -1)).filter((i) => i >= 0);
    if (cells.length > 0 && cells.every((i) => shot.has(i))) out.push(id);
  }
  return out;
}

export function hitCount(board: number[], shots: number[]): number {
  return shots.filter((s) => board[s] > 0).length;
}

export function shipTotal(board: number[]): number {
  return board.filter((c) => c > 0).length;
}

export function isWon(enemyBoard: number[], myShots: number[]): boolean {
  const total = shipTotal(enemyBoard);
  return total > 0 && hitCount(enemyBoard, myShots) >= total;
}

// Flotte aléatoire valide (bouton « Placement aléatoire »)
export function randomFleet(): number[] {
  const board: number[] = Array(SIZE * SIZE).fill(0);
  SHIPS.forEach((size, k) => {
    for (let tries = 0; tries < 500; tries++) {
      const cells = shipCells(
        Math.floor(Math.random() * SIZE * SIZE),
        size,
        Math.random() < 0.5,
      );
      if (cells && canPlace(board, cells)) {
        cells.forEach((c) => (board[c] = k + 1));
        return;
      }
    }
  });
  return board;
}

// ══════ ÉCRAN ══════
const { width } = Dimensions.get("window");
const CELL = Math.floor((Math.min(width, 440) - 48) / SIZE);
const SMALL = Math.floor(CELL * 0.62);
const WATER = "#171A1E";
const WATER_LINE = "#252A31";

interface Props {
  game: GameDoc;
  chatId: string;
  myId: string;
}

function Grid({
  size,
  render,
}: {
  size: number;
  render: (idx: number) => React.ReactNode;
}) {
  return (
    <View style={[s.grid, { width: size * SIZE + 2 }]}>
      {Array.from({ length: SIZE }, (_, r) => (
        <View key={r} style={{ flexDirection: "row" }}>
          {Array.from({ length: SIZE }, (_, c) => render(r * SIZE + c))}
        </View>
      ))}
    </View>
  );
}

// Comme le vrai jeu : lettres A à J en haut, chiffres 1 à 10 à gauche
const LETTERS = "ABCDEFGHIJ";
const coordOf = (idx: number) => `${LETTERS[idx % SIZE]}${Math.floor(idx / SIZE) + 1}`;
function CoordGrid({ size, render }: { size: number; render: (idx: number) => React.ReactNode }) {
  return (
    <View>
      <View style={{ flexDirection: "row", marginLeft: 16 }}>
        {Array.from({ length: SIZE }, (_, c) => (
          <Text key={c} style={[s.coord, { width: size }]}>{LETTERS[c]}</Text>
        ))}
      </View>
      <View style={{ flexDirection: "row" }}>
        <View style={{ width: 16, paddingTop: 1 }}>
          {Array.from({ length: SIZE }, (_, r) => (
            <Text key={r} style={[s.coord, { height: size, lineHeight: size }]}>{r + 1}</Text>
          ))}
        </View>
        <Grid size={size} render={render} />
      </View>
    </View>
  );
}

export function Battleship({ game, chatId, myId }: Props) {
  const navigation = useNavigation();
  const board = game.board ?? {};
  const isP1 = myId === game.player1;
  const myBK = isP1 ? "p1Board" : "p2Board";
  const enBK = isP1 ? "p2Board" : "p1Board";
  const myRK = isP1 ? "p1Ready" : "p2Ready";
  const enRK = isP1 ? "p2Ready" : "p1Ready";
  // Les tirs sont rangés sous le nom du plateau visé
  const mySK = isP1 ? "p2Shots" : "p1Shots";
  const enSK = isP1 ? "p1Shots" : "p2Shots";
  const empty: number[] = Array(SIZE * SIZE).fill(0);
  const myBoard: number[] = board[myBK] ?? empty;
  const enBoard: number[] = board[enBK] ?? empty;
  const myShots: number[] = board[mySK] ?? [];
  const enShots: number[] = board[enSK] ?? [];
  const myReady: boolean = !!board[myRK];
  const enReady: boolean = !!board[enRK];
  const isMyTurn = game.currentTurn === myId;
  const finished = game.status === "finished";
  const w = game.winner;

  const [horiz, setHoriz] = useState(true);
  const [hover, setHover] = useState(-1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevMy = useRef<number | null>(null);
  const prevEn = useRef<number | null>(null);

  const placed = placedCount(myBoard);
  const placing = !myReady;

  function say(t: string) {
    setMsg(t);
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMsg(null), 1700);
  }
  useEffect(() => {
    return () => {
      if (msgTimer.current) clearTimeout(msgTimer.current);
    };
  }, []);

  // Retour immédiat pour tes tirs ET ceux de l'adversaire
  useEffect(() => {
    if (!myReady || !enReady) return;
    if (prevMy.current !== null && myShots.length > prevMy.current) {
      const idx = myShots[myShots.length - 1];
      const id = enBoard[idx];
      const sunk =
        id > 0 &&
        sunkShips(enBoard, myShots).includes(id) &&
        !sunkShips(enBoard, myShots.slice(0, -1)).includes(id);
      // Comme au vrai jeu : on annonce quel navire est coulé
      say(`${coordOf(idx)} · ${sunk ? `${SHIP_NAMES[id - 1]} coulé !` : id > 0 ? "Touché !" : "Dans l'eau"}`);
      haptic(id > 0 ? "success" : "tap");
    }
    prevMy.current = myShots.length;
  }, [myShots.length, myReady, enReady]);

  useEffect(() => {
    if (!myReady || !enReady) return;
    if (prevEn.current !== null && enShots.length > prevEn.current) {
      const idx = enShots[enShots.length - 1];
      const id = myBoard[idx];
      const sunk =
        id > 0 &&
        sunkShips(myBoard, enShots).includes(id) &&
        !sunkShips(myBoard, enShots.slice(0, -1)).includes(id);
      say(`${coordOf(idx)} · ${sunk ? `Ton ${SHIP_NAMES[id - 1]} est coulé` : id > 0 ? "Il t'a touché !" : "Il a raté"}`);
      haptic(id > 0 ? "error" : "tap");
    }
    prevEn.current = enShots.length;
  }, [enShots.length, myReady, enReady]);

  async function write(updates: Record<string, any>) {
    setBusy(true);
    try {
      // Écritures ciblées (« board.xxx ») : on n'écrase jamais le plateau de l'adversaire
      await updateGame(chatId, game.id, updates as any);
    } catch {
      haptic("error");
    } finally {
      setBusy(false);
    }
  }

  function place(idx: number) {
    if (!placing || busy || placed >= SHIPS.length) return;
    const cells = shipCells(idx, SHIPS[placed], horiz);
    if (!cells || !canPlace(myBoard, cells)) {
      haptic("error");
      return;
    }
    haptic("tap");
    const nb = [...myBoard];
    cells.forEach((c) => (nb[c] = placed + 1));
    write({
      [`board.${myBK}`]: nb,
      [`board.${myRK}`]: placed + 1 >= SHIPS.length,
    });
    setHover(-1);
  }

  function undo() {
    if (!placing || busy || placed === 0) return;
    haptic("select");
    write({ [`board.${myBK}`]: myBoard.map((c) => (c === placed ? 0 : c)) });
  }

  function randomize() {
    if (!placing || busy) return;
    haptic("select");
    write({ [`board.${myBK}`]: randomFleet(), [`board.${myRK}`]: true });
  }

  function shoot(idx: number) {
    if (!isMyTurn || finished || !myReady || !enReady || busy) return;
    if (myShots.includes(idx)) return;
    const ns = [...myShots, idx];
    const won = isWon(enBoard, ns);
    const next = game.currentTurn === game.player1 ? game.player2 : game.player1;
    write({
      [`board.${mySK}`]: ns,
      currentTurn: won ? game.currentTurn : next,
      status: won ? "finished" : "playing",
      winner: won ? myId : null,
    });
  }

  const myHits = hitCount(enBoard, myShots);
  const enHits = hitCount(myBoard, enShots);
  const enSunk = sunkShips(enBoard, myShots);
  const mySunk = sunkShips(myBoard, enShots);

  const modal = (
    <GameResultModal
      result={
        !finished ? null : w === "draw" ? "draw" : w === myId ? "win" : "lose"
      }
      onClose={() => navigation.goBack()}
    />
  );

  // ── 1) Placement des navires ─────────────────────────────
  if (placing) {
    const preview =
      hover >= 0 && placed < SHIPS.length
        ? shipCells(hover, SHIPS[placed], horiz)
        : null;
    const valid = canPlace(myBoard, preview);
    return (
      <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>Place ta flotte</Text>
        <Text style={s.sub}>
          {placed < SHIPS.length
            ? `${SHIP_NAMES[placed]} · ${SHIPS[placed]} cases`
            : "Flotte prête…"}
        </Text>

        <View style={s.chips}>
          {SHIPS.map((size, k) => (
            <View
              key={k}
              style={[s.chip, k < placed && s.chipDone, k === placed && s.chipNow]}
            >
              <Text style={[s.chipTxt, k < placed && { color: G.win }]}>{size}</Text>
            </View>
          ))}
        </View>

        <Grid
          size={CELL}
          render={(idx) => {
            const isShip = myBoard[idx] > 0;
            const inPrev = preview?.includes(idx) ?? false;
            const hoverBad = !preview && hover === idx;
            return (
              <Pressable
                key={idx}
                onPress={() => place(idx)}
                onPressIn={() => setHover(idx)}
                onPressOut={() => setHover(-1)}
                style={[
                  s.cell,
                  { width: CELL, height: CELL },
                  isShip && s.ship,
                  inPrev && (valid ? s.prevOk : s.prevBad),
                  hoverBad && s.prevBad,
                ]}
              />
            );
          }}
        />

        <View style={s.row}>
          <Pressable style={s.tool} onPress={() => { haptic("select"); setHoriz((h) => !h); }}>
            <Ionicons name={(horiz ? "swap-horizontal" : "swap-vertical") as any} size={20} color={G.text} />
            <Text style={s.toolTxt}>{horiz ? "Horizontal" : "Vertical"}</Text>
          </Pressable>
          <Pressable style={[s.tool, placed === 0 && { opacity: 0.35 }]} onPress={undo} disabled={placed === 0}>
            <Ionicons name="arrow-undo" size={20} color={G.text} />
            <Text style={s.toolTxt}>Annuler</Text>
          </Pressable>
          <Pressable style={s.tool} onPress={randomize}>
            <Ionicons name="shuffle" size={20} color={G.text} />
            <Text style={s.toolTxt}>Aléatoire</Text>
          </Pressable>
        </View>
        {modal}
      </ScrollView>
    );
  }

  // ── 2) En attente de l'adversaire ────────────────────────
  if (!enReady) {
    return (
      <ScrollView contentContainerStyle={s.container}>
        <Text style={s.title}>Flotte prête</Text>
        <Text style={s.sub}>L'adversaire place encore ses navires…</Text>
        <Grid
          size={CELL}
          render={(idx) => (
            <View
              key={idx}
              style={[s.cell, { width: CELL, height: CELL }, myBoard[idx] > 0 && s.ship]}
            />
          )}
        />
        {modal}
      </ScrollView>
    );
  }

  // ── 3) Combat ────────────────────────────────────────────
  const hint = finished
    ? w === myId
      ? "Tu as coulé toute la flotte !"
      : "Ta flotte est détruite"
    : isMyTurn
      ? "Touche une case de la grille ennemie pour tirer"
      : "L'adversaire vise…";

  return (
    <ScrollView contentContainerStyle={s.container} showsVerticalScrollIndicator={false}>
      <PlayersBar
        game={game}
        myId={myId}
        colorP1={G.p1}
        colorP2={G.p2}
        scoreP1={isP1 ? myHits : enHits}
        scoreP2={isP1 ? enHits : myHits}
      />

      <View style={s.msgBox}>
        {msg ? (
          <PopIn animate key={msg + myShots.length + enShots.length}>
            <Text style={s.msg}>{msg}</Text>
          </PopIn>
        ) : (
          <Text style={s.hint}>{hint}</Text>
        )}
      </View>

      <Text style={s.gridTitle}>
        Eaux ennemies · {enSunk.length}/{SHIPS.length} navires coulés
      </Text>
      {/* Flotte ennemie : ce qu'il reste à trouver (barré quand c'est coulé) */}
      <View style={s.fleet}>
        {SHIPS.map((size, k) => {
          const down = enSunk.includes(k + 1);
          return (
            <View key={k} style={[s.fleetChip, down && s.fleetChipDown]}>
              <Text style={[s.fleetTxt, down && s.fleetTxtDown]} numberOfLines={1}>
                {SHIP_NAMES[k]} · {size}
              </Text>
            </View>
          );
        })}
      </View>
      <CoordGrid
        size={CELL}
        render={(idx) => {
          const shot = myShots.includes(idx);
          const id = enBoard[idx];
          const hit = shot && id > 0;
          const revealed = id > 0 && enSunk.includes(id);
          return (
            <Pressable
              key={idx}
              onPress={() => shoot(idx)}
              disabled={shot || !isMyTurn || finished}
              style={[
                s.cell,
                { width: CELL, height: CELL },
                revealed && s.sunk,
                hit && !revealed && s.hit,
              ]}
            >
              {hit && <Ionicons name="flame" size={CELL * 0.55} color={revealed ? G.text : "#fff"} />}
              {shot && !hit && <View style={s.missDot} />}
            </Pressable>
          );
        }}
      />

      <Text style={s.gridTitle}>
        Ma flotte · {mySunk.length}/{SHIPS.length} coulés
      </Text>
      <Grid
        size={SMALL}
        render={(idx) => {
          const isShip = myBoard[idx] > 0;
          const shot = enShots.includes(idx);
          const hit = shot && isShip;
          return (
            <View
              key={idx}
              style={[
                s.cell,
                { width: SMALL, height: SMALL },
                isShip && s.ship,
                hit && s.hit,
              ]}
            >
              {shot && !hit && <View style={[s.missDot, { width: 5, height: 5 }]} />}
              {hit && <Ionicons name="flame" size={SMALL * 0.6} color="#fff" />}
            </View>
          );
        }}
      />
      {modal}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: {
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
    flexGrow: 1,
  },
  title: { color: G.text, fontSize: 22, fontWeight: "900" },
  sub: { color: G.muted, fontSize: 14, fontWeight: "700" },
  chips: { flexDirection: "row", gap: 8 },
  chip: {
    minWidth: 36,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: G.surface,
    borderWidth: 1.5,
    borderColor: G.border,
  },
  chipDone: { borderColor: G.win },
  chipNow: { borderColor: G.gold },
  chipTxt: { color: G.text, fontWeight: "900", fontSize: 14 },
  grid: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: WATER_LINE,
    backgroundColor: WATER,
    overflow: "hidden",
  },
  cell: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: WATER_LINE,
    backgroundColor: WATER,
  },
  ship: { backgroundColor: G.p2 },
  prevOk: { backgroundColor: "rgba(74,222,128,0.55)" },
  prevBad: { backgroundColor: "rgba(255,77,109,0.55)" },
  hit: { backgroundColor: G.p1 },
  sunk: { backgroundColor: "#5a2430" },
  missDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: G.mutedDark },
  row: { flexDirection: "row", gap: 10 },
  tool: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 16,
    backgroundColor: G.surface,
    borderWidth: 1,
    borderColor: G.border,
  },
  toolTxt: { color: G.text, fontSize: 13, fontWeight: "700" },
  msgBox: { height: 30, alignItems: "center", justifyContent: "center" },
  fleet: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, paddingHorizontal: 12 },
  fleetChip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10, backgroundColor: G.surface, borderWidth: 1, borderColor: G.border },
  fleetChipDown: { backgroundColor: "rgba(255,77,109,0.15)", borderColor: "rgba(255,77,109,0.5)" },
  fleetTxt: { color: G.text, fontSize: 11, fontWeight: "800" },
  fleetTxtDown: { color: G.p1, textDecorationLine: "line-through" },
  coord: { color: G.mutedDark, fontSize: 10, fontWeight: "800", textAlign: "center" },
  msg: { color: G.gold, fontSize: 20, fontWeight: "900" },
  hint: { color: G.muted, fontSize: 14, fontWeight: "700" },
  gridTitle: { color: G.muted, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
});
