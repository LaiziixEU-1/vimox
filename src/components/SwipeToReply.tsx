import { ReactNode, useRef } from "react";
import { Animated, PanResponder, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { colors } from "../theme/colors";

// Glisser un message vers la droite = y répondre (comme sur Snap).
// Le geste ne se déclenche que pour un mouvement nettement horizontal : le défilement vertical
// de la conversation et les appuis (ouvrir un Vim, appui long) continuent de marcher.
const TRIGGER = 64;

export function SwipeToReply({
  children,
  onReply,
  enabled = true,
}: {
  children: ReactNode;
  onReply: () => void;
  enabled?: boolean;
}) {
  const x = useRef(new Animated.Value(0)).current;
  const fired = useRef(false);
  const latest = useRef({ onReply, enabled });
  latest.current = { onReply, enabled };

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        latest.current.enabled && g.dx > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 2.2,
      onPanResponderGrant: () => {
        fired.current = false;
      },
      onPanResponderMove: (_, g) => {
        const dx = Math.max(0, Math.min(g.dx, 110));
        x.setValue(dx);
        if (!fired.current && dx >= TRIGGER) {
          fired.current = true;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
      },
      onPanResponderRelease: () => {
        if (fired.current) latest.current.onReply();
        Animated.spring(x, { toValue: 0, useNativeDriver: true, bounciness: 8 }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  const iconOpacity = x.interpolate({ inputRange: [0, TRIGGER * 0.5, TRIGGER], outputRange: [0, 0.4, 1], extrapolate: "clamp" });
  const iconScale = x.interpolate({ inputRange: [0, TRIGGER], outputRange: [0.6, 1], extrapolate: "clamp" });

  return (
    <View {...pan.panHandlers}>
      <Animated.View pointerEvents="none" style={[st.icon, { opacity: iconOpacity, transform: [{ scale: iconScale }] }]}>
        <Ionicons name="arrow-undo" size={18} color={colors.text} />
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX: x }] }}>{children}</Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  icon: {
    position: "absolute",
    left: 10,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
});
