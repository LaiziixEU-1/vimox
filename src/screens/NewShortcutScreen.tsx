import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors } from "../theme/colors";
import { ScreenHeader } from "../components/ScreenHeader";
import { Avatar } from "../components/Avatar";
import { EmptyState } from "../components/ui";
import { useAuth } from "../services/AuthContext";
import { Friend, RootStackParamList } from "../models/types";
import { subscribeFriends } from "../services/friendService";
import { PrefsError, SHORTCUT_NAME_MAX, addShortcut, prefsProblemText } from "../services/chatPrefsService";

type Props = NativeStackScreenProps<RootStackParamList, "NewShortcut">;
const EMOJIS = ["⚡", "🎉", "🔥", "💬", "👯", "🏠", "🎮", "🌟", "🍕", "🎵", "📸", "💛"];

// « Nouveau raccourci » : un groupe d'amis auquel envoyer un Snap en une seule touche
export function NewShortcutScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("⚡");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!profile) return;
    return subscribeFriends(profile.id, setFriends);
  }, [profile?.id]);

  const toggle = (id: string) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const valid = name.trim().length > 0 && selected.length >= 2;

  async function save() {
    if (!profile || !valid || busy) return;
    setBusy(true);
    try {
      await addShortcut(profile.id, { name, emoji, friendIds: selected });
      Alert.alert("Raccourci créé", "Tu le retrouveras en haut de l'écran quand tu envoies un Vim.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert("Raccourci non créé", e instanceof PrefsError ? prefsProblemText(e.problem) : "Réessaie dans un instant.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.root}>
      <ScreenHeader title="Nouveau raccourci" onBack={() => navigation.goBack()} />
      {friends !== null && friends.length < 2 ? (
        <EmptyState
          icon="flash-outline"
          title="Il te faut au moins 2 amis"
          text="Un raccourci envoie un Vim à plusieurs amis d'un coup."
          actionLabel="Ajouter des amis"
          onAction={() => navigation.replace("AddFriends")}
        />
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
          <Text style={s.label}>NOM</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={SHORTCUT_NAME_MAX}
            placeholder="Les potes, Famille…"
            placeholderTextColor={colors.muted}
            style={s.input}
            accessibilityLabel="Nom du raccourci"
          />
          <Text style={s.label}>EMOJI</Text>
          <View style={s.emojis}>
            {EMOJIS.map((e) => (
              <Pressable
                key={e}
                onPress={() => setEmoji(e)}
                accessibilityRole="button"
                accessibilityLabel={`Emoji ${e}`}
                accessibilityState={{ selected: emoji === e }}
                style={[s.emojiBtn, emoji === e && s.emojiOn]}
              >
                <Text style={{ fontSize: 22 }}>{e}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.label}>AMIS · {selected.length} SÉLECTIONNÉ{selected.length > 1 ? "S" : ""} (2 MINIMUM)</Text>
          {(friends ?? []).map((f) => {
            const on = selected.includes(f.id);
            return (
              <Pressable
                key={f.id}
                onPress={() => toggle(f.id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                accessibilityLabel={f.name}
                style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.card }]}
              >
                <Avatar uri={f.profilePhotoURL} name={f.name} size={42} />
                <Text style={s.name} numberOfLines={1}>{f.name}</Text>
                <View style={[s.check, on && s.checkOn]}>{on && <Ionicons name="checkmark" size={16} color="#fff" />}</View>
              </Pressable>
            );
          })}
          <Pressable
            onPress={save}
            disabled={!valid || busy}
            accessibilityRole="button"
            style={({ pressed }) => [s.btn, (!valid || busy) && { opacity: 0.45 }, pressed && { opacity: 0.8 }]}
          >
            <Text style={s.btnTxt}>{busy ? "Création…" : `Créer le raccourci ${emoji}`}</Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  label: { color: colors.muted, fontSize: 12, fontWeight: "800", letterSpacing: 1, marginTop: 18, marginBottom: 8 },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, color: colors.text, fontSize: 16 },
  emojis: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  emojiBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  emojiOn: { borderColor: colors.neonRed, backgroundColor: colors.neonRedBg },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, paddingHorizontal: 4 },
  name: { flex: 1, color: colors.text, fontSize: 16, fontWeight: "700" },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.borderLight, alignItems: "center", justifyContent: "center" },
  checkOn: { backgroundColor: colors.neonRed, borderColor: colors.neonRed },
  btn: { marginTop: 24, height: 52, borderRadius: 26, backgroundColor: colors.neonRed, alignItems: "center", justifyContent: "center" },
  btnTxt: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
