// ───────────────────────── VimoX Bot : jouer contre l'ordinateur ─────────────────────────
// Morpion (minimax parfait), 4 à la suite (alpha-bêta), Dames (minimax avec rafles).
// Niveaux : 1 = facile (fait des erreurs), 2 = moyen, 3 = difficile.
// Le bot joue sur le téléphone du joueur humain (pas de serveur nécessaire).

import { BOT_ID, GameDoc, updateGame } from "./gameService";
import {
  C4_COLS,
  C4_ROWS,
  c4FindRow,
  c4IsDraw,
  c4ToBoard,
  c4ToDoc,
  c4WinningCells,
  tttResult,
} from "./gameLogic";
import { SIZE as BS_SIZE, isWon as bsIsWon, randomFleet, sunkShips } from "./Battleship";
import { PL as LUDO_PL, SAFE_IDX as LUDO_SAFE, WIN_POS as LUDO_WIN, pIdx as ludoIdx } from "./Ludo";
import {
  Move,
  QUIET_LIMIT,
  applyMove,
  isKing,
  legalMoves,
  owner,
  toCells,
  winnerIfBlocked,
} from "./Checkers";

export const BOT_GAMES = ["tictactoe", "connect4", "checkers", "battleship", "ludo", "uno"];

const pick = <T,>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

// ═════════════ Morpion ═════════════
function tttMinimax(b: number[], me: number, turn: number, depth: number): number {
  const r = tttResult(b);
  if (r === me) return 10 - depth;
  if (r === "draw") return 0;
  if (r) return depth - 10;
  const other = turn === 1 ? 2 : 1;
  let best = turn === me ? -Infinity : Infinity;
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue;
    b[i] = turn;
    const v = tttMinimax(b, me, other, depth + 1);
    b[i] = 0;
    best = turn === me ? Math.max(best, v) : Math.min(best, v);
  }
  return best;
}

export function tttBestMove(board: number[], me: number, level: number): number {
  const free = board.map((c, i) => (c ? -1 : i)).filter((i) => i >= 0);
  if (free.length === 0) return -1;
  const mistake = level === 1 ? 0.6 : level === 2 ? 0.2 : 0;
  if (Math.random() < mistake) return pick(free);
  const other = me === 1 ? 2 : 1;
  let bestScore = -Infinity;
  let bests: number[] = [];
  for (const i of free) {
    const b = [...board];
    b[i] = me;
    const v = tttMinimax(b, me, other, 1);
    if (v > bestScore) {
      bestScore = v;
      bests = [i];
    } else if (v === bestScore) bests.push(i);
  }
  return pick(bests);
}

// ═════════════ 4 à la suite ═════════════
function scoreWindow(w: number[], me: number): number {
  const opp = me === 1 ? 2 : 1;
  const mine = w.filter((x) => x === me).length;
  const theirs = w.filter((x) => x === opp).length;
  const empty = w.filter((x) => x === 0).length;
  if (mine === 4) return 1000;
  if (mine === 3 && empty === 1) return 6;
  if (mine === 2 && empty === 2) return 2;
  if (theirs === 3 && empty === 1) return -8;
  if (theirs === 2 && empty === 2) return -1;
  return 0;
}

function c4Evaluate(b: number[][], me: number): number {
  let score = 0;
  const center = Math.floor(C4_COLS / 2);
  for (let r = 0; r < C4_ROWS; r++) if (b[r][center] === me) score += 3;
  for (let r = 0; r < C4_ROWS; r++)
    for (let c = 0; c < C4_COLS; c++) {
      if (c + 3 < C4_COLS) score += scoreWindow([b[r][c], b[r][c + 1], b[r][c + 2], b[r][c + 3]], me);
      if (r + 3 < C4_ROWS) score += scoreWindow([b[r][c], b[r + 1][c], b[r + 2][c], b[r + 3][c]], me);
      if (r + 3 < C4_ROWS && c + 3 < C4_COLS)
        score += scoreWindow([b[r][c], b[r + 1][c + 1], b[r + 2][c + 2], b[r + 3][c + 3]], me);
      if (r - 3 >= 0 && c + 3 < C4_COLS)
        score += scoreWindow([b[r][c], b[r - 1][c + 1], b[r - 2][c + 2], b[r - 3][c + 3]], me);
    }
  return score;
}

