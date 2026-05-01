import { useEffect, useRef, useState } from "react";
import { Animated, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { doc, onSnapshot } from "firebase/firestore";
import { GlassPanel } from "../components/GlassPanel";
import { NeonButton } from "../components/NeonButton";
import { AdBanner } from "../components/AdBanner";
import { VimoXLogo } from "../components/VimoXLogo";
import { RootStackParamList, Gender, MatchFilters } from "../models/types";
import { db } from "../config/firebase";
import { nextMatch, startMatching } from "../services/matchService";
import { useAuth } from "../services/AuthContext";
import { activatePremiumDemo, canUseUnlimitedSkip } from "../services/premiumService";
import { colors } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "Matching">;
const countries = ["Tous", "France", "Suisse", "Belgique", "Canada", "Maroc", "Algérie", "Tunisie"];
const genders: Gender[] = ["Tous", "Femme", "Homme", "Non-binaire", "Autre"];

export function MatchingScreen({ navigation }: Props) {
  const { profile, logout } = useAuth();
  const [filters, setFilters] = useState<MatchFilters>({ minAge: 16, maxAge: 35, gender: "Tous", country: "Tous" });
  const [status, setStatus] = useState("Prêt à matcher");
  const [searching, setSearching] = useState(false);
  const [usedSkips, setUsedSkips] = useState(0);
  const scan = useRef(new Animated.Value(0)).current;

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
    Animated.loop(
      Animated.sequence([
        Animated.timing(scan, { toValue: 1, duration: 1100, useNativeDriver: true }),
        Animated.timing(scan, { toValue: 0, duration: 1100, useNativeDriver: true })
      ])
    ).start();
  }, [scan]);

  async function match() {
    if (!profile) return;
    setSearching(true);
    setStatus("Recherche d'un signal compatible...");
    try {
      const roomId = await startMatching(profile, filters);
      if (roomId) navigation.navigate("ChatRoom", { roomId });
      else setStatus("En attente d'un partenaire...");
    } catch (error) {
      setSearching(false);
      Alert.alert("Matching impossible", error instanceof Error ? error.message : "Erreur inconnue");
    }
  }

  async function next() {
    if (!profile) return;
    if (!canUseUnlimitedSkip(profile.isPremium, usedSkips)) {
      Alert.alert("Premium requis", "Passe Premium pour obtenir les skips illimités.");
      return;
    }
    setUsedSkips((value) => value + 1);
    const roomId = await nextMatch(profile, profile.activeMatchId, filters);
    if (roomId) navigation.navigate("ChatRoom", { roomId });
  }

  async function upgrade() {
    if (!profile) return;
    await activatePremiumDemo(profile.id);
    Alert.alert("Premium activé", "Mode démo activé. Pour l'App Store, branche StoreKit/RevenueCat ici.");
  }

  return (
    <LinearGradient colors={[colors.black, "#111122", "#16080D"]} style={styles.root}>
      {searching && <Animated.View style={[styles.scan, { transform: [{ translateY: scan.interpolate({ inputRange: [0, 1], outputRange: [-260, 520] }) }] }]} />}
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <VimoXLogo size={150} compact />
            <Text style={styles.signal}>{profile?.isPremium ? "PREMIUM SIGNAL" : "ANONYMOUS SIGNAL"}</Text>
          </View>
          <Pressable onPress={logout}><Text style={styles.logout}>Sortir</Text></Pressable>
        </View>

        <GlassPanel style={styles.card}>
          <VimoXLogo size={210} showWordmark={false} />
          <Text style={styles.status}>{status}</Text>
          <Text style={styles.hint}>Appuie sur Match ou utilise Suivant pour changer instantanément de partenaire.</Text>
        </GlassPanel>

        <GlassPanel style={{ gap: 14 }}>
          <Text style={styles.title}>Filtres avant match</Text>
          <Stepper label={`Âge min: ${filters.minAge}`} minus={() => setFilters((f) => ({ ...f, minAge: Math.max(16, f.minAge - 1) }))} plus={() => setFilters((f) => ({ ...f, minAge: Math.min(f.maxAge, f.minAge + 1) }))} />
          <Stepper label={`Âge max: ${filters.maxAge}`} minus={() => setFilters((f) => ({ ...f, maxAge: Math.max(f.minAge, f.maxAge - 1) }))} plus={() => setFilters((f) => ({ ...f, maxAge: Math.min(99, f.maxAge + 1) }))} />
          <ChoiceRow values={genders} value={filters.gender} onChange={(gender) => setFilters((f) => ({ ...f, gender }))} />
          <ChoiceRow values={countries} value={filters.country} onChange={(country) => setFilters((f) => ({ ...f, country }))} />
        </GlassPanel>

        <GlassPanel>
          <Text style={styles.title}>VimoX Premium</Text>
          <Text style={styles.hint}>Sans pubs, skips illimités, effets vidéo premium, masques et avatars.</Text>
          {!profile?.isPremium ? (
            <>
              <AdBanner />
              <Pressable onPress={upgrade} style={styles.upgrade}>
                <Text style={styles.upgradeText}>Activer Premium</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.premiumOk}>Premium actif</Text>
          )}
        </GlassPanel>

        <NeonButton title={searching ? "Recherche..." : "Match aléatoire"} onPress={match} disabled={searching} />
        <NeonButton title="Suivant" danger onPress={next} />
      </ScrollView>
    </LinearGradient>
  );
}

function Stepper({ label, minus, plus }: { label: string; minus: () => void; plus: () => void }) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperText}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable onPress={minus} style={styles.round}><Text style={styles.roundText}>-</Text></Pressable>
        <Pressable onPress={plus} style={styles.round}><Text style={styles.roundText}>+</Text></Pressable>
      </View>
    </View>
  );
}

function ChoiceRow<T extends string>({ values, value, onChange }: { values: T[]; value: T; onChange: (value: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.choices}>
        {values.map((item) => (
          <Pressable key={item} onPress={() => onChange(item)} style={[styles.choice, value === item && styles.choiceActive]}>
            <Text style={styles.choiceText}>{item}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingTop: 58, gap: 18 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  signal: { color: colors.muted, fontSize: 12, fontWeight: "900" },
  logout: { color: colors.neonRed, fontWeight: "900" },
  card: { minHeight: 230, alignItems: "center", justifyContent: "center", gap: 16 },
  status: { color: colors.text, fontSize: 22, fontWeight: "900", textAlign: "center" },
  hint: { color: colors.muted, textAlign: "center", lineHeight: 20 },
  title: { color: colors.text, fontSize: 18, fontWeight: "900" },
  stepper: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  stepperText: { color: colors.text, fontWeight: "700" },
  stepperControls: { flexDirection: "row", gap: 8 },
  round: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.panelStrong, alignItems: "center", justifyContent: "center" },
  roundText: { color: colors.text, fontSize: 20, fontWeight: "900" },
  choices: { flexDirection: "row", gap: 8 },
  choice: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.panelStrong },
  choiceActive: { backgroundColor: colors.neonBlue },
  choiceText: { color: colors.text, fontWeight: "800" },
  upgrade: { marginTop: 12, minHeight: 44, borderRadius: 12, backgroundColor: colors.neonRed, alignItems: "center", justifyContent: "center" },
  upgradeText: { color: colors.text, fontWeight: "900" },
  premiumOk: { color: colors.success, marginTop: 10, fontWeight: "900" },
  scan: { position: "absolute", left: 0, right: 0, height: 4, backgroundColor: colors.neonBlue, shadowColor: colors.neonBlue, shadowRadius: 18, shadowOpacity: 1 }
});
