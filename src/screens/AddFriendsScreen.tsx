/*VIMOX-V17*/
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors } from "../theme/colors";
import { ScreenHeader } from "../components/ScreenHeader";
import { useAuth } from "../services/AuthContext";
import { canUseMatch } from "../services/ageGate";
import { pagerBus } from "../navigation/pagerBus";
import { scanBus } from "../services/scanBus";
import { FriendRequest, RootStackParamList } from "../models/types";
import {
  acceptFriendRequest,
  declineFriendRequest,
  sendFriendRequest,
  subscribeFriendIds,
  subscribeFriendRequests,
  subscribeSentRequests,
} from "../services/friendService";
import {
  MIN_QUERY,
  PersonResult,
  Suggestion,
  dismissSuggestion,
  isAdult,
  loadSuggestions,
  normalizeName,
  searchPeople,
} from "../services/searchService";

type Props = NativeStackScreenProps<RootStackParamList, "AddFriends">;

const REQUESTS_SHOWN = 3;

function Avatar({ uri, name, size = 46 }: { uri?: string | null; name?: string; size?: number }) {
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.neonRedBg,
        borderWidth: 1,
        borderColor: colors.neonRed,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: colors.neonRedText, fontWeight: "800", fontSize: size * 0.4 }}>
        {name?.[0]?.toUpperCase() ?? "?"}
      </Text>
    </View>
  );
}

type RowState = "add" | "sent" | "friend" | "accept";

