import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors } from "../theme/colors";
import { ScreenHeader } from "../components/ScreenHeader";
import { Avatar } from "../components/Avatar";
import { SafetySheet } from "../components/SafetySheet";
import { EmptyState } from "../components/ui";
import { useAuth } from "../services/AuthContext";
import { Friend, RootStackParamList } from "../models/types";
import {
  cancelSentRequest,
  getUserBrief,
  removeFriend,
  subscribeFriends,
  subscribeSentRequestDocs,
} from "../services/friendService";
import { blockUser, reportContent } from "../services/moderationService";

type Props = NativeStackScreenProps<RootStackParamList, "ManageFriends">;
type Sent = { id: string; toUid: string; name: string; photo: string | null };

// « Gérer les amitiés » : supprimer, bloquer ou signaler un ami, annuler une demande envoyée
export function ManageFriendsScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [sent, setSent] = useState<Sent[]>([]);
  const [safetyFor, setSafetyFor] = useState<Friend | null>(null);

  useEffect(() => {
    if (!profile) return;
    const u1 = subscribeFriends(profile.id, setFriends);
    const u2 = subscribeSentRequestDocs(profile.id, async (reqs) => {
      // Le nom de chaque destinataire est lu une fois (un profil à la fois)
      const items = await Promise.all(
        reqs.map(async (r) => {
          const b = await getUserBrief(r.toUid);
          return { id: r.id, toUid: r.toUid, name: b?.name ?? "Utilisateur", photo: b?.photo ?? null };
        }),
      );
      setSent(items);
    });
    return () => {
      u1();
      u2();
    };
  }, [profile?.id]);
  if (!profile) return null;
  const me = profile.id;

  function openMenu(f: Friend) {
    Alert.alert(f.name, undefined, [
      { text: "Voir le profil", onPress: () => navigation.navigate("UserProfile", { userId: f.id }) },
      { text: "Signaler ou bloquer", onPress: () => setSafetyFor(f) },
      {
        text: "Supprimer l'ami",
        style: "destructive",
        onPress: () =>
          Alert.alert(`Retirer ${f.name} de tes amis ?`, "Vous ne pourrez plus vous écrire ni vous envoyer de Vims.", [
            { text: "Annuler", style: "cancel" },
            { text: "Supprimer", style: "destructive", onPress: () => removeFriend(me, f.id) },
          ]),
      },
      { text: "Annuler", style: "cancel" },
    ]);
  }

  const sorted = [...(friends ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <View style={s.root}>
      <ScreenHeader title="Gérer les amitiés" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <Text style={s.section}>Amis{friends ? ` · ${friends.length}` : ""}</Text>
        {friends !== null && friends.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title="Pas encore d'amis"
            text="Cherche un prénom ou un @pseudo pour en ajouter."
            actionLabel="Ajouter des amis"
            onAction={() => navigation.navigate("AddFriends")}
          />
        ) : (
          sorted.map((f) => (
            <View key={f.id} style={s.row}>
              <Pressable
                onPress={() => navigation.navigate("UserProfile", { userId: f.id })}
                style={s.rowMain}
                accessibilityRole="button"
                accessibilityLabel={`Voir le profil de ${f.name}`}
              >
                <Avatar uri={f.profilePhotoURL} name={f.name} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={s.name} numberOfLines={1}>{f.name}</Text>
                  {!!f.country && <Text style={s.sub} numberOfLines={1}>{String(f.country)}</Text>}
                </View>
              </Pressable>
              <Pressable
                onPress={() => openMenu(f)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Options pour ${f.name} : supprimer, bloquer, signaler`}
                style={s.iconBtn}
              >
                <Ionicons name="ellipsis-horizontal" size={18} color={colors.text} />
              </Pressable>
            </View>
          ))
        )}

        <Text style={s.section}>Demandes envoyées{sent.length ? ` · ${sent.length}` : ""}</Text>
        {sent.length === 0 ? (
          <Text style={s.none}>Aucune demande en attente.</Text>
        ) : (
          sent.map((r) => (
            <View key={r.id} style={s.row}>
              <View style={s.rowMain}>
                <Avatar uri={r.photo} name={r.name} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={s.name} numberOfLines={1}>{r.name}</Text>
                  <Text style={s.sub}>En attente de réponse</Text>
                </View>
              </View>
              <Pressable
                onPress={() => cancelSentRequest(r.id).catch(() => Alert.alert("Erreur", "Impossible d'annuler pour le moment."))}
                accessibilityRole="button"
                accessibilityLabel={`Annuler la demande envoyée à ${r.name}`}
                style={({ pressed }) => [s.cancel, pressed && { opacity: 0.7 }]}
              >
                <Text style={s.cancelTxt}>Annuler</Text>
              </Pressable>
            </View>
          ))
        )}
      </ScrollView>

      {safetyFor ? (
        <SafetySheet
          visible
          title={safetyFor.name}
          onClose={() => setSafetyFor(null)}
          onReport={(reason) => reportContent({ reporterId: me, reportedId: safetyFor.id, kind: "profile", reason })}
          onBlock={async () => {
            await blockUser(me, safetyFor.id);
            setSafetyFor(null);
          }}
        />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  section: { color: colors.muted, fontSize: 12, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase", marginTop: 22, marginBottom: 6, marginHorizontal: 18 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 8 },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0 },
  name: { color: colors.text, fontSize: 16, fontWeight: "700" },
  sub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: colors.card },
  cancel: { height: 34, paddingHorizontal: 14, borderRadius: 17, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  cancelTxt: { color: colors.text, fontSize: 13, fontWeight: "800" },
  none: { color: colors.muted, fontSize: 14, marginHorizontal: 18, marginTop: 4 },
});