const C4_ORDER = [3, 2, 4, 1, 5, 0, 6]; // le centre d'abord : la recherche va plus vite

function c4Search(b: number[][], depth: number, alpha: number, beta: number, turn: number, me: number): number {
  const opp = me === 1 ? 2 : 1;
  if (c4WinningCells(b, me)) return 100000 + depth;
  if (c4WinningCells(b, opp)) return -100000 - depth;
  if (c4IsDraw(b)) return 0;
  if (depth === 0) return c4Evaluate(b, me);
  const next = turn === 1 ? 2 : 1;
  if (turn === me) {
    let v = -Infinity;
    for (const col of C4_ORDER) {
      const r = c4FindRow(b, col);
      if (r < 0) continue;
      b[r][col] = turn;
      v = Math.max(v, c4Search(b, depth - 1, alpha, beta, next, me));
      b[r][col] = 0;
      alpha = Math.max(alpha, v);
      if (alpha >= beta) break;
    }
    return v;
  }
  let v = Infinity;
  for (const col of C4_ORDER) {
    const r = c4FindRow(b, col);
    if (r < 0) continue;
    b[r][col] = turn;
    v = Math.min(v, c4Search(b, depth - 1, alpha, beta, next, me));
    b[r][col] = 0;
    beta = Math.min(beta, v);
    if (alpha >= beta) break;
  }
  return v;
}

export function c4BestCol(board: number[][], me: number, level: number): number {
  const cols = C4_ORDER.filter((c) => c4FindRow(board, c) >= 0);
  if (cols.length === 0) return -1;
  const opp = me === 1 ? 2 : 1;
  // Même au niveau facile : gagner tout de suite, ou bloquer une victoire immédiate
  for (const who of [me, opp]) {
    for (const col of cols) {
      const b = board.map((r) => [...r]);
      b[c4FindRow(b, col)][col] = who;
      if (c4WinningCells(b, who) && (who === me || level > 1 || Math.random() < 0.5)) return col;
    }
  }
  if (level === 1 && Math.random() < 0.55) return pick(cols);
  const depth = level === 1 ? 2 : level === 2 ? 4 : 6;
  let best = -Infinity;
  let bests: number[] = [];
  for (const col of cols) {
    const b = board.map((r) => [...r]);
    b[c4FindRow(b, col)][col] = me;
    const v = c4Search(b, depth - 1, -Infinity, Infinity, opp, me);
    if (v > best) {
      best = v;
      bests = [col];
    } else if (v === best) bests.push(col);
  }
  return pick(bests);
}

// ═════════════ Dames ═════════════
function checkersEval(cells: number[], me: 1 | 2): number {
  let s = 0;
  for (let i = 0; i < 64; i++) {
    const c = cells[i];
    const who = owner(c);
    if (!who) continue;
    const row = Math.floor(i / 8);
    // pions : valeur + bonus d'avancée ; dames : plus fortes
    const advance = who === 1 ? 7 - row : row;
    const v = isKing(c) ? 1.7 : 1 + advance * 0.04;
    s += who === me ? v : -v;
  }
  return s;
}

function checkersSearch(
  cells: number[],
  turn: 1 | 2,
  forced: number,
  depth: number,
  alpha: number,
  beta: number,
  me: 1 | 2,
): number {
  const moves = legalMoves(cells, turn, forced);
  if (moves.length === 0) return turn === me ? -1000 - depth : 1000 + depth; // bloqué = perdu
  if (depth <= 0) return checkersEval(cells, me);
  const maximizing = turn === me;
  let v = maximizing ? -Infinity : Infinity;
  for (const mv of moves) {
    const a = applyMove(cells, mv);
    // Rafle : le même joueur rejoue avec la même pièce
    const nextTurn: 1 | 2 = a.chain ? turn : turn === 1 ? 2 : 1;
    const nextForced = a.chain ? mv.to : -1;
    const score = checkersSearch(a.cells, nextTurn, nextForced, a.chain ? depth : depth - 1, alpha, beta, me);
    if (maximizing) {
      v = Math.max(v, score);
      alpha = Math.max(alpha, v);
    } else {
      v = Math.min(v, score);
      beta = Math.min(beta, v);
    }
    if (alpha >= beta) break;
  }
  return v;
}

