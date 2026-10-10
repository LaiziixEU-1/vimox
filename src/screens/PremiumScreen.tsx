import { useState } from "react";
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors } from "../theme/colors";
import { RootStackParamList } from "../models/types";
import { useAuth } from "../services/AuthContext";
import { NeonButton } from "../components/NeonButton";
import { activatePremiumDemo } from "../services/premiumService";

type Props = NativeStackScreenProps<RootStackParamList, "Premium">;

const FEATURES = [
  {
    icon: "♾️",
    title: "Matchs illimités",
    desc: "Aucune limite de connexions",
  },
  { icon: "⭐", title: "Badge Premium", desc: "Visible sur ton profil" },
  { icon: "🎨", title: "Effets vidéo", desc: "Filtres exclusifs en appel" },
  { icon: "🔊", title: "Audio longue durée", desc: "Jusqu'à 5 minutes" },
];

export function PremiumScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);

  function handleActivate() {
    Alert.alert(
      "Confirmer l'activation",
      "Cet abonnement est définitif et ne pourra pas être résilié une fois activé. Continuer ?",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Confirmer", style: "destructive", onPress: doActivate },
      ],
    );
  }

  async function doActivate() {
    if (!profile) return;
    setLoading(true);
    try {
      await activatePremiumDemo(profile.id);
      Alert.alert("🎉 Premium activé !", "", [
        { text: "Super !", onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert("Erreur", "Impossible d'activer le Premium.");
    } finally {
      setLoading(false);
    }
  }

  if (profile?.isPremium) {
    return (
      <SafeAreaView style={s.root}>
        <Pressable onPress={() => navigation.goBack()} style={s.closeBtn}>
          <Text style={s.closeTxt}>✕</Text>
        </Pressable>
        <View style={s.center}>
          <Text style={s.bigEmoji}>⭐</Text>
          <Text style={s.alreadyTitle}>Tu es déjà Premium !</Text>
          <NeonButton
            title="Fermer"
            onPress={() => navigation.goBack()}
            style={{ marginTop: 16, width: "100%" }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <Pressable onPress={() => navigation.goBack()} style={s.closeBtn}>
        <Text style={s.closeTxt}>✕</Text>
      </Pressable>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.hero}>
          <Text style={s.badge}>✦ PREMIUM ✦</Text>
          <Text style={s.heroTitle}>VimoX sans limites</Text>
        </View>
        <View style={s.features}>
          {FEATURES.map((f, i) => (
            <View key={i} style={s.featureRow}>
              <Text style={s.featureIcon}>{f.icon}</Text>
              <View style={s.featureTxt}>
                <Text style={s.featureTitle}>{f.title}</Text>
                <Text style={s.featureDesc}>{f.desc}</Text>
              </View>
              <Text style={s.check}>✓</Text>
            </View>
          ))}
        </View>
        <View style={s.priceCard}>
          <Text style={s.price}>4,99 €</Text>
          <Text style={s.pricePeriod}>/mois</Text>
        </View>
        <NeonButton
          title={loading ? "Activation..." : "Activer Premium"}
          onPress={handleActivate}
          disabled={loading}
        />
        <Text style={s.legal}>
          Abonnement définitif — non résiliable une fois activé
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  closeBtn: { alignSelf: "flex-end", padding: 16 },
  closeTxt: { color: colors.muted, fontSize: 24, fontWeight: "300" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 12,
  },
  bigEmoji: { fontSize: 72 },
  alreadyTitle: { color: colors.text, fontSize: 22, fontWeight: "900" },
  scroll: { padding: 20, gap: 20, paddingBottom: 40 },
  hero: { alignItems: "center", gap: 10 },
  badge: {
    color: "#FFD700",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
  },
  heroTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
  },
  features: { gap: 2 },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  featureIcon: { fontSize: 22, width: 28, textAlign: "center" },
  featureTxt: { flex: 1 },
  featureTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  featureDesc: { color: colors.muted, fontSize: 12, marginTop: 2 },
  check: { color: "#28F7A1", fontSize: 16, fontWeight: "900" },
  priceCard: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 4,
  },
  price: { color: colors.neonRed, fontSize: 32, fontWeight: "900" },
  pricePeriod: {
    color: colors.muted,
    fontSize: 16,
    alignSelf: "flex-end",
    marginBottom: 4,
  },
  legal: { color: colors.muted, fontSize: 11, textAlign: "center" },
});
