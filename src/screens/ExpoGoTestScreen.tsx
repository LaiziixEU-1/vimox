import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { VimoXLogo } from "../components/VimoXLogo";
import { colors } from "../theme/colors";

export function ExpoGoTestScreen() {
  return (
    <LinearGradient colors={[colors.black, "#111122", "#16080D"]} style={styles.root}>
      <VimoXLogo size={270} />
      <Text style={styles.title}>Expo Go fonctionne</Text>
      <Text style={styles.text}>Si tu vois cet écran sur ton téléphone, le problème vient de Firebase/config runtime, pas du QR ni du réseau.</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24
  },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 24
  },
  text: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 10
  }
});