export function checkersBestMove(cells: number[], me: 1 | 2, forced: number, level: number): Move | null {
  const moves = legalMoves(cells, me, forced);
  if (moves.length === 0) return null;
  if (level === 1 && Math.random() < 0.5) return pick(moves);
  const depth = level === 1 ? 1 : level === 2 ? 3 : 6;
  let best = -Infinity;
  let bests: Move[] = [];
  for (const mv of moves) {
    const a = applyMove(cells, mv);
    const nextTurn: 1 | 2 = a.chain ? me : me === 1 ? 2 : 1;
    const v = checkersSearch(a.cells, nextTurn, a.chain ? mv.to : -1, depth - 1, -Infinity, Infinity, me);
    if (v > best) {
      best = v;
      bests = [mv];
    } else if (v === best) bests.push(mv);
  }
  return pick(bests);
}


// ═════════════ Bataille navale : chasse puis visée (comme un vrai joueur) ═════════════
export function battleshipBestShot(enemyBoard: number[], shots: number[], level: number): number {
  const shot = new Set(shots);
  const free = Array.from({ length: BS_SIZE * BS_SIZE }, (_, i) => i).filter((i) => !shot.has(i));
  if (free.length === 0) return -1;
  if (level === 1 && Math.random() < 0.6) return pick(free);
  const sunk = new Set(sunkShips(enemyBoard, shots));
  // Cases touchées d'un navire pas encore coulé : on vise autour
  const hits = shots.filter((i) => enemyBoard[i] > 0 && !sunk.has(enemyBoard[i]));
  const nb = (i: number) => {
    const r = Math.floor(i / BS_SIZE), c = i % BS_SIZE;
    return [r > 0 ? i - BS_SIZE : -1, r < BS_SIZE - 1 ? i + BS_SIZE : -1, c > 0 ? i - 1 : -1, c < BS_SIZE - 1 ? i + 1 : -1].filter(
      (x) => x >= 0 && !shot.has(x),
    );
  };
  if (hits.length > 0) {
    // Deux touches alignées : on continue dans la même direction
    if (hits.length >= 2) {
      const rows = new Set(hits.map((i) => Math.floor(i / BS_SIZE)));
      const cols = new Set(hits.map((i) => i % BS_SIZE));
      const line = hits.flatMap(nb).filter((x) =>
        rows.size === 1 ? Math.floor(x / BS_SIZE) === [...rows][0] : cols.size === 1 ? x % BS_SIZE === [...cols][0] : true,
      );
      if (line.length) return pick(line);
    }
    const around = hits.flatMap(nb);
    if (around.length) return pick(around);
  }
  // Chasse : une case sur deux (aucun navire ne fait 1 case) ; difficile = au centre d'abord
  const parity = free.filter((i) => (Math.floor(i / BS_SIZE) + (i % BS_SIZE)) % 2 === 0);
  const pool = parity.length ? parity : free;
  if (level >= 3) {
    const score = (i: number) => {
      const r = Math.floor(i / BS_SIZE), c = i % BS_SIZE;
      return -Math.abs(4.5 - r) - Math.abs(4.5 - c) + Math.random() * 2;
    };
    return pool.sort((a, b) => score(b) - score(a))[0];
  }
  return pick(pool);
}

// ═════════════ UNO : règles et choix de carte ═════════════
type UnoCard = { color: string; value: string; id: string };
const UNO_COLORS = ["red", "blue", "green", "yellow"];
const toArr = (v: any): any[] =>
  !v ? [] : Array.isArray(v) ? v : Object.keys(v).sort((a, b) => Number(a) - Number(b)).map((k) => v[k]);
