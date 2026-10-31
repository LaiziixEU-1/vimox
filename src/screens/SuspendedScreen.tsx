import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { useAuth } from "../services/AuthContext";
import { suspendedUntilMs } from "../services/suspension";
import { LEGAL, hasSupportEmail } from "../config/legal";

// Écran bloquant affiché quand le compte est suspendu (signalements répétés).
export function SuspendedScreen() {
  const { profile, logout } = useAuth();
  const until = suspendedUntilMs(profile);
  const when = until
    ? new Date(until).toLocaleString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <View style={s.root}>
      <View style={s.icon}>
        <Ionicons name="pause-circle-outline" size={52} color={colors.neonRedText} />
      </View>
      <Text style={s.title}>Compte suspendu</Text>
      <Text style={s.text}>
        Plusieurs personnes ont signalé ton comportement, ou tes messages ont été refusés à
        plusieurs reprises par notre filtre. Ton compte est suspendu pour examen
        {when ? ` jusqu'au ${when}` : ""}.
      </Text>
      <Text style={s.text}>
        Pendant ce temps, tu ne peux ni discuter, ni jouer, ni publier. Lis les règles de
        conduite dans les Conditions d'utilisation quand tu retrouves l'accès.
      </Text>
      {hasSupportEmail && (
        <Pressable
          style={s.btn}
          onPress={() =>
            Linking.openURL(
              `mailto:${LEGAL.supportEmail}?subject=${encodeURIComponent("Suspension de mon compte VimoX")}`,
            ).catch(() => {})
          }
          accessibilityRole="button"
        >
          <Ionicons name="mail-outline" size={18} color="#fff" />
          <Text style={s.btnTxt}>Contester la suspension</Text>
        </Pressable>
      )}
      <Pressable style={s.link} onPress={() => logout()} accessibilityRole="button">
        <Text style={s.linkTxt}>Se déconnecter</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.black,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 14,
  },
  icon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neonRedBg,
    borderWidth: 1,
    borderColor: colors.neonRed,
    marginBottom: 6,
  },
  title: { color: colors.text, fontSize: 24, fontWeight: "900" },
  text: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center" },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    backgroundColor: colors.neonRed,
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 13,
  },
  btnTxt: { color: "#fff", fontSize: 15, fontWeight: "800" },
  link: { paddingVertical: 12 },
  linkTxt: { color: colors.muted, fontSize: 14, fontWeight: "700" },
});
