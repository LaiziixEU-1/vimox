import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db } from "../config/firebase";
import { colors } from "../theme/colors";
import { ScreenHeader } from "../components/ScreenHeader";
import { Avatar } from "../components/Avatar";
import { EmptyState } from "../components/ui";
import { useAuth } from "../services/AuthContext";
import { getUserBrief, sendFriendRequest, subscribeFriendIds } from "../services/friendService";
import { reportUser } from "../services/moderationService";

// Rencontres récentes : les dernières personnes croisées dans le chat aléatoire.
// On peut les ajouter en ami (si on les a passées trop vite) ou les signaler après coup.
type Row = { roomId: string; uid: string; at: number; name: string; photo: string | null; video: boolean };

function ago(ms: number) {
  const m = Math.floor((Date.now() - ms) / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? "hier" : `il y a ${d} jours`;
}

export function RecentMatchesScreen({ navigation }: any) {
  const { profile } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [sent, setSent] = useState<string[]>([]);
  const [reported, setReported] = useState<string[]>([]);

  useEffect(() => (profile ? subscribeFriendIds(profile.id, setFriendIds) : undefined), [profile?.id]);

  useEffect(() => {
    if (!profile) return;
    let alive = true;
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "rooms"), where("participants", "array-contains", profile.id), orderBy("createdAt", "desc"), limit(40)),
        );
        const seen = new Set<string>();
        const base: Omit<Row, "name" | "photo">[] = [];
        snap.docs.forEach((d) => {
          const x: any = d.data();
          const uid = (x.participants ?? []).find((p: string) => p !== profile.id);
          if (!uid || seen.has(uid)) return; // une seule ligne par personne (la rencontre la plus récente)
          seen.add(uid);
          const t = x.createdAt;
          base.push({
            roomId: d.id,
            uid,
            at: typeof t?.toMillis === "function" ? t.toMillis() : typeof t === "number" ? t : 0,
            video: x.mode === "video",
          });
        });
        const full = await Promise.all(
          base.slice(0, 25).map(async (r) => {
            const b = await getUserBrief(r.uid).catch(() => null);
            return { ...r, name: b?.name ?? "Utilisateur", photo: b?.photo ?? null };
          }),
        );
        if (alive) setRows(full);
      } catch {
        if (alive) setRows([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [profile?.id]);

  async function add(r: Row) {
    if (!profile) return;
    try {
      await sendFriendRequest(profile.id, profile.name, profile.profilePhotoURL, r.uid);
      setSent((l) => [...l, r.uid]);
    } catch {
      Alert.alert("Demande non envoyée", "Vérifie ta connexion et réessaie.");
    }
  }

  function report(r: Row) {
    if (!profile) return;
    Alert.alert(`Signaler ${r.name} ?`, "Notre équipe de modération examinera cette rencontre.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Signaler",
        style: "destructive",
        onPress: async () => {
          try {
            await reportUser(profile.id, r.roomId, r.uid);
            setReported((l) => [...l, r.uid]);
          } catch {
            Alert.alert("Signalement impossible", "Vérifie ta connexion et réessaie.");
          }
        },
      },
    ]);
  }

  return (
    <View style={s.root}>
      <ScreenHeader title="Rencontres récentes" onBack={() => navigation.goBack()} />
      {rows === null ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.neonRed} />
        </View>
      ) : rows.length === 0 ? (
        <EmptyState
          icon="time-outline"
          title="Aucune rencontre pour l'instant"
          text="Les personnes avec qui tu discutes dans le chat aléatoire apparaîtront ici."
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.roomId}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 60 }}
          ListHeaderComponent={
            <Text style={s.hint}>Tu as passé quelqu'un trop vite ? Ajoute-le en ami ici. Un souci ? Signale-le.</Text>
          }
          renderItem={({ item: r }) => {
            const isFriend = friendIds.includes(r.uid);
            const isSent = sent.includes(r.uid);
            const isReported = reported.includes(r.uid);
            return (
              <View style={s.row}>
                <Avatar uri={r.photo} name={r.name} size={46} />
                <View style={{ flex: 1 }}>
                  <Text style={s.name} numberOfLines={1}>{r.name}</Text>
                  <Text style={s.sub}>
                    {r.video ? "📹 Vidéo" : "💬 Texte"} · {ago(r.at)}
                  </Text>
                </View>
                {isFriend ? (
                  <Text style={s.done}>Ami ✓</Text>
                ) : isSent ? (
                  <Text style={s.done}>Envoyé ✓</Text>
                ) : (
                  <Pressable onPress={() => add(r)} style={({ pressed }) => [s.addBtn, pressed && { opacity: 0.85 }]} accessibilityRole="button">
                    <Ionicons name="person-add" size={15} color="#fff" />
                    <Text style={s.addTxt}>Ajouter</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => report(r)}
                  disabled={isReported}
                  hitSlop={8}
                  style={s.flag}
                  accessibilityRole="button"
                  accessibilityLabel={isReported ? "Déjà signalé" : `Signaler ${r.name}`}
                >
                  <Ionicons name={isReported ? "flag" : "flag-outline"} size={19} color={isReported ? colors.neonRed : colors.muted} />
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  hint: { color: colors.muted, fontSize: 13, marginBottom: 6, lineHeight: 18 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  name: { color: colors.text, fontSize: 15, fontWeight: "800" },
  sub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.neonRed,
  },
  addTxt: { color: "#fff", fontSize: 13, fontWeight: "800" },
  done: { color: colors.muted, fontSize: 13, fontWeight: "800" },
  flag: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
});
