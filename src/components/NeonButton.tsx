import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../theme/colors";

type Props = {
  title: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
};

export function NeonButton({ title, onPress, danger, disabled, style }: Props) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.wrap, disabled && styles.disabled, style]}>
      <LinearGradient
        colors={danger ? [colors.neonRed, "#9A1111"] : [colors.neonBlue, colors.neonRed]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.button}
      >
        <Text style={styles.text}>{title}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    shadowColor: colors.neonBlue,
    shadowOpacity: 0.7,
    shadowRadius: 16,
    elevation: 8
  },
  button: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  text: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800"
  },
  disabled: {
    opacity: 0.55
  }
});

