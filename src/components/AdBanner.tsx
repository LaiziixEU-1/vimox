import { StyleSheet, Text, View } from "react-native";
import { ads } from "../config/ads";
import { colors } from "../theme/colors";

export function AdBanner() {
  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{ads.enabled ? "AdMob banner prêt" : "Ajoute EXPO_PUBLIC_ADMOB_IOS_BANNER_ID dans .env"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    height: 50,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.28)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)"
  },
  text: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800"
  }
});

