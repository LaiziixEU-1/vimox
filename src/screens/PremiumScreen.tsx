import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { NeonButton } from "../components/NeonButton";
import { colors } from "../theme/colors";
import { useAuth } from "../services/AuthContext";
import { activatePremiumDemo } from "../services/premiumService";
import { RootStackParamList } from "../models/types";

type Props = NativeStackScreenProps<RootStackParamList, "Premium">;

const features = [
  {
    icon: "🚫",
    title: "Sans publicités",
    desc: "Profite de VimoX sans interruption",
  },
  {
    icon: "⚡",
    title: "Skips illimités",
    desc: "Change de partenaire autant que tu veux",
  },
  {
    icon: "🎭",
    title: "Filtres avancés",
    desc: "Filtre par âge, genre et pays précisément",
  },
  {
    icon: "⭐",
    title: "Badge Premium",
    desc: "Montre ton statut Premium aux autres",
  },
  {
    icon: "🎥",
    title: "Effets vidéo",
    desc: "Accède à tous les effets visuels",
  },
  {
    icon: "🔒",
    title: "Priorité matching",
    desc: "Matche plus vite avec les autres Premium",
  },
];

const plans = [
  {
    id: "monthly",
    label: "Mensuel",
    price: "4,99 €",
    period: "/mois",
    highlight: false,
  },
  {
    id: "yearly",
    label: "Annuel",
    price: "29,99 €",
    period: "/an",
    highlight: true,
    badge: "🔥 -50%",
  },
];

export function PremiumScreen({ navigation }: Props) {
  const { profile } = useAuth();

  async function handleSubscribe(planId: string) {
    Alert.alert(
      "Abonnement Premium",
      `Tu vas t'abonner au plan ${planId === "monthly" ? "mensuel (4,99€/mois)" : "annuel (29,99€/an)"}.\n\nEn production, ceci connectera RevenueCat pour le paiement réel.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Activer (démo)",
          onPress: async () => {
            if (!profile) return;
            await activatePremiumDemo(profile.id);
            Alert.alert(
              "Premium activé ! ✅",
              "Profite de toutes les fonctionnalités Premium.",
            );
            navigation.goBack();
          },
        },
      ],
    );
  }

  if (profile?.isPremium) {
    return (
      <LinearGradient
        colors={[colors.black, "#111122", "#16080D"]}
        style={styles.root}
      >
        <View style={styles.activeContainer}>
          <Text style={styles.activeEmoji}>⭐</Text>
          <Text style={styles.activeTitle}>Tu es déjà Premium !</Text>
          <Text style={styles.activeDesc}>
            Profite de toutes les fonctionnalités sans limite.
          </Text>
          <NeonButton title="Retour" onPress={() => navigation.goBack()} />
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[colors.black, "#111122", "#16080D"]}
      style={styles.root}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Text style={styles.close}>✕</Text>
        </Pressable>

        <Text style={styles.title}>VimoX Premium ⭐</Text>
        <Text style={styles.subtitle}>Débloque toutes les fonctionnalités</Text>

        {/* Features */}
        <View style={styles.features}>
          {features.map((f) => (
            <View key={f.title} style={styles.featureRow}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Plans */}
        <View style={styles.plans}>
          {plans.map((plan) => (
            <Pressable
              key={plan.id}
              onPress={() => handleSubscribe(plan.id)}
              style={[styles.plan, plan.highlight && styles.planHighlight]}
            >
              {plan.badge && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{plan.badge}</Text>
                </View>
              )}
              <Text style={styles.planLabel}>{plan.label}</Text>
              <Text style={styles.planPrice}>{plan.price}</Text>
              <Text style={styles.planPeriod}>{plan.period}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.legal}>
          Abonnement renouvelé automatiquement. Annulable à tout moment depuis
          les paramètres de l'App Store / Google Play.
        </Text>

        <Pressable
          onPress={() => navigation.navigate("Legal", { type: "privacy" })}
        >
          <Text style={styles.legalLink}>Politique de confidentialité</Text>
        </Pressable>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 24, paddingTop: 60, gap: 20 },
  closeBtn: { alignSelf: "flex-end" },
  close: { color: colors.muted, fontSize: 20, fontWeight: "900" },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
    textAlign: "center",
  },
  subtitle: { color: colors.muted, textAlign: "center", fontSize: 15 },
  features: { gap: 14 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  featureIcon: { fontSize: 28, width: 40, textAlign: "center" },
  featureText: { flex: 1 },
  featureTitle: { color: colors.text, fontWeight: "800", fontSize: 15 },
  featureDesc: { color: colors.muted, fontSize: 13 },
  plans: { flexDirection: "row", gap: 12 },
  plan: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    backgroundColor: colors.panelStrong,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "transparent",
  },
  planHighlight: {
    borderColor: colors.neonBlue,
    backgroundColor: "rgba(0,163,255,0.1)",
  },
  badge: {
    backgroundColor: colors.neonRed,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: { color: colors.text, fontSize: 11, fontWeight: "800" },
  planLabel: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  planPrice: { color: colors.text, fontSize: 22, fontWeight: "900" },
  planPeriod: { color: colors.muted, fontSize: 12 },
  legal: {
    color: colors.muted,
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
  },
  legalLink: {
    color: colors.neonBlue,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
  },
  activeContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
  },
  activeEmoji: { fontSize: 64 },
  activeTitle: { color: colors.text, fontSize: 24, fontWeight: "900" },
  activeDesc: { color: colors.muted, textAlign: "center", fontSize: 15 },
});
