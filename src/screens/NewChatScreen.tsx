import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors } from "../theme/colors";
import { ScreenHeader } from "../components/ScreenHeader";
import { Avatar } from "../components/Avatar";
import { EmptyState } from "../components/ui";
import { useAuth } from "../services/AuthContext";
import { Friend, RootStackParamList } from "../models/types";
import { subscribeFriends } from "../services/friendService";
import { normalizeName } from "../services/searchService";

type Props = NativeStackScreenProps<RootStackParamList, "NewChat">;

// « Nouveau chat » : choisir un ami pour ouvrir (ou commencer) la conversation
export function NewChatScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    if (!profile) return;
    return subscribeFriends(profile.id, setFriends);
  }, [profile?.id]);

  const needle = normalizeName(q);
  const list = (friends ?? [])
    .filter((f) => !needle || normalizeName(f.name).includes(needle))
    .sort((a, b) => (!!a.isOnline !== !!b.isOnline ? (a.isOnline ? -1 : 1) : a.name.localeCompare(b.name)));

  return (
    <View style={s.root}>
      <ScreenHeader title="Nouveau chat" onBack={() => navigation.goBack()} />
      {friends !== null && friends.length === 0 ? (
        <EmptyState
          icon="chatbubbles-outline"
          title="Pas encore d'amis"
          text="Ajoute des amis pour discuter avec eux."
          actionLabel="Ajouter des amis"
          onAction={() => navigation.replace("AddFriends")}
        />
      ) : (
        <>
          <View style={s.searchWrap}>
            <Ionicons name="search" size={18} color={colors.muted} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Rechercher parmi tes amis"
              placeholderTextColor={colors.muted}
              style={s.searchInput}
              autoCorrect={false}
              accessibilityLabel="Rechercher parmi tes amis"
            />
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
            {list.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => navigation.replace("FriendChat", { friendId: f.id, friendName: f.name })}
                accessibilityRole="button"
                accessibilityLabel={`Discuter avec ${f.name}`}
                style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.card }]}
              >
                <View>
                  <Avatar uri={f.profilePhotoURL} name={f.name} size={48} />
                  {f.isOnline && <View style={s.dot} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.name} numberOfLines={1}>{f.name}</Text>
                  <Text style={s.sub} numberOfLines={1}>{f.isOnline ? "En ligne" : f.country || "Touche pour discuter"}</Text>
                </View>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.muted} />
              </Pressable>
            ))}
            {friends !== null && list.length === 0 && friends.length > 0 && (
              <Text style={s.none}>Aucun ami « {q.trim()} »</Text>
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginVertical: 8, paddingHorizontal: 14, height: 44, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  dot: { position: "absolute", right: 0, bottom: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: "#28F7A1", borderWidth: 2, borderColor: colors.black },
  name: { color: colors.text, fontSize: 16, fontWeight: "800" },
  sub: { color: colors.muted, fontSize: 13, marginTop: 2 },
  none: { color: colors.muted, textAlign: "center", marginTop: 30 },
});
