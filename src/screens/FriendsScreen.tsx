/*VIMOX-V29*/
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors } from "../theme/colors";
import { ScreenHeader } from "../components/ScreenHeader";
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
  subscribeStreaksAtRisk,
  getStreakDisplay,
  getBestFriendEmoji,
  StreakInfo,
} from "../services/snapService";
import type { ChatFilter, ChatPreview } from "../services/chatListLogic";
import { filterChats, previewLabel, sortChats, unreadCount } from "../services/chatListLogic";
import { subscribeChatPreviews } from "../services/chatListService";
import { ChatMenuKey, ChatMenuSheet } from "../components/ChatMenuSheet";
import { FriendSheet } from "../components/FriendSheet";
import { SafetySheet } from "../components/SafetySheet";
import { blockUser, reportContent } from "../services/moderationService";
import { useChatPrefs } from "../hooks/useChatPrefs";
import { Group, isGroupUnread, subscribeGroupOpened, subscribeMyGroups } from "../services/groupService";
import { setBadge } from "../services/badgeStore";
import { inAppBus } from "../services/inAppBus";
import { scheduleStreakReminder } from "../services/notificationService";

type Props = NativeStackScreenProps<RootStackParamList, "Friends"> & {
  // true quand l'écran est une page du pager (alors pas de flèche de retour)
  embedded?: boolean;
};

const ONLINE_GREEN = "#28F7A1";

function Icon({
  name,
  size = 20,
  color = colors.text,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name as any} size={size} color={color} />;
}

function lastSeenMs(v: any): number {
  if (!v) return 0;
  if (typeof v?.toMillis === "function") return v.toMillis();
  if (typeof v === "number") return v;
  return 0;
}

