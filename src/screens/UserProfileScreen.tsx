/*VIMOX-V17*/
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { colors } from "../theme/colors";
import { RootStackParamList, VimoXUser } from "../models/types";
import { useAuth } from "../services/AuthContext";
import { db } from "../config/firebase";
import { sendFriendRequest } from "../services/friendService";
import { isReallyOnline } from "../services/presence";
import { blockUser, reportContent } from "../services/moderationService";
import { SafetySheet } from "../components/SafetySheet";
import { ScreenHeader } from "../components/ScreenHeader";
import { FriendshipSheet } from "../components/FriendshipSheet";

type Props = NativeStackScreenProps<RootStackParamList, "UserProfile">;
type Relation = "none" | "friends" | "pending" | "self" | "blocked";

// Profil d'une autre personne, ouvert depuis un lien de partage (vimox://profile/...)
export function UserProfileScreen({ route, navigation }: Props) {
  const { userId } = route.params;
  const { profile } = useAuth();
  // undefined = chargement, null = profil introuvable
  const [user, setUser] = useState<VimoXUser | null | undefined>(undefined);
  const [isFriend, setIsFriend] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const [friendshipOpen, setFriendshipOpen] = useState(false);

  useEffect(() => {
    return onSnapshot(
      doc(db, "users", userId),
      (snap) =>
        setUser(snap.exists() ? ({ id: snap.id, ...snap.data() } as VimoXUser) : null),
      () => setUser(null),
    );
  }, [userId]);

  useEffect(() => {
    if (!profile?.id || profile.id === userId) return;
    const u1 = onSnapshot(
      query(
        collection(db, "friends"),
        where("userId", "==", profile.id),
        where("id", "==", userId),
      ),
      (snap) => setIsFriend(!snap.empty),
      () => {},
    );
    const u2 = onSnapshot(
      query(
        collection(db, "friendRequests"),
        where("fromUid", "==", profile.id),
        where("toUid", "==", userId),
        where("status", "==", "pending"),
      ),
      (snap) => setIsPending(!snap.empty),
      () => {},
    );
    return () => {
      u1();
      u2();
    };
  }, [profile?.id, userId]);

  const relation: Relation =
    profile?.id === userId
      ? "self"
      : profile?.blockedUserIds?.includes(userId)
        ? "blocked"
        : isFriend
          ? "friends"
          : isPending
            ? "pending"
            : "none";

  async function reportProfile(reason: string) {
    if (!profile) return;
    await reportContent({ reporterId: profile.id, reportedId: userId, kind: "profile", reason });
  }
  async function blockProfile() {
    if (!profile) return;
    await blockUser(profile.id, userId);
    navigation.goBack();
  }

  async function addFriend() {
    if (!profile || busy) return;
    setBusy(true);
    try {
      await sendFriendRequest(profile.id, profile.name, profile.profilePhotoURL, userId);
    } catch {
      Alert.alert(
        "Demande impossible",
        "Tu ne peux pas ajouter cette personne : les moins de 18 ans et les adultes ne peuvent pas être amis. Sinon, vérifie ta connexion et réessaie.",
      );
    } finally {
      setBusy(false);
    }
  }

  const initials = user?.name?.[0]?.toUpperCase() ?? "?";
  const online = isReallyOnline(user as any);

  return (
    <SafeAreaView style={s.root}>
      <ScreenHeader
        safeArea={false}
        title="Profil"
        onBack={() => navigation.goBack()}
        right={
          user && relation !== "self" && relation !== "blocked" ? (
            <Pressable
              onPress={() => setSafetyOpen(true)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Plus d'options : signaler ou bloquer"
            >
              <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
            </Pressable>
          ) : undefined
        }
      />
      {user ? (
        <SafetySheet
          visible={safetyOpen}
          title={user.name}
          onClose={() => setSafetyOpen(false)}
          onReport={reportProfile}
          onBlock={blockProfile}
        />
      ) : null}

      {user === undefined ? (
        <ActivityIndicator color={colors.muted} style={{ marginTop: 80 }} />
      ) : user === null || relation === "blocked" ? (
        <View style={s.center}>
          <Ionicons name="person-remove-outline" size={48} color={colors.mutedDark} />
          <Text style={s.title}>Profil introuvable</Text>
          <Text style={s.sub}>Ce lien n'est plus valide ou ce profil n'est pas disponible.</Text>
        </View>
      ) : (
        <View style={s.center}>
          <View>
            {user.profilePhotoURL ? (
              <Image source={{ uri: user.profilePhotoURL }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, s.avatarPh]}>
                <Text style={s.initial}>{initials}</Text>
              </View>
            )}
            {online && <View style={s.dot} />}
          </View>
          <Text style={s.name}>{user.name}</Text>
          {!!user.username && <Text style={s.handle}>@{user.username}</Text>}
          {user.isPremium && <Text style={s.premium}>✦ Vim+</Text>}
          {/* L'âge n'est visible qu'en match */}
          {!!user.country && <Text style={s.sub}>{user.country}</Text>}
          {!!user.bio && <Text style={s.bio}>« {user.bio} »</Text>}

          {relation === "self" ? (
            <Text style={s.state}>C'est ton profil</Text>
          ) : relation === "friends" ? (
            <>
              <Text style={s.state}>Vous êtes amis</Text>
              <Pressable
                onPress={() =>
                  navigation.navigate("FriendChat", { friendId: user.id, friendName: user.name })
                }
                style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]}
              >
                <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
                <Text style={s.btnTxt}>Envoyer un message</Text>
              </Pressable>
              <View style={s.row2}>
                <Pressable
                  onPress={() =>
                    navigation.navigate("CameraDirect" as any, { directSendTo: { friendId: user.id, friendName: user.name } } as any)
                  }
                  style={({ pressed }) => [s.btn2, pressed && { opacity: 0.85 }]}
                  accessibilityRole="button"
                >
                  <Ionicons name="camera-outline" size={18} color={colors.text} />
                  <Text style={s.btn2Txt}>Envoyer un Vim</Text>
                </Pressable>
                <Pressable
                  onPress={() => setFriendshipOpen(true)}
                  style={({ pressed }) => [s.btn2, pressed && { opacity: 0.85 }]}
                  accessibilityRole="button"
                >
                  <Ionicons name="heart-outline" size={18} color={colors.text} />
                  <Text style={s.btn2Txt}>Notre amitié</Text>
                </Pressable>
              </View>
              {profile && (
                <FriendshipSheet
                  visible={friendshipOpen}
                  onClose={() => setFriendshipOpen(false)}
                  me={profile.id}
                  friend={{ id: user.id, name: user.name, photo: user.profilePhotoURL ?? null }}
                  onProfile={() => setFriendshipOpen(false)}
                  onSendVim={() => {
                    setFriendshipOpen(false);
                    navigation.navigate("CameraDirect" as any, { directSendTo: { friendId: user.id, friendName: user.name } } as any);
                  }}
                />
              )}
            </>
          ) : relation === "pending" ? (
            <Text style={s.state}>Demande envoyée</Text>
          ) : (
            <Pressable
              onPress={addFriend}
              disabled={busy}
              style={({ pressed }) => [s.btn, (pressed || busy) && { opacity: 0.8 }]}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="person-add" size={18} color="#fff" />
                  <Text style={s.btnTxt}>Ajouter en ami</Text>
                </>
              )}
            </Pressable>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  row2: { flexDirection: "row", gap: 10, alignSelf: "stretch", paddingHorizontal: 24 },
  btn2: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btn2Txt: { color: colors.text, fontSize: 14, fontWeight: "800" },
  root: { flex: 1, backgroundColor: colors.black },
  header: { paddingTop: 20, paddingHorizontal: 16 },
  back: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  center: { flex: 1, alignItems: "center", paddingTop: 40, paddingHorizontal: 32, gap: 10 },
  avatar: { width: 120, height: 120, borderRadius: 60 },
  avatarPh: {
    backgroundColor: colors.neonRedBg,
    borderWidth: 3,
    borderColor: colors.neonRed,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { color: colors.neonRedText, fontSize: 48, fontWeight: "900" },
  dot: {
    position: "absolute",
    bottom: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#28F7A1",
    borderWidth: 3,
    borderColor: colors.black,
  },
  name: { color: colors.text, fontSize: 24, fontWeight: "900", marginTop: 8 },
  handle: { color: colors.gold, fontSize: 14, fontWeight: "700", marginTop: 2 },
  premium: { color: colors.gold, fontSize: 13, fontWeight: "800" },
  sub: { color: colors.muted, fontSize: 15, textAlign: "center" },
  bio: { color: colors.text, fontSize: 15, fontStyle: "italic", textAlign: "center", marginTop: 6, lineHeight: 22 },
  title: { color: colors.text, fontSize: 18, fontWeight: "800", marginTop: 6 },
  state: { color: colors.muted, fontSize: 15, fontWeight: "700", marginTop: 18 },
  btn: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neonRed,
    borderRadius: 16,
    paddingHorizontal: 28,
    paddingVertical: 14,
    marginTop: 18,
    minWidth: 220,
  },
  btnTxt: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
