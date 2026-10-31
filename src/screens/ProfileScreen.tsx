/*VIMOX-V26*/
﻿/*VIMOX-V17*/
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
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../theme/colors";
import { RootStackParamList } from "../models/types";
import { useAuth } from "../services/AuthContext";
import { db } from "../config/firebase";
import { ScreenHeader } from "../components/ScreenHeader";
import { ListGroup, ListRow, SectionTitle } from "../components/ui";
import { subscribeFriendsStories, UserStories } from "../services/storyService";
import { pagerBus } from "../navigation/pagerBus";
import { subscribeMyScore } from "../services/snapService";
import { canUseMatch } from "../services/ageGate";

type Props = NativeStackScreenProps<RootStackParamList, "Profile"> & {
  // true quand l'écran est une page du pager (alors pas de flèche de retour)
  embedded?: boolean;
};

function Chip({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={s.chip}>
      <Ionicons name={icon as any} size={13} color={colors.gold} />
      <Text style={s.chipTxt}>{text}</Text>
    </View>
  );
}

function ago(ms: number): string {
  const mins = Math.max(0, Math.floor((Date.now() - ms) / 60000));
  if (mins < 2) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  return `il y a ${Math.floor(mins / 60)} h`;
}

export function ProfileScreen({ navigation, embedded }: Props) {
  const { profile, logout } = useAuth();
  const [friendCount, setFriendCount] = useState(0);
  const [myStories, setMyStories] = useState<UserStories | null>(null);
  // ⚡ Score VimoX (comme le Snap Score)
  const [score, setScore] = useState({ score: 0, bestStreak: 0 });
  useEffect(() => (profile?.id ? subscribeMyScore(profile.id, setScore) : undefined), [profile?.id]);

  // Nombre d'amis en direct (un ami n'est compté qu'une fois, même avec d'anciens doublons)
  useEffect(() => {
    if (!profile?.id) return;
    return onSnapshot(
      query(collection(db, "friends"), where("userId", "==", profile.id)),
      (snap) => setFriendCount(new Set(snap.docs.map((d) => d.data().id)).size),
      () => {},
    );
  }, [profile?.id]);

  // Ma story en direct (comme sur Snap, elle est en haut du profil)
  useEffect(() => {
    if (!profile?.id) return;
    return subscribeFriendsStories(profile.id, [], (list) =>
      setMyStories(list.find((u) => u.userId === profile.id) ?? null),
    );
  }, [profile?.id]);

  function handleLogout() {
    Alert.alert("Déconnexion", "Tu vas être déconnecté.", [
      { text: "Annuler", style: "cancel" },
      { text: "Se déconnecter", style: "destructive", onPress: () => logout() },
    ]);
  }

  // Dans le pager, on glisse vers la page voulue au lieu d'ouvrir un écran en double
  function openFriends() {
    if (embedded) pagerBus.go("Friends");
    else navigation.navigate("Friends");
  }
  function openCamera() {
    if (!embedded) navigation.goBack();
    pagerBus.go("Camera");
  }
  function openMyStory() {
    if (myStories && myStories.stories.length > 0) {
      navigation.navigate("StoryViewer", { stories: [myStories], initialUserIndex: 0 });
    } else {
      openCamera();
    }
  }

  if (!profile) return null;

  const initials =
    profile.name
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ?? "?";

  const storyCount = myStories?.stories.length ?? 0;
  const lastStory = storyCount
    ? myStories!.stories.reduce((a, b) => (b.createdAt > a.createdAt ? b : a))
    : null;
  const views = lastStory
    ? lastStory.viewedBy.filter((id) => id !== profile.id).length
    : 0;

  return (
    <View style={s.root}>
      <ScreenHeader
        title="Mon profil"
        onBack={embedded ? undefined : () => navigation.goBack()}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={s.hero}>
          {/* Halo de couleur derrière la photo (rouge, ou or si une story est en ligne) */}
          <LinearGradient
            pointerEvents="none"
            colors={storyCount > 0 ? ["rgba(255,194,75,0.28)", "rgba(9,9,12,0)"] : ["rgba(255,46,77,0.26)", "rgba(9,9,12,0)"]}
            style={s.heroGlow}
          />
          <Pressable
            onPress={() => navigation.navigate("EditProfile")}
            accessibilityRole="button"
            accessibilityLabel="Modifier la photo de profil"
            style={s.avatarWrap}
          >
            <View style={[s.avatarRing, storyCount > 0 && { borderColor: colors.gold }]}>
              {profile.profilePhotoURL ? (
                <Image source={{ uri: profile.profilePhotoURL }} style={s.avatar} />
              ) : (
                <View style={s.avatarPh}>
                  <Text style={s.initials}>{initials}</Text>
                </View>
              )}
            </View>
            <View style={s.editBadge}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </Pressable>
          <Text style={s.name} numberOfLines={1}>
            {profile.name}
          </Text>
          {profile.username ? (
            <Text style={s.handle} accessibilityLabel={`Ton pseudo : ${profile.username}`}>
              @{profile.username}
            </Text>
          ) : (
            <Pressable
              onPress={() => navigation.navigate("EditProfile")}
              accessibilityRole="button"
              accessibilityLabel="Choisir un pseudo"
              hitSlop={8}
            >
              <Text style={s.handleHint}>+ Choisir un pseudo</Text>
            </Pressable>
          )}
          {profile.isPremium && (
            <View style={s.premium}>
              <Ionicons name="star" size={12} color={colors.gold} />
              <Text style={s.premiumTxt}>Vim+</Text>
            </View>
          )}
          <View style={s.chips}>
            {typeof profile.age === "number" && <Chip icon="lock-closed-outline" text={`${profile.age} ans${canUseMatch(profile) ? " · visible en match" : ""}`} />}
            <Chip icon="location-outline" text={String(profile.country)} />
          </View>
          {!!profile.bio && <Text style={s.bio}>« {profile.bio} »</Text>}
        </View>

        <View style={s.stats}>
          <Pressable
            style={s.stat}
            onPress={openFriends}
            accessibilityRole="button"
            accessibilityLabel="Voir mes amis"
          >
            <Text style={s.statVal}>{friendCount}</Text>
            <Text style={s.statLabel}>{friendCount > 1 ? "Amis" : "Ami"}</Text>
          </Pressable>
          <View style={s.statDiv} />
          <Pressable
            style={s.stat}
            onPress={openMyStory}
            accessibilityRole="button"
            accessibilityLabel="Ma story"
          >
            <Text style={s.statVal}>{storyCount}</Text>
            <Text style={s.statLabel}>{storyCount > 1 ? "Stories" : "Story"}</Text>
          </Pressable>
          <View style={s.statDiv} />
          <Pressable
            style={s.stat}
            onPress={() =>
              Alert.alert(
                "⚡ Score VimoX",
                `Ton score augmente avec chaque Vim échangé avec tes amis.${score.bestStreak > 0 ? `\n\nTa meilleure flamme en cours : 🔥 ${score.bestStreak} jours.` : ""}`,
              )
            }
            accessibilityRole="button"
            accessibilityLabel={`Score VimoX : ${score.score}`}
          >
            <Text style={s.statVal}>⚡ {score.score}</Text>
            <Text style={s.statLabel}>Score</Text>
          </Pressable>
          <View style={s.statDiv} />
          <View style={s.stat}>
            <Text style={s.statVal}>{profile.isPremium ? "Vim+" : "Gratuit"}</Text>
            <Text style={s.statLabel}>Formule</Text>
          </View>
        </View>

        {/* Ma story, comme en haut du profil Snap */}
        <SectionTitle>Ma story</SectionTitle>
        <View style={s.storyCard}>
        <Pressable
          onPress={openMyStory}
          style={({ pressed }) => [s.storyMain, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel={storyCount ? "Voir ma story" : "Ajouter à ma story"}
        >
          {lastStory?.imageURL ? (
            <Image source={{ uri: lastStory.imageURL }} style={s.storyThumb} />
          ) : (
            <View style={[s.storyThumb, s.storyThumbEmpty]}>
              <Ionicons name={storyCount ? "text" : "camera-outline"} size={22} color={colors.muted} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.storyTitle}>
              {storyCount ? `${storyCount} publication${storyCount > 1 ? "s" : ""}` : "Ajouter à ma story"}
            </Text>
            <Text style={s.storySub} numberOfLines={1}>
              {lastStory
                ? `${ago(lastStory.createdAt)} · ${views === 0 ? "pas encore de vue" : `vue par ${views}`}`
                : "Partage un moment avec tes amis pendant 24 h"}
            </Text>
          </View>
        </Pressable>
          <Pressable
            onPress={openCamera}
            hitSlop={8}
            style={s.storyAdd}
            accessibilityRole="button"
            accessibilityLabel="Ajouter à ma story"
          >
            <Ionicons name="add" size={22} color="#fff" />
          </Pressable>
        </View>

        {(() => {
          // Complète ton profil : chaque étape est un raccourci
          const steps = [
            { done: !!profile.profilePhotoURL, icon: "camera-outline", label: "Ajoute une photo de profil", go: () => navigation.navigate("EditProfile") },
            { done: !!profile.username, icon: "at-outline", label: "Choisis ton pseudo", go: () => navigation.navigate("EditProfile") },
            { done: !!profile.bio?.trim(), icon: "create-outline", label: "Écris une petite bio", go: () => navigation.navigate("EditProfile") },
            { done: friendCount > 0, icon: "person-add-outline", label: "Ajoute ton premier ami", go: () => navigation.navigate("AddFriends") },
            { done: storyCount > 0, icon: "aperture-outline", label: "Publie ta première story", go: openCamera },
          ];
          const done = steps.filter((x) => x.done).length;
          if (done === steps.length) return null;
          return (
            <View style={s.complete}>
              <View style={s.completeHead}>
                <Text style={s.completeTitle}>Complète ton profil</Text>
                <Text style={s.completePct}>{Math.round((done / steps.length) * 100)} %</Text>
              </View>
              <View style={s.completeTrack}>
                <View style={[s.completeFill, { width: `${(done / steps.length) * 100}%` }]} />
              </View>
              {steps
                .filter((x) => !x.done)
                .slice(0, 3)
                .map((x) => (
                  <Pressable key={x.label} onPress={x.go} style={({ pressed }) => [s.completeRow, pressed && { opacity: 0.7 }]} accessibilityRole="button">
                    <Ionicons name={x.icon as any} size={18} color={colors.neonRed} />
                    <Text style={s.completeTxt}>{x.label}</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.mutedDark} />
                  </Pressable>
                ))}
            </View>
          );
        })()}

        <SectionTitle>Mon compte</SectionTitle>
        <ListGroup>
          <ListRow
            icon="create-outline"
            label="Modifier le profil"
            onPress={() => navigation.navigate("EditProfile")}
          />
          <ListRow
            icon="people-outline"
            label="Mes amis"
            value={String(friendCount)}
            onPress={openFriends}
          />
          <ListRow
            icon="person-add-outline"
            label="Ajouter des amis"
            onPress={() => navigation.navigate("AddFriends")}
          />
          <ListRow
            icon="qr-code-outline"
            label="Partager mon profil"
            onPress={() => navigation.navigate("ShareProfile")}
          />
          {!profile.isPremium && (
            <ListRow
              icon="star-outline"
              label="Passer à Vim+"
              accent
              onPress={() => navigation.navigate("Premium")}
            />
          )}
        </ListGroup>

        <SectionTitle>Application</SectionTitle>
        <ListGroup>
          <ListRow
            icon="settings-outline"
            label="Paramètres"
            onPress={() => navigation.navigate("AccountSettings")}
          />
          <ListRow
            icon="document-text-outline"
            label="Conditions d'utilisation"
            onPress={() => navigation.navigate("Legal", { type: "cgu" })}
          />
          <ListRow
            icon="shield-checkmark-outline"
            label="Politique de confidentialité"
            onPress={() => navigation.navigate("Legal", { type: "privacy" })}
          />
        </ListGroup>

        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [s.logoutBtn, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.neonRedText} />
          <Text style={s.logoutTxt}>Se déconnecter</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  complete: {
    marginHorizontal: 16,
    marginTop: 18,
    padding: 16,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  completeHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  completeTitle: { color: colors.text, fontSize: 16, fontWeight: "900" },
  completePct: { color: colors.neonRed, fontSize: 14, fontWeight: "900" },
  completeTrack: { height: 6, borderRadius: 3, backgroundColor: colors.cardLight, overflow: "hidden" },
  completeFill: { height: "100%", borderRadius: 3, backgroundColor: colors.neonRed },
  completeRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  completeTxt: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "700" },
  root: { flex: 1, backgroundColor: colors.black },
  scroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 130 },
  hero: { alignItems: "center", gap: 8 },
  heroGlow: { position: "absolute", top: -60, left: -16, right: -16, height: 260, borderRadius: 40 },
  avatarWrap: { marginBottom: 4 },
  avatarRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 3,
    borderColor: colors.neonRed,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarPh: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.neonRedBg,
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { color: colors.neonRedText, fontSize: 36, fontWeight: "900" },
  editBadge: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.neonRed,
    borderWidth: 3,
    borderColor: colors.black,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { color: colors.text, fontSize: 24, fontWeight: "900", maxWidth: "90%" },
  handle: { color: colors.gold, fontSize: 14, fontWeight: "700", marginTop: 2 },
  handleHint: { color: colors.muted, fontSize: 13, fontWeight: "600", marginTop: 2, textDecorationLine: "underline" },
  premium: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.goldDim,
    backgroundColor: "rgba(255,194,75,0.08)",
  },
  premiumTxt: { color: colors.gold, fontSize: 12, fontWeight: "800" },
  chips: { flexDirection: "row", gap: 8, marginTop: 2 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipTxt: { color: colors.text, fontSize: 13, fontWeight: "600" },
  bio: {
    color: colors.muted,
    fontSize: 14,
    fontStyle: "italic",
    textAlign: "center",
    lineHeight: 20,
    marginTop: 4,
    paddingHorizontal: 12,
  },
  stats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 22,
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
  },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statDiv: { width: StyleSheet.hairlineWidth, height: 34, backgroundColor: colors.borderLight },
  statVal: { color: colors.text, fontSize: 17, fontWeight: "900" },
  statLabel: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  storyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  storyMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  storyThumb: { width: 46, height: 62, borderRadius: 10, backgroundColor: colors.cardLight },
  storyThumbEmpty: { alignItems: "center", justifyContent: "center" },
  storyTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  storySub: { color: colors.muted, fontSize: 13, marginTop: 2 },
  storyAdd: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.neonRed,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 26,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.neonRed,
  },
  logoutTxt: { color: colors.neonRedText, fontSize: 15, fontWeight: "800" },
});
