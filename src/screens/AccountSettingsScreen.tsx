import { useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { doc, updateDoc } from "firebase/firestore";
import { colors } from "../theme/colors";
import { RootStackParamList } from "../models/types";
import { useAuth } from "../services/AuthContext";
import { db } from "../config/firebase";

type Props = NativeStackScreenProps<RootStackParamList, "AccountSettings">;

function soon(feature: string) {
  Alert.alert(feature, "Bientôt disponible sur VimoX 🚧");
}

export function AccountSettingsScreen({ navigation }: Props) {
  const { profile, logout } = useAuth();
  const [onlineVisible, setOnlineVisible] = useState(true);
  const [notifs, setNotifs] = useState(true);
  const [notifSounds, setNotifSounds] = useState(true);
  const [notifPreview, setNotifPreview] = useState(true);
  const [locationOn, setLocationOn] = useState(false);
  const [whoCanSnap, setWhoCanSnap] = useState<"everyone" | "friends">(
    "friends",
  );
  const [whoCanSeeStory, setWhoCanSeeStory] = useState<
    "everyone" | "friends" | "custom"
  >("friends");

  const initials =
    profile?.name
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ?? "?";

  async function toggle(field: string, value: boolean) {
    if (!profile) return;
    updateDoc(doc(db, "users", profile.id), { [field]: value }).catch(() => {});
  }

  function handleDeleteAccount() {
    Alert.alert(
      "Supprimer le compte",
      "Cette action est définitive. Toutes tes données (photos, stories, amis, messages) seront perdues.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => soon("Suppression de compte"),
        },
      ],
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.back}>‹</Text>
        </Pressable>
        <Text style={s.title}>Paramètres</Text>
      </View>
      <ScrollView contentContainerStyle={s.scroll}>
        <Pressable
          style={s.profileBanner}
          onPress={() => navigation.navigate("EditProfile")}
        >
          {profile?.profilePhotoURL ? (
            <Image source={{ uri: profile.profilePhotoURL }} style={s.avatar} />
          ) : (
            <View style={s.avatarPh}>
              <Text style={s.avatarTxt}>{initials}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.profileName}>{profile?.name}</Text>
            <Text style={s.profileSub}>Voir mon profil VimoX</Text>
          </View>
          <Text style={s.arrow}>›</Text>
        </Pressable>

        <Section title="Mon compte">
          <ActionRow
            label="✏️  Nom, e-mail, numéro"
            onPress={() => navigation.navigate("EditProfile")}
          />
          <ActionRow
            label="🔑  Changer le mot de passe"
            onPress={() => soon("Changement de mot de passe")}
          />
          <ActionRow
            label="🛡️  Authentification à deux facteurs"
            onPress={() => soon("Double authentification")}
          />
        </Section>

        <Section title="Confidentialité">
          <ChoiceRow
            label="Qui peut m'envoyer des Snaps"
            value={whoCanSnap === "everyone" ? "Tout le monde" : "Mes amis"}
            onPress={() =>
              setWhoCanSnap((v) => (v === "everyone" ? "friends" : "everyone"))
            }
          />
          <ChoiceRow
            label="Qui peut voir ma Story"
            value={
              whoCanSeeStory === "everyone"
                ? "Tout le monde"
                : whoCanSeeStory === "friends"
                  ? "Mes amis"
                  : "Personnalisé"
            }
            onPress={() =>
              setWhoCanSeeStory((v) =>
                v === "everyone"
                  ? "friends"
                  : v === "friends"
                    ? "custom"
                    : "everyone",
              )
            }
          />
          <ToggleRow
            label="Afficher que je suis en ligne"
            value={onlineVisible}
            onToggle={(v) => {
              setOnlineVisible(v);
              toggle("showOnlineStatus", v);
            }}
          />
          <ToggleRow
            label="Partager ma position (VimoX Map)"
            value={locationOn}
            onToggle={(v) => {
              setLocationOn(v);
              toggle("shareLocation", v);
            }}
          />
          <ActionRow
            label="🚫  Utilisateurs bloqués"
            onPress={() => soon("Liste des bloqués")}
          />
        </Section>

        <Section title="Notifications">
          <ToggleRow
            label="Notifications push"
            value={notifs}
            onToggle={setNotifs}
          />
          <ToggleRow
            label="Sons"
            value={notifSounds}
            onToggle={setNotifSounds}
          />
          <ToggleRow
            label="Aperçu des messages"
            value={notifPreview}
            onToggle={setNotifPreview}
          />
        </Section>

        <Section title="Assistance">
          <ActionRow
            label="🐞  Signaler un problème"
            onPress={() => soon("Signalement")}
          />
          <ActionRow
            label="💬  Contacter le support"
            onPress={() => soon("Support")}
          />
        </Section>

        <Section title="Application">
          <ActionRow
            label="⭐  Passer Premium"
            onPress={() => navigation.navigate("Premium")}
            accent
          />
          <ActionRow
            label="📋  Conditions d'utilisation"
            onPress={() => navigation.navigate("Legal", { type: "cgu" })}
          />
          <ActionRow
            label="🔏  Confidentialité"
            onPress={() => navigation.navigate("Legal", { type: "privacy" })}
          />
          <View style={sec.row}>
            <Text style={[sec.rowLabel, { flex: 1 }]}>Version</Text>
            <Text style={s.versionTxt}>VimoX 1.0.0</Text>
          </View>
        </Section>

        <Pressable
          onPress={() =>
            Alert.alert("Déconnexion", "Tu vas être déconnecté.", [
              { text: "Annuler", style: "cancel" },
              {
                text: "Se déconnecter",
                style: "destructive",
                onPress: () => logout(),
              },
            ])
          }
          style={s.logoutBtn}
        >
          <Text style={s.logoutTxt}>🚪 Se déconnecter</Text>
        </Pressable>

        <Pressable onPress={handleDeleteAccount} style={s.deleteBtn}>
          <Text style={s.deleteTxt}>🗑️ Supprimer mon compte</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={sec.wrap}>
      <Text style={sec.title}>{title}</Text>
      <View style={sec.content}>{children}</View>
    </View>
  );
}
function ActionRow({
  label,
  onPress,
  accent = false,
}: {
  label: string;
  onPress: () => void;
  accent?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        sec.row,
        accent && sec.accent,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={[sec.rowLabel, accent && { color: colors.neonRed }]}>
        {label}
      </Text>
      <Text style={sec.arrow}>›</Text>
    </Pressable>
  );
}
function ChoiceRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [sec.row, pressed && { opacity: 0.85 }]}
    >
      <Text style={[sec.rowLabel, { flex: 1 }]}>{label}</Text>
      <Text style={sec.choiceValue}>{value}</Text>
      <Text style={sec.arrow}>›</Text>
    </Pressable>
  );
}
function ToggleRow({
  label,
  value,
  onToggle,
}: {
  label: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <View style={sec.row}>
      <Text style={[sec.rowLabel, { flex: 1 }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.border, true: `${colors.neonRed}55` }}
        thumbColor={value ? colors.neonRed : "#555"}
      />
    </View>
  );
}
const sec = StyleSheet.create({
  wrap: { marginBottom: 20 },
  title: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  content: { gap: 2 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accent: {
    borderColor: "rgba(232,0,10,0.2)",
    backgroundColor: "rgba(232,0,10,0.04)",
  },
  rowLabel: { color: colors.text, fontSize: 14, fontWeight: "600" },
  choiceValue: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  arrow: { color: colors.muted, fontSize: 20 },
});
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  header: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  back: { color: colors.text, fontSize: 28, fontWeight: "300" },
  title: { color: colors.text, fontSize: 20, fontWeight: "900" },
  scroll: { padding: 20, paddingBottom: 40 },
  profileBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarPh: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(232,0,10,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.neonRed,
  },
  avatarTxt: { color: colors.neonRed, fontWeight: "900", fontSize: 18 },
  profileName: { color: colors.text, fontSize: 16, fontWeight: "800" },
  profileSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  arrow: { color: colors.muted, fontSize: 22 },
  versionTxt: { color: colors.muted, fontSize: 13 },
  logoutBtn: {
    backgroundColor: "rgba(232,0,10,0.08)",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(232,0,10,0.2)",
    marginTop: 10,
  },
  logoutTxt: { color: colors.neonRed, fontWeight: "700", fontSize: 14 },
  deleteBtn: {
    alignItems: "center",
    paddingVertical: 14,
    marginTop: 8,
  },
  deleteTxt: { color: colors.muted, fontWeight: "600", fontSize: 13 },
});
