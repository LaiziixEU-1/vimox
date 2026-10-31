/*VIMOX-V30*/
import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors } from "../theme/colors";
import { ScreenHeader } from "../components/ScreenHeader";
import { Friend, RootStackParamList } from "../models/types";
import { useAuth } from "../services/AuthContext";
import { subscribeFriends } from "../services/friendService";
import { sendSnapToFriend } from "../services/snapService";
import { useChatPrefs } from "../hooks/useChatPrefs";
import { Shortcut, activeMembers } from "../services/chatPrefsService";
import { Group, sendGroupSnap, subscribeMyGroups } from "../services/groupService";

type Props = NativeStackScreenProps<RootStackParamList, "SendTo">;

export function SendToScreen({ route, navigation }: Props) {
  const { imageURL, duration } = route.params;
  const { profile } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  // Groupes : un Vim peut aussi partir dans un ou plusieurs groupes
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  useEffect(() => {
    if (!profile) return;
    return subscribeMyGroups(profile.id, setGroups);
  }, [profile?.id]);
  const total = selected.length + selectedGroups.length;
  const prefs = useChatPrefs(profile?.id);

  useEffect(() => {
    if (!profile) return;
    return subscribeFriends(profile.id, setFriends);
  }, [profile]);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  // Un raccourci sélectionne (ou désélectionne) d'un coup tous ses amis encore dans ta liste
  function applyShortcut(sc: Shortcut) {
    const ids = activeMembers(sc, friends.map((f) => f.id));
    if (ids.length === 0) {
      Alert.alert("Raccourci vide", "Ces amis ne sont plus dans ta liste.");
      return;
    }
    const all = ids.every((id) => selected.includes(id));
    setSelected((prev) => (all ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]));
  }

  async function handleSend() {
    if (!profile || total === 0) return;
    setSending(true);
    try {
      await Promise.all([
        ...selected.map((friendId) => sendSnapToFriend(profile.id, friendId, imageURL, duration)),
        ...groups
          .filter((g) => selectedGroups.includes(g.id))
          .map((g) => sendGroupSnap(g, { id: profile.id, name: profile.name }, imageURL, duration)),
      ]);
      navigation.popToTop();
    } catch {
      Alert.alert("Erreur", "Impossible d'envoyer le Vim.");
    } finally {
      setSending(false);
    }
  }

  const groupsSection =
    groups.length > 0 ? (
      <View style={s.shortcuts}>
        <Text style={s.shortcutsTitle}>GROUPES</Text>
        <View style={s.shortcutsRow}>
          {groups.map((g) => {
            const on = selectedGroups.includes(g.id);
            return (
              <Pressable
                key={g.id}
                onPress={() =>
                  setSelectedGroups((p) => (p.includes(g.id) ? p.filter((x) => x !== g.id) : [...p, g.id]))
                }
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`Groupe ${g.name}`}
                style={[s.shortcut, on && s.shortcutOn]}
              >
                <Text style={{ fontSize: 16 }}>{g.emoji}</Text>
                <Text style={[s.shortcutTxt, on && { color: "#fff" }]} numberOfLines={1}>
                  {g.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    ) : null;

  return (
    <SafeAreaView style={s.root}>
      <ScreenHeader
        safeArea={false}
        title="Envoyer à"
        onBack={() => navigation.goBack()}
      />

      <FlatList
        ListHeaderComponent={
          <>
          {groupsSection}
          {prefs.shortcuts.length > 0 ? (
            <View style={s.shortcuts}>
              <Text style={s.shortcutsTitle}>RACCOURCIS</Text>
              <View style={s.shortcutsRow}>
                {prefs.shortcuts.map((sc) => {
                  const ids = activeMembers(sc, friends.map((f) => f.id));
                  const on = ids.length > 0 && ids.every((id) => selected.includes(id));
                  return (
                    <Pressable
                      key={sc.id}
                      onPress={() => applyShortcut(sc)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={`Raccourci ${sc.name}, ${ids.length} amis`}
                      style={[s.shortcut, on && s.shortcutOn]}
                    >
                      <Text style={{ fontSize: 16 }}>{sc.emoji}</Text>
                      <Text style={[s.shortcutTxt, on && { color: "#fff" }]} numberOfLines={1}>
                        {sc.name} · {ids.length}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}
          </>
        }
        data={friends}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Text style={s.emptyTxt}>Pas encore d'amis à qui envoyer</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isSel = selected.includes(item.id);
          return (
            <Pressable
              onPress={() => toggle(item.id)}
              style={[s.row, isSel && s.rowSelected]}
            >
              {item.profilePhotoURL ? (
                <Image
                  source={{ uri: item.profilePhotoURL }}
                  style={s.avatar}
                />
              ) : (
                <View style={s.avatarPh}>
                  <Text style={s.avatarTxt}>
                    {item.name?.[0]?.toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={s.name}>{item.name}</Text>
              <View style={[s.checkbox, isSel && s.checkboxOn]}>
                {isSel && <Text style={s.checkMark}>✓</Text>}
              </View>
            </Pressable>
          );
        }}
      />

      {total > 0 && (
        <View style={s.footer}>
          <Pressable
            style={[s.sendBtn, sending && { opacity: 0.6 }]}
            onPress={handleSend}
            disabled={sending}
          >
            <Text style={s.sendTxt}>
              {sending ? "Envoi..." : `Envoyer (${total})`}
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  shortcuts: { marginBottom: 6 },
  shortcutsTitle: { color: colors.muted, fontSize: 12, fontWeight: "800", letterSpacing: 1, marginBottom: 8 },
  shortcutsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  shortcut: { flexDirection: "row", alignItems: "center", gap: 6, height: 38, paddingHorizontal: 12, borderRadius: 19, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, maxWidth: "100%" },
  shortcutOn: { backgroundColor: colors.neonRed, borderColor: colors.neonRed },
  shortcutTxt: { color: colors.text, fontSize: 13, fontWeight: "800", flexShrink: 1 },
  root: { flex: 1, backgroundColor: colors.black },
  header: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  back: { color: colors.text, fontSize: 28, fontWeight: "300" },
  title: { color: colors.text, fontSize: 18, fontWeight: "900" },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyTxt: { color: colors.muted, fontSize: 14 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowSelected: {
    borderColor: colors.neonRed,
    backgroundColor: "rgba(255,46,77,0.08)",
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPh: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,46,77,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarTxt: { color: colors.neonRed, fontWeight: "900" },
  name: { flex: 1, color: colors.text, fontWeight: "700", fontSize: 15 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: colors.neonRed, borderColor: colors.neonRed },
  checkMark: { color: "#fff", fontWeight: "900", fontSize: 13 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border },
  sendBtn: {
    backgroundColor: colors.neonRed,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  sendTxt: { color: "#fff", fontWeight: "900", fontSize: 15 },
});
