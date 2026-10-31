import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafetyCharter, hasAcceptedCharter } from "../components/SafetyCharter";
import { StoreItem, buyItem, getStoreItems, isBillingReady } from "../services/purchaseService";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { colors, gradients } from "../theme/colors";
import { RootStackParamList } from "../models/types";
import { useAuth } from "../services/AuthContext";
import {
  ageBandOf,
  ageLimitsFor,
  cancelFindMatch,
  countSearching,
  findMatch,
  MatchMode,
  normalizeInterests,
  boostActive,
} from "../services/matchService";

type Props = NativeStackScreenProps<RootStackParamList, "Matching">;
const GENDERS = ["Tous", "Homme", "Femme", "Non-binaire"];
const COUNTRIES = ["Tous", "France", "Belgique", "Suisse", "Canada", "Maroc", "Tunisie", "Algérie", "Autres"];
const ADULT_MINS = [18, 21, 25, 30, 40];
const ADULT_MAXS = [25, 30, 40, 50, 60, 99];
const PREFS_KEY = "vimox_match_prefs";
const SUGGESTED = ["musique", "jeux video", "foot", "anime", "films", "voyage", "mode", "danse", "manga", "sport"];

export function MatchingScreen({ navigation }: Props) {
  const { profile } = useAuth();
  // Âge pas encore chargé : on attend (sinon l'écran croirait que tu es mineur)
  const ageKnown = typeof profile?.age === "number";
  const band = ageBandOf(profile?.age);
  const limits = ageLimitsFor(profile?.age);
  const isMinor = band === "minor";

  const [mode, setMode] = useState<MatchMode>("text");
  const [gender, setGender] = useState("Tous");
  const [country, setCountry] = useState("Tous");
  // Vim+ : plusieurs pays à la fois
  const isPlus = profile?.isPremium === true;
  const [countries, setCountries] = useState<string[]>([]);
  const [ageMin, setAgeMin] = useState(limits.min);
  const [ageMax, setAgeMax] = useState(limits.max);
  const [interests, setInterests] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [searching, setSearching] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [online, setOnline] = useState<number | null>(null);
  const searchingRef = useRef(false);

  const pulse = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.8)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  // Préférences gardées d'une fois sur l'autre (comme Omegle garde tes intérêts)
  useEffect(() => {
    AsyncStorage.getItem(PREFS_KEY)
      .then((raw) => {
        if (!raw) return;
        const p = JSON.parse(raw);
        if (p.mode === "video" || p.mode === "text") setMode(p.mode);
        if (Array.isArray(p.interests)) setInterests(normalizeInterests(p.interests));
        if (typeof p.gender === "string") setGender(p.gender);
        if (typeof p.country === "string") setCountry(p.country);
        if (Array.isArray(p.countries)) setCountries(p.countries.filter((x: any) => typeof x === "string").slice(0, 10));
      })
      .catch(() => {});
  }, []);
  function savePrefs() {
    AsyncStorage.setItem(PREFS_KEY, JSON.stringify({ mode, interests, gender, country, countries })).catch(() => {});
  }

  // L'âge reste toujours dans la tranche de l'utilisateur (sécurité des mineurs)
  useEffect(() => {
    setAgeMin((v) => Math.max(limits.min, Math.min(v, limits.max)));
    setAgeMax((v) => Math.min(limits.max, Math.max(v, limits.min)));
  }, [band]);

  // Personnes en ligne dans ta tranche d'âge, actualisé toutes les 15 s
  useEffect(() => {
    // On attend l'âge : sans lui, la tranche d'âge serait fausse et Firebase refuserait
    if (typeof profile?.age !== "number") return;
    let alive = true;
    const load = () => countSearching(profile?.age).then((n) => alive && setOnline(n));
    load();
    const id = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [profile?.age]);

  useEffect(() => {
    if (!searching) return;
    setSeconds(0);
    const tick = setInterval(() => setSeconds((s) => s + 1), 1000);
    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulse, { toValue: 1.2, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0.2, duration: 900, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseOpacity, { toValue: 0.8, duration: 900, useNativeDriver: true }),
        ]),
      ]),
    );
    const rotateAnim = Animated.loop(Animated.timing(rotate, { toValue: 1, duration: 4000, useNativeDriver: true }));
    pulseAnim.start();
    rotateAnim.start();
    return () => {
      clearInterval(tick);
      pulseAnim.stop();
      rotateAnim.stop();
    };
  }, [searching]);

  useEffect(() => () => cancelFindMatch(), []);

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  function addInterest(raw: string) {
    const next = normalizeInterests([...interests, ...raw.split(",")]);
    setInterests(next);
    setDraft("");
  }

  // ⚡ Boost (achat à l'unité)
  const [boostItem, setBoostItem] = useState<StoreItem | null>(null);
  const [buyingBoost, setBuyingBoost] = useState(false);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isBillingReady()) return;
    getStoreItems().then((it) => setBoostItem(it.boost ?? null));
  }, []);
  useEffect(() => {
    if (!profile || !boostActive(profile)) return;
    const id = setInterval(() => setTick((t) => t + 1), 30000); // met à jour les minutes restantes
    return () => clearInterval(id);
  }, [(profile as any)?.boostUntil]);
  function boostMinutesLeft() {
    const v: any = (profile as any)?.boostUntil;
    const ms = typeof v?.toMillis === "function" ? v.toMillis() : 0;
    return Math.max(1, Math.ceil((ms - Date.now()) / 60000));
  }
  async function buyBoost() {
    if (!isBillingReady() || !boostItem) {
      Alert.alert(
        "⚡ Boost",
        "Le Boost (30 minutes de priorité dans les matchs) arrivera avec les paiements. Vim+ donne déjà une priorité permanente.",
        [
          { text: "Plus tard", style: "cancel" },
          { text: "Découvrir Vim+", onPress: () => navigation.navigate("Premium") },
        ],
      );
      return;
    }
    setBuyingBoost(true);
    try {
      const r = await buyItem(boostItem);
      if (r.ok) Alert.alert("⚡ Boost activé !", "Pendant 30 minutes, tu passes devant dans la file d'attente.");
      else if (!r.cancelled) Alert.alert("Achat impossible", "Tu n'as pas été débité. Réessaie plus tard.");
    } finally {
      setBuyingBoost(false);
    }
  }

  // Charte de sécurité : une seule fois, avant la toute première rencontre
  const [charterOpen, setCharterOpen] = useState(false);
  async function handleStart() {
    if (!profile || !ageKnown || searchingRef.current) return;
    if (!(await hasAcceptedCharter())) {
      setCharterOpen(true);
      return;
    }
    if (draft.trim()) addInterest(draft);
    savePrefs();
    searchingRef.current = true;
    setSearching(true);
    try {
      const id = await findMatch(profile, {
        mode,
        interests: normalizeInterests([...interests, ...draft.split(",")]),
        gender: gender === "Tous" ? undefined : gender,
        country: isPlus ? undefined : country === "Tous" ? undefined : country,
        countries: isPlus && countries.length ? countries : undefined,
        ageMin,
        ageMax,
      });
      navigation.replace("ChatRoom", { roomId: id, video: mode === "video" });
    } catch (e) {
      if (!(e instanceof Error && e.message === "Cancelled")) {
        const code = String((e as any)?.code ?? (e as any)?.message ?? "");
        if (/permission/i.test(code)) {
          Alert.alert(
            "Recherche refusée par Firebase",
            "Les règles de sécurité de Firebase ne sont pas à jour. Publie le fichier firestore.rules de la v17 (console Firebase > Firestore Database > Règles > Publier), puis réessaie.",
          );
        } else {
          Alert.alert(
            "Connexion interrompue",
            `Vérifie ta connexion internet puis réessaie.${code ? `\n(code : ${code.slice(0, 60)})` : ""}`,
          );
        }
      }
    } finally {
      searchingRef.current = false;
      setSearching(false);
    }
  }

  function handleCancel() {
    cancelFindMatch();
  }

  const status =
    seconds < 6
      ? interests.length
        ? "Recherche d'un inconnu avec tes intérêts…"
        : "Recherche d'un inconnu…"
      : seconds < 16
        ? "On élargit un peu la recherche…"
        : "Recherche partout, ça arrive…";

  return (
    <View style={s.root}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Match</Text>
            <View style={s.onlineRow}>
              <View style={s.onlineDot} />
              <Text style={s.headerSub}>
                {online === null ? "Parle à un inconnu, maintenant" : `${online} en recherche en ce moment`}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => navigation.navigate("RecentMatches")}
            hitSlop={8}
            style={s.historyBtn}
            accessibilityRole="button"
            accessibilityLabel="Rencontres récentes"
          >
            <Ionicons name="time-outline" size={22} color={colors.text} />
          </Pressable>
        </View>

        {searching ? (
          <View style={s.searchWrap}>
            <View style={s.radar}>
              <Animated.View style={[s.radarOuter, { transform: [{ scale: pulse }], opacity: pulseOpacity }]} />
              <Animated.View style={[s.radarRing, { transform: [{ rotate: spin }] }]}>
                <View style={s.radarDot} />
              </Animated.View>
              <View style={s.radarCenter}>
                <Ionicons name={mode === "video" ? "videocam" : "chatbubbles"} size={28} color={colors.neonRed} />
              </View>
            </View>
            <Text style={s.searchingTitle}>{status}</Text>
            <Text style={s.searchingSubtitle}>
              {mode === "video" ? "Chat vidéo" : "Chat texte"}
              {interests.length ? ` · ${interests.slice(0, 3).join(", ")}` : ""} · {seconds}s
            </Text>
            <Pressable onPress={handleCancel} style={s.cancelBtn} accessibilityRole="button">
              <Text style={s.cancelText}>Arrêter</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            {/* Texte ou vidéo, comme sur Omegle */}
            <View style={s.modeRow}>
              {(["text", "video"] as MatchMode[]).map((m) => (
                <Pressable
                  key={m}
                  onPress={() => setMode(m)}
                  style={[s.modeBtn, mode === m && s.modeBtnActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: mode === m }}
                >
                  <Ionicons name={m === "video" ? "videocam" : "chatbubbles"} size={22} color={mode === m ? "#fff" : colors.muted} />
                  <Text style={[s.modeTxt, mode === m && { color: "#fff" }]}>{m === "video" ? "Vidéo" : "Texte"}</Text>
                </Pressable>
              ))}
            </View>

            {/* Centres d'intérêt */}
            <Text style={s.filterLabel}>CENTRES D'INTÉRÊT (OPTIONNEL)</Text>
            <View style={s.interestBox}>
              {interests.map((t) => (
                <Pressable key={t} onPress={() => setInterests(interests.filter((x) => x !== t))} style={s.tag}>
                  <Text style={s.tagTxt}>{t}</Text>
                  <Ionicons name="close" size={14} color="#fff" />
                </Pressable>
              ))}
              <TextInput
                value={draft}
                onChangeText={(v) => (v.endsWith(",") ? addInterest(v) : setDraft(v))}
                onSubmitEditing={() => draft.trim() && addInterest(draft)}
                placeholder={interests.length ? "Ajouter…" : "ex. musique, foot, anime"}
                placeholderTextColor={colors.muted}
                style={s.interestInput}
                returnKeyType="done"
                maxLength={24}
              />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {SUGGESTED.filter((t) => !interests.includes(t)).map((t) => (
                <Pressable key={t} onPress={() => addInterest(t)} style={s.suggest}>
                  <Text style={s.suggestTxt}>+ {t}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={s.filterLabel}>GENRE</Text>
            <View style={s.chips}>
              {GENDERS.map((g) => (
                <Pressable key={g} onPress={() => setGender(g)} style={[s.chip, g === gender && s.chipActive]}>
                  <Text style={[s.chipText, g === gender && s.chipTextActive]}>{g}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={s.filterLabel}>{isPlus ? "PAYS · VIM+ : PLUSIEURS AU CHOIX" : "PAYS"}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {COUNTRIES.map((c) => {
                const on = isPlus ? (c === "Tous" ? countries.length === 0 : countries.includes(c)) : c === country;
                return (
                  <Pressable
                    key={c}
                    onPress={() => {
                      if (!isPlus) return setCountry(c);
                      if (c === "Tous") return setCountries([]);
                      setCountries((l) => (l.includes(c) ? l.filter((x) => x !== c) : [...l, c].slice(0, 10)));
                    }}
                    style={[s.chip, on && s.chipActive]}
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[s.chipText, on && s.chipTextActive]}>{c}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            {!isPlus && (
              <Pressable onPress={() => navigation.navigate("Premium")} accessibilityRole="button">
                <Text style={s.plusHint}>✦ Vim+ : choisis plusieurs pays à la fois</Text>
              </Pressable>
            )}

            {!ageKnown ? (
              <View style={s.safeNote}>
                <Ionicons name="hourglass-outline" size={18} color={colors.muted} />
                <Text style={s.safeTxt}>Chargement de ton profil…</Text>
              </View>
            ) : isMinor ? (
              <View style={s.safeNote}>
                <Ionicons name="shield-checkmark" size={18} color={colors.gold} />
                <Text style={s.safeTxt}>
                  Tu as moins de 18 ans : tu ne parles qu'avec des personnes de 16 et 17 ans.
                </Text>
              </View>
            ) : (
              <>
                <Text style={s.filterLabel}>ÂGE</Text>
                <View style={s.chips}>
                  {ADULT_MINS.map((a) => (
                    <Pressable key={`min${a}`} onPress={() => a <= ageMax && setAgeMin(a)} style={[s.chip, a === ageMin && s.chipActive]}>
                      <Text style={[s.chipText, a === ageMin && s.chipTextActive]}>{a}+</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={s.chips}>
                  {ADULT_MAXS.map((a) => (
                    <Pressable key={`max${a}`} onPress={() => a >= ageMin && setAgeMax(a)} style={[s.chip, a === ageMax && s.chipActive]}>
                      <Text style={[s.chipText, a === ageMax && s.chipTextActive]}>jusqu'à {a === 99 ? "∞" : a}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}

            {/* ⚡ Boost : 30 minutes de priorité dans les matchs (achat à l'unité) */}
            {profile &&
              (profile.isPremium ? (
                <View style={s.boostChip}>
                  <Text style={s.boostChipTxt}>🎯 Priorité Vim+ active</Text>
                </View>
              ) : boostActive(profile) ? (
                <View style={[s.boostChip, s.boostChipOn]}>
                  <Text style={s.boostChipTxt}>⚡ Boost actif · encore {boostMinutesLeft()} min</Text>
                </View>
              ) : (
                <Pressable
                  onPress={buyBoost}
                  disabled={buyingBoost}
                  style={({ pressed }) => [s.boostBtn, pressed && { opacity: 0.85 }]}
                  accessibilityRole="button"
                >
                  <Text style={s.boostBtnTxt}>
                    {buyingBoost ? "Achat en cours…" : `⚡ Booster mes matchs · 30 min${boostItem ? ` · ${boostItem.priceString}` : ""}`}
                  </Text>
                </Pressable>
              ))}
            {!profile?.isPremium && (
              <Pressable onPress={() => navigation.navigate("Premium")} style={s.adNote} accessibilityRole="button">
                <Ionicons name="megaphone-outline" size={15} color={colors.muted} />
                <Text style={s.adNoteTxt}>
                  1 pub toutes les 3 personnes passées · <Text style={{ color: colors.gold, fontWeight: "800" }}>Vim+ : sans pub</Text>
                </Text>
              </Pressable>
            )}
            <Text style={s.rules}>
              Sois respectueux. Les conversations peuvent être signalées et la nudité, le harcèlement et les
              contenus choquants entraînent un bannissement.
            </Text>
          </ScrollView>
        )}

        {!searching && (
          <View style={s.bottom}>
            <Pressable
              onPress={handleStart}
              disabled={!ageKnown}
              style={({ pressed }) => [s.matchBtn, (pressed || !ageKnown) && { opacity: ageKnown ? 0.9 : 0.5 }]}
              accessibilityRole="button"
            >
              <LinearGradient
                colors={gradients.brand as unknown as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Ionicons name={mode === "video" ? "videocam" : "flash"} size={22} color="#fff" />
              <Text style={s.matchText}>{mode === "video" ? "LANCER LE CHAT VIDÉO" : "PARLER À UN INCONNU"}</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
      <SafetyCharter
        visible={charterOpen}
        onClose={() => setCharterOpen(false)}
        onAccept={() => {
          setCharterOpen(false);
          setTimeout(() => handleStart(), 250);
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  header: { paddingTop: 54, paddingHorizontal: 20, paddingBottom: 8, flexDirection: "row", alignItems: "center" },
  headerTitle: { color: colors.text, fontSize: 28, fontWeight: "900" },
  onlineRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#28F7A1" },
  headerSub: { color: colors.muted, fontSize: 13 },
  scroll: { padding: 20, gap: 12, paddingBottom: 120 },
  modeRow: { flexDirection: "row", gap: 10 },
  modeBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 16, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  modeBtnActive: { backgroundColor: colors.neonRed, borderColor: colors.neonRed },
  modeTxt: { color: colors.muted, fontSize: 16, fontWeight: "800" },
  filterLabel: { color: colors.muted, fontSize: 10, fontWeight: "700", letterSpacing: 1.5, marginTop: 8 },
  interestBox: {
    flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center",
    padding: 10, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, minHeight: 50,
  },
  tag: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.neonRed, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  tagTxt: { color: "#fff", fontSize: 13, fontWeight: "700" },
  interestInput: { flex: 1, minWidth: 120, color: colors.text, fontSize: 15, paddingVertical: 4 },
  suggest: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  suggestTxt: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: "rgba(255,46,77,0.15)", borderColor: colors.neonRed },
  chipText: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: colors.neonRed },
  safeNote: { flexDirection: "row", gap: 10, alignItems: "center", padding: 12, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, marginTop: 8 },
  safeTxt: { color: colors.text, fontSize: 13, flex: 1, lineHeight: 18 },
  historyBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  boostBtn: {
    marginTop: 12,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: "rgba(255,194,75,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,194,75,0.5)",
  },
  boostBtnTxt: { color: colors.gold, fontSize: 13, fontWeight: "900" },
  boostChip: { marginTop: 12, alignSelf: "center", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.card },
  boostChipOn: { backgroundColor: "rgba(255,194,75,0.15)" },
  boostChipTxt: { color: colors.gold, fontSize: 13, fontWeight: "800" },
  plusHint: { color: colors.gold, fontSize: 12, fontWeight: "700", marginTop: 2 },
  adNote: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 14 },
  adNoteTxt: { color: colors.muted, fontSize: 12 },
  rules: { color: colors.mutedDark, fontSize: 11, lineHeight: 16, marginTop: 14, textAlign: "center" },
  searchWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20, paddingBottom: 40 },
  radar: { width: 150, height: 150, alignItems: "center", justifyContent: "center" },
  radarOuter: { position: "absolute", width: 150, height: 150, borderRadius: 75, borderWidth: 2, borderColor: `${colors.neonRed}45`, backgroundColor: `${colors.neonRed}08` },
  radarRing: { position: "absolute", width: 115, height: 115, borderRadius: 58, borderWidth: 2, borderColor: colors.neonRed, borderStyle: "dashed" },
  radarDot: { position: "absolute", top: 5, left: "50%", marginLeft: -4, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.neonRed },
  radarCenter: { width: 66, height: 66, borderRadius: 20, backgroundColor: "rgba(255,46,77,0.15)", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.neonRed },
  searchingTitle: { color: colors.text, fontSize: 18, fontWeight: "900", textAlign: "center", paddingHorizontal: 30 },
  searchingSubtitle: { color: colors.muted, fontSize: 13, textAlign: "center" },
  cancelBtn: { paddingHorizontal: 28, paddingVertical: 12, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: colors.border, marginTop: 8 },
  cancelText: { color: colors.text, fontSize: 14, fontWeight: "800" },
  bottom: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: colors.black },
  matchBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: colors.neonRed, borderRadius: 20, paddingVertical: 19, overflow: "hidden",
    shadowColor: colors.neonRed, shadowOpacity: 0.55, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  matchText: { color: "#fff", fontSize: 15, fontWeight: "900", letterSpacing: 1.2 },
});
