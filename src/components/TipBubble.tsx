import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text } from "react-native";
import { colors } from "../theme/colors";

// Bulle d'astuce : apparaît en douceur, se ferme d'un tap ou toute seule.
export function TipBubble({
  text,
  onDismiss,
  bottom,
  top,
  autoHideMs = 7000,
}: {
  text: string;
  onDismiss: () => void;
  bottom?: number;
  top?: number;
  autoHideMs?: number;
}) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: 1, useNativeDriver: true, friction: 7 }).start();
    const t = setTimeout(onDismiss, autoHideMs);
    return () => clearTimeout(t);
  }, [text]);
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        st.wrap,
        bottom !== undefined ? { bottom } : { top: top ?? 120 },
        { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] },
      ]}
    >
      <Pressable onPress={onDismiss} style={st.bubble} accessibilityRole="button" accessibilityLabel={`Astuce : ${text}. Toucher pour fermer`}>
        <Text style={st.icon}>💡</Text>
        <Text style={st.txt}>{text}</Text>
        <Text style={st.ok}>OK</Text>
      </Pressable>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, alignItems: "center", zIndex: 500, elevation: 20 },
  bubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    maxWidth: 420,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 18,
    backgroundColor: "rgba(20,20,20,0.94)",
    borderWidth: 1,
    borderColor: colors.gold,
  },
  icon: { fontSize: 18 },
  txt: { flexShrink: 1, color: "#fff", fontSize: 13, fontWeight: "700", lineHeight: 18 },
  ok: { color: colors.gold, fontSize: 13, fontWeight: "900" },
});