function PersonRow({
  person,
  subtitle,
  state,
  onOpen,
  onAdd,
  onAccept,
  onDismiss,
}: {
  person: { id: string; name: string; photo?: string | null };
  subtitle?: string;
  state: RowState;
  onOpen: () => void;
  onAdd?: () => void;
  onAccept?: () => void;
  onDismiss?: () => void;
}) {
  return (
    <View style={s.row}>
      <Pressable
        onPress={onOpen}
        style={s.rowMain}
        accessibilityRole="button"
        accessibilityLabel={`Voir le profil de ${person.name}`}
      >
        <Avatar uri={person.photo} name={person.name} />
        <View style={s.rowInfo}>
          <Text style={s.rowName} numberOfLines={1}>
            {person.name}
          </Text>
          {!!subtitle && (
            <Text style={s.rowSub} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
      </Pressable>
      {state === "add" && (
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel={`Ajouter ${person.name}`}
          style={({ pressed }) => [s.pill, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="person-add" size={15} color="#fff" />
          <Text style={s.pillTxt}>Ajouter</Text>
        </Pressable>
      )}
      {state === "accept" && (
        <Pressable
          onPress={onAccept}
          accessibilityRole="button"
          accessibilityLabel={`Accepter ${person.name}`}
          style={({ pressed }) => [s.pill, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="checkmark" size={16} color="#fff" />
          <Text style={s.pillTxt}>Accepter</Text>
        </Pressable>
      )}
      {state === "sent" && (
        <View style={[s.pill, s.pillGhost]} accessibilityLabel={`Demande envoyée à ${person.name}`}>
          <Ionicons name="time-outline" size={15} color={colors.muted} />
          <Text style={[s.pillTxt, { color: colors.muted }]}>Envoyée</Text>
        </View>
      )}
      {state === "friend" && (
        <View style={[s.pill, s.pillGhost]} accessibilityLabel={`${person.name} est déjà ton ami`}>
          <Ionicons name="checkmark" size={15} color={colors.muted} />
          <Text style={[s.pillTxt, { color: colors.muted }]}>Amis</Text>
        </View>
      )}
      {!!onDismiss && (
        <Pressable
          onPress={onDismiss}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Retirer la suggestion ${person.name}`}
          style={s.dismiss}
        >
          <Ionicons name="close" size={18} color={colors.muted} />
        </Pressable>
      )}
    </View>
  );
}

export function AddFriendsScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const [friendList, setFriendList] = useState<string[] | null>(null);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [sentTo, setSentTo] = useState<string[] | null>(null);
  const [justSent, setJustSent] = useState<Record<string, boolean>>({});
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [showAllReq, setShowAllReq] = useState(false);

  const [text, setText] = useState("");
  const [results, setResults] = useState<PersonResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const searchSeq = useRef(0);

  const [sugg, setSugg] = useState<{ metBefore: Suggestion[]; nearby: Suggestion[] } | null>(null);
  const [suggError, setSuggError] = useState(false);

  const friendIds = useMemo(() => new Set(friendList ?? []), [friendList]);
  const pendingIds = useMemo(() => new Set(sentTo ?? []), [sentTo]);
  const incoming = useMemo(() => new Map(requests.map((r) => [r.fromUid, r])), [requests]);

  // ── Abonnements : mes amis, les demandes reçues, les demandes que j'ai envoyées ──
  useEffect(() => {
    if (!profile) return;
    const u1 = subscribeFriendIds(profile.id, setFriendList);
    const u2 = subscribeFriendRequests(profile.id, setRequests);
    const u3 = subscribeSentRequests(profile.id, setSentTo);
    return () => {
      u1();
      u2();
      u3();
    };
  }, [profile?.id]);

  // ── Suggestions (une fois que l'on connaît mes amis et mes demandes en cours) ──
  const ready = friendList !== null && sentTo !== null;
  useEffect(() => {
    if (!profile || !ready) return;
    let alive = true;
    loadSuggestions(profile, { friendIds, pendingIds })
      .then((r) => {
        if (alive) setSugg(r);
      })
      .catch(() => {
        if (alive) {
          setSuggError(true);
          setSugg({ metBefore: [], nearby: [] });
        }
      });
    return () => {
      alive = false;
    };
  }, [profile?.id, ready]);

  // ── Recherche par prénom (après une courte pause de frappe) ──
  const query = normalizeName(text);
  useEffect(() => {
    if (!profile) return;
    if (query.length < MIN_QUERY) {
      setResults([]);
      setSearching(false);
      setSearchError(false);
      return;
    }
    setSearching(true);
    const seq = ++searchSeq.current;
    const timer = setTimeout(async () => {
      try {
        const r = await searchPeople(text, profile, profile.blockedUserIds ?? []);
        if (seq !== searchSeq.current) return; // une frappe plus récente a pris le relais
        setResults(r);
        setSearchError(false);
      } catch {
        if (seq !== searchSeq.current) return;
        setResults([]);
        setSearchError(true);
      } finally {
        if (seq === searchSeq.current) setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query, profile?.id]);

  if (!profile) return null;
  const me = profile;

  function stateOf(id: string): RowState {
    if (friendIds.has(id)) return "friend";
    if (incoming.has(id)) return "accept";
    if (pendingIds.has(id) || justSent[id]) return "sent";
    return "add";
  }

  async function handleAdd(p: { id: string; name: string }) {
    Haptics.selectionAsync().catch(() => {});
    setJustSent((m) => ({ ...m, [p.id]: true }));
    try {
      await sendFriendRequest(me.id, me.name, me.profilePhotoURL, p.id);
    } catch {
      setJustSent((m) => ({ ...m, [p.id]: false }));
      Alert.alert(
        "Demande impossible",
        "Tu ne peux pas ajouter cette personne : pour la sécurité de tous, les moins de 18 ans et les adultes ne peuvent pas être amis. Si ce n'est pas le cas, vérifie ta connexion et réessaie.",
      );
    }
  }

  async function handleAccept(req: FriendRequest) {
    try {
      await acceptFriendRequest(req.id, req.fromUid, me.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert("Ami ajouté !", `${req.fromName} est maintenant ton ami.`);
    } catch {
      Alert.alert("Erreur", "Impossible d'accepter pour le moment.");
    }
  }

  async function handleDecline(req: FriendRequest) {
    try {
      await declineFriendRequest(req.id);
    } catch {}
  }

  function handleDismiss(sg: Suggestion) {
    Haptics.selectionAsync().catch(() => {});
    setHidden((m) => ({ ...m, [sg.id]: true }));
    dismissSuggestion(me.id, sg.id).catch(() => {});
  }

  const openProfile = (id: string) => navigation.navigate("UserProfile", { userId: id });
  const invite = () => navigation.navigate("ShareProfile");

  // ── Listes à afficher ──
  const visibleReq = showAllReq ? requests : requests.slice(0, REQUESTS_SHOWN);
  const suggestions: Suggestion[] = sugg
    ? [...sugg.metBefore, ...sugg.nearby].filter(
        (x) => !hidden[x.id] && !friendIds.has(x.id) && !incoming.has(x.id),
      )
    : [];
  const typing = text.trim().length > 0;
  const tooShort = typing && query.length < MIN_QUERY;
  const minor = !isAdult(me.age);

  return (
    <View style={s.root}>
      <ScreenHeader title="Ajouter des amis" onBack={() => navigation.goBack()} />

      <View style={s.searchWrap}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Rechercher un prénom ou @pseudo…"
          placeholderTextColor={colors.muted}
          style={s.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel="Rechercher une personne par son prénom"
        />
        {text.length > 0 && (
          <Pressable
            onPress={() => setText("")}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Effacer la recherche"
          >
            <Ionicons name="close-circle" size={18} color={colors.muted} />
          </Pressable>
        )}
      </View>

      {!typing && (
        <View style={s.quickRow}>
          <Pressable
            onPress={() => {
              navigation.goBack();
              setTimeout(() => {
                pagerBus.go("Camera");
                scanBus.request();
              }, 250);
            }}
            style={({ pressed }) => [s.quickBtn, pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
          >
            <Ionicons name="scan-outline" size={18} color={colors.text} />
            <Text style={s.quickTxt}>Scanner un code QR</Text>
          </Pressable>
          <Pressable
            onPress={invite}
            style={({ pressed }) => [s.quickBtn, pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
          >
            <Ionicons name="qr-code-outline" size={18} color={colors.text} />
            <Text style={s.quickTxt}>Mon code QR</Text>
          </Pressable>
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 60 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {typing ? (
          // ───────── Résultats de recherche ─────────
          <View>
            {tooShort ? (
              <Text style={s.hint}>Tape au moins {MIN_QUERY} lettres du prénom.</Text>
            ) : searching ? (
              <View style={s.loadingBox}>
                <ActivityIndicator color={colors.neonRed} />
                <Text style={s.hint}>Recherche…</Text>
              </View>
            ) : searchError ? (
              <View style={s.emptyBox}>
                <Ionicons name="cloud-offline-outline" size={44} color={colors.mutedDark} />
                <Text style={s.emptyTitle}>Recherche indisponible</Text>
                <Text style={s.emptyText}>Vérifie ta connexion et réessaie.</Text>
              </View>
            ) : results.length === 0 ? (
              <View style={s.emptyBox}>
                <Ionicons name="search" size={44} color={colors.mutedDark} />
                <Text style={s.emptyTitle}>Aucun résultat pour « {text.trim()} »</Text>
                <Text style={s.emptyText}>
                  Seules les personnes qui ont activé la recherche apparaissent.
                  {minor ? " Comme tu as moins de 18 ans, tu ne vois que des personnes de ton âge." : ""}
                  {" "}Tu peux aussi leur envoyer ton lien de profil.
                </Text>
                <Pressable onPress={invite} style={({ pressed }) => [s.linkBtn, pressed && { opacity: 0.7 }]}>
                  <Text style={s.linkBtnTxt}>Partager mon profil</Text>
                </Pressable>
              </View>
            ) : (
              <View>
                <Text style={s.section}>Résultats</Text>
                {results.map((p) => (
                  <PersonRow
                    key={p.id}
                    person={p}
                    subtitle={[p.username ? `@${p.username}` : "", p.country].filter(Boolean).join(" · ") || undefined}
                    state={stateOf(p.id)}
                    onOpen={() => openProfile(p.id)}
                    onAdd={() => handleAdd(p)}
                    onAccept={() => {
                      const req = incoming.get(p.id);
                      if (req) handleAccept(req);
                    }}
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          // ───────── Écran principal : invitation, demandes reçues, suggestions ─────────
          <View>
            <Pressable
              onPress={invite}
              accessibilityRole="button"
              accessibilityLabel="Inviter tes amis en partageant ton profil"
              style={({ pressed }) => [s.inviteCard, pressed && { opacity: 0.85 }]}
            >
              <View style={s.inviteIcon}>
                <Ionicons name="share-social" size={20} color={colors.neonRedText} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.inviteTitle}>Inviter tes amis</Text>
                <Text style={s.inviteSub}>Partage ton profil par lien ou code</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>

            {requests.length > 0 && (
              <View>
                <Text style={s.section}>Ils t'ont ajouté · {requests.length}</Text>
                {visibleReq.map((req) => (
                  <View key={req.id} style={s.row}>
                    <Pressable
                      onPress={() => openProfile(req.fromUid)}
                      style={s.rowMain}
                      accessibilityRole="button"
                      accessibilityLabel={`Voir le profil de ${req.fromName}`}
                    >
                      <Avatar uri={req.fromPhoto} name={req.fromName} />
                      <View style={s.rowInfo}>
                        <Text style={s.rowName} numberOfLines={1}>
                          {req.fromName}
                        </Text>
                        <Text style={s.rowSub}>Veut être ton ami</Text>
                      </View>
                    </Pressable>
                    <Pressable
                      onPress={() => handleAccept(req)}
                      accessibilityRole="button"
                      accessibilityLabel={`Accepter ${req.fromName}`}
                      style={({ pressed }) => [s.pill, pressed && { opacity: 0.8 }]}
                    >
                      <Ionicons name="checkmark" size={16} color="#fff" />
                      <Text style={s.pillTxt}>Accepter</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleDecline(req)}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={`Refuser ${req.fromName}`}
                      style={s.dismiss}
                    >
                      <Ionicons name="close" size={18} color={colors.muted} />
                    </Pressable>
                  </View>
                ))}
                {requests.length > REQUESTS_SHOWN && (
                  <Pressable onPress={() => setShowAllReq((v) => !v)} style={s.moreBtn}>
                    <Text style={s.moreTxt}>
                      {showAllReq ? "Voir moins" : `Voir ${requests.length - REQUESTS_SHOWN} autres`}
                    </Text>
                  </Pressable>
                )}
              </View>
            )}

            <Text style={s.section}>Trouver des amis</Text>
            {sugg === null ? (
              <View style={s.loadingBox}>
                <ActivityIndicator color={colors.neonRed} />
              </View>
            ) : suggestions.length === 0 ? (
              <View style={s.emptyBox}>
                <Ionicons name="people-outline" size={44} color={colors.mutedDark} />
                <Text style={s.emptyTitle}>
                  {suggError ? "Suggestions indisponibles" : "Pas de suggestion pour le moment"}
                </Text>
                <Text style={s.emptyText}>
                  {suggError
                    ? "Vérifie ta connexion et réessaie plus tard."
                    : canUseMatch(profile)
                      ? "Fais des matchs : les personnes rencontrées apparaîtront ici. Tu peux aussi chercher un prénom ci-dessus."
                      : "Cherche un prénom ou un pseudo ci-dessus, ou scanne le code QR d'un ami."}
                </Text>
              </View>
            ) : (
              suggestions.map((sg) => (
                <PersonRow
                  key={sg.id}
                  person={sg}
                  subtitle={[
                    sg.username ? `@${sg.username}` : "",
                    sg.reason === "met" ? "Rencontré·e en match" : sg.country ? `Près de toi · ${sg.country}` : "Suggestion",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  state={stateOf(sg.id)}
                  onOpen={() => openProfile(sg.id)}
                  onAdd={() => handleAdd(sg)}
                  onDismiss={() => handleDismiss(sg)}
                />
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  quickRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingBottom: 6 },
  quickBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickTxt: { color: colors.text, fontSize: 13, fontWeight: "800" },
  root: { flex: 1, backgroundColor: colors.black },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 6,
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: 0 },
  section: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 22,
    marginBottom: 6,
    marginHorizontal: 18,
  },
  inviteCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inviteIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neonRedBg,
    alignItems: "center",
    justifyContent: "center",
  },
  inviteTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  inviteSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0 },
  rowInfo: { flex: 1, minWidth: 0 },
  rowName: { color: colors.text, fontSize: 16, fontWeight: "700" },
  rowSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: colors.neonRed,
  },
  pillGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.border },
  pillTxt: { color: "#fff", fontSize: 14, fontWeight: "800" },
  dismiss: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  moreBtn: { alignItems: "center", paddingVertical: 12 },
  moreTxt: { color: colors.gold, fontSize: 14, fontWeight: "700" },
  hint: { color: colors.muted, fontSize: 14, textAlign: "center", marginTop: 24, marginHorizontal: 30 },
  loadingBox: { alignItems: "center", gap: 10, paddingVertical: 30 },
  emptyBox: { alignItems: "center", gap: 8, paddingVertical: 34, paddingHorizontal: 34 },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "800", textAlign: "center", marginTop: 6 },
  emptyText: { color: colors.muted, fontSize: 13, textAlign: "center", lineHeight: 19 },
  linkBtn: { marginTop: 10, paddingVertical: 8, paddingHorizontal: 14 },
  linkBtnTxt: { color: colors.gold, fontSize: 14, fontWeight: "800", textDecorationLine: "underline" },
});
