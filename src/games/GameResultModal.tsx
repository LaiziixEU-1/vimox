import { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width, height } = Dimensions.get("window");
const CARD_W = Math.min(320, width - 48);
const CONFETTI_COLORS = [
  "#FFD700",
  "#E8000A",
  "#28F7A1",
  "#74B9FF",
  "#FF69B4",
  "#FFA500",
  "#fff",
];
const CONFETTI_COUNT = 28;

function Confetti({ active }: { active: boolean }) {
  // ── FIX : on stocke initialX comme nombre (pas _value qui est privé) ──────
  const pieces = useRef(
    Array.from({ length: CONFETTI_COUNT }, (_, i) => {
      const initialX = Math.random() * width;
      return {
        x: new Animated.Value(initialX),
        initialX,
        y: new Animated.Value(-20 - Math.random() * 120),
        rot: new Animated.Value(0),
        scale: new Animated.Value(0.6 + Math.random() * 0.8),
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        delay: Math.random() * 400,
        dur: 1000 + Math.random() * 800,
        drift: (Math.random() - 0.5) * 160,
        spin: (Math.random() > 0.5 ? 1 : -1) * (2 + Math.random() * 4),
      };
    }),
  ).current;

  useEffect(() => {
    if (!active) return;
    pieces.forEach((p) => {
      const newX = Math.random() * width;
      p.x.setValue(newX);
      p.y.setValue(-20 - Math.random() * 100);
      p.rot.setValue(0);
      Animated.parallel([
        Animated.timing(p.y, {
          toValue: height + 40,
          duration: p.dur,
          delay: p.delay,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(p.x, {
          toValue: newX + p.drift,
          duration: p.dur,
          delay: p.delay,
          useNativeDriver: true,
        }),
        Animated.timing(p.rot, {
          toValue: p.spin,
          duration: p.dur,
          delay: p.delay,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [active]);

  if (!active) return null;
  return (
    <>
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            width: 10,
            height: 14,
            borderRadius: 2,
            backgroundColor: p.color,
            transform: [
              { translateX: p.x },
              { translateY: p.y },
              {
                rotate: p.rot.interpolate({
                  inputRange: [-4, 4],
                  outputRange: ["-720deg", "720deg"],
                }),
              },
              { scale: p.scale },
            ],
          }}
        />
      ))}
    </>
  );
}

interface Props {
  result: "win" | "lose" | "draw" | null;
  onClose: () => void;
}

export function GameResultModal({ result, onClose }: Props) {
  const backdrop = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0)).current;
  const cardRot = useRef(new Animated.Value(-8)).current;
  const iconScale = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!result) return;
    backdrop.setValue(0);
    cardScale.setValue(0);
    cardRot.setValue(-8);
    iconScale.setValue(0);
    shimmer.setValue(0);
    pulse.setValue(1);

    Animated.sequence([
      Animated.timing(backdrop, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.spring(cardScale, {
          toValue: 1,
          speed: 14,
          bounciness: 16,
          useNativeDriver: true,
        }),
        Animated.spring(cardRot, {
          toValue: 0,
          speed: 14,
          bounciness: 10,
          useNativeDriver: true,
        }),
      ]),
      Animated.spring(iconScale, {
        toValue: 1,
        speed: 12,
        bounciness: 20,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1600,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();

    if (result === "win") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.08,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }
  }, [result]);

  if (!result) return null;

  const isWin = result === "win";
  const isDraw = result === "draw";

  const emoji = isWin ? "🏆" : isDraw ? "🤝" : "😔";
  const title = isWin ? "VICTOIRE !" : isDraw ? "ÉGALITÉ" : "DÉFAITE";
  const subtitle = isWin
    ? "Tu as écrasé l'adversaire !"
    : isDraw
      ? "Vous êtes à égalité !"
      : "Meilleure chance la prochaine fois !";
  const cardBg = isWin ? "#1a1200" : isDraw ? "#0d0d1a" : "#1a0000";
  const accentCol = isWin ? "#FFD700" : isDraw ? "#74B9FF" : "#E8000A";
  const glowCol = isWin
    ? "rgba(255,215,0,0.22)"
    : isDraw
      ? "rgba(116,185,255,0.15)"
      : "rgba(232,0,10,0.18)";

  const shimmerX = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Confetti active={isWin} />
      <Animated.View style={[s.backdrop, { opacity: backdrop }]}>
        <Animated.View
          style={[
            s.card,
            {
              backgroundColor: cardBg,
              borderColor: accentCol,
              shadowColor: accentCol,
              transform: [
                { scale: cardScale },
                {
                  rotate: cardRot.interpolate({
                    inputRange: [-8, 8],
                    outputRange: ["-8deg", "8deg"],
                  }),
                },
              ],
            },
          ]}
        >
          <Animated.View
            style={[s.shimmer, { transform: [{ translateX: shimmerX }] }]}
          />
          <View style={[s.glow, { backgroundColor: glowCol }]} />
          <View style={[s.accentLine, { backgroundColor: accentCol }]} />

          <Animated.View
            style={{ transform: [{ scale: isWin ? pulse : iconScale }] }}
          >
            <View
              style={[
                s.iconCircle,
                { backgroundColor: glowCol, borderColor: accentCol },
              ]}
            >
              <Text style={s.icon}>{emoji}</Text>
            </View>
          </Animated.View>

          {isWin && (
            <Animated.View
              style={[
                s.starsRow,
                { opacity: iconScale, transform: [{ scale: iconScale }] },
              ]}
            >
              {["⭐", "🌟", "⭐"].map((star, i) => (
                <Text key={i} style={s.star}>
                  {star}
                </Text>
              ))}
            </Animated.View>
          )}

          <Text style={[s.title, { color: accentCol }]}>{title}</Text>
          <Text style={s.subtitle}>{subtitle}</Text>
          <View style={[s.divider, { backgroundColor: accentCol + "33" }]} />

          <TouchableOpacity
            style={[s.btn, { backgroundColor: accentCol }]}
            onPress={onClose}
            activeOpacity={0.85}
          >
            <View style={s.btnShine} />
            <Text style={[s.btnTxt, { color: isWin ? "#000" : "#fff" }]}>
              {isWin ? "🎉 Super !" : isDraw ? "👍 OK !" : "💪 Réessayer"}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: CARD_W,
    borderRadius: 28,
    borderWidth: 1.5,
    padding: 28,
    alignItems: "center",
    gap: 14,
    overflow: "hidden",
    position: "relative",
    shadowOpacity: 0.6,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 20,
  },
  shimmer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: "rgba(255,255,255,0.06)",
    transform: [{ skewX: "-20deg" }],
    zIndex: 1,
  },
  glow: { position: "absolute", top: 0, left: 0, right: 0, height: 100 },
  accentLine: {
    position: "absolute",
    top: 0,
    left: 40,
    right: 40,
    height: 2,
    borderRadius: 1,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  icon: { fontSize: 52 },
  starsRow: { flexDirection: "row", gap: 8 },
  star: { fontSize: 22 },
  title: {
    fontSize: 34,
    fontWeight: "900",
    letterSpacing: 1,
    textAlign: "center",
  },
  subtitle: {
    color: "#777",
    fontSize: 14,
    textAlign: "center",
    fontWeight: "500",
  },
  divider: { width: "80%", height: 1, borderRadius: 1 },
  btn: {
    width: "100%",
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    overflow: "hidden",
    position: "relative",
  },
  btnShine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  btnTxt: { fontSize: 16, fontWeight: "900", letterSpacing: 0.5 },
});
