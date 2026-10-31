import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors } from "../theme/colors";
import { ScreenHeader } from "../components/ScreenHeader";
import { useAuth } from "../services/AuthContext";
import { useChatPrefs } from "../hooks/useChatPrefs";
import { RootStackParamList } from "../models/types";
import { BadgeLevel, DEFAULT_EMOJIS, PrefsError, emojiFor, prefsProblemText, resetBestFriendEmojis, setBestFriendEmoji } from "../services/chatPrefsService";

type Props = NativeStackScreenProps<RootStackParamList, "BestFriendEmojis">;

const LEVELS: { level: BadgeLevel; title: string; desc: string }[] = [
  { level: "friend", title: "Ami proche", desc: "Vous commencez à échanger des Vims" },
  { level: "bestie", title: "Meilleur ami", desc: "5 Vims échangés ou plus" },
  { level: "bestie_long", title: "Meilleur ami de longue date", desc: "Meilleurs amis depuis 14 jours ou plus" },
];
const CHOICES = ["😊", "😎", "🥰", "😇", "🤗", "💛", "❤️", "💜", "💙", "💚", "🧡", "💖", "🔥", "⭐", "🌟", "🦋", "🌈", "🍀", "👑", "💎"];

// « Personnaliser les emojis d'amis proches » : l'emoji affiché à côté du nom selon le niveau d'amitié
export function BestFriendEmojisScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const prefs = useChatPrefs(profile?.id);
  if (!profile) return null;
  const me = profile.id;
  const custom = Object.keys(prefs.emojis).length > 0;

  async function pick(level: BadgeLevel, emoji: string) {
    try {
      await setBestFriendEmoji(me, level, emoji);
    } catch (e) {
      Alert.alert("Emoji non enregistré", e instanceof PrefsError ? prefsProblemText(e.problem) : "Réessaie.");
    }
  }

  return (
    <View style={s.root}>
      <ScreenHeader title="Emojis d'amis proches" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
        <Text style={s.help}>
          Choisis l'emoji qui apparaît à côté du nom de tes amis dans ta liste de conversations. Ce choix reste sur ton téléphone.
        </Text>
        {LEVELS.map(({ level, title, desc }) => (
          <View key={level} style={s.card}>
            <View style={s.head}>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{title}</Text>
                <Text style={s.desc}>{desc}</Text>
              </View>
              <View style={s.current} accessibilityLabel={`Emoji actuel : ${emojiFor(level, prefs.emojis)}`}>
                <Text style={{ fontSize: 28 }}>{emojiFor(level, prefs.emojis)}</Text>
              </View>
            </View>
            <View style={s.grid}>
              {CHOICES.map((e) => {
                const on = emojiFor(level, prefs.emojis) === e;
                return (
                  <Pressable
                    key={e}
                    onPress={() => pick(level, e)}
                    accessibilityRole="button"
                    accessibilityLabel={`${title} : ${e}`}
                    accessibilityState={{ selected: on }}
                    style={[s.choice, on && s.choiceOn]}
                  >
                    <Text style={{ fontSize: 20 }}>{e}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
        <Pressable
          onPress={() => resetBestFriendEmojis(me)}
          disabled={!custom}
          accessibilityRole="button"
          style={({ pressed }) => [s.reset, !custom && { opacity: 0.4 }, pressed && { opacity: 0.7 }]}
        >
          <Text style={s.resetTxt}>
            Rétablir les emojis d'origine ({DEFAULT_EMOJIS.friend} {DEFAULT_EMOJIS.bestie} {DEFAULT_EMOJIS.bestie_long})
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  help: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 6 },
  card: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 14, marginTop: 14 },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { color: colors.text, fontSize: 16, fontWeight: "800" },
  desc: { color: colors.muted, fontSize: 12, marginTop: 2 },
  current: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.neonRedBg, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  choice: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.cardLight, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  choiceOn: { borderColor: colors.neonRed, backgroundColor: colors.neonRedBg },
  reset: { marginTop: 22, alignItems: "center", paddingVertical: 12 },
  resetTxt: { color: colors.gold, fontSize: 14, fontWeight: "700", textDecorationLine: "underline" },
});
