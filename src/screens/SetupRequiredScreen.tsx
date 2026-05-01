import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { VimoXLogo } from "../components/VimoXLogo";
import { colors } from "../theme/colors";

export function SetupRequiredScreen() {
  return (
    <LinearGradient colors={[colors.black, "#111122", "#16080D"]} style={styles.root}>
      <VimoXLogo size={250} />
      <View style={styles.panel}>
        <Text style={styles.title}>Firebase à configurer</Text>
        <Text style={styles.text}>
          L'app s'ouvre correctement, mais le fichier .env contient encore les valeurs exemple. Remplace les clés Firebase
          pour activer inscription, matching et chat.
        </Text>
      </View>
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
  panel: {
    marginTop: 24,
    padding: 18,
    borderRadius: 18,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.neonBlue
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 10
  },
  text: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center"
  }
});

