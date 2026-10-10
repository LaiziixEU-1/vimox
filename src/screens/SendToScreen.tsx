import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors } from "../theme/colors";
import { Friend, RootStackParamList } from "../models/types";
import { useAuth } from "../services/AuthContext";
import { subscribeFriends } from "../services/friendService";
import { sendSnapToFriend } from "../services/snapService";

type Props = NativeStackScreenProps<RootStackParamList, "SendTo">;

export function SendToScreen({ route, navigation }: Props) {
  const { imageURL } = route.params;
  const { profile } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!profile) return;
    return subscribeFriends(profile.id, setFriends);
  }, [profile]);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleSend() {
    if (!profile || selected.length === 0) return;
    setSending(true);
    try {
      await Promise.all(
        selected.map((friendId) =>
          sendSnapToFriend(profile.id, friendId, imageURL),
        ),
      );
      navigation.popToTop();
    } catch {
      Alert.alert("Erreur", "Impossible d'envoyer le Snap.");
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.back}>‹</Text>
        </Pressable>
        <Text style={s.title}>Envoyer à</Text>
      </View>

      <FlatList
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

      {selected.length > 0 && (
        <View style={s.footer}>
          <Pressable
            style={[s.sendBtn, sending && { opacity: 0.6 }]}
            onPress={handleSend}
            disabled={sending}
          >
            <Text style={s.sendTxt}>
              {sending ? "Envoi..." : `Envoyer (${selected.length})`}
            </Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
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
    backgroundColor: "rgba(232,0,10,0.08)",
  },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPh: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(232,0,10,0.15)",
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
