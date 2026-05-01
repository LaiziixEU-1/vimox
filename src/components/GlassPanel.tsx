import { PropsWithChildren } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { colors } from "../theme/colors";

export function GlassPanel({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: "rgba(0,163,255,0.45)"
  }
});