function unoCanPlay(card: UnoCard, top: UnoCard | undefined, color: string): boolean {
  if (!top) return true;
  if (card.color === "wild") return true;
  return card.color === color || card.value === top.value;
}
function unoShuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}
function unoDraw(deck: UnoCard[], discard: UnoCard[], n: number) {
  let nd = [...deck];
  let ndis = [...discard];
  if (nd.length < n) {
    nd = [...nd, ...unoShuffle(ndis.slice(0, -1))];
    ndis = ndis.slice(-1);
  }
  return { nd, ndis, drawn: nd.splice(0, n) };
}
function unoBestColor(hand: UnoCard[]): string {
  const count: Record<string, number> = { red: 0, blue: 0, green: 0, yellow: 0 };
  hand.forEach((c) => c.color !== "wild" && count[c.color]++);
  return UNO_COLORS.sort((a, b) => count[b] - count[a])[0];
}
function unoChoose(playable: UnoCard[], hand: UnoCard[], oppCount: number, level: number): UnoCard {
  if (level === 1) return pick(playable);
  const attack = playable.filter((c) => ["+2", "+4", "skip", "reverse"].includes(c.value));
  // L'adversaire va gagner : on l'attaque
  if (oppCount <= 2 && attack.length) return attack.sort((a, b) => (b.value === "+4" ? 1 : 0) - (a.value === "+4" ? 1 : 0))[0];
  // Sinon : on garde les jokers pour la fin, on joue la couleur la plus fournie
  const best = unoBestColor(hand);
  const normal = playable.filter((c) => c.color !== "wild");
  if (normal.length) {
    const sameBest = normal.filter((c) => c.color === best);
    return pick(sameBest.length ? sameBest : normal);
  }
  return playable[0];
}

// ═════════════ Ludo : quel pion avancer ═════════════
function ludoChooseToken(myT: number[], enT: number[], dice: number, botIsP1: boolean, level: number): number {
  const movable = myT
    .map((p, i) => (p === LUDO_WIN ? -1 : p === -1 ? (dice === 6 ? i : -1) : p + dice <= LUDO_WIN ? i : -1))
    .filter((i) => i >= 0);
  if (movable.length === 0) return -1;
  if (level === 1) return pick(movable);
  let best = movable[0];
  let bestScore = -Infinity;
  for (const i of movable) {
    const pos = myT[i];
    const np = pos === -1 ? 0 : pos + dice;
    let sc = np / 10;
    if (np === LUDO_WIN) sc += 80; // rentrer un pion
    if (pos === -1) sc += 50; // sortir un pion
    if (np < LUDO_PL) {
      const mi = ludoIdx(np, botIsP1);
      if (LUDO_SAFE.has(mi)) sc += 15;
      const captures = enT.some((ep) => ep >= 0 && ep < LUDO_PL && ludoIdx(ep, !botIsP1) === mi && !LUDO_SAFE.has(mi));
      if (captures) sc += 100; // renvoyer un pion adverse à la maison
    }
    if (sc > bestScore) {
      bestScore = sc;
      best = i;
    }
  }
  return best;
}

