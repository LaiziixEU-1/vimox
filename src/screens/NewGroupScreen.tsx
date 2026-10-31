import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { ScreenHeader } from "../components/ScreenHeader";
import { Avatar } from "../components/Avatar";
import { EmptyState } from "../components/ui";
import { useAuth } from "../services/AuthContext";
import { Friend } from "../models/types";
import { subscribeFriends } from "../services/friendService";
import { guardText } from "../services/moderationGuard";
import { GROUP_MAX, createGroup } from "../services/groupService";

const EMOJIS = ["👥", "🔥", "🎉", "💬", "🏠", "🎮", "⚽", "🎵", "🍕", "💛", "🌟", "😎"];

// « Nouveau groupe » : choisis 2 à 7 amis, un nom et un emoji
export function NewGroupScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("👥");
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!profile) return;
    return subscribeFriends(profile.id, setFriends);
  }, [profile?.id]);

  const maxFriends = GROUP_MAX - 1;
  const toggle = (id: string) =>
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= maxFriends ? p : [...p, id]));
  const valid = selected.length >= 2;

  async function create() {
    if (!profile || !valid || busy) return;
    const label = name.trim() || "Groupe";
    const verdict = await guardText(label, { userId: profile.id, where: "groupName" });
    if (!verdict.ok) {
      Alert.alert("Nom refusé", verdict.message);
      return;
    }
    setBusy(true);
    try {
      const gid = await createGroup({ id: profile.id, name: profile.name }, label, emoji, selected);
      navigation.replace("GroupChat", { groupId: gid, name: label });
    } catch (e: any) {
      const code = String(e?.code ?? e?.message ?? "");
      Alert.alert(
        "Groupe non créé",
        /permission/i.test(code)
          ? "Un des amis choisis n'est pas dans ta tranche d'âge : les moins de 18 ans et les adultes ne peuvent pas être dans le même groupe."
          : "Vérifie ta connexion et réessaie.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={s.root}>
      <ScreenHeader title="Nouveau groupe" onBack={() => navigation.goBack()} />
      {friends !== null && friends.length < 2 ? (
        <EmptyState
          icon="people-outline"
          title="Il te faut au moins 2 amis"
          text="Un groupe réunit 3 à 8 personnes, toi compris."
          actionLabel="Ajouter des amis"
          onAction={() => navigation.replace("AddFriends")}
        />
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 60 }}>
          <Text style={s.label}>NOM DU GROUPE</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            maxLength={30}
            placeholder="Les potes, Famille, Équipe…"
            placeholderTextColor={colors.muted}
            style={s.input}
          />
          <Text style={s.label}>EMOJI</Text>
          <View style={s.emojis}>
            {EMOJIS.map((e) => (
              <Pressable
                key={e}
                onPress={() => setEmoji(e)}
                accessibilityRole="button"
                accessibilityState={{ selected: emoji === e }}
                style={[s.emojiBtn, emoji === e && s.emojiOn]}
              >
                <Text style={{ fontSize: 22 }}>{e}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.label}>
            AMIS · {selected.length}/{maxFriends} (2 MINIMUM)
          </Text>
          {(friends ?? []).map((f) => {
            const on = selected.includes(f.id);
            const full = !on && selected.length >= maxFriends;
            return (
              <Pressable
                key={f.id}
                onPress={() => toggle(f.id)}
                disabled={full}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on, disabled: full }}
                style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.card }, full && { opacity: 0.4 }]}
              >
                <Avatar uri={f.profilePhotoURL} name={f.name} size={42} />
                <Text style={s.name} numberOfLines={1}>{f.name}</Text>
                <View style={[s.check, on && s.checkOn]}>{on && <Ionicons name="checkmark" size={16} color="#fff" />}</View>
              </Pressable>
            );
          })}
          <Pressable
            onPress={create}
            disabled={!valid || busy}
            accessibilityRole="button"
            style={({ pressed }) => [s.btn, (!valid || busy) && { opacity: 0.45 }, pressed && { opacity: 0.8 }]}
          >
            <Text style={s.btnTxt}>{busy ? "Création…" : `Créer le groupe ${emoji}`}</Text>
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
