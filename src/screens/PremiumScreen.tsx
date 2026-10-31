/*VIMOX-V24*/
/*VIMOX-V22*/
import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../theme/colors";
import { RootStackParamList } from "../models/types";
import { useAuth } from "../services/AuthContext";
import { NeonButton } from "../components/NeonButton";
import { ChatColorPicker } from "../components/ChatColorPicker";
import {
  activatePremiumDemo,
  deactivatePremium,
  BILLING_ENABLED,
} from "../services/premiumService";
import {
  MANAGE_URL,
  PremiumOffer,
  STORE_NAME,
  annualSavings,
  buyPremium,
  getPremiumOffers,
  initPurchases,
  isBillingReady,
  restorePremium,
  giftVimPass,
  passesLeft,
} from "../services/purchaseService";
import { APP_ICONS, AppIconId, appIconsSupported, currentAppIcon, setAppIcon } from "../services/appIconService";
import { subscribeFriends } from "../services/friendService";
import { canUseMatch } from "../services/ageGate";
import { Avatar } from "../components/Avatar";

type Props = NativeStackScreenProps<RootStackParamList, "Premium">;

// Uniquement ce que le Premium fait vraiment aujourd'hui
// « adult » : avantages liés à Match, montrés seulement aux 18 ans et plus (Match leur est réservé)
const FEATURES: { icon: string; title: string; desc: string; adult?: boolean }[] = [
  { icon: "🔥", title: "Flammes restaurées", desc: "2 restaurations gratuites par mois" },
  { icon: "🎁", title: "3 Pass Vim+ par an", desc: "Offre 1 mois de Vim+ à tes amis" },
  { icon: "🎨", title: "Couleur de chat", desc: "Choisis la couleur de tes messages" },
  { icon: "🖼️", title: "Icône de l'app au choix", desc: "8 icônes pour personnaliser VimoX" },
  { icon: "🔁", title: "Qui a revu ta story", desc: "Vois qui l'a regardée plusieurs fois" },
  { icon: "🚫", title: "Aucune publicité", desc: "Plus aucune pub dans Match", adult: true },
  { icon: "🎯", title: "Priorité dans les matchs", desc: "Tu passes devant dans la file d'attente", adult: true },
  { icon: "🌍", title: "Plusieurs pays à la fois", desc: "Filtre de match avancé", adult: true },
  { icon: "✏️", title: "Modifier tes messages", desc: "Corrige un message pendant 15 minutes" },
  { icon: "✦", title: "Badge Vim+", desc: "Visible sur ton profil" },
];