// ═════════════ Le bot joue son coup (écrit dans la partie, comme un joueur) ═════════════
export async function playBotMove(chatId: string, game: GameDoc): Promise<void> {
  if (game.status !== "playing") return;
  const placing = game.type === "battleship" && !(game.board ?? {})[game.player1 === BOT_ID ? "p1Ready" : "p2Ready"];
  if (game.currentTurn !== BOT_ID && !placing) return;
  const botIsP1 = game.player1 === BOT_ID;
  const human = botIsP1 ? game.player2 : game.player1;
  const piece: 1 | 2 = botIsP1 ? 1 : 2;
  const level = Math.max(1, Math.min(3, Number((game as any).botLevel) || 2));


  // ── Bataille navale ──
  if (game.type === "battleship") {
    const b: any = game.board ?? {};
    const myBK = botIsP1 ? "p1Board" : "p2Board";
    const myRK = botIsP1 ? "p1Ready" : "p2Ready";
    const enBK = botIsP1 ? "p2Board" : "p1Board";
    const enRK = botIsP1 ? "p2Ready" : "p1Ready";
    const mySK = botIsP1 ? "p2Shots" : "p1Shots"; // tirs rangés sous le nom du plateau visé
    if (!b[myRK]) {
      await updateGame(chatId, game.id, { [`board.${myBK}`]: randomFleet(), [`board.${myRK}`]: true } as any);
      return;
    }
    if (game.currentTurn !== BOT_ID || !b[enRK]) return;
    const enemy: number[] = b[enBK] ?? [];
    const shots: number[] = b[mySK] ?? [];
    const idx = battleshipBestShot(enemy, shots, level);
    if (idx < 0) return;
    const ns = [...shots, idx];
    const won = bsIsWon(enemy, ns);
    await updateGame(chatId, game.id, {
      [`board.${mySK}`]: ns,
      currentTurn: won ? BOT_ID : human,
      status: won ? "finished" : "playing",
      winner: won ? BOT_ID : null,
    } as any);
    return;
  }

  // ── Ludo ──
  if (game.type === "ludo") {
    const b: any = game.board ?? {};
    const myTK = botIsP1 ? "p1Tokens" : "p2Tokens";
    const enTK = botIsP1 ? "p2Tokens" : "p1Tokens";
    const myT: number[] = b[myTK] || [-1, -1, -1, -1];
    const enT: number[] = b[enTK] || [-1, -1, -1, -1];
    const dice: number = b.dice || 0;
    if (!b.diceRolled) {
      // Lancer le dé
      const d = Math.floor(Math.random() * 6) + 1;
      const sixes = (b.sixes || 0) + (d === 6 ? 1 : 0);
      if (d === 6 && sixes >= 3) {
        await updateGame(chatId, game.id, { board: { ...b, dice: d, diceRolled: false, sixes: 0 }, currentTurn: human });
        return;
      }
      await updateGame(chatId, game.id, { board: { ...b, dice: d, diceRolled: true, sixes }, currentTurn: BOT_ID });
      return;
    }
    const ti = ludoChooseToken(myT, enT, dice, botIsP1, level);
    if (ti < 0) {
      // Aucun pion ne peut bouger : avec un 6 on relance, sinon le tour passe
      await updateGame(chatId, game.id, {
        board: { ...b, dice, diceRolled: false, sixes: dice === 6 ? b.sixes || 0 : 0 },
        currentTurn: dice === 6 ? BOT_ID : human,
      });
      return;
    }
    const pos = myT[ti];
    const newPos = pos === -1 ? 0 : pos + dice;
    const newEn = [...enT];
    let captured = false;
    if (newPos < LUDO_PL) {
      const mi = ludoIdx(newPos, botIsP1);
      enT.forEach((ep, ei) => {
        if (ep < 0 || ep >= LUDO_PL) return;
        if (ludoIdx(ep, !botIsP1) === mi && !LUDO_SAFE.has(mi)) {
          newEn[ei] = -1;
          captured = true;
        }
      });
    }
    const newMy = [...myT];
    newMy[ti] = newPos;
    const won = newMy.every((p) => p === LUDO_WIN);
    const arrived = newPos === LUDO_WIN;
    const extra = !won && (dice === 6 || captured || arrived);
    await updateGame(chatId, game.id, {
      board: { ...b, [myTK]: newMy, [enTK]: newEn, dice: 0, diceRolled: false, sixes: extra && dice === 6 ? b.sixes || 0 : 0 },
      currentTurn: extra ? BOT_ID : human,
      status: won ? "finished" : "playing",
      winner: won ? BOT_ID : null,
    });
    return;
  }

  // ── UNO ──
  if (game.type === "uno") {
    const b: any = game.board ?? {};
    if (!b.initialized) return; // la distribution se fait à l'ouverture de l'écran
    const myK = botIsP1 ? "p1Hand" : "p2Hand";
    const enK = botIsP1 ? "p2Hand" : "p1Hand";
    let hand: UnoCard[] = toArr(b[myK]);
    let enHand: UnoCard[] = toArr(b[enK]);
    let deck: UnoCard[] = toArr(b.deck);
    let discard: UnoCard[] = toArr(b.discard);
    const top = discard[discard.length - 1];
    const color: string = b.currentColor || "red";
    const isPlayable = (c: UnoCard) =>
      unoCanPlay(c, top, color) && !(c.value === "+4" && hand.some((x) => x.id !== c.id && x.color === color));
    const drew: string | null = b.drewCardId || null;
    const playable = hand.filter((c) => (drew ? c.id === drew : true) && isPlayable(c));
    if (playable.length === 0) {
      if (drew) {
        await updateGame(chatId, game.id, { board: { ...b, drewCardId: null }, currentTurn: human });
        return;
      }
      // Piocher 1 carte : si elle convient, l'ordinateur pourra la poser au prochain passage
      const r = unoDraw(deck, discard, 1);
      const card = r.drawn[0];
      const nh = card ? [...hand, card] : hand;
      const ok = !!card && unoCanPlay(card, top, color) && !(card.value === "+4" && hand.some((x) => x.color === color));
      await updateGame(chatId, game.id, {
        board: { ...b, [myK]: nh, deck: r.nd, discard: r.ndis, drawStack: 0, drewCardId: ok ? card.id : null },
        currentTurn: ok ? BOT_ID : human,
      });
      return;
    }
    const card = unoChoose(playable, hand, enHand.length, level);
    const newColor = card.color === "wild" ? unoBestColor(hand.filter((c) => c.id !== card.id)) : card.color;
    hand = hand.filter((c) => c.id !== card.id);
    discard = [...discard, card];
    if (hand.length === 0) {
      await updateGame(chatId, game.id, {
        board: { ...b, [myK]: hand, discard, currentColor: newColor, drawStack: 0, drewCardId: null },
        currentTurn: BOT_ID,
        status: "finished",
        winner: BOT_ID,
      });
      return;
    }
    // L'ordinateur dit toujours « UNO ! » à temps
    let next = human;
    if (card.value === "skip" || card.value === "reverse") next = BOT_ID;
    if (card.value === "+2" || card.value === "+4") {
      const r = unoDraw(deck, discard, card.value === "+2" ? 2 : 4);
      deck = r.nd;
      discard = r.ndis;
      enHand = [...enHand, ...r.drawn];
      next = BOT_ID;
    }
    await updateGame(chatId, game.id, {
      board: { ...b, [myK]: hand, [enK]: enHand, deck, discard, currentColor: newColor, drawStack: 0, drewCardId: null },
      currentTurn: next,
    });
    return;
  }

  if (game.type === "tictactoe") {
    const board: number[] = Array.isArray(game.board) ? game.board : Array(9).fill(0);
    const i = tttBestMove(board, piece, level);
    if (i < 0) return;
    const nb = [...board];
    nb[i] = piece;
    const res = tttResult(nb);
    await updateGame(chatId, game.id, {
      board: nb,
      currentTurn: res ? BOT_ID : human,
      status: res ? "finished" : "playing",
      winner: res === 1 ? game.player1 : res === 2 ? game.player2 : res === "draw" ? "draw" : null,
    });
    return;
  }

  if (game.type === "connect4") {
    const board = c4ToBoard(game.board);
    const col = c4BestCol(board, piece, level);
    if (col < 0) return;
    const row = c4FindRow(board, col);
    const nb = board.map((r) => [...r]);
    nb[row][col] = piece;
    const win = !!c4WinningCells(nb, piece);
    const draw = !win && c4IsDraw(nb);
    await updateGame(chatId, game.id, {
      board: c4ToDoc(nb),
      currentTurn: win || draw ? BOT_ID : human,
      status: win || draw ? "finished" : "playing",
      winner: win ? BOT_ID : draw ? "draw" : null,
    });
    return;
  }

  if (game.type === "checkers") {
    const bd: any = game.board ?? {};
    const cells = toCells(bd.cells ?? bd);
    const forced: number = typeof bd.selected === "number" ? bd.selected : -1;
    const quiet: number = typeof bd.quiet === "number" ? bd.quiet : 0;
    const moveId: number = typeof bd.moveId === "number" ? bd.moveId : 0;
    const mv = checkersBestMove(cells, piece, forced, level);
    if (!mv) {
      // Aucun coup : le bot a perdu
      await updateGame(chatId, game.id, { status: "finished", winner: human });
      return;
    }
    const a = applyMove(cells, mv);
    const opp: 1 | 2 = piece === 1 ? 2 : 1;
    const lost = a.chain ? 0 : winnerIfBlocked(a.cells, opp);
    const nq = mv.capture !== undefined || a.promoted ? 0 : quiet + 1;
    const drawn = !a.chain && !lost && nq >= QUIET_LIMIT;
    const over = !!lost || drawn;
    await updateGame(chatId, game.id, {
      board: { cells: a.cells, selected: a.chain ? mv.to : -1, quiet: nq, last: { from: mv.from, to: mv.to }, moveId: moveId + 1 },
      currentTurn: over ? BOT_ID : a.chain ? BOT_ID : human,
      status: over ? "finished" : "playing",
      winner: lost ? (lost === 1 ? game.player1 : game.player2) : drawn ? "draw" : null,
    });
  }
}
