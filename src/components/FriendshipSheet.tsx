import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { db } from "../config/firebase";
import { colors } from "../theme/colors";
import { StreakInfo, getBestFriendEmoji, getChatId, subscribeStreakInfo } from "../services/snapService";

// Profil d'amitié (comme sur Snap) : votre flamme, vos Vims échangés, depuis quand vous êtes amis,
// votre niveau d'amitié et vos groupes en commun.
const LEVELS: Record<string, string> = {
  bestie_long: "Meilleurs amis de longue date",
  bestie: "Meilleurs amis",
  friend: "Amis proches",
  none: "Amis",
};

export function FriendshipSheet({
  visible,
  onClose,
  me,
  friend,
  onProfile,
  onSendVim,
  onSearch,
}: {
  visible: boolean;
  onClose: () => void;
  me: string;
  friend: { id: string; name: string; photo?: string | null };
  onProfile: () => void;
  onSendVim: () => void;
  onSearch?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [info, setInfo] = useState<StreakInfo | null>(null);
  const [since, setSince] = useState<number | null>(null);
  const [groups, setGroups] = useState<{ name: string; emoji: string }[]>([]);

  useEffect(() => {
    if (!visible) return;
    return subscribeStreakInfo(getChatId(me, friend.id), setInfo);
  }, [visible, me, friend.id]);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    // Amis depuis : date du lien d'amitié
    getDoc(doc(db, "friends", `${me}_${friend.id}`))
      .then((d) => {
        const v: any = d.data()?.createdAt;
        const ms = typeof v?.toMillis === "function" ? v.toMillis() : typeof v === "number" ? v : 0;
        if (alive) setSince(ms || null);
      })
      .catch(() => {});
    // Groupes en commun
    getDocs(query(collection(db, "groups"), where("members", "array-contains", me)))
      .then((snap) => {
        if (!alive) return;
        setGroups(
          snap.docs
            .map((d) => d.data() as any)
            .filter((g) => (g.members ?? []).includes(friend.id))
            .map((g) => ({ name: String(g.name ?? "Groupe"), emoji: String(g.emoji ?? "👥") })),
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [visible, me, friend.id]);

  const badge = info?.bestFriendBadge ?? "none";
  const emoji = getBestFriendEmoji(badge as any);
  const sinceTxt = since
    ? new Date(since).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : "—";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={st.overlay} onPress={onClose} accessibilityLabel="Fermer">
        <Pressable style={[st.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]} onPress={() => {}}>
          <View style={st.handle} />
          <View style={st.head}>
            {friend.photo ? (
              <ExpoImage source={{ uri: friend.photo }} style={st.avatar} contentFit="cover" />
            ) : (
              <View style={[st.avatar, st.avatarEmpty]}>
                <Text style={st.avatarTxt}>{friend.name?.[0]?.toUpperCase() ?? "?"}</Text>
              </View>
            )}
            <Text style={st.name} numberOfLines={1}>
              {friend.name} {emoji}
            </Text>
            <Text style={st.level}>{LEVELS[badge] ?? "Amis"}</Text>
          </View>

          <View style={st.stats}>
            <View style={st.stat}>
              <Text style={st.statVal}>{info && info.streakCount >= 1 ? `🔥 ${info.streakCount}` : "—"}</Text>
              <Text style={st.statLbl}>Flamme</Text>
            </View>
            <View style={st.div} />
            <View style={st.stat}>
              <Text style={st.statVal}>{info?.totalSnaps ?? 0}</Text>
              <Text style={st.statLbl}>Vims échangés</Text>
            </View>
            <View style={st.div} />
            <View style={st.stat}>
              <Text style={[st.statVal, { fontSize: 14 }]} numberOfLines={2}>{sinceTxt}</Text>
              <Text style={st.statLbl}>Amis depuis</Text>
            </View>
          </View>

          {info?.isAboutToExpire && (
            <Text style={st.warn}>⏳ Votre flamme va s'éteindre : envoyez-vous un Vim aujourd'hui !</Text>
          )}

          <Text style={st.section}>Groupes en commun · {groups.length}</Text>
          {groups.length === 0 ? (
            <Text style={st.empty}>Aucun groupe en commun pour l'instant.</Text>
          ) : (
            <View style={st.groups}>
              {groups.slice(0, 6).map((g, i) => (
                <View key={i} style={st.group}>
                  <Text style={{ fontSize: 16 }}>{g.emoji}</Text>
                  <Text style={st.groupTxt} numberOfLines={1}>{g.name}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={st.actions}>
            <Pressable onPress={onSendVim} style={({ pressed }) => [st.btn, st.btnMain, pressed && { opacity: 0.85 }]} accessibilityRole="button">
              <Ionicons name="camera" size={18} color="#fff" />
              <Text style={st.btnTxt}>Envoyer un Vim</Text>
            </Pressable>
            <Pressable onPress={onProfile} style={({ pressed }) => [st.btn, pressed && { opacity: 0.85 }]} accessibilityRole="button">
              <Ionicons name="person-outline" size={18} color={colors.text} />
              <Text style={[st.btnTxt, { color: colors.text }]}>Voir le profil</Text>
            </Pressable>
          </View>
          {onSearch && (
            <Pressable onPress={onSearch} style={({ pressed }) => [st.searchBtn, pressed && { opacity: 0.8 }]} accessibilityRole="button">
              <Ionicons name="search" size={17} color={colors.muted} />
              <Text style={st.searchTxt}>Rechercher dans la conversation</Text>
            </Pressable>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 18,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  handle: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: colors.borderLight },
  head: { alignItems: "center", gap: 6 },
  avatar: { width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderColor: colors.neonRed },
  avatarEmpty: { backgroundColor: colors.neonRedBg, alignItems: "center", justifyContent: "center" },
  avatarTxt: { color: colors.neonRedText, fontSize: 32, fontWeight: "900" },
  name: { color: colors.text, fontSize: 20, fontWeight: "900", maxWidth: "90%" },
  level: { color: colors.gold, fontSize: 13, fontWeight: "800" },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.black,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
  },
  stat: { flex: 1, alignItems: "center", gap: 3, paddingHorizontal: 4 },
  statVal: { color: colors.text, fontSize: 18, fontWeight: "900", textAlign: "center" },
  statLbl: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  div: { width: StyleSheet.hairlineWidth, height: 34, backgroundColor: colors.borderLight },
  warn: { color: "#FF9F1C", fontSize: 13, fontWeight: "800", textAlign: "center" },
  section: { color: colors.muted, fontSize: 12, fontWeight: "800", letterSpacing: 0.8, textTransform: "uppercase" },
  empty: { color: colors.mutedDark, fontSize: 13 },
  groups: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  group: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    maxWidth: "48%",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: colors.black,
    borderWidth: 1,
    borderColor: colors.border,
  },
  groupTxt: { color: colors.text, fontSize: 13, fontWeight: "700", flexShrink: 1 },
  actions: { flexDirection: "row", gap: 10, marginTop: 4 },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.black,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnMain: { backgroundColor: colors.neonRed, borderColor: colors.neonRed },
  btnTxt: { color: "#fff", fontSize: 14, fontWeight: "800" },
  searchBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10 },
  searchTxt: { color: colors.muted, fontSize: 14, fontWeight: "700" },
});
