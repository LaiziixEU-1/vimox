import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  collection,
  getCountFromServer,
  query,
  where,
} from "firebase/firestore";
import { colors } from "../theme/colors";
import { RootStackParamList } from "../models/types";
import { useAuth } from "../services/AuthContext";
import { db } from "../config/firebase";

type Props = NativeStackScreenProps<RootStackParamList, "Profile">;

export function ProfileScreen({ navigation }: Props) {
  const { profile, logout } = useAuth();
  const [friendCount, setFriendCount] = useState(0);

  useEffect(() => {
    if (!profile) return;
    getCountFromServer(
      query(collection(db, "friends"), where("userId", "==", profile.id)),
    )
      .then((s) => setFriendCount(s.data().count))
      .catch(() => {});
  }, [profile]);

  async function handleLogout() {
    Alert.alert("Déconnexion", "Tu vas être déconnecté.", [
      { text: "Annuler", style: "cancel" },
      { text: "Se déconnecter", style: "destructive", onPress: () => logout() },
    ]);
  }

  if (!profile) return null;
  const initials =
    profile.name
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ?? "?";

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Text style={s.title}>Mon profil</Text>
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll}>
        <View style={s.hero}>
          {profile.profilePhotoURL ? (
            <Image source={{ uri: profile.profilePhotoURL }} style={s.avatar} />
          ) : (
            <View style={s.avatarPh}>
              <Text style={s.initials}>{initials}</Text>
            </View>
          )}
          {profile.isPremium && (
            <View style={s.premiumBadge}>
              <Text style={s.premiumBadgeTxt}>⭐ Premium</Text>
            </View>
          )}
          <Text style={s.name}>{profile.name}</Text>
          <Text style={s.sub}>
            {profile.age} ans · {profile.country}
          </Text>
          {profile.bio && <Text style={s.bio}>"{profile.bio}"</Text>}
        </View>

        <View style={s.stats}>
          <View style={s.statItem}>
            <Text style={s.statVal}>{friendCount}</Text>
            <Text style={s.statLabel}>Amis</Text>
          </View>
          <View style={s.statDiv} />
          <View style={s.statItem}>
            <Text style={s.statVal}>{profile.country}</Text>
            <Text style={s.statLabel}>Pays</Text>
          </View>
        </View>

        <View style={s.section}>
          <Row
            icon="✏️"
            label="Modifier le profil"
            onPress={() => navigation.navigate("EditProfile")}
          />
          <Row
            icon="👥"
            label="Mes amis"
            onPress={() => navigation.navigate("Friends")}
          />
          {!profile.isPremium && (
            <Row
              icon="⭐"
              label="Passer Premium"
              onPress={() => navigation.navigate("Premium")}
              accent
            />
          )}
          <Row
            icon="⚙️"
            label="Paramètres"
            onPress={() => navigation.navigate("AccountSettings")}
          />
          <Row
            icon="📱"
            label="Partager mon profil"
            onPress={() => navigation.navigate("ShareProfile")}
          />
          <Row
            icon="📋"
            label="Conditions d'utilisation"
            onPress={() => navigation.navigate("Legal", { type: "cgu" })}
          />
        </View>

        <Pressable onPress={handleLogout} style={s.logoutBtn}>
          <Text style={s.logoutTxt}>Se déconnecter</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  icon,
  label,
  onPress,
  accent = false,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  accent?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        r.row,
        accent && r.accent,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={r.icon}>{icon}</Text>
      <Text style={[r.label, accent && { color: colors.neonRed }]}>
        {label}
      </Text>
      <Text style={r.arrow}>›</Text>
    </Pressable>
  );
}
const r = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accent: {
    borderColor: "rgba(232,0,10,0.25)",
    backgroundColor: "rgba(232,0,10,0.05)",
  },
  icon: { fontSize: 18, width: 24, textAlign: "center" },
  label: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "600" },
  arrow: { color: colors.muted, fontSize: 20 },
});
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  header: {
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: "900" },
  scroll: { padding: 20, paddingBottom: 40, gap: 16 },
  hero: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 20,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: colors.neonRed,
  },
  avatarPh: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(232,0,10,0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.neonRed,
  },
  initials: { color: colors.neonRed, fontSize: 36, fontWeight: "900" },
  premiumBadge: {
    backgroundColor: "rgba(255,215,0,0.15)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "rgba(255,215,0,0.4)",
  },
  premiumBadgeTxt: { color: "#FFD700", fontSize: 12, fontWeight: "700" },
  name: { color: colors.text, fontSize: 22, fontWeight: "900" },
  sub: { color: colors.muted, fontSize: 14 },
  bio: {
    color: colors.muted,
    fontSize: 13,
    fontStyle: "italic",
    textAlign: "center",
  },
  stats: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statItem: { flex: 1, alignItems: "center", gap: 4 },
  statDiv: { width: 1, backgroundColor: colors.border, marginVertical: 4 },
  statVal: { color: colors.text, fontSize: 18, fontWeight: "900" },
  statLabel: { color: colors.muted, fontSize: 12 },
  section: { gap: 2 },
  logoutBtn: {
    backgroundColor: "rgba(232,0,10,0.08)",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(232,0,10,0.2)",
  },
  logoutTxt: { color: colors.neonRed, fontWeight: "700", fontSize: 14 },
});
