/*VIMOX-V33*/
/*VIMOX-V32*/
/*VIMOX-V11*/
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../models/types";
import {
  GameDoc,
  listenGame,
  joinGameAsPlayer2,
  gamesCol,
  createRematch,
  updateGame,
} from "./gameService";
import { useAuth } from "../services/AuthContext";
import { BOT_ID } from "./gameService";
import { playBotMove } from "./botAI";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../config/firebase";

// Comme les vrais jeux en ligne : un temps conseillé par tour, et la victoire par abandon
const TURN_LIMIT = 60; // secondes affichées au joueur dont c'est le tour
const CLAIM_AFTER = 90; // sans aucun coup de l'adversaire pendant ce temps : on peut réclamer la victoire
import { G, GameRuntimeContext, haptic } from "./gameKit";
import { GAME_INFO } from "./GameLauncher";
import { LinearGradient } from "expo-linear-gradient";
import { ConnectFour } from "./ConnectFour";
import { TicTacToe } from "./TicTacToe";
import { Battleship } from "./Battleship";
import { Checkers } from "./Checkers";
import { Ludo } from "./Ludo";
import { Uno } from "./Uno";
import { Drawing } from "./DessinDevine";

type Props = NativeStackScreenProps<RootStackParamList, "GameScreen">;

// Règles officielles appliquées dans chaque jeu (bouton ⓘ en haut)
const RULES: Record<string, string> = {
  tictactoe:
    "Chacun son tour, pose ta marque (✕ ou ◯) sur une case libre. Le premier qui aligne 3 marques en ligne, en colonne ou en diagonale gagne. Grille pleine sans alignement : égalité. Celui qui commence change à chaque revanche.",
  connect4:
    "Chacun son tour, lâche un jeton dans une colonne : il tombe tout en bas. Le premier qui aligne 4 jetons à l'horizontale, à la verticale ou en diagonale gagne. Grille pleine : égalité. Celui qui commence change à chaque revanche.",
  battleship:
    "Place ta flotte : porte-avions (5 cases), cuirassé (4), croiseur (3), sous-marin (3) et torpilleur (2). Les navires ne peuvent ni se chevaucher ni dépasser la grille, mais ils peuvent se toucher. Ensuite, un tir par tour chacun, même après un touché : « Dans l'eau », « Touché » ou « Coulé » avec le nom du navire. Le premier qui coule toute la flotte adverse gagne.",
  checkers:
    "Dames anglaises sur damier 8×8. Les pions avancent d'une case en diagonale, vers l'avant. La prise est obligatoire : on saute par-dessus une pièce adverse, et les prises s'enchaînent avec la même pièce. Les pions ne prennent que vers l'avant ; si plusieurs prises sont possibles, tu choisis laquelle. Un pion qui atteint la dernière ligne devient dame (il avance et recule) et son tour s'arrête. Tu gagnes si l'adversaire n'a plus de pièce ou plus aucun coup. 40 coups chacun sans prise ni promotion : partie nulle.",
  ludo:
    "Il faut un 6 pour sortir un pion de la maison. Un 6 fait rejouer, mais trois 6 de suite font perdre le tour. S'arrêter sur un pion adverse le renvoie à sa maison et fait rejouer, sauf sur les cases protégées (étoiles et cases de départ). Il faut le nombre exact pour rentrer au centre, et un pion qui arrive fait rejouer. Le premier à rentrer ses 4 pions gagne.",
  uno:
    "Pose une carte de même couleur, de même chiffre ou de même symbole, ou un joker. +2 : l'adversaire pioche 2 cartes et passe son tour. Joker +4 : il pioche 4 cartes et passe son tour ; il n'est autorisé que si tu n'as aucune carte de la couleur demandée (VimoX le vérifie pour toi, pas besoin de contester). À deux joueurs, Inversion = Passe : tu rejoues. Si tu ne peux pas jouer, pioche 1 carte : tu peux la poser si elle convient, sinon ton tour passe. Touche « UNO ! » avant de poser ton avant-dernière carte, sinon tu pioches 2 cartes. Si la première carte retournée est un +2, le premier joueur pioche 2 cartes et passe son tour ; si c'est un Passe ou une Inversion, il passe son tour. Le premier qui n'a plus de carte gagne.",
  drawing:
    "4 manches de 60 secondes ; le dessinateur change à chaque manche. Il fait deviner le mot sans écrire ni parler (↩️ annule le dernier trait). Une lettre se dévoile à mi-temps et une autre au dernier quart. « Presque ! » s'affiche si tu es à une lettre près. Trouver le mot rapporte 100 points plus un bonus de vitesse, et le dessinateur gagne 80 points. Le plus de points à la fin gagne.",
};

