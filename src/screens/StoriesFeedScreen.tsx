import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors } from "../theme/colors";
import { useAuth } from "../services/AuthContext";
import {
  purgeMyExpiredStories,
  subscribeFriendsStories,
  Story,
  UserStories,
} from "../services/storyService";
import { subscribeFriends } from "../services/friendService";
import { useChatPrefs } from "../hooks/useChatPrefs";
import { RootStackParamList } from "../models/types";
import { ScreenHeader } from "../components/ScreenHeader";
import { EmptyState, SectionTitle } from "../components/ui";
import { pagerBus } from "../navigation/pagerBus";
import { setBadge } from "../services/badgeStore";
import { deleteDoc, doc } from "firebase/firestore";
import { db } from "../config/firebase";

type Props = NativeStackScreenProps<RootStackParamList, "StoriesFeed"> & {
  // true quand l'écran est une page du pager (alors pas de flèche de retour)
  embedded?: boolean;
};

function latestOf(u: UserStories): Story {
  return u.stories.reduce((a, b) => (b.createdAt > a.createdAt ? b : a), u.stories[0]);
}

function timeAgo(ms: number): string {
  const mins = Math.max(0, Math.floor((Date.now() - ms) / 60000));
  if (mins < 2) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  return `il y a ${hours} h`;
}

function Avatar({
  uri,
  name,
  ringColor,
  size = 56,
}: {
  uri?: string | null;
  name?: string;
  ringColor: string;
  size?: number;
}) {
  const inner = size - 10;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2.5,
        borderColor: ringColor,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: inner, height: inner, borderRadius: inner / 2 }}
        />
      ) : (
        <View
          style={{
            width: inner,
            height: inner,
            borderRadius: inner / 2,
            backgroundColor: colors.neonRedBg,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: colors.neonRedText, fontWeight: "900", fontSize: inner * 0.4 }}>
            {name?.[0]?.toUpperCase() ?? "?"}
          </Text>
        </View>
      )}
    </View>
  );
}

// Petit aperçu de la dernière story (photo, vidéo, ou texte sur fond coloré)
function Thumb({ story }: { story: Story }) {
  if (story.imageURL) {
    return (
      <View>
        <Image source={{ uri: story.imageURL }} style={s.thumb} />
        {!!story.videoURL && (
          <View style={s.thumbPlay} pointerEvents="none">
            <Ionicons name="play" size={16} color="#fff" />
          </View>
        )}
      </View>
    );
  }
  return (
    <View style={[s.thumb, s.thumbText, { backgroundColor: story.bgColor ?? colors.cardLight }]}>
      <Text
        numberOfLines={3}
        style={{
          color: story.textColor ?? "#fff",
          fontSize: 8,
          fontWeight: "800",
          textAlign: "center",
        }}
      >
        {story.text ?? story.overlayText ?? ""}
      </Text>
    </View>
  );
}

export function StoriesFeedScreen({ navigation, embedded }: Props) {
  const { profile } = useAuth();
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [stories, setStories] = useState<UserStories[]>([]);
  const prefs = useChatPrefs(profile?.id);

  useEffect(() => {
    if (!profile) return;
    const unsub = subscribeFriends(profile.id, (friends) =>
      setFriendIds(friends.map((f) => f.id)),
    );
    return unsub;
  }, [profile]);

  // Efface mes stories expirées (une fois à l'ouverture de l'écran)
  useEffect(() => {
    if (profile?.id) purgeMyExpiredStories(profile.id).catch(() => {});
  }, [profile?.id]);

  // Stories en direct (clé stable : la liste d'amis est réémise à chaque changement de présence)
  // (les amis dont j'ai coupé les stories — fiche d'ami > Réglages de la Story — n'y figurent pas)
  const shownIds = friendIds.filter((id) => !prefs.storyMuted.includes(id));
  const friendKey = [...shownIds].sort().join(",");
  useEffect(() => {
    if (!profile) return;
    return subscribeFriendsStories(profile.id, shownIds, setStories);
  }, [profile?.id, friendKey]);

  const myStories = stories.find((u) => u.userId === profile?.id);
  const others = stories.filter((u) => u.userId !== profile?.id && u.stories.length > 0);
  const byRecent = (a: UserStories, b: UserStories) =>
    latestOf(b).createdAt - latestOf(a).createdAt;
  // Comme sur Snap : les nouvelles d'abord, puis celles déjà vues
  const unseen = others.filter((u) => u.hasUnviewed).sort(byRecent);
  const seen = others.filter((u) => !u.hasUnviewed).sort(byRecent);
  const ordered = [...unseen, ...seen];
  // Pastille de l'onglet « Stories » : amis avec une nouvelle story
  useEffect(() => {
    setBadge("StoriesFeed", unseen.length);
  }, [unseen.length]);

  // Le lecteur enchaîne les amis dans le même ordre que la liste affichée
  function openViewer(user: UserStories) {
    if (user.userId === profile?.id) {
      navigation.navigate("StoryViewer", { stories: [user], initialUserIndex: 0 });
      return;
    }
    const index = Math.max(0, ordered.findIndex((u) => u.userId === user.userId));
    navigation.navigate("StoryViewer", { stories: ordered, initialUserIndex: index });
  }

  // « + » comme sur Snap : la caméra (photo / vidéo), ou une story texte
  function addStory() {
    Alert.alert("Ajouter à ma story", undefined, [
      {
        text: "📷  Photo ou vidéo",
        onPress: () => {
          if (!embedded) navigation.goBack();
          pagerBus.go("Camera");
        },
      },
      { text: "Aa  Story texte", onPress: () => navigation.navigate("CreateStory") },
      { text: "Annuler", style: "cancel" },
    ]);
  }

  const hasMine = !!myStories && myStories.stories.length > 0;

  // 🗑 Supprimer mes stories (la plus récente, ou toutes)
  async function removeStories(ids: string[]) {
    try {
      await Promise.all(ids.map((id) => deleteDoc(doc(db, "stories", id))));
    } catch {
      Alert.alert("Suppression impossible", "Vérifie ta connexion et réessaie.");
    }
  }
  function manageMyStories() {
    if (!myStories || myStories.stories.length === 0) return;
    const list = [...myStories.stories].sort((a, b) => b.createdAt - a.createdAt);
    const buttons: any[] = [
      {
        text: list.length > 1 ? "Supprimer la plus récente" : "Supprimer ma story",
        style: "destructive",
        onPress: () => removeStories([list[0].id]),
      },
    ];
    if (list.length > 1) {
      buttons.push({
        text: `Supprimer les ${list.length} stories`,
        style: "destructive",
        onPress: () => removeStories(list.map((x) => x.id)),
      });
    }
    buttons.push({ text: "Annuler", style: "cancel" });
    Alert.alert(
      "Supprimer ma story",
      list.length > 1
        ? `Tu as ${list.length} publications en ligne. Elles disparaîtront pour tous tes amis.`
        : "Elle disparaîtra pour tous tes amis.",
      buttons,
    );
  }

  const renderRow = (user: UserStories) => {
    const last = latestOf(user);
    return (
      <Pressable
        key={user.userId}
        style={({ pressed }) => [s.row, pressed && s.rowPressed]}
        onPress={() => openViewer(user)}
        accessibilityRole="button"
        accessibilityLabel={`Voir la story de ${user.userName}`}
      >
        <Avatar
          uri={user.userPhoto}
          name={user.userName}
          ringColor={user.hasUnviewed ? colors.neonRed : colors.borderLight}
        />
        <View style={s.info}>
          <Text style={s.name} numberOfLines={1}>
            {user.userName}
          </Text>
          <Text
            style={[s.rowSub, user.hasUnviewed && { color: colors.neonRedText }]}
            numberOfLines={1}
          >
            {user.hasUnviewed ? "Nouveau · " : ""}
            {timeAgo(last.createdAt)}
            {user.stories.length > 1 ? ` · ${user.stories.length} stories` : ""}
          </Text>
        </View>
        <Thumb story={last} />
      </Pressable>
    );
  };

  return (
    <View style={s.root}>
      {embedded ? (
        <View style={s.header}>
          <Text style={s.title}>Stories</Text>
          <Text style={s.sub}>Les stories de tes amis, visibles 24 h</Text>
        </View>
      ) : (
        <ScreenHeader
          title="Stories"
          subtitle="Visibles 24 h"
          onBack={() => navigation.goBack()}
        />
      )}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Bulles en haut, comme sur Snap : toi puis tes amis */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.bubbles}
        >
          <Pressable
            style={s.bubble}
            onPress={() => (hasMine ? openViewer(myStories!) : addStory())}
            accessibilityRole="button"
            accessibilityLabel={hasMine ? "Voir ma story" : "Ajouter à ma story"}
          >
            <View>
              <Avatar
                uri={profile?.profilePhotoURL}
                name={profile?.name}
                ringColor={hasMine ? colors.gold : colors.borderLight}
                size={64}
              />
              <View style={s.bubblePlus}>
                <Ionicons name="add" size={14} color="#fff" />
              </View>
            </View>
            <Text style={s.bubbleName} numberOfLines={1}>Ma story</Text>
          </Pressable>
          {ordered.map((u) => (
            <Pressable
              key={u.userId}
              style={s.bubble}
              onPress={() => openViewer(u)}
              accessibilityRole="button"
              accessibilityLabel={`Voir la story de ${u.userName}`}
            >
              <Avatar
                uri={u.userPhoto}
                name={u.userName}
                ringColor={u.hasUnviewed ? colors.neonRed : colors.borderLight}
                size={64}
              />
              <Text style={[s.bubbleName, !u.hasUnviewed && { color: colors.muted }]} numberOfLines={1}>
                {u.userName}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <SectionTitle>Ma story</SectionTitle>
        {/* Deux boutons côte à côte (jamais un bouton dans un bouton : interdit sur le web) */}
        <View style={s.row}>
          <Pressable
            style={({ pressed }) => [s.rowMain, pressed && { opacity: 0.8 }]}
            onPress={() => (hasMine ? openViewer(myStories!) : addStory())}
            accessibilityRole="button"
            accessibilityLabel={hasMine ? "Voir ma story" : "Publier ma story"}
          >
            <Avatar
              uri={profile?.profilePhotoURL}
              name={profile?.name}
              ringColor={hasMine ? colors.gold : colors.borderLight}
            />
            <View style={s.info}>
              <Text style={s.name}>Ma story</Text>
              <Text style={s.rowSub} numberOfLines={1}>
                {hasMine
                  ? `${myStories!.stories.length} publication${myStories!.stories.length > 1 ? "s" : ""} · ${timeAgo(latestOf(myStories!).createdAt)}`
                  : "Partage un moment avec tes amis"}
              </Text>
            </View>
            {hasMine && <Thumb story={latestOf(myStories!)} />}
          </Pressable>
          {hasMine && (
            <Pressable
              onPress={manageMyStories}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Supprimer ma story"
              style={({ pressed }) => [s.trashBtn, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name="trash-outline" size={19} color={colors.text} />
            </Pressable>
          )}
          <Pressable
            onPress={addStory}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Ajouter une story"
            style={({ pressed }) => [s.addBtn, pressed && { opacity: 0.8 }]}
          >
            <Ionicons name="add" size={22} color="#fff" />
          </Pressable>
        </View>

        {ordered.length === 0 ? (
          <>
            <SectionTitle>Stories de tes amis</SectionTitle>
            <EmptyState
              icon="albums-outline"
              title="Aucune story pour le moment"
              text="Dès qu'un ami publie une story, elle apparaît ici pendant 24 h."
              actionLabel="Publier ma story"
              onAction={addStory}
            />
          </>
        ) : (
          <>
            {unseen.length > 0 && (
              <>
                <SectionTitle>{`Nouvelles · ${unseen.length}`}</SectionTitle>
                <View style={s.list}>{unseen.map(renderRow)}</View>
              </>
            )}
            {seen.length > 0 && (
              <>
                <SectionTitle>Déjà vues</SectionTitle>
                <View style={s.list}>{seen.map(renderRow)}</View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  header: { paddingTop: 54, paddingHorizontal: 20, paddingBottom: 6 },
  title: { color: colors.text, fontSize: 28, fontWeight: "900" },
  sub: { color: colors.muted, fontSize: 13, marginTop: 2 },
  scroll: { paddingHorizontal: 16, paddingBottom: 130 },
  bubbles: { gap: 14, paddingVertical: 12, paddingRight: 8 },
  bubble: { width: 70, alignItems: "center", gap: 6 },
  bubbleName: { color: colors.text, fontSize: 12, fontWeight: "700", maxWidth: 70 },
  bubblePlus: {
    position: "absolute",
    right: -1,
    bottom: -1,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.neonRed,
    borderWidth: 2,
    borderColor: colors.black,
    alignItems: "center",
    justifyContent: "center",
  },
  list: { gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 12,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowPressed: { backgroundColor: colors.cardLight },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 14 },
  info: { flex: 1 },
  name: { color: colors.text, fontSize: 16, fontWeight: "800" },
  rowSub: { color: colors.muted, fontSize: 13, marginTop: 2 },
  thumb: { width: 44, height: 58, borderRadius: 10, backgroundColor: colors.cardLight },
  thumbPlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 44,
    height: 58,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  thumbText: { alignItems: "center", justifyContent: "center", padding: 3 },
  trashBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.cardLight,
    alignItems: "center",
    justifyContent: "center",
  },
  addBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.neonRed,
    alignItems: "center",
    justifyContent: "center",
  },
});