function formatLastSeen(lastSeen: any): string {
  const ms = lastSeenMs(lastSeen);
  if (!ms) return "";
  const mins = Math.floor((Date.now() - ms) / 60000);
  if (mins < 2) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.floor(hours / 24)} j`;
}

function statusOf(f: Friend): { text: string; online: boolean } {
  if (f.isOnline) return { text: "En ligne", online: true };
  const seen = formatLastSeen(f.lastSeen);
  if (seen) return { text: `Vu ${seen}`, online: false };
  return {
    text: f.country ? String(f.country) : "Touche pour discuter",
    online: false,
  };
}

function Avatar({
  uri,
  name,
  size,
}: {
  uri?: string | null;
  name?: string;
  size: number;
}) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.neonRedBg,
        borderWidth: 1,
        borderColor: colors.neonRed,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: colors.neonRedText,
          fontWeight: "800",
          fontSize: size * 0.4,
        }}
      >
        {name?.[0]?.toUpperCase() ?? "?"}
      </Text>
    </View>
  );
}

function StreakBadge({
  myId,
  friendId,
  emojis,
}: {
  myId: string;
  friendId: string;
  emojis?: Partial<Record<"friend" | "bestie" | "bestie_long", string>>;
}) {
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
  const bf = getBestFriendEmoji(info.bestFriendBadge, emojis);
  if (!flame.show && !bf) return null;

  return (
    <Text style={streakStyles.txt}>
      {bf}
      {flame.show ? ` ${flame.icon}${info.streakCount}` : ""}
    </Text>
  );
}

const streakStyles = StyleSheet.create({
  txt: { fontSize: 14, fontWeight: "800", color: colors.text },
});

export function FriendsScreen({ navigation, embedded }: Props) {
  const { profile } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [previews, setPreviews] = useState<Record<string, ChatPreview>>({});
  const prefs = useChatPrefs(profile?.id);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheetFriend, setSheetFriend] = useState<Friend | null>(null);
  const [safetyFor, setSafetyFor] = useState<Friend | null>(null);
  const [filter, setFilter] = useState<ChatFilter>("all");
  // Mes groupes (le plus récent en haut)
  const [groups, setGroups] = useState<Group[]>([]);
  useEffect(() => {
    if (!profile) return;
    return subscribeMyGroups(profile.id, setGroups);
  }, [profile?.id]);
  const [groupOpened, setGroupOpened] = useState<Record<string, number>>({});
  useEffect(() => (profile ? subscribeGroupOpened(profile.id, setGroupOpened) : undefined), [profile?.id]);
  // Dernier message de chaque conversation (suivi seulement quand la liste d'amis change vraiment)
  const idsKey = friends.map((f) => f.id).sort().join(",");
  useEffect(() => {
    if (!profile) return;
    return subscribeChatPreviews(profile.id, idsKey ? idsKey.split(",") : [], setPreviews);
  }, [profile?.id, idsKey]);

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
      Alert.alert("Ami ajouté !", `${req.fromName} est maintenant ton ami.`);
    } catch {
      Alert.alert("Erreur", "Impossible d'accepter.");
    }
  }

  async function handleDecline(req: FriendRequest) {
    await declineFriendRequest(req.id);
  }

  function openChat(f: Friend) {
    navigation.navigate("FriendChat", { friendId: f.id, friendName: f.name });
  }

  // Envoyer un Snap directement à cet ami (ouvre la caméra avec l'ami déjà choisi)
  function snapTo(f: Friend) {
    Haptics.selectionAsync().catch(() => {});
    (navigation as any).navigate("CameraDirect", {
      directSendTo: { friendId: f.id, friendName: f.name },
    });
  }

  // Appui long sur un ami : la fiche (envoyer un Vim, chat, appels, épingles, réglages…)
  function openFriendMenu(f: Friend) {
    Haptics.selectionAsync().catch(() => {});
    setSheetFriend(f);
  }
  // Nouvel appel : la salle porte un nom aléatoire (impossible à deviner), comme dans la conversation
  function callFriend(f: Friend, video: boolean) {
    if (!profile) return;
    const cid = getChatId(profile.id, f.id);
    const callId = `${cid}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    navigation.navigate("VideoCall", {
      roomId: callId,
      audioOnly: !video,
      friend: { cid, friendId: f.id, friendName: f.name },
    });
  }

  function closeSearch() {
    setSearching(false);
    setSearch("");
  }

  const q = search.trim().toLowerCase();
  // Recherche par nom, puis filtre (Tous / Non lu / En ligne), puis conversations récentes d'abord
  const searched = friends.filter((f) => f.name.toLowerCase().includes(q));
  const filtered = sortChats(filterChats(searched, previews, filter), previews, prefs.pinned);
  const unread = unreadCount(previews, friends.map((f) => f.id));

  // ── ⏳ Rappel de flamme : notification programmée à 20 h si une flamme va s'éteindre ──
  const [atRisk, setAtRisk] = useState<{ otherUid: string; count: number }[]>([]);
  useEffect(() => (profile ? subscribeStreaksAtRisk(profile.id, setAtRisk) : undefined), [profile?.id]);
  const atRiskKey = atRisk.map((r) => r.otherUid + ":" + r.count).join(",") + "|" + friends.length;
  useEffect(() => {
    if (!profile || profile.notifPush === false) return;
    const named = atRisk
      .map((r) => ({ name: friends.find((f) => f.id === r.otherUid)?.name ?? "", count: r.count }))
      .filter((r) => r.name)
      .sort((a, b) => b.count - a.count);
    scheduleStreakReminder(named).catch(() => {});
  }, [atRiskKey, profile?.notifPush]);

  // ── Bannière dans l'app quand un message arrive (comme sur Snap) ──
  const mountedAt = useRef(Date.now());
  const lastSeenAt = useRef<Record<string, number>>({});
  useEffect(() => {
    for (const f of friends) {
      const pv = previews[f.id];
      if (!pv) continue;
      const prev = lastSeenAt.current[f.id] ?? 0;
      lastSeenAt.current[f.id] = Math.max(prev, pv.at);
      if (!pv.unread || pv.fromMe || pv.at <= prev || pv.at <= mountedAt.current) continue;
      const body =
        pv.kind === "snap"
          ? "📸 t'a envoyé un Vim"
          : pv.kind === "audio"
            ? "🎤 Message vocal"
            : pv.kind === "photo"
              ? "🖼️ Photo"
              : pv.kind === "call"
                ? "📞 Appel"
                : "💬 Nouveau message";
      inAppBus.show({
        key: `f:${f.id}:${pv.at}`,
        title: f.name,
        body,
        photo: f.profilePhotoURL ?? null,
        target: { name: "FriendChat", params: { friendId: f.id, friendName: f.name } },
      });
    }
  }, [previews, friends]);
  const groupSeenAt = useRef<Record<string, number>>({});
  useEffect(() => {
    if (!profile) return;
    for (const g of groups) {
      const prev = groupSeenAt.current[g.id] ?? 0;
      groupSeenAt.current[g.id] = Math.max(prev, g.lastAt);
      if (g.lastBy === profile.id || g.lastAt <= prev || g.lastAt <= mountedAt.current) continue;
      inAppBus.show({
        key: `g:${g.id}:${g.lastAt}`,
        title: `${g.emoji} ${g.name}`,
        body: g.lastText || "Nouveau message",
        emoji: g.emoji,
        target: { name: "GroupChat", params: { groupId: g.id, name: g.name } },
      });
    }
  }, [groups, profile?.id]);
  // Pastille de l'onglet « Messages » : conversations non lues + groupes non lus + demandes d'ami
  const unreadGroups = profile ? groups.filter((g) => isGroupUnread(g, profile.id, groupOpened)).length : 0;
  useEffect(() => {
    setBadge("Friends", unread + unreadGroups + requests.length);
  }, [unread, unreadGroups, requests.length]);
  const chips = !searching && friends.length > 0 && (
    <View style={s.chips}>
      {(
        [
          ["all", "Tous"],
          ["unread", "Non lu"],
          ["online", "En ligne"],
        ] as [ChatFilter, string][]
      ).map(([k, label]) => (
        <Pressable
          key={k}
          onPress={() => setFilter(k)}
          accessibilityRole="button"
          accessibilityState={{ selected: filter === k }}
          accessibilityLabel={k === "unread" && unread > 0 ? `${label}, ${unread}` : label}
          style={[s.chip, filter === k && s.chipOn]}
        >
          <Text style={[s.chipTxt, filter === k && s.chipTxtOn]}>{label}</Text>
          {k === "unread" && unread > 0 && (
            <View style={[s.chipBadge, filter === k && s.chipBadgeOn]}>
              <Text style={[s.chipBadgeTxt, filter === k && s.chipBadgeTxtOn]}>{unread}</Text>
            </View>
          )}
        </Pressable>
      ))}
    </View>
  );

  const requestsHeader =
    requests.length > 0 && !q ? (
      <View style={s.reqSection}>
        <Text style={s.sectionTitle}>Demandes d'amis · {requests.length}</Text>
        {requests.map((req) => (
          <View key={req.id} style={s.reqRow}>
            <Avatar uri={req.fromPhoto} name={req.fromName} size={44} />
            <View style={s.info}>
              <Text style={s.name} numberOfLines={1}>
                {req.fromName}
              </Text>
              <Text style={s.sub}>Veut être ton ami</Text>
            </View>
            <Pressable
              onPress={() => handleAccept(req)}
              style={({ pressed }) => [s.acceptBtn, pressed && { opacity: 0.8 }]}
            >
              <Text style={s.acceptTxt}>Accepter</Text>
            </Pressable>
            <Pressable
              onPress={() => handleDecline(req)}
              hitSlop={8}
              style={s.declineBtn}
            >
              <Icon name="close" size={18} color={colors.muted} />
            </Pressable>
          </View>
        ))}
      </View>
    ) : null;

  const groupsHeader =
    groups.length > 0 && !q && filter === "all" ? (
      <View style={s.groupSection}>
        <Text style={s.sectionTitle}>Groupes · {groups.length}</Text>
        {groups.map((g) => (
          <Pressable
            key={g.id}
            onPress={() => navigation.navigate("GroupChat" as any, { groupId: g.id, name: g.name } as any)}
            style={({ pressed }) => [s.groupRow, pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
            accessibilityLabel={`Groupe ${g.name}`}
          >
            <View style={s.groupIcon}>
              <Text style={{ fontSize: 24 }}>{g.emoji}</Text>
              {profile && isGroupUnread(g, profile.id, groupOpened) && <View style={s.avatarUnread} />}
            </View>
            <View style={s.info}>
              <Text style={s.name} numberOfLines={1}>{g.name}</Text>
              <Text
                style={[s.sub, profile && isGroupUnread(g, profile.id, groupOpened) && s.subUnread]}
                numberOfLines={1}
              >
                {g.lastText || `${g.members.length} membres`}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    ) : null;

  const searchButton = (
    <Pressable
      onPress={() => (searching ? closeSearch() : setSearching(true))}
      accessibilityRole="button"
      accessibilityLabel={searching ? "Fermer la recherche" : "Rechercher un ami"}
      style={({ pressed }) => [s.headerBtn, pressed && { opacity: 0.7 }]}
    >
      <Icon name={searching ? "close" : "search"} size={20} />
    </Pressable>
  );

  function onMenu(key: ChatMenuKey) {
    setMenuOpen(false);
    if (key === "group") {
      navigation.navigate("NewGroup" as any);
      return;
    }
    const route = { newChat: "NewChat", shortcut: "NewShortcut", manageChats: "ManageChats", manageFriends: "ManageFriends", emojis: "BestFriendEmojis" }[key];
    navigation.navigate(route as any);
  }
  const moreButton = (
    <Pressable
      onPress={() => setMenuOpen(true)}
      accessibilityRole="button"
      accessibilityLabel="Plus d'options"
      style={({ pressed }) => [s.headerBtn, pressed && { opacity: 0.7 }]}
    >
      <Icon name="ellipsis-horizontal" size={20} />
    </Pressable>
  );
  const addButton = (
    <Pressable
      onPress={() => navigation.navigate("AddFriends")}
      accessibilityRole="button"
      accessibilityLabel="Ajouter des amis"
      style={({ pressed }) => [s.headerBtn, pressed && { opacity: 0.7 }]}
    >
      <Icon name="person-add-outline" size={20} />
    </Pressable>
  );
  return (
    <View style={s.root}>
      {embedded ? (
        <View style={s.header}>
          <Avatar uri={profile?.profilePhotoURL} name={profile?.name} size={36} />
          <Text style={s.title}>Chat</Text>
          {addButton}
          {searchButton}
          {moreButton}
        </View>
      ) : (
        <ScreenHeader
          title="Mes amis"
          onBack={() => navigation.goBack()}
          right={
            <View style={{ flexDirection: "row", gap: 8 }}>
              {addButton}
              {searchButton}
              {moreButton}
            </View>
          }
        />
      )}

      {searching && (
        <View style={s.searchWrap}>
          <Icon name="search" size={18} color={colors.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher"
            placeholderTextColor={colors.muted}
            style={s.searchInput}
            autoFocus
            autoCorrect={false}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")} hitSlop={8}>
              <Icon name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          )}
        </View>
      )}

      {chips}
      <FlatList
        style={{ flex: 1 }}
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListHeaderComponent={
          <>
            {requestsHeader}
            {groupsHeader}
          </>
        }
        ItemSeparatorComponent={() => <View style={s.sep} />}
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
            <Icon
              name={q ? "search" : filter === "unread" ? "checkmark-done" : filter === "online" ? "moon-outline" : "chatbubbles-outline"}
              size={46}
              color={colors.mutedDark}
            />
            <Text style={s.emptyText}>
              {q
                ? `Aucun ami « ${search.trim()} »`
                : filter === "unread" && friends.length > 0
                  ? "Tout est lu"
                  : filter === "online" && friends.length > 0
                    ? "Aucun ami en ligne"
                    : "Pas encore d'amis"}
            </Text>
            {!q && friends.length === 0 && (
              <Text style={s.emptySub}>Fais des matchs ou cherche un prénom pour en ajouter !</Text>
            )}
            {!q && friends.length === 0 && (
              <Pressable
                onPress={() => navigation.navigate("AddFriends")}
                accessibilityRole="button"
                style={({ pressed }) => [s.emptyAddBtn, pressed && { opacity: 0.8 }]}
              >
                <Icon name="person-add" size={16} color="#fff" />
                <Text style={s.emptyAddTxt}>Ajouter des amis</Text>
              </Pressable>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const st = statusOf(item);
          const pv = previewLabel(previews[item.id]);
          return (
            <Pressable
              style={({ pressed }) => [s.row, pressed && s.rowPressed]}
              onPress={() => openChat(item)}
              onLongPress={() => openFriendMenu(item)}
              delayLongPress={350}
            >
              <View style={s.avatarWrap}>
                <Avatar uri={item.profilePhotoURL} name={item.name} size={52} />
                {item.isOnline && <View style={s.onlineDot} />}
                {pv?.unread && <View style={s.avatarUnread} accessibilityLabel="Non lu" />}
              </View>
              <View style={s.info}>
                <View style={s.nameRow}>
                  <Text style={[s.name, { flexShrink: 1 }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {prefs.best.includes(item.id) && <Text accessibilityLabel="Meilleur·e ami·e">❤️</Text>}
                  {prefs.pinned.includes(item.id) && (
                    <Icon name="pin" size={12} color={colors.gold} />
                  )}
                </View>
                <View style={s.statusRow}>
                  {pv ? (
                    <>
                      {pv.unread && (
                        <Icon
                          name={pv.snap ? "square" : "chatbubble"}
                          size={11}
                          color={pv.snap ? colors.neonRedText : colors.gold}
                        />
                      )}
                      <Text
                        style={[
                          s.sub,
                          pv.unread && s.subUnread,
                          pv.unread && pv.snap && { color: colors.neonRedText },
                        ]}
                        numberOfLines={1}
                      >
                        {pv.text}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Icon
                        name={st.online ? "ellipse" : "time-outline"}
                        size={st.online ? 8 : 12}
                        color={st.online ? ONLINE_GREEN : colors.muted}
                      />
                      <Text
                        style={[s.sub, st.online && { color: ONLINE_GREEN }]}
                        numberOfLines={1}
                      >
                        {st.text}
                      </Text>
                    </>
                  )}
                </View>
              </View>

              {profile && <StreakBadge myId={profile.id} friendId={item.id} emojis={prefs.emojis} />}
              <Pressable
                onPress={() => snapTo(item)}
                hitSlop={8}
                style={({ pressed }) => [s.camBtn, pressed && { opacity: 0.6 }]}
              >
                <Icon name="camera-outline" size={22} />
              </Pressable>
            </Pressable>
          );
        }}
      />
      <ChatMenuSheet visible={menuOpen} onClose={() => setMenuOpen(false)} onSelect={onMenu} />
      {profile && (
        <FriendSheet
          visible={!!sheetFriend}
          friend={sheetFriend}
          me={profile.id}
          prefs={prefs}
          streak={sheetFriend ? <StreakBadge myId={profile.id} friendId={sheetFriend.id} emojis={prefs.emojis} /> : null}
          onClose={() => setSheetFriend(null)}
          onOpenChat={() => {
            const f = sheetFriend;
            setSheetFriend(null);
            if (f) openChat(f);
          }}
          onSendVim={() => {
            const f = sheetFriend;
            setSheetFriend(null);
            if (f) snapTo(f);
          }}
          onCall={(video) => {
            const f = sheetFriend;
            setSheetFriend(null);
            if (f) callFriend(f, video);
          }}
          onProfile={() => {
            const f = sheetFriend;
            setSheetFriend(null);
            if (f) navigation.navigate("UserProfile", { userId: f.id });
          }}
          onSafety={() => {
            const f = sheetFriend;
            setSheetFriend(null);
            if (f) setTimeout(() => setSafetyFor(f), 300); // laisse la fiche se fermer avant d'ouvrir l'autre
          }}
        />
      )}
      {profile && safetyFor ? (
        <SafetySheet
          visible
          title={safetyFor.name}
          onClose={() => setSafetyFor(null)}
          onReport={(reason) => reportContent({ reporterId: profile.id, reportedId: safetyFor.id, kind: "profile", reason })}
          onBlock={async () => {
            await blockUser(profile.id, safetyFor.id);
            await removeFriend(profile.id, safetyFor.id).catch(() => {});
            setSafetyFor(null);
          }}
        />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  groupSection: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  groupRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  groupIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  chips: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.neonRed, borderColor: colors.neonRed },
  chipTxt: { color: colors.text, fontSize: 13, fontWeight: "700" },
  chipTxtOn: { color: "#fff" },
  chipBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: colors.neonRed,
    alignItems: "center",
    justifyContent: "center",
  },
  chipBadgeOn: { backgroundColor: "#fff" },
  chipBadgeTxt: { color: "#fff", fontSize: 11, fontWeight: "800" },
  chipBadgeTxtOn: { color: colors.neonRed },
  subUnread: { color: colors.text, fontWeight: "800" },
  avatarUnread: {
    position: "absolute",
    top: -1,
    right: -1,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: colors.neonRed,
    borderWidth: 2.5,
    borderColor: colors.black,
  },
  emptyAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 18,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neonRed,
  },
  emptyAddTxt: { color: "#fff", fontSize: 14, fontWeight: "800" },
  root: { flex: 1, backgroundColor: colors.black },
  header: {
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  title: {
    flex: 1,
    textAlign: "center",
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    height: 40,
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 0 },
  sectionTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  reqSection: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    marginBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  reqRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  acceptBtn: {
    backgroundColor: colors.neonRed,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  acceptTxt: { color: "#fff", fontWeight: "800", fontSize: 13 },
  declineBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { alignItems: "center", paddingTop: 70, gap: 10 },
  emptyText: { color: colors.text, fontSize: 16, fontWeight: "700" },
  emptySub: { color: colors.muted, fontSize: 13, textAlign: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  rowPressed: { backgroundColor: colors.card },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 80,
  },
  avatarWrap: { position: "relative" },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: ONLINE_GREEN,
    borderWidth: 2.5,
    borderColor: colors.black,
  },
  info: { flex: 1, gap: 3 },
  name: { color: colors.text, fontWeight: "800", fontSize: 16 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  sub: { color: colors.muted, fontSize: 13, flexShrink: 1 },
  camBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
});
