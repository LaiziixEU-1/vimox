import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { NeonButton } from "../components/NeonButton";
import { colors } from "../theme/colors";
import { useAuth } from "../services/AuthContext";
import { RootStackParamList } from "../models/types";

type Props = NativeStackScreenProps<RootStackParamList, "Profile">;

export function ProfileScreen({ navigation }: Props) {
  const { profile, logout } = useAuth();
  if (!profile) return null;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()}>
            <Text style={styles.back}>‹</Text>
          </Pressable>
          <Text style={styles.title}>Profil</Text>
          <Pressable onPress={() => navigation.navigate("EditProfile")}>
            <Text style={styles.edit}>Modifier</Text>
          </Pressable>
        </View>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            {profile.profilePhotoURL ? (
              <Image
                source={{ uri: profile.profilePhotoURL }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>
                  {profile.name?.[0]?.toUpperCase() ?? "?"}
                </Text>
              </View>
            )}
            {profile.isPremium && (
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumBadgeText}>⭐</Text>
              </View>
            )}
          </View>
          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.info}>
            {profile.age} ans · {profile.gender} · {profile.country}
          </Text>
          <Text style={styles.email}>{profile.email}</Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Matchs</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {profile.isPremium ? "⭐" : "Free"}
            </Text>
            <Text style={styles.statLabel}>Statut</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {profile.blockedUserIds?.length ?? 0}
            </Text>
            <Text style={styles.statLabel}>Bloqués</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable
            onPress={() => navigation.navigate("EditProfile")}
            style={styles.actionRow}
          >
            <Text style={styles.actionIcon}>✏️</Text>
            <Text style={styles.actionText}>Modifier le profil</Text>
            <Text style={styles.actionArrow}>›</Text>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate("AccountSettings")}
            style={styles.actionRow}
          >
            <Text style={styles.actionIcon}>⚙️</Text>
            <Text style={styles.actionText}>Paramètres</Text>
            <Text style={styles.actionArrow}>›</Text>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate("Legal", { type: "privacy" })}
            style={styles.actionRow}
          >
            <Text style={styles.actionIcon}>🔒</Text>
            <Text style={styles.actionText}>Confidentialité</Text>
            <Text style={styles.actionArrow}>›</Text>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate("Premium" as never)}
            style={styles.actionRow}
          >
            <Text style={styles.actionIcon}>⭐</Text>
            <Text style={styles.actionText}>Premium</Text>
            <Text style={styles.actionArrow}>›</Text>
          </Pressable>
        </View>

        <Pressable onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  content: { padding: 20, paddingTop: 54, gap: 20 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  back: { color: colors.text, fontSize: 28, fontWeight: "300" },
  title: { color: colors.text, fontSize: 18, fontWeight: "800" },
  edit: { color: colors.neonRed, fontWeight: "700", fontSize: 14 },
  avatarSection: { alignItems: "center", gap: 8 },
  avatarContainer: { position: "relative" },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: colors.neonRed,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(232,0,10,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.neonRed,
  },
  avatarInitial: { color: colors.neonRed, fontSize: 40, fontWeight: "900" },
  premiumBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 4,
    borderWidth: 2,
    borderColor: colors.neonRed,
  },
  premiumBadgeText: { fontSize: 14 },
  name: { color: colors.text, fontSize: 22, fontWeight: "900" },
  info: { color: colors.muted, fontSize: 14 },
  email: { color: colors.muted, fontSize: 12 },
  statsRow: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statItem: { flex: 1, alignItems: "center", gap: 4 },
  statDivider: { width: 1, backgroundColor: colors.border },
  statValue: { color: colors.text, fontSize: 18, fontWeight: "900" },
  statLabel: { color: colors.muted, fontSize: 11, fontWeight: "600" },
  actions: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  actionIcon: { fontSize: 18 },
  actionText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "600" },
  actionArrow: { color: colors.muted, fontSize: 18 },
  logoutBtn: {
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(232,0,10,0.3)",
    backgroundColor: "rgba(232,0,10,0.05)",
  },
  logoutText: { color: colors.neonRed, fontWeight: "700", fontSize: 15 },
});