export function PremiumScreen({ navigation }: Props) {
  const { profile } = useAuth();
  // Les avantages de Match ne concernent que les adultes
  const features = FEATURES.filter((f) => !f.adult || canUseMatch(profile));
  const [loading, setLoading] = useState(false);
  // Paiement réel disponible ? (clé RevenueCat + module d'achat, seulement dans une version construite)
  const billing = isBillingReady();
  // Formules venues du store (annuel, mensuel…) et formule choisie
  const [offers, setOffers] = useState<PremiumOffer[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [offerLoading, setOfferLoading] = useState(billing);
  const offer = offers.find((o) => o.id === selectedId) ?? offers[0] ?? null;
  const savings = annualSavings(offers);

  // Page membre : Pass Vim+ et icône de l'app
  const [passOpen, setPassOpen] = useState(false);
  const [gifting, setGifting] = useState<string | null>(null);
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [appIcon, setAppIconState] = useState<AppIconId>(currentAppIcon());
  useEffect(() => (profile?.isPremium ? subscribeFriends(profile.id, setFriendsList) : undefined), [profile?.id, profile?.isPremium]);
  const passFriends = friendsList.filter((f) => !f.isPremium);

  async function sendPass(friendId: string, name: string) {
    setGifting(friendId);
    const r = await giftVimPass(friendId);
    setGifting(null);
    if (r.ok) {
      setPassOpen(false);
      Alert.alert("🎁 Pass offert !", `${name} a maintenant 1 mois de Vim+. Un message l'attend dans votre conversation.`);
    } else {
      Alert.alert(
        "Pass non offert",
        billing ? r.message ?? "Réessaie plus tard." : "Les Pass Vim+ fonctionneront dès que les paiements seront activés (voir ACTIVER-LES-PAIEMENTS.md).",
      );
    }
  }

  async function chooseIcon(id: AppIconId) {
    if (!appIconsSupported()) {
      Alert.alert("Icône de l'application", "Le changement d'icône fonctionne dans l'application installée (pas dans Expo Go).");
      return;
    }
    if (await setAppIcon(id)) setAppIconState(id);
  }

  useEffect(() => {
    if (!billing || !profile) return;
    let alive = true;
    (async () => {
      await initPurchases(profile.id);
      const list = await getPremiumOffers();
      if (alive) {
        setOffers(list);
        setSelectedId(list[0]?.id ?? null);
        setOfferLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [profile?.id]);

  async function doPurchase() {
    if (!profile || !offer) return;
    setLoading(true);
    try {
      const r = await buyPremium(offer.pkg);
      if (r.ok) {
        Alert.alert("🎉 Bienvenue dans Vim+ !", "", [
          { text: "Super !", onPress: () => navigation.goBack() },
        ]);
      } else if (!r.cancelled) {
        Alert.alert(
          "Achat impossible",
          "Ton paiement n'a pas abouti et tu n'as pas été débité. Réessaie plus tard." +
            (r.error ? ` (code : ${r.error})` : ""),
        );
      }
    } finally {
      setLoading(false);
    }
  }

  async function doRestore() {
    if (!profile) return;
    setLoading(true);
    try {
      const ok = await restorePremium();
      if (ok) {
        Alert.alert("Achat restauré", "Ton abonnement Vim+ est de retour.", [
          { text: "Super !", onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert("Aucun achat trouvé", `Aucun abonnement actif n'est associé à ton compte ${STORE_NAME}.`);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleActivate() {
    if (billing) {
      doPurchase();
      return;
    }
    Alert.alert(
      "Confirmer l'activation",
      BILLING_ENABLED
        ? "Tu vas activer l'abonnement Vim+. Continuer ?"
        : "Mode démonstration : Vim+ est activé gratuitement, sans aucun paiement. Tu pourras le désactiver quand tu veux.",
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
      Alert.alert("🎉 Vim+ activé !", "", [
        { text: "Super !", onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert("Erreur", "Impossible d'activer Vim+.");
    } finally {
      setLoading(false);
    }
  }

  if (profile?.isPremium) {
    const p: any = profile;
    const ms = (v: any) => (typeof v?.toMillis === "function" ? v.toMillis() : typeof v === "number" ? v : 0);
    const fmt = (v: any) =>
      ms(v) ? new Date(ms(v)).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : null;
    const since = fmt(p.premiumSince) ?? fmt(p.premiumActivatedAt);
    const until = fmt(p.premiumUntil);
    const left = passesLeft(p);
    return (
      <SafeAreaView style={s.root}>
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {/* En-tête membre, comme Snapchat+ */}
          <LinearGradient colors={["#7A0F1E", "#3A0812", "#09090C"]} style={m.header}>
            <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={() => navigation.goBack()} style={m.close}>
              <Text style={s.closeTxt}>✕</Text>
            </Pressable>
            <Text style={m.brand}>Vim+</Text>
            {since ? <Text style={m.since}>Membre depuis le {since}</Text> : null}
            <Text style={m.until}>
              {!billing
                ? "Mode démonstration"
                : p.premiumStore === "gift"
                  ? `Pass offert · jusqu'au ${until ?? "—"}`
                  : p.premiumWillRenew === false
                    ? `Fin de l'abonnement le ${until ?? "—"}`
                    : until
                      ? `Renouvellement le ${until}`
                      : ""}
            </Text>
            {billing && p.premiumStore !== "gift" ? (
              <Pressable onPress={() => Linking.openURL(MANAGE_URL).catch(() => {})} style={m.manage} accessibilityRole="button">
                <Text style={m.manageTxt}>Gérer mon abonnement ›</Text>
              </Pressable>
            ) : null}
          </LinearGradient>

          <View style={m.body}>
            {/* 🎁 Pass Vim+ */}
            <Pressable
              style={({ pressed }) => [m.card, pressed && { opacity: 0.85 }]}
              onPress={() => setPassOpen(true)}
              accessibilityRole="button"
            >
              <Text style={m.cardEmoji}>🎁</Text>
              <View style={{ flex: 1 }}>
                <Text style={m.cardTitle}>
                  {left} Pass Vim+ disponible{left > 1 ? "s" : ""}
                </Text>
                <Text style={m.cardSub}>Offre 1 mois de Vim+ gratuitement à tes amis</Text>
              </View>
              <Text style={m.chev}>›</Text>
            </Pressable>

            {/* 🖼️ Icône de l'application */}
            <View style={m.card}>
              <View style={{ flex: 1, gap: 12 }}>
                <Text style={m.cardTitle}>Icône de l'application</Text>
                <View style={m.iconGrid}>
                  {APP_ICONS.map((ic) => {
                    const on = ic.id === appIcon;
                    return (
                      <Pressable
                        key={ic.id}
                        onPress={() => chooseIcon(ic.id)}
                        style={m.iconCell}
                        accessibilityRole="button"
                        accessibilityLabel={`Icône ${ic.label}`}
                        accessibilityState={{ selected: on }}
                      >
                        <Image source={ic.thumb} style={[m.iconImg, on && m.iconImgOn]} />
                        <Text style={[m.iconLbl, on && { color: colors.text }]}>{ic.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {!appIconsSupported() ? (
                  <Text style={m.cardSub}>Disponible dans l'application installée (pas dans Expo Go).</Text>
                ) : null}
              </View>
            </View>

            {/* 🎨 Couleur de chat */}
            <ChatColorPicker />

            {/* ✓ Tes avantages */}
            <View style={m.card}>
              <View style={{ flex: 1, gap: 10 }}>
                <Text style={m.cardTitle}>Tes avantages</Text>
                {features.map((f) => (
                  <View key={f.title} style={m.perk}>
                    <Text style={{ fontSize: 18 }}>{f.icon}</Text>
                    <Text style={m.perkTxt}>{f.title}</Text>
                    <Text style={s.check}>✓</Text>
                  </View>
                ))}
              </View>
            </View>

            {billing ? (
              <Pressable onPress={doRestore} disabled={loading} style={m.footerBtn} accessibilityRole="button">
                <Text style={m.footerTxt}>Restaurer mes achats</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() =>
                  Alert.alert("Désactiver Vim+", "Mode démonstration : tu peux le réactiver à tout moment.", [
                    { text: "Annuler", style: "cancel" },
                    { text: "Désactiver", style: "destructive", onPress: () => deactivatePremium(p.id).catch(() => {}) },
                  ])
                }
                style={m.footerBtn}
              >
                <Text style={m.footerTxt}>Désactiver Vim+ (démo)</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>

        {/* Choisir l'ami qui reçoit le Pass */}
        <Modal visible={passOpen} transparent animationType="slide" onRequestClose={() => setPassOpen(false)}>
          <View style={m.sheetBack}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setPassOpen(false)} />
            <View style={m.sheet}>
              <Text style={m.sheetTitle}>🎁 Offrir un Pass Vim+</Text>
              <Text style={m.cardSub}>
                {left > 0
                  ? `Ton ami reçoit 1 mois de Vim+ gratuit. Il te reste ${left} Pass cette année.`
                  : "Tu as utilisé tes 3 Pass de l'année. Ils reviennent le 1er janvier."}
              </Text>
              <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ gap: 6, paddingTop: 10 }}>
                {passFriends.length === 0 ? (
                  <Text style={[m.cardSub, { textAlign: "center", paddingVertical: 20 }]}>
                    Tous tes amis ont déjà Vim+, ou tu n'as pas encore d'amis.
                  </Text>
                ) : (
                  passFriends.map((f) => (
                    <View key={f.id} style={m.friendRow}>
                      <Avatar uri={f.profilePhotoURL} name={f.name} size={42} />
                      <Text style={m.friendName} numberOfLines={1}>{f.name}</Text>
                      <Pressable
                        disabled={left <= 0 || gifting !== null}
                        onPress={() => sendPass(f.id, f.name)}
                        style={[m.giftBtn, (left <= 0 || gifting !== null) && { opacity: 0.4 }]}
                        accessibilityRole="button"
                      >
                        <Text style={m.giftTxt}>{gifting === f.id ? "…" : "Offrir"}</Text>
                      </Pressable>
                    </View>
                  ))
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={() => navigation.goBack()} style={s.closeBtn}>
        <Text style={s.closeTxt}>✕</Text>
      </Pressable>
      <ScrollView contentContainerStyle={s.scroll}>
        <View style={s.hero}>
          <LinearGradient
            pointerEvents="none"
            colors={["rgba(255,194,75,0.30)", "rgba(255,138,61,0.10)", "rgba(9,9,12,0)"]}
            style={s.heroGlow}
          />
          <Text style={s.badge}>✦ VIM+ ✦</Text>
          <Text style={s.heroTitle}>VimoX sans limites</Text>
        </View>
        <View style={s.features}>
          {features.map((f, i) => (
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
        {billing && offers.length > 1 ? (
          // Choix de la formule (annuel / mensuel…), comme les grandes apps
          <View style={s.plans}>
            {offers.map((o) => {
              const on = o.id === offer?.id;
              return (
                <Pressable
                  key={o.id}
                  onPress={() => setSelectedId(o.id)}
                  style={[s.plan, on && s.planOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                >
                  {o.kind === "annual" && savings ? <Text style={s.planBadge}>−{savings} %</Text> : null}
                  <Text style={s.planTitle}>{o.kind === "annual" ? "Annuel" : o.kind === "monthly" ? "Mensuel" : o.kind === "weekly" ? "Hebdo" : o.title}</Text>
                  <Text style={s.planPrice}>{o.priceString}</Text>
                  <Text style={s.planPeriod}>{o.period}</Text>
                  {o.trial ? <Text style={s.planTrial}>{o.trial}</Text> : null}
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={s.priceCard}>
            <Text style={s.price}>
              {billing ? (offer ? offer.priceString : offerLoading ? "…" : "Indisponible") : "Gratuit"}
            </Text>
            <Text style={s.pricePeriod}>
              {billing ? (offer ? offer.period : "") : "· mode démonstration"}
            </Text>
          </View>
        )}
        {billing && offer?.trial ? (
          <Text style={s.trialNote}>
            {offer.trial}, puis {offer.priceString}
            {offer.period}. Résiliable à tout moment.
          </Text>
        ) : null}
        <NeonButton
          title={
            billing
              ? loading
                ? "Achat en cours..."
                : offer?.trial
                  ? "Commencer l'essai gratuit"
                  : "S'abonner"
              : loading
                ? "Activation..."
                : "Activer Vim+"
          }
          onPress={handleActivate}
          disabled={loading || (billing && !offer)}
        />
        {billing ? (
          <>
            <Text style={s.legal}>
              Abonnement à renouvellement automatique : il se renouvelle tant que tu ne le résilies pas, au
              moins 24 h avant la fin de la période en cours. Le paiement est débité sur ton compte {STORE_NAME}
              à la confirmation de l'achat{offer?.trial ? " (à la fin de l'essai gratuit)" : ""} ; tu peux gérer ou résilier
              ton abonnement à tout moment dans les réglages de ton compte {STORE_NAME}.
            </Text>
            <View style={s.linksRow}>
              <Pressable onPress={doRestore} disabled={loading} accessibilityRole="button">
                <Text style={s.link}>Restaurer mes achats</Text>
              </Pressable>
              <Pressable onPress={() => navigation.navigate("Legal", { type: "cgu" })} accessibilityRole="button">
                <Text style={s.link}>Conditions d'utilisation</Text>
              </Pressable>
              <Pressable onPress={() => navigation.navigate("Legal", { type: "privacy" })} accessibilityRole="button">
                <Text style={s.link}>Confidentialité</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Text style={s.legal}>
            Mode démonstration : Vim+ est gratuit et tu peux le désactiver à tout moment.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Styles de la page membre
const m = StyleSheet.create({
  header: { alignItems: "center", paddingTop: 20, paddingBottom: 26, paddingHorizontal: 20, gap: 6 },
  close: { position: "absolute", top: 6, right: 6, padding: 12 },
  brand: { color: "#fff", fontSize: 44, fontWeight: "900", letterSpacing: 0.5, marginTop: 10 },
  since: { color: "rgba(255,255,255,0.8)", fontSize: 15, fontWeight: "700" },
  until: { color: "rgba(255,255,255,0.65)", fontSize: 13 },
  manage: { marginTop: 10, backgroundColor: "#FFD98A", borderRadius: 22, paddingHorizontal: 22, paddingVertical: 10 },
  manageTxt: { color: "#2A1A00", fontSize: 15, fontWeight: "900" },
  body: { paddingHorizontal: 14, gap: 12, marginTop: 4 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "rgba(122,15,30,0.28)",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  cardEmoji: { fontSize: 40 },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: "900" },
  cardSub: { color: colors.muted, fontSize: 13, marginTop: 3, lineHeight: 18 },
  chev: { color: colors.muted, fontSize: 26, fontWeight: "300" },
  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  iconCell: { width: "22%", alignItems: "center", gap: 4 },
  iconImg: { width: 60, height: 60, borderRadius: 14, borderWidth: 2, borderColor: "transparent" },
  iconImgOn: { borderColor: colors.gold },
  iconLbl: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  perk: { flexDirection: "row", alignItems: "center", gap: 10 },
  perkTxt: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "700" },
  footerBtn: { alignItems: "center", padding: 14 },
  footerTxt: { color: colors.muted, fontSize: 13, textDecorationLine: "underline" },
  sheetBack: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 34 },
  sheetTitle: { color: colors.text, fontSize: 19, fontWeight: "900" },
  friendRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 },
  friendName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "700" },
  giftBtn: { backgroundColor: colors.gold, borderRadius: 16, paddingHorizontal: 16, height: 34, alignItems: "center", justifyContent: "center" },
  giftTxt: { color: "#1A1000", fontWeight: "900" },
});

const s = StyleSheet.create({
  linksRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 18, marginTop: 8 },
  link: { color: "#FFC24B", fontSize: 13, fontWeight: "700", textDecorationLine: "underline" },
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
  hero: { alignItems: "center", gap: 10, paddingTop: 10 },
  heroGlow: { position: "absolute", top: -80, left: -20, right: -20, height: 280, borderRadius: 40 },
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
  plans: { flexDirection: "row", gap: 10 },
  plan: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.border,
  },
  planOn: { borderColor: colors.gold, backgroundColor: "rgba(255,194,75,0.08)" },
  planBadge: {
    position: "absolute",
    top: -10,
    backgroundColor: colors.gold,
    color: "#1A1000",
    fontSize: 11,
    fontWeight: "900",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: "hidden",
  },
  planTitle: { color: colors.text, fontSize: 14, fontWeight: "800", marginTop: 4 },
  planPrice: { color: colors.text, fontSize: 20, fontWeight: "900" },
  planPeriod: { color: colors.muted, fontSize: 12 },
  planTrial: { color: colors.gold, fontSize: 11, fontWeight: "800", marginTop: 2 },
  trialNote: { color: colors.text, fontSize: 13, fontWeight: "700", textAlign: "center" },
});
