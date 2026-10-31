/*VIMOX-V33*/
/*VIMOX-V11*/
import {
  arrayUnion,
  addDoc,
  collection,
  doc,
  updateDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { logDenied } from "../services/firestoreErrors";

// Adversaire « ordinateur » (VimoX Bot) : il joue sur le téléphone du joueur humain
export const BOT_ID = "vimox-bot";

export type GameType =
  | "connect4"
  | "tictactoe"
  | "battleship"
  | "checkers"
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
  // Revanche : renseigné quand un joueur relance une partie après la fin
  rematchGameId?: string | null;
  rematchBy?: string | null;
  // Partie contre l'ordinateur : 1 facile, 2 moyen, 3 difficile
  botLevel?: number;
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


// ───────────── Où est rangée une partie ? ─────────────
// Chat aléatoire : rooms/{id}/games · Chat entre amis : friendChats/{cid}/games (chatId = « fc:<cid> »).
// Les 7 jeux passent tous par ces fonctions : ils marchent dans les deux chats sans rien changer.
export const FRIEND_PREFIX = "fc:";
export function friendGameChatId(cid: string): string {
  return FRIEND_PREFIX + cid;
}
function where_(chatId: string): { root: "rooms" | "friendChats"; id: string } {
  return chatId.startsWith(FRIEND_PREFIX)
    ? { root: "friendChats", id: chatId.slice(FRIEND_PREFIX.length) }
    : { root: "rooms", id: chatId };
}
export function gamesCol(chatId: string) {
  const w = where_(chatId);
  return collection(db, w.root, w.id, "games");
}
export function gameRef(chatId: string, gameId: string) {
  const w = where_(chatId);
  return doc(db, w.root, w.id, "games", gameId);
}
// Bulle « 🎮 invitation à jouer » dans la bonne conversation (chaque chat a son format de message)
export async function postGameBubble(chatId: string, gameId: string, gameType: GameType, myId: string, label?: string) {
  const w = where_(chatId);
  if (w.root === "friendChats") {
    await addDoc(collection(db, "friendChats", w.id, "messages"), {
      type: "game",
      gameId,
      gameType,
      senderUid: myId,
      text: `🎮 ${label ?? "Partie"}`,
      imageURL: null,
      audioURL: null,
      sentAt: serverTimestamp(),
    });
  } else {
    await addDoc(collection(db, "rooms", w.id, "messages"), {
      type: "game",
      gameId,
      gameType,
      senderId: myId,
      createdAt: serverTimestamp(),
      sentAt: serverTimestamp(),
      readBy: [myId],
    });
  }
}

export async function createGame(
  chatId: string,
  type: GameType,
  player1: string,
  player2: string,
): Promise<string> {
  const board = getInitialBoard(type);
  const ref = await addDoc(gamesCol(chatId), {
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

// Nouvelle partie contre l'ordinateur (le joueur commence)
export async function createBotGame(
  chatId: string,
  type: GameType,
  human: string,
  level: number,
): Promise<string> {
  const ref = await addDoc(gamesCol(chatId), {
    type,
    player1: human,
    player2: BOT_ID,
    currentTurn: human,
    status: "playing",
    winner: null,
    board: getInitialBoard(type),
    botLevel: Math.max(1, Math.min(3, level)),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateGame(
  chatId: string,
  gameId: string,
  updates: Partial<GameDoc>,
) {
  await updateDoc(gameRef(chatId, gameId), updates as any);
}

export async function joinGameAsPlayer2(
  chatId: string,
  gameId: string,
  userId: string,
) {
  await updateDoc(gameRef(chatId, gameId), {
    player2: userId,
  });
}

export function listenGame(
  chatId: string,
  gameId: string,
  onUpdate: (g: GameDoc) => void,
) {
  return onSnapshot(gameRef(chatId, gameId), (snap) => {
    if (snap.exists()) onUpdate({ id: snap.id, ...snap.data() } as GameDoc);
  }, (e) => logDenied("partie de jeu", e));
}

// Revanche : crée une nouvelle partie (l'ancien joueur 2 commence, pour que ce soit équitable),
// la signale sur l'ancienne partie pour que l'adversaire puisse la rejoindre,
// et l'ajoute dans le chat comme une bulle de jeu.
export async function createRematch(
  chatId: string,
  old: GameDoc,
  myId: string,
): Promise<string> {
  const gameId = await createGame(chatId, old.type, old.player2, old.player1);
  if (old.botLevel) {
    await updateDoc(gameRef(chatId, gameId), { botLevel: old.botLevel } as any);
  }
  await updateDoc(gameRef(chatId, old.id), {
    rematchGameId: gameId,
    rematchBy: myId,
  } as any);
  if (old.player1 !== BOT_ID && old.player2 !== BOT_ID) postGameBubble(chatId, gameId, old.type, myId, "Revanche").catch(() => {});
  return gameId;
}


// Initialise une partie (distribution UNO, mot du Dessin...) UNE SEULE FOIS,
// même si les deux joueurs ouvrent l'écran au même moment.
export async function initGameOnce(
  chatId: string,
  gameId: string,
  updates: Partial<GameDoc>,
) {
  const ref = gameRef(chatId, gameId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data: any = snap.data();
    if (data?.board?.initialized) return;
    tx.update(ref, updates as any);
  });
}

// Ajoute des éléments à un tableau Firestore sans écraser ceux ajoutés par l'autre joueur.
// Usage : updateGame(chatId, id, { "board.guesses": appendTo(guess) } as any)
export function appendTo(...items: any[]) {
  return arrayUnion(...items);
}

// Écrit SEULEMENT si la partie est encore dans l'état attendu (évite les doubles actions
// quand les deux joueurs touchent le même bouton au même moment). Renvoie true si appliqué.
export async function updateIf(
  chatId: string,
  gameId: string,
  check: (data: any) => boolean,
  updates: Record<string, any>,
): Promise<boolean> {
  const ref = gameRef(chatId, gameId);
  let applied = false;
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists() || !check(snap.data())) return;
    tx.update(ref, updates as any);
    applied = true;
  });
  return applied;
}
