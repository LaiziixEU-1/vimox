/*VIMOX-V33*/
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../config/firebase";
import { colors } from "../theme/colors";
import type { GameDoc } from "./gameService";

// ─────────────────────────────────────────────────────────────
// Palette commune des jeux : même univers que le reste de l'app
// ─────────────────────────────────────────────────────────────
export const G = {
  bg: colors.black,
  surface: colors.card,
  surface2: colors.cardLight,
  border: colors.border,
  borderLight: colors.borderLight,
  text: colors.text,
  muted: colors.muted,
  mutedDark: colors.mutedDark,
  accent: colors.neonRed,
  accentSoft: colors.neonRedText,
  gold: colors.gold,
  // Couleurs des deux joueurs : bordeaux clair et champagne
  p1: "#FF4D6D",
  p2: "#FFD166",
  win: "#4ADE80",
};

// ─────────────────────────────────────────────────────────────
// Retours haptiques
// ─────────────────────────────────────────────────────────────
export function haptic(kind: "tap" | "success" | "error" | "select") {
  try {
    if (kind === "tap") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } else if (kind === "select") {
      Haptics.selectionAsync().catch(() => {});
    } else if (kind === "success") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(
        () => {},
      );
    }
  } catch {}
}

// ─────────────────────────────────────────────────────────────
// Contexte : permet au modal de résultat de lancer la revanche
// ─────────────────────────────────────────────────────────────
export interface GameRuntime {
  rematch: () => void;
  rematching: boolean;
  exit: () => void;
}
export const GameRuntimeContext = createContext<GameRuntime | null>(null);
export function useGameRuntime() {
  return useContext(GameRuntimeContext);
}

// ─────────────────────────────────────────────────────────────
// Joueurs : nom + photo lus dans Firestore
// ─────────────────────────────────────────────────────────────
export interface PlayerInfo {
  id: string;
  name: string;
  photo: string | null;
}

export function usePlayer(uid: string | undefined, fallback: string): PlayerInfo {
  const [p, setP] = useState<PlayerInfo>({
    id: uid ?? "",
    name: fallback,
    photo: null,
  });
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        const d: any = snap.data();
        if (d) {
          setP({
            id: uid,
            name: d.name ?? fallback,
            photo: d.profilePhotoURL ?? null,
          });
        }
      },
      () => {},
    );
  }, [uid]);
  if (uid === "vimox-bot") return { id: uid, name: "VimoX Bot 🤖", photo: null };
  return p;
}

export function Avatar({
  player,
  size,
  ring,
}: {
  player: PlayerInfo;
  size: number;
  ring?: string;
}) {
  const border = ring ? { borderWidth: 2, borderColor: ring } : null;
  if (player.photo) {
    return (
      <Image
        source={{ uri: player.photo }}
        style={[
          { width: size, height: size, borderRadius: size / 2 },
          border,
        ]}
      />
    );
  }
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: G.surface2,
          alignItems: "center",
          justifyContent: "center",
        },
        border,
      ]}
    >
      <Text
        style={{
          color: G.text,
          fontWeight: "800",
          fontSize: size * 0.42,
        }}
      >
        {player.name?.[0]?.toUpperCase() ?? "?"}
      </Text>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Bandeau des deux joueurs, avec le tour en cours bien visible
// ─────────────────────────────────────────────────────────────
function PlayerChip({
  player,
  color,
  active,
  isMe,
  score,
}: {
  player: PlayerInfo;
  color: string;
  active: boolean;
  isMe: boolean;
  score?: number;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 850,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active]);

  return (
    <View style={[kit.chip, active && { borderColor: color }]}>
      <View style={kit.avatarBox}>
        <Avatar player={player} size={38} ring={color} />
        {active && (
          <Animated.View
            pointerEvents="none"
            style={[
              kit.pulseRing,
              {
                borderColor: color,
                opacity: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.85, 0],
                }),
                transform: [
                  {
                    scale: pulse.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.55],
                    }),
                  },
                ],
              },
            ]}
          />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={kit.chipName} numberOfLines={1}>
          {isMe ? "Toi" : player.name}
        </Text>
        <Text
          style={[kit.chipSub, active && { color }]}
          numberOfLines={1}
        >
          {active ? (isMe ? "À toi de jouer" : "Réfléchit…") : "En attente"}
        </Text>
      </View>
      {typeof score === "number" && <Text style={kit.score}>{score}</Text>}
    </View>
  );
}

export function PlayersBar({
  game,
  myId,
  colorP1,
  colorP2,
  scoreP1,
  scoreP2,
}: {
  game: GameDoc;
  myId: string;
  colorP1: string;
  colorP2: string;
  scoreP1?: number;
  scoreP2?: number;
}) {
  const p1 = usePlayer(game.player1, "Joueur 1");
  const p2 = usePlayer(game.player2, "Joueur 2");
  const iAmP1 = myId === game.player1;
  const finished = game.status === "finished";
  const me = iAmP1 ? p1 : p2;
  const opp = iAmP1 ? p2 : p1;
  const myColor = iAmP1 ? colorP1 : colorP2;
  const oppColor = iAmP1 ? colorP2 : colorP1;
  const myScore = iAmP1 ? scoreP1 : scoreP2;
  const oppScore = iAmP1 ? scoreP2 : scoreP1;
  return (
    <View style={kit.bar}>
      <PlayerChip
        player={me}
        color={myColor}
        active={!finished && game.currentTurn === myId}
        isMe
        score={myScore}
      />
      <PlayerChip
        player={opp}
        color={oppColor}
        active={!finished && game.currentTurn !== myId}
        isMe={false}
        score={oppScore}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// Animations
// ─────────────────────────────────────────────────────────────

// Fait « apparaître » un élément (pion, croix...) avec un petit rebond
export function PopIn({
  animate,
  children,
  style,
}: {
  animate: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const v = useRef(new Animated.Value(animate ? 0 : 1)).current;
  useEffect(() => {
    if (animate) {
      Animated.spring(v, {
        toValue: 1,
        friction: 5,
        tension: 170,
        useNativeDriver: true,
      }).start();
    }
  }, []);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v.interpolate({
            inputRange: [0, 0.35, 1],
            outputRange: [0, 1, 1],
          }),
          transform: [
            {
              scale: v.interpolate({
                inputRange: [0, 1],
                outputRange: [0.25, 1],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// Repère les cases qui viennent d'être jouées (par toi OU par l'adversaire)
export function useFreshCells(cells: number[]): Set<number> {
  const prev = useRef<number[] | null>(null);
  const fresh = new Set<number>();
  if (prev.current) {
    for (let i = 0; i < cells.length; i++) {
      if (cells[i] !== 0 && prev.current[i] === 0) fresh.add(i);
    }
  }
  useEffect(() => {
    prev.current = cells;
  });
  return fresh;
}

// Animation de « battement » pour les cases gagnantes
export function usePulse(active: boolean) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      v.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {
          toValue: 1,
          duration: 520,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0,
          duration: 520,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active]);
  return v;
}

const kit = StyleSheet.create({
  bar: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
    paddingHorizontal: 16,
  },
  chip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  avatarBox: { width: 38, height: 38 },
  pulseRing: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 19,
    borderWidth: 2,
  },
  chipName: { color: colors.text, fontSize: 14, fontWeight: "800" },
  chipSub: { color: colors.muted, fontSize: 11, fontWeight: "600", marginTop: 1 },
  score: { color: colors.text, fontSize: 20, fontWeight: "900" },
});
