import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors } from "../theme/colors";
import { ScreenHeader } from "../components/ScreenHeader";
import { Avatar } from "../components/Avatar";
import { EmptyState } from "../components/ui";
import { useAuth } from "../services/AuthContext";
import { useChatPrefs } from "../hooks/useChatPrefs";
import { Friend, RootStackParamList } from "../models/types";
import { subscribeFriends } from "../services/friendService";
import { MAX_PINS, PrefsError, clearConversation, deleteShortcut, prefsProblemText, togglePin } from "../services/chatPrefsService";

type Props = NativeStackScreenProps<RootStackParamList, "ManageChats">;

// « Gérer les chats » : épingler en haut de la liste, effacer une conversation chez soi, gérer les raccourcis
export function ManageChatsScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const prefs = useChatPrefs(profile?.id);
  const [friends, setFriends] = useState<Friend[] | null>(null);
  useEffect(() => {
    if (!profile) return;
    return subscribeFriends(profile.id, setFriends);
  }, [profile?.id]);
  if (!profile) return null;
  const me = profile.id;

  async function pin(f: Friend) {
    try {
      await togglePin(me, f.id);
    } catch (e) {
      Alert.alert("Épingle impossible", e instanceof PrefsError ? prefsProblemText(e.problem) : "Réessaie.");
    }
  }
  function clear(f: Friend) {
    Alert.alert(
      `Effacer la conversation avec ${f.name} ?`,
      `Les messages n'apparaîtront plus sur ce téléphone. ${f.name} garde les siens et vos flammes ne changent pas.`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Effacer", style: "destructive", onPress: () => clearConversation(me, f.id) },
      ],
    );
  }
  function removeShortcut(id: string, name: string) {
    Alert.alert(`Supprimer le raccourci « ${name} » ?`, "Tes amis ne sont pas supprimés.", [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => deleteShortcut(me, id) },
    ]);
  }

  const sorted = [...(friends ?? [])].sort((a, b) => {
    const ia = prefs.pinned.indexOf(a.id), ib = prefs.pinned.indexOf(b.id);
    if ((ia >= 0) !== (ib >= 0)) return ia >= 0 ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <View style={s.root}>
      <ScreenHeader title="Gérer les chats" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <Text style={s.section}>Conversations</Text>
        <Text style={s.help}>
          Épingle jusqu'à {MAX_PINS} conversations en haut de ta liste. « Effacer » ne vide la conversation que sur ce téléphone.
        </Text>
        {friends !== null && friends.length === 0 ? (
          <EmptyState icon="chatbubbles-outline" title="Pas encore de conversations" text="Ajoute des amis pour discuter." />
        ) : (
          sorted.map((f) => {
            const pinned = prefs.pinned.includes(f.id);
            return (
              <View key={f.id} style={s.row}>
                <Avatar uri={f.profilePhotoURL} name={f.name} size={42} />
                <Text style={s.name} numberOfLines={1}>{f.name}</Text>
                <Pressable
                  onPress={() => pin(f)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={pinned ? `Désépingler ${f.name}` : `Épingler ${f.name}`}
                  style={[s.iconBtn, pinned && s.iconOn]}
                >
                  <Ionicons name={pinned ? "pin" : "pin-outline"} size={18} color={pinned ? colors.gold : colors.muted} />
                </Pressable>
                <Pressable
                  onPress={() => clear(f)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Effacer la conversation avec ${f.name}`}
                  style={s.iconBtn}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.muted} />
                </Pressable>
              </View>
            );
          })
        )}

        <Text style={s.section}>Raccourcis</Text>
        {prefs.shortcuts.length === 0 ? (
          <Pressable onPress={() => navigation.navigate("NewShortcut")} style={s.emptyShortcuts} accessibilityRole="button">
            <Ionicons name="flash-outline" size={18} color={colors.gold} />
            <Text style={s.emptyShortcutsTxt}>Créer un raccourci pour envoyer un Vim à plusieurs amis</Text>
          </Pressable>
        ) : (
          prefs.shortcuts.map((sc) => (
            <View key={sc.id} style={s.row}>
              <View style={s.scEmoji}><Text style={{ fontSize: 22 }}>{sc.emoji}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={s.name} numberOfLines={1}>{sc.name}</Text>
                <Text style={s.sub}>{sc.friendIds.length} amis</Text>
              </View>
              <Pressable
                onPress={() => removeShortcut(sc.id, sc.name)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Supprimer le raccourci ${sc.name}`}
                style={s.iconBtn}
              >
                <Ionicons name="trash-outline" size={18} color={colors.muted} />
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  section: { color: colors.muted, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", marginTop: 22, marginBottom: 6, marginHorizontal: 18 },
  help: { color: colors.muted, fontSize: 13, lineHeight: 19, marginHorizontal: 18, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  name: { flex: 1, color: colors.text, fontSize: 16, fontWeight: "700" },
  sub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: colors.card },
  iconOn: { backgroundColor: colors.neonRedBg },
  scEmoji: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  emptyShortcuts: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, padding: 14, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  emptyShortcutsTxt: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "600" },
});
