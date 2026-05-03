import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { doc, onSnapshot } from "firebase/firestore";
import { NeonButton } from "../components/NeonButton";
import { VimoXLogo } from "../components/VimoXLogo";
import { RootStackParamList, Gender, MatchFilters } from "../models/types";
import { db } from "../config/firebase";
import { nextMatch, startMatching } from "../services/matchService";
import { useAuth } from "../services/AuthContext";
import {
  activatePremiumDemo,
  canUseUnlimitedSkip,
} from "../services/premiumService";
import { colors } from "../theme/colors";
import { notifyNewMatch } from "../services/notificationService";

type Props = NativeStackScreenProps<RootStackParamList, "Matching">;
const countries = [
  "Tous",
  "France",
  "Suisse",
  "Belgique",
  "Canada",
  "Maroc",
  "Algérie",
  "Tunisie",
];
const genders: Gender[] = ["Tous", "Femme", "Homme", "Non-binaire", "Autre"];

export function MatchingScreen({ navigation }: Props) {
  const { profile, logout } = useAuth();
  const [filters, setFilters] = useState<MatchFilters>({
    minAge: 16,
    maxAge: 35,
    gender: "Tous",
    country: "Tous",
  });
  const [status, setStatus] = useState("Tout est prêt !");
  const [statusSub, setStatusSub] = useState(
    "Nous allons te trouver des personnes incroyables 🔥",
  );
  const [searching, setSearching] = useState(false);
  const [usedSkips, setUsedSkips] = useState(0);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!profile) return;
    return onSnapshot(doc(db, "users", profile.id), (snapshot) => {
      const roomId = snapshot.data()?.activeMatchId;
      if (roomId) {
        setSearching(false);
        navigation.navigate("ChatRoom", { roomId });
      }
    });
  }, [navigation, profile]);

  useEffect(() => {
    if (!searching) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.15,
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
  }, [searching]);

  async function match() {
    if (!profile) return;
    setSearching(true);
    setStatus("Recherche en cours...");
    setStatusSub("Nous cherchons ton prochain match 🔥");
    try {
      const roomId = await startMatching(profile, filters);
      if (roomId) {
        await notifyNewMatch(undefined).catch(() => {});
        navigation.navigate("ChatRoom", { roomId });
      } else {
        setStatus("En attente...");
        setStatusSub("On cherche quelqu'un pour toi ⏳");
      }
    } catch (error) {
      setSearching(false);
      setStatus("Tout est prêt !");
      setStatusSub("Nous allons te trouver des personnes incroyables 🔥");
      Alert.alert(
        "Matching impossible",
        error instanceof Error ? error.message : "Erreur inconnue",
      );
    }
  }

  async function next() {
    if (!profile) return;
    if (!canUseUnlimitedSkip(profile.isPremium, usedSkips)) {
      Alert.alert("Premium requis", "Passe Premium pour les skips illimités.");
      return;
    }
    setUsedSkips((v) => v + 1);
    const roomId = await nextMatch(profile, profile.activeMatchId, filters);
    if (roomId) navigation.navigate("ChatRoom", { roomId });
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.navigate("Profile" as never)}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {profile?.name?.[0]?.toUpperCase() ?? "?"}
              </Text>
            </View>
          </Pressable>
          <Text style={styles.appName}>
            VIMO<Text style={styles.appX}>X</Text>
          </Text>
          <Pressable onPress={logout}>
            <Text style={styles.logout}>Sortir</Text>
          </Pressable>
        </View>

        {/* Logo animé */}
        <View style={styles.logoSection}>
          <Animated.View style={{ transform: [{ scale: pulse }] }}>
            <View style={styles.logoBg}>
              <VimoXLogo size={160} showWordmark={false} />
            </View>
          </Animated.View>

          {/* Filtres visuels autour du logo */}
          <View style={styles.filtersAround}>
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>♂♀</Text>
            </View>
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>
                {filters.minAge}-{filters.maxAge}
              </Text>
            </View>
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>
                {filters.country === "Tous"
                  ? "🌍"
                  : filters.country.slice(0, 2)}
              </Text>
            </View>
          </View>

          <Text style={styles.status}>{status}</Text>
          <Text style={styles.statusSub}>{statusSub}</Text>
        </View>

        {/* Filtres */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>FILTRES</Text>
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Âge min: {filters.minAge}</Text>
            <View style={styles.stepperBtns}>
              <Pressable
                onPress={() =>
                  setFilters((f) => ({
                    ...f,
                    minAge: Math.max(16, f.minAge - 1),
                  }))
                }
                style={styles.stepBtn}
              >
                <Text style={styles.stepBtnText}>−</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  setFilters((f) => ({
                    ...f,
                    minAge: Math.min(f.maxAge, f.minAge + 1),
                  }))
                }
                style={styles.stepBtn}
              >
                <Text style={styles.stepBtnText}>+</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Âge max: {filters.maxAge}</Text>
            <View style={styles.stepperBtns}>
              <Pressable
                onPress={() =>
                  setFilters((f) => ({
                    ...f,
                    maxAge: Math.max(f.minAge, f.maxAge - 1),
                  }))
                }
                style={styles.stepBtn}
              >
                <Text style={styles.stepBtnText}>−</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  setFilters((f) => ({
                    ...f,
                    maxAge: Math.min(99, f.maxAge + 1),
                  }))
                }
                style={styles.stepBtn}
              >
                <Text style={styles.stepBtnText}>+</Text>
              </Pressable>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chips}>
              {genders.map((g) => (
                <Pressable
                  key={g}
                  onPress={() => setFilters((f) => ({ ...f, gender: g }))}
                  style={[
                    styles.chip,
                    filters.gender === g && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      filters.gender === g && styles.chipTextActive,
                    ]}
                  >
                    {g}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chips}>
              {countries.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setFilters((f) => ({ ...f, country: c }))}
                  style={[
                    styles.chip,
                    filters.country === c && styles.chipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      filters.country === c && styles.chipTextActive,
                    ]}
                  >
                    {c}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Boutons */}
        <NeonButton
          title={searching ? "Recherche..." : "✕  Lancer le match aléatoire"}
          onPress={match}
          disabled={searching}
        />
        {profile?.isPremium ? (
          <NeonButton title="Suivant →" onPress={next} variant="outline" />
        ) : (
          <Pressable
            onPress={() => navigation.navigate("Premium" as never)}
            style={styles.premiumBanner}
          >
            <Text style={styles.premiumText}>
              ⭐ Passe Premium pour les skips illimités
            </Text>
          </Pressable>
        )}
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
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neonRed,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.text, fontWeight: "900", fontSize: 16 },
  appName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 3,
  },
  appX: { color: colors.neonRed },
  logout: { color: colors.neonRed, fontWeight: "700", fontSize: 14 },
  logoSection: { alignItems: "center", gap: 14, paddingVertical: 10 },
  logoBg: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(232,0,10,0.08)",
    borderWidth: 1,
    borderColor: "rgba(232,0,10,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  filtersAround: { flexDirection: "row", gap: 16 },
  filterBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(232,0,10,0.4)",
    backgroundColor: "rgba(232,0,10,0.08)",
  },
  filterBadgeText: { color: colors.text, fontWeight: "700", fontSize: 13 },
  status: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  statusSub: { color: colors.muted, fontSize: 14, textAlign: "center" },
  section: {
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
  },
  filterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  filterLabel: { color: colors.text, fontWeight: "600", fontSize: 14 },
  stepperBtns: { flexDirection: "row", gap: 8 },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "rgba(232,0,10,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(232,0,10,0.3)",
  },
  stepBtnText: { color: colors.neonRed, fontSize: 18, fontWeight: "900" },
  chips: { flexDirection: "row", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive: {
    borderColor: colors.neonRed,
    backgroundColor: "rgba(232,0,10,0.1)",
  },
  chipText: { color: colors.muted, fontWeight: "600", fontSize: 13 },
  chipTextActive: { color: colors.neonRed },
  premiumBanner: {
    alignItems: "center",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(232,0,10,0.3)",
    backgroundColor: "rgba(232,0,10,0.05)",
  },
  premiumText: { color: colors.neonRed, fontWeight: "700", fontSize: 13 },
});
