import {
  addDoc,
  collection,
  doc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";

export type GameType =
  | "connect4"
  | "tictactoe"
  | "battleship"
  | "checkers"
  | "bowling"
  | "ludo"
  | "uno"
  | "drawing";

export interface GameDoc {
  id: string;
  type: GameType;
  player1: string;
  player2: string;
  currentTurn: string;
  status: "playing" | "finished";
  winner: string | "draw" | null;
  board: any;
}

function initCheckers() {
  const cells = Array(64).fill(0);
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) cells[r * 8 + c] = 2;
  for (let r = 5; r < 8; r++)
    for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) cells[r * 8 + c] = 1;
  return { cells, selected: -1 };
}

function getInitialBoard(type: GameType): any {
  switch (type) {
    case "connect4":
      return Object.fromEntries(
        Array.from({ length: 6 }, (_, r) => [String(r), Array(7).fill(0)]),
      );
    case "tictactoe":
      return Array(9).fill(0);
    case "battleship":
      return {
        p1Board: Array(100).fill(0),
        p2Board: Array(100).fill(0),
        p1Shots: [],
        p2Shots: [],
        p1Ready: false,
        p2Ready: false,
      };
    case "checkers":
      return initCheckers();
    case "bowling":
      return { p1Frames: {}, p2Frames: {}, pinsUp: Array(10).fill(true) };
    case "ludo":
      return {
        dice: 0,
        diceRolled: false,
        p1Tokens: [-1, -1, -1, -1],
        p2Tokens: [-1, -1, -1, -1],
      };
    case "uno":
      return {
        initialized: false,
        deck: [],
        discard: [],
        p1Hand: [],
        p2Hand: [],
        currentColor: "red",
        direction: 1,
        drawStack: 0,
      };
    case "drawing":
      return {
        initialized: false,
        strokes: [],
        guesses: [],
        word: "",
        drawerRole: "p1",
        phase: "drawing",
        round: 1,
        scores: { p1: 0, p2: 0 },
        roundEndAt: 0,
        foundBy: null,
      };
  }
}

export async function createGame(
  chatId: string,
  type: GameType,
  player1: string,
  player2: string,
): Promise<string> {
  const board = getInitialBoard(type);
  const ref = await addDoc(collection(db, "rooms", chatId, "games"), {
    type,
    player1,
    player2: player2 ?? "",
    currentTurn: player1,
    status: "playing",
    winner: null,
    board,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateGame(
  chatId: string,
  gameId: string,
  updates: Partial<GameDoc>,
) {
  await updateDoc(doc(db, "rooms", chatId, "games", gameId), updates as any);
}

export async function joinGameAsPlayer2(
  chatId: string,
  gameId: string,
  userId: string,
) {
  await updateDoc(doc(db, "rooms", chatId, "games", gameId), {
    player2: userId,
  });
}

export function listenGame(
  chatId: string,
  gameId: string,
  onUpdate: (g: GameDoc) => void,
) {
  return onSnapshot(doc(db, "rooms", chatId, "games", gameId), (snap) => {
    if (snap.exists()) onUpdate({ id: snap.id, ...snap.data() } as GameDoc);
  });
}