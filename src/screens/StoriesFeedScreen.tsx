import { useCallback, useEffect, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { colors } from "../theme/colors";
import { useAuth } from "../services/AuthContext";
import { getFriendsStories, UserStories } from "../services/storyService";
import { subscribeFriends } from "../services/friendService";
import { RootStackParamList } from "../models/types";

type Props = NativeStackScreenProps<RootStackParamList, "StoriesFeed">;

export function StoriesFeedScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [stories, setStories] = useState<UserStories[]>([]);

  useEffect(() => {
    if (!profile) return;
    const unsub = subscribeFriends(profile.id, (friends) =>
      setFriendIds(friends.map((f) => f.id)),
    );
    return unsub;
  }, [profile]);

  const loadStories = useCallback(() => {
    if (!profile) return;
    getFriendsStories(profile.id, friendIds)
      .then(setStories)
      .catch(() => {});
  }, [profile, friendIds]);

  useFocusEffect(
    useCallback(() => {
      loadStories();
    }, [loadStories]),
  );

  const myStories = stories.find((u) => u.userId === profile?.id);
  const friendsStories = stories.filter((u) => u.userId !== profile?.id);

  return (
    <View style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>Notifications</Text>
        <Text style={s.sub}>Stories et activité récente</Text>
      </View>

      <ScrollView style={{ flex: 1 }}>
        <Text style={s.sectionLabel}>STORIES</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 16 }}
        >
          <Pressable
            style={s.storyItem}
            onPress={() => navigation.navigate("CreateStory")}
          >
            <View
              style={[
                s.ring,
                {
                  borderColor: myStories?.hasUnviewed
                    ? colors.neonRed
                    : "#3a3a3a",
                },
              ]}
            >
              {profile?.profilePhotoURL ? (
                <Image
                  source={{ uri: profile.profilePhotoURL }}
                  style={s.avatar}
                />
              ) : (
                <View style={s.avatarPlaceholder}>
                  <Text style={s.avatarInitial}>
                    {profile?.name?.[0]?.toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={s.plusBadge}>
                <Text style={s.plusTxt}>+</Text>
              </View>
            </View>
            <Text style={s.storyName} numberOfLines={1}>
              Ta story
            </Text>
          </Pressable>

          {friendsStories.map((user) => {
            const globalIndex = stories.findIndex(
              (u) => u.userId === user.userId,
            );
            return (
              <Pressable
                key={user.userId}
                style={s.storyItem}
                onPress={() =>
                  navigation.navigate("StoryViewer", {
                    stories,
                    initialUserIndex: globalIndex,
                  })
                }
              >
                <View
                  style={[
                    s.ring,
                    {
                      borderColor: user.hasUnviewed
                        ? colors.neonRed
                        : "#3a3a3a",
                    },
                  ]}
                >
                  {user.userPhoto ? (
                    <Image source={{ uri: user.userPhoto }} style={s.avatar} />
                  ) : (
                    <View style={s.avatarPlaceholder}>
                      <Text style={s.avatarInitial}>
                        {user.userName?.[0]?.toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={s.storyName} numberOfLines={1}>
                  {user.userName}
                </Text>
              </Pressable>
            );
          })}

          {friendsStories.length === 0 && (
            <View style={s.emptyInline}>
              <Text style={s.emptyText}>Aucune story d'ami pour le moment</Text>
            </View>
          )}
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black, paddingTop: 54 },
  header: { paddingHorizontal: 20, marginBottom: 20 },
  title: { color: colors.text, fontSize: 28, fontWeight: "900" },
  sub: { color: colors.muted, fontSize: 13, marginTop: 2 },
  sectionLabel: {
    color: colors.neonRed,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 12,
    marginLeft: 20,
  },
  storyItem: { alignItems: "center", width: 72 },
  ring: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: { width: 60, height: 60, borderRadius: 30 },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(232,0,10,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { color: colors.neonRed, fontWeight: "900", fontSize: 20 },
  storyName: { color: colors.muted, fontSize: 12, marginTop: 6 },
  emptyInline: { justifyContent: "center", paddingLeft: 8 },
  emptyText: { color: colors.muted, fontSize: 13 },
  plusBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.neonRed,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.black,
  },
  plusTxt: { color: "#fff", fontWeight: "900", fontSize: 13, lineHeight: 14 },
});
