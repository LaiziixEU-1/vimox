import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
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
import { findMatch, cancelSearch } from "../services/matchService";

type Props = NativeStackScreenProps<RootStackParamList, "Matching">;
const GENDERS = ["Tous", "Homme", "Femme", "Non-binaire"];
const COUNTRIES = [
  "Tous",
  "France",
  "Belgique",
  "Suisse",
  "Canada",
  "Maroc",
  "Tunisie",
  "Algérie",
  "Autres",
];
const AGE_MINS = [16, 18, 21, 25, 30, 40];
const AGE_MAXS = [25, 30, 40, 50, 60, 99];

export function MatchingScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const [gender, setGender] = useState("Tous");
  const [country, setCountry] = useState("Tous");
  const [ageMin, setAgeMin] = useState(16);
  const [ageMax, setAgeMax] = useState(99);
  const [searching, setSearching] = useState(false);
  const [ellipsis, setEllipsis] = useState(".");
  const roomRef = useRef<string | null>(null);

  const pulse = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.8)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const formOpacity = useRef(new Animated.Value(1)).current;
  const formY = useRef(new Animated.Value(0)).current;
  const searchOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!searching) return;
    const interval = setInterval(
      () => setEllipsis((e) => (e.length >= 3 ? "." : e + ".")),
      500,
    );
    const pulseAnim = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulse, {
            toValue: 1.2,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.2,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(pulse, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.8,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    const rotateAnim = Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 4000,
        useNativeDriver: true,
      }),
    );
    pulseAnim.start();
    rotateAnim.start();
    return () => {
      clearInterval(interval);
      pulseAnim.stop();
      rotateAnim.stop();
    };
  }, [searching]);

  const spin = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  function showSearch() {
    setSearching(true);
    Animated.parallel([
      Animated.timing(formOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(formY, {
        toValue: -20,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(searchOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();
  }

  function hideSearch() {
    setSearching(false);
    Animated.parallel([
      Animated.timing(formOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(formY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(searchOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }

  async function handleStart() {
    if (!profile) return;
    showSearch();
    try {
      const filters = {
        gender: gender === "Tous" ? undefined : gender,
        country: country === "Tous" ? undefined : country,
        ageMin,
        ageMax,
      };
      const id = await findMatch(profile, filters);
      roomRef.current = id;
      navigation.replace("ChatRoom", { roomId: id });
    } catch {
      hideSearch();
      Alert.alert("Aucun partenaire 😔", "Réessaie dans quelques secondes !");
    }
  }

  function handleCancel() {
    if (roomRef.current) cancelSearch(roomRef.current).catch(() => {});
    hideSearch();
  }

  return (
    <View style={s.root}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.headerTitle}>Match</Text>
            <Text style={s.headerSub}>Trouve un inconnu · maintenant</Text>
          </View>
          <Pressable
            onPress={() => navigation.navigate("Profile")}
            style={s.profileBtn}
          >
            <Text style={s.profileBtnTxt}>👤</Text>
          </Pressable>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll}>
          <Animated.View
            style={[
              s.filtersWrap,
              { opacity: formOpacity, transform: [{ translateY: formY }] },
            ]}
            pointerEvents={searching ? "none" : "auto"}
          >
            <Text style={s.sectionTitle}>Filtres de match</Text>

            <Text style={s.filterLabel}>Genre</Text>
            <View style={s.chips}>
              {GENDERS.map((g) => (
                <Pressable
                  key={g}
                  onPress={() => setGender(g)}
                  style={[s.chip, g === gender && s.chipActive]}
                >
                  <Text style={[s.chipText, g === gender && s.chipTextActive]}>
                    {g}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={s.filterLabel}>Pays</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginHorizontal: -20 }}
              contentContainerStyle={{ paddingHorizontal: 20 }}
            >
              <View style={s.chips}>
                {COUNTRIES.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setCountry(c)}
                    style={[s.chip, c === country && s.chipActive]}
                  >
                    <Text
                      style={[s.chipText, c === country && s.chipTextActive]}
                    >
                      {c}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Text style={s.filterLabel}>Âge minimum</Text>
            <View style={s.chips}>
              {AGE_MINS.map((a) => (
                <Pressable
                  key={a}
                  onPress={() => {
                    if (a <= ageMax) setAgeMin(a);
                  }}
                  style={[s.chip, a === ageMin && s.chipActive]}
                >
                  <Text style={[s.chipText, a === ageMin && s.chipTextActive]}>
                    {a}+
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={s.filterLabel}>Âge maximum</Text>
            <View style={s.chips}>
              {AGE_MAXS.map((a) => (
                <Pressable
                  key={a}
                  onPress={() => {
                    if (a >= ageMin) setAgeMax(a);
                  }}
                  style={[s.chip, a === ageMax && s.chipActive]}
                >
                  <Text style={[s.chipText, a === ageMax && s.chipTextActive]}>
                    {a === 99 ? "∞" : a}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>

          <Animated.View
            style={[s.searchWrap, { opacity: searchOpacity }]}
            pointerEvents={searching ? "auto" : "none"}
          >
            <View style={s.radar}>
              <Animated.View
                style={[
                  s.radarOuter,
                  { transform: [{ scale: pulse }], opacity: pulseOpacity },
                ]}
              />
              <Animated.View
                style={[s.radarRing, { transform: [{ rotate: spin }] }]}
              >
                <View style={s.radarDot} />
              </Animated.View>
              <View style={s.radarCenter}>
                <Text style={s.radarIcon}>⚡</Text>
              </View>
            </View>
            <Text style={s.searchingTitle}>Recherche en cours{ellipsis}</Text>
            <Text style={s.searchingSubtitle}>
              Connexion mondiale · filtres appliqués
            </Text>
            <Pressable onPress={handleCancel} style={s.cancelBtn}>
              <Text style={s.cancelText}>Annuler la recherche</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>

        {!searching && (
          <View style={s.bottom}>
            <Pressable
              onPress={handleStart}
              style={({ pressed }) => [s.matchBtn, pressed && { opacity: 0.9 }]}
            >
              <Text style={s.matchIcon}>⚡</Text>
              <Text style={s.matchText}>TROUVER UN MATCH</Text>
            </Pressable>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  header: {
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { color: colors.text, fontSize: 28, fontWeight: "900" },
  headerSub: { color: colors.muted, fontSize: 13, marginTop: 2 },
  profileBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  profileBtnTxt: { fontSize: 22 },
  scroll: { padding: 20, gap: 20, paddingBottom: 160 },
  filtersWrap: { gap: 12 },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  filterLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginTop: 4,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: "rgba(232,0,10,0.15)",
    borderColor: colors.neonRed,
  },
  chipText: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  chipTextActive: { color: colors.neonRed },
  searchWrap: { alignItems: "center", gap: 22, paddingTop: 40 },
  radar: {
    width: 150,
    height: 150,
    alignItems: "center",
    justifyContent: "center",
  },
  radarOuter: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 2,
    borderColor: `${colors.neonRed}45`,
    backgroundColor: `${colors.neonRed}08`,
  },
  radarRing: {
    position: "absolute",
    width: 115,
    height: 115,
    borderRadius: 58,
    borderWidth: 2,
    borderColor: colors.neonRed,
    borderStyle: "dashed",
  },
  radarDot: {
    position: "absolute",
    top: 5,
    left: "50%",
    marginLeft: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.neonRed,
  },
  radarCenter: {
    width: 66,
    height: 66,
    borderRadius: 20,
    backgroundColor: "rgba(232,0,10,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.neonRed,
  },
  radarIcon: { fontSize: 28 },
  searchingTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  searchingSubtitle: { color: colors.muted, fontSize: 13, textAlign: "center" },
  cancelBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 8,
  },
  cancelText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  bottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    gap: 10,
    backgroundColor: colors.black,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  matchBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.neonRed,
    borderRadius: 16,
    paddingVertical: 18,
    shadowColor: colors.neonRed,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  matchIcon: { fontSize: 22 },
  matchText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
});
