import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors } from "../theme/colors";
import { useAuth } from "../services/AuthContext";
import { Friend, FriendRequest, RootStackParamList } from "../models/types";
import {
  subscribeFriends,
  subscribeFriendRequests,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
} from "../services/friendService";
import {
  getChatId,
  subscribeStreakInfo,
  getStreakDisplay,
  getBestFriendEmoji,
  StreakInfo,
} from "../services/snapService";

type Props = NativeStackScreenProps<RootStackParamList, "Friends">;

function formatLastSeen(lastSeen: any): string {
  if (!lastSeen) return "";
  const ms = lastSeen?.toMillis ? lastSeen.toMillis() : lastSeen;
  if (!ms) return "";
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "à l'instant";
  if (mins < 60) return `il y a ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  return `il y a ${Math.floor(hours / 24)}j`;
}

function OnlineDot({ isOnline }: { isOnline?: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!isOnline) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.4,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [isOnline]);
  if (!isOnline) return <View style={dot.offline} />;
  return (
    <View style={dot.wrap}>
      <Animated.View style={[dot.pulse, { transform: [{ scale: pulse }] }]} />
      <View style={dot.online} />
    </View>
  );
}

const dot = StyleSheet.create({
  wrap: {
    width: 12,
    height: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  pulse: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(40,247,161,0.4)",
    position: "absolute",
  },
  online: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#28F7A1",
    position: "absolute",
  },
  offline: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#444" },
});

function StreakBadge({ myId, friendId }: { myId: string; friendId: string }) {
  const [info, setInfo] = useState<StreakInfo>({
    streakCount: 0,
    totalSnaps: 0,
    isAboutToExpire: false,
    bestFriendBadge: "none",
    canRestore: false,
  });
  useEffect(() => {
    return subscribeStreakInfo(getChatId(myId, friendId), setInfo);
  }, [myId, friendId]);

  const flame = getStreakDisplay(info.streakCount, info.isAboutToExpire);
  const bf = getBestFriendEmoji(info.bestFriendBadge);
  if (!flame.show && !bf) return null;

  return (
    <Text style={streakStyles.txt}>
      {bf}
      {flame.show ? ` ${flame.icon}${info.streakCount}` : ""}
    </Text>
  );
}

const streakStyles = StyleSheet.create({
  txt: { fontSize: 12, fontWeight: "800" },
});

export function FriendsScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [tab, setTab] = useState<"friends" | "requests">("friends");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const u1 = subscribeFriends(profile.id, setFriends);
    const u2 = subscribeFriendRequests(profile.id, setRequests);
    return () => {
      u1();
      u2();
    };
  }, [profile]);

  async function handleAccept(req: FriendRequest) {
    try {
      await acceptFriendRequest(req.id, req.fromUid, profile!.id);
      Alert.alert("✅ Ami ajouté !", `${req.fromName} est maintenant ton ami.`);
    } catch {
      Alert.alert("Erreur", "Impossible d'accepter.");
    }
  }

  async function handleDecline(req: FriendRequest) {
    await declineFriendRequest(req.id);
  }

  async function handleRemove(friend: Friend) {
    Alert.alert("Supprimer", "Retirer cet ami ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: () => removeFriend(profile!.id, friend.id),
      },
    ]);
  }

  const filtered = [...friends]
    .filter((f) => f.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;
      return a.name.localeCompare(b.name);
    });

  const onlineCount = friends.filter((f) => f.isOnline).length;

  return (
    <View style={s.root}>
      <View style={s.header}>
        <View style={s.headerCenter}>
          <Text style={s.title}>Amis</Text>
          {onlineCount > 0 && (
            <Text style={s.onlineCount}>{onlineCount} en ligne</Text>
          )}
        </View>
        {requests.length > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>{requests.length}</Text>
          </View>
        )}
      </View>

      <View style={s.tabs}>
        <Pressable
          onPress={() => setTab("friends")}
          style={[s.tab, tab === "friends" && s.tabActive]}
        >
          <Text style={[s.tabText, tab === "friends" && s.tabTextActive]}>
            👥 Amis ({friends.length})
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setTab("requests")}
          style={[s.tab, tab === "requests" && s.tabActive]}
        >
          <Text style={[s.tabText, tab === "requests" && s.tabTextActive]}>
            📬 Demandes{requests.length > 0 ? ` (${requests.length})` : ""}
          </Text>
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>
        {tab === "friends" ? (
          <>
            {friends.length > 0 && (
              <View style={s.searchWrap}>
                <Text style={s.searchIcon}>🔍</Text>
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Rechercher..."
                  placeholderTextColor={colors.muted}
                  style={s.searchInput}
                />
                {search.length > 0 && (
                  <Pressable onPress={() => setSearch("")}>
                    <Text style={s.searchClear}>✕</Text>
                  </Pressable>
                )}
              </View>
            )}
            <FlatList
              style={{ flex: 1 }}
              data={filtered}
              keyExtractor={(i) => i.id}
              contentContainerStyle={s.list}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => {
                    setRefreshing(true);
                    setTimeout(() => setRefreshing(false), 800);
                  }}
                  tintColor={colors.neonRed}
                />
              }
              ListEmptyComponent={
                <View style={s.empty}>
                  <Text style={s.emptyIcon}>{search ? "🔍" : "👥"}</Text>
                  <Text style={s.emptyText}>
                    {search ? `Aucun ami "${search}"` : "Pas encore d'amis"}
                  </Text>
                  {!search && (
                    <Text style={s.emptySub}>
                      Fais des matchs pour en ajouter !
                    </Text>
                  )}
                </View>
              }
              renderItem={({ item }) => (
                <Pressable
                  style={s.row}
                  onPress={() =>
                    navigation.navigate("FriendChat", {
                      friendId: item.id,
                      friendName: item.name,
                    })
                  }
                  onLongPress={() => handleRemove(item)}
                >
                  <View style={s.avatarWrap}>
                    {item.profilePhotoURL ? (
                      <Image
                        source={{ uri: item.profilePhotoURL }}
                        style={s.avatarImg}
                      />
                    ) : (
                      <View style={s.avatar}>
                        <Text style={s.avatarTxt}>
                          {item.name?.[0]?.toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={s.dotPos}>
                      <OnlineDot isOnline={item.isOnline} />
                    </View>
                  </View>
                  <View style={s.info}>
                    <Text style={s.name}>{item.name}</Text>
                    <Text style={s.sub}>
                      {item.isOnline
                        ? "🟢 En ligne"
                        : item.lastSeen
                          ? `🕐 ${formatLastSeen(item.lastSeen)}`
                          : `🌍 ${item.country}`}
                    </Text>
                  </View>
                  {profile && (
                    <StreakBadge myId={profile.id} friendId={item.id} />
                  )}
                  <Pressable
                    onPress={() =>
                      navigation.navigate("FriendChat", {
                        friendId: item.id,
                        friendName: item.name,
                      })
                    }
                    style={s.chatBtn}
                  >
                    <Text style={s.chatBtnTxt}>💬</Text>
                  </Pressable>
                </Pressable>
              )}
            />
          </>
        ) : (
          <FlatList
            style={{ flex: 1 }}
            data={requests}
            keyExtractor={(i) => i.id}
            contentContainerStyle={s.list}
            ListEmptyComponent={
              <View style={s.empty}>
                <Text style={s.emptyIcon}>📬</Text>
                <Text style={s.emptyText}>Aucune demande en attente</Text>
              </View>
            }
            renderItem={({ item }) => (
              <View style={s.row}>
                <View style={s.avatarWrap}>
                  {item.fromPhoto ? (
                    <Image
                      source={{ uri: item.fromPhoto }}
                      style={s.avatarImg}
                    />
                  ) : (
                    <View style={s.avatar}>
                      <Text style={s.avatarTxt}>
                        {item.fromName?.[0]?.toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={s.info}>
                  <Text style={s.name}>{item.fromName}</Text>
                  <Text style={s.sub}>Veut être ton ami</Text>
                </View>
                <Pressable
                  onPress={() => handleAccept(item)}
                  style={s.acceptBtn}
                >
                  <Text style={s.acceptTxt}>✓</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleDecline(item)}
                  style={s.declineBtn}
                >
                  <Text style={s.declineTxt}>✕</Text>
                </Pressable>
              </View>
            )}
          />
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  header: {
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerCenter: { flex: 1 },
  title: { color: colors.text, fontSize: 20, fontWeight: "900" },
  onlineCount: { color: "#28F7A1", fontSize: 11, fontWeight: "600" },
  badge: {
    backgroundColor: colors.neonRed,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
  },
  badgeText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {
    borderColor: colors.neonRed,
    backgroundColor: "rgba(232,0,10,0.1)",
  },
  tabText: { color: colors.muted, fontWeight: "700", fontSize: 12 },
  tabTextActive: { color: colors.neonRed },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: { fontSize: 16, color: colors.muted },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    paddingVertical: 11,
  },
  searchClear: { color: colors.muted, fontSize: 16, paddingHorizontal: 4 },
  list: { padding: 16, gap: 10 },
  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyIcon: { fontSize: 48 },
  emptyText: { color: colors.text, fontSize: 16, fontWeight: "700" },
  emptySub: { color: colors.muted, fontSize: 13, textAlign: "center" },
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
  avatarWrap: { position: "relative" },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(232,0,10,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.neonRed,
  },
  avatarImg: { width: 50, height: 50, borderRadius: 25 },
  avatarTxt: { color: colors.neonRed, fontWeight: "900", fontSize: 20 },
  dotPos: {
    position: "absolute",
    bottom: -1,
    right: -1,
    borderRadius: 7,
    backgroundColor: colors.card,
    padding: 1,
  },
  info: { flex: 1, gap: 3 },
  name: { color: colors.text, fontWeight: "800", fontSize: 15 },
  sub: { color: colors.muted, fontSize: 12 },
  chatBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(232,0,10,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.neonRed,
  },
  chatBtnTxt: { fontSize: 18 },
  acceptBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(40,247,161,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#28F7A1",
  },
  acceptTxt: { color: "#28F7A1", fontWeight: "900", fontSize: 18 },
  declineBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(232,0,10,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.neonRed,
  },
  declineTxt: { color: colors.neonRed, fontWeight: "900", fontSize: 18 },
});