const LABELS: Record<string, string> = {
  connect4: "4 à la suite",
  tictactoe: "Morpion",
  battleship: "Bataille navale",
  checkers: "Dames",
  ludo: "Ludo",
  uno: "UNO",
  drawing: "Dessin deviné",
};

function WaitingDots() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(v, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {[0, 1, 2].map((i) => (
        <Animated.View
          key={i}
          style={[
            s.dot,
            {
              opacity: v.interpolate({
                inputRange: [0, i / 3, i / 3 + 0.2, 1],
                outputRange: [0.25, 0.25, 1, 0.25],
                extrapolate: "clamp",
              }),
            },
          ]}
        />
      ))}
    </View>
  );
}

export function GameScreen({ route, navigation }: Props) {
  const { chatId, gameId } = route.params;
  const { profile } = useAuth();
  const [game, setGame] = useState<GameDoc | null>(null);
  const [rematching, setRematching] = useState(false);
  const prevTurn = useRef<string | null>(null);
  // Partie contre l'ordinateur : quand c'est son tour, il « réfléchit » un instant puis joue
  const botSig = game ? game.currentTurn + ":" + game.status + ":" + JSON.stringify(game.board ?? null).length : "";
  useEffect(() => {
    if (!game || !profile) return;
    const vsBot = game.player1 === BOT_ID || game.player2 === BOT_ID;
    const botIsP1 = game.player1 === BOT_ID;
    // Bataille navale : l'ordinateur place sa flotte dès le début, même si ce n'est pas son tour
    const mustPlace = game.type === "battleship" && !(game.board ?? {})[botIsP1 ? "p1Ready" : "p2Ready"];
    if (!vsBot || game.status !== "playing" || (game.currentTurn !== BOT_ID && !mustPlace)) return;
    const human = game.player1 === BOT_ID ? game.player2 : game.player1;
    if (profile.id !== human) return;
    const t = setTimeout(() => {
      playBotMove(chatId, game).catch(() => {});
    }, 600 + Math.random() * 600);
    return () => clearTimeout(t);
  }, [botSig, profile?.id]);
  // Dernier coup vu (n'importe quel changement de la partie) + horloge
  const [lastChange, setLastChange] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [series, setSeries] = useState<{ me: number; opp: number } | null>(null);
  const boardSig = game ? JSON.stringify(game.board ?? null).length + ":" + game.currentTurn + ":" + game.status : "";
  useEffect(() => {
    setLastChange(Date.now());
  }, [boardSig]);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  // Score de la série entre ces deux joueurs, pour ce jeu
  useEffect(() => {
    if (!game || !profile || !game.player2) return;
    getDocs(
      query(gamesCol(chatId), where("type", "==", game.type), where("status", "==", "finished")),
    )
      .then((snap) => {
        let me = 0;
        let opp = 0;
        snap.docs.forEach((d) => {
          const x: any = d.data();
          const pair = [x.player1, x.player2];
          if (!pair.includes(game.player1) || !pair.includes(game.player2)) return;
          if (x.winner === profile.id) me++;
          else if (x.winner && x.winner !== "draw") opp++;
        });
        setSeries({ me, opp });
      })
      .catch(() => {});
  }, [game?.id, game?.status, game?.player2]);

  useEffect(() => listenGame(chatId, gameId, setGame), [chatId, gameId]);

  // Rejoindre la partie en tant que joueur 2
  useEffect(() => {
    if (!game || !profile) return;
    const isP1 = game.player1 === profile.id;
    const isP2 = game.player2 === profile.id;
    const noP2 = !game.player2 || game.player2 === "";
    if (!isP1 && !isP2 && noP2) joinGameAsPlayer2(chatId, gameId, profile.id);
  }, [game?.player2, profile?.id]);

  // Petite vibration quand c'est à toi de jouer
  useEffect(() => {
    if (!game || !profile) return;
    if (
      prevTurn.current &&
      prevTurn.current !== game.currentTurn &&
      game.currentTurn === profile.id &&
      game.status === "playing"
    ) {
      haptic("tap");
    }
    prevTurn.current = game.currentTurn;
  }, [game?.currentTurn]);

  if (!game || !profile) {
    return (
      <View style={s.loading}>
        <ActivityIndicator color={G.accentSoft} size="large" />
      </View>
    );
  }

  const label = LABELS[game.type] ?? game.type;
  const noP2 = !game.player2 || game.player2 === "";

  // Abandonner : l'adversaire est déclaré vainqueur (utile quand une partie est bloquée)
  const isPlayer = game.player1 === profile.id || game.player2 === profile.id;
  const canResign = game.status === "playing" && !noP2 && isPlayer;
  const opponentId = game.player1 === profile.id ? game.player2 : game.player1;

  function confirmResign() {
    Alert.alert("Abandonner la partie ?", "Ton adversaire sera déclaré vainqueur.", [
      { text: "Continuer à jouer", style: "cancel" },
      {
        text: "Abandonner",
        style: "destructive",
        onPress: async () => {
          try {
            await updateGame(chatId, game!.id, {
              status: "finished",
              winner: opponentId,
            });
          } catch {}
          navigation.goBack();
        },
      },
    ]);
  }

  const header = (
    <View style={s.header}>
      <Pressable
        onPress={() => navigation.goBack()}
        hitSlop={12}
        style={s.back}
        accessibilityRole="button"
        accessibilityLabel="Retour"
      >
        <Ionicons name="chevron-back" size={26} color={G.text} />
      </Pressable>
      <Pressable
        onPress={() =>
          Alert.alert(
            `Règles · ${label}`,
            (RULES[game.type] ?? "") +
              (game.type !== "drawing"
                ? "\n\n⏱ 60 secondes conseillées par tour. Si ton adversaire ne joue plus pendant 1 min 30, tu peux réclamer la victoire."
                : ""),
          )
        }
        hitSlop={10}
        style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
        accessibilityRole="button"
        accessibilityLabel={`Règles du jeu ${label}`}
      >
        <View style={{ alignItems: "center" }}>
          <Text style={s.title}>
            {GAME_INFO[game.type]?.emoji ? `${GAME_INFO[game.type].emoji} ` : ""}
            {label}
          </Text>
          {series && series.me + series.opp > 0 && (
            <Text style={s.series}>
              Série {series.me} – {series.opp}
            </Text>
          )}
        </View>
        <Ionicons name="information-circle-outline" size={20} color={G.muted} />
      </Pressable>
      {canResign ? (
        <Pressable
          onPress={confirmResign}
          hitSlop={12}
          style={s.back}
          accessibilityRole="button"
          accessibilityLabel="Abandonner la partie"
        >
          <Ionicons name="flag-outline" size={21} color={G.muted} />
        </Pressable>
      ) : (
        <View style={{ width: 36 }} />
      )}
    </View>
  );

  if (noP2) {
    return (
      <View style={s.root}>
        {header}
        <View style={s.waiting}>
          <View style={s.waitIcon}>
            <Ionicons name="hourglass-outline" size={34} color={G.gold} />
          </View>
          <Text style={s.waitTxt}>En attente de l'adversaire</Text>
          <WaitingDots />
          <Text style={s.waitSub}>
            Dis-lui d'ouvrir la bulle de jeu dans le chat.
          </Text>
        </View>
      </View>
    );
  }

  async function rematch() {
    if (!game || !profile || rematching) return;
    setRematching(true);
    try {
      // Si l'adversaire a déjà lancé la revanche, on la rejoint
      if (game.rematchGameId) {
        navigation.replace("GameScreen", {
          chatId,
          gameId: game.rematchGameId,
        });
        return;
      }
      const id = await createRematch(chatId, game, profile.id);
      navigation.replace("GameScreen", { chatId, gameId: id });
    } catch {
      setRematching(false);
    }
  }

  // ── Chrono du tour / adversaire parti ──
  const timed =
    game.status === "playing" &&
    !noP2 &&
    isPlayer &&
    game.type !== "drawing" &&
    !(game.type === "battleship" && !(game.board?.p1Ready && game.board?.p2Ready));
  const idle = Math.max(0, Math.floor((now - lastChange) / 1000));
  const myTurnNow = game.currentTurn === profile.id;
  const left = Math.max(0, TURN_LIMIT - idle);
  const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  async function claimWin() {
    haptic("success");
    try {
      await updateGame(chatId, game!.id, { status: "finished", winner: profile!.id });
    } catch {}
  }
  const timerBar = !timed ? null : myTurnNow ? (
    <View style={s.timerWrap}>
      <View style={s.timerTrack}>
        <View
          style={[
            s.timerFill,
            { width: `${(left / TURN_LIMIT) * 100}%`, backgroundColor: left <= 15 ? "#E5484D" : G.win },
          ]}
        />
      </View>
      <Text style={[s.timerTxt, left <= 15 && { color: "#E5484D" }]}>
        {left > 0 ? `⏱ ${fmt(left)} pour jouer` : "⏱ Temps écoulé : joue vite, l'adversaire peut réclamer la victoire"}
      </Text>
    </View>
  ) : idle >= CLAIM_AFTER ? (
    <View style={s.claim}>
      <Ionicons name="time-outline" size={22} color={G.gold} />
      <Text style={s.claimTxt}>L'adversaire ne joue plus depuis {fmt(idle)}</Text>
      <Pressable onPress={claimWin} style={({ pressed }) => [s.claimBtn, pressed && { opacity: 0.8 }]} accessibilityRole="button">
        <Text style={s.claimBtnTxt}>Réclamer la victoire</Text>
      </Pressable>
    </View>
  ) : null;

  const props = { game, chatId, myId: profile.id };

  const renderGame = () => {
    switch (game.type) {
      case "connect4":
        return <ConnectFour {...props} />;
      case "tictactoe":
        return <TicTacToe {...props} />;
      case "battleship":
        return <Battleship {...props} />;
      case "checkers":
        return <Checkers {...props} />;
      case "ludo":
        return <Ludo {...props} />;
      case "uno":
        return <Uno {...props} />;
      case "drawing":
        return <Drawing {...props} />;
      default:
        return null;
    }
  };

  // UNO, Dames et Dessin gèrent leur propre défilement
  const needsFullscreen =
    game.type === "uno" || game.type === "drawing" || game.type === "checkers";

  const rematchOffer =
    game.status === "finished" &&
    !!game.rematchGameId &&
    game.rematchBy !== profile.id;

  return (
    <GameRuntimeContext.Provider
      value={{
        rematch,
        rematching,
        exit: () => navigation.goBack(),
      }}
    >
      <View style={s.root}>
        {/* Ambiance du jeu : halo de sa couleur en haut de l'écran */}
        <LinearGradient
          pointerEvents="none"
          colors={[(GAME_INFO[game.type]?.colors[0] ?? "#FF2E4D") + "55", "rgba(9,9,12,0)"]}
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: 280 }}
        />
        {header}
        {timerBar}
        {needsFullscreen ? (
          <View style={{ flex: 1 }}>{renderGame()}</View>
        ) : (
          <ScrollView
            contentContainerStyle={s.content}
            showsVerticalScrollIndicator={false}
          >
            {renderGame()}
          </ScrollView>
        )}

        {rematchOffer && (
          <View style={s.offer}>
            <Ionicons name="refresh-circle" size={30} color={G.gold} />
            <View style={{ flex: 1 }}>
              <Text style={s.offerTitle}>Revanche proposée</Text>
              <Text style={s.offerSub}>Ton adversaire veut rejouer.</Text>
            </View>
            <Pressable
              onPress={() => {
                haptic("select");
                navigation.replace("GameScreen", {
                  chatId,
                  gameId: game.rematchGameId as string,
                });
              }}
              style={({ pressed }) => [s.offerBtn, pressed && { opacity: 0.8 }]}
            >
              <Text style={s.offerBtnTxt}>Jouer</Text>
            </Pressable>
          </View>
        )}
      </View>
    </GameRuntimeContext.Provider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: G.bg },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: G.bg,
  },
  header: {
    paddingTop: 54,
    paddingHorizontal: 12,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "transparent",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  back: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: G.text, fontSize: 18, fontWeight: "800" },
  series: { color: G.gold, fontSize: 11, fontWeight: "800", marginTop: 1 },
  timerWrap: { paddingHorizontal: 16, paddingTop: 8, gap: 5 },
  timerTrack: { height: 5, borderRadius: 3, backgroundColor: G.surface2, overflow: "hidden" },
  timerFill: { height: "100%", borderRadius: 3 },
  timerTxt: { color: G.muted, fontSize: 12, fontWeight: "700", textAlign: "center" },
  claim: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 10,
    borderRadius: 14,
    backgroundColor: G.surface,
    borderWidth: 1,
    borderColor: G.gold,
  },
  claimTxt: { flex: 1, color: G.text, fontSize: 13, fontWeight: "700" },
  claimBtn: { backgroundColor: G.accent, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  claimBtnTxt: { color: "#fff", fontSize: 12, fontWeight: "900" },
  content: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  waiting: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    paddingHorizontal: 32,
  },
  waitIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: G.surface,
    borderWidth: 1,
    borderColor: G.border,
    alignItems: "center",
    justifyContent: "center",
  },
  waitTxt: { color: G.text, fontSize: 17, fontWeight: "800" },
  waitSub: { color: G.muted, fontSize: 13, textAlign: "center" },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: G.gold },
  offer: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: G.surface,
    borderWidth: 1,
    borderColor: G.gold,
  },
  offerTitle: { color: G.text, fontSize: 15, fontWeight: "800" },
  offerSub: { color: G.muted, fontSize: 12, marginTop: 1 },
  offerBtn: {
    backgroundColor: G.accent,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  offerBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
});
