import { useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

interface Props {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  style?: any;
}

export function NeonButton({
  title,
  onPress,
  disabled = false,
  variant = "primary",
  style,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  function onIn() {
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 30,
      bounciness: 0,
    }).start();
  }
  function onOut() {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 4,
    }).start();
  }
  return (
    <Pressable
      onPress={onPress}
      onPressIn={onIn}
      onPressOut={onOut}
      disabled={disabled}
      style={style}
    >
      <Animated.View
        style={[
          s.btn,
          variant === "primary" && s.primary,
          variant === "secondary" && s.secondary,
          variant === "danger" && s.danger,
          disabled && s.disabled,
          { transform: [{ scale }] },
        ]}
      >
        <View style={s.shine} />
        <Text
          style={[
            s.txt,
            variant === "secondary" && s.txtSec,
            variant === "danger" && s.txtDgr,
          ]}
        >
          {title}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  btn: {
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: "center",
    overflow: "hidden",
    position: "relative",
  },
  primary: {
    backgroundColor: colors.neonRed,
    shadowColor: colors.neonRed,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  secondary: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.neonRed,
  },
  danger: {
    backgroundColor: "rgba(232,0,10,0.08)",
    borderWidth: 1,
    borderColor: "rgba(232,0,10,0.3)",
  },
  disabled: { opacity: 0.5 },
  shine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 22,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  txt: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1,
  },
  txtSec: { color: colors.neonRed },
  txtDgr: { color: colors.neonRed },
});
