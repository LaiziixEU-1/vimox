import { useEffect, useState } from "react";
import { adPrivacyAvailable, openAdPrivacyOptions } from "../services/adService";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { colors } from "../theme/colors";
import { ScreenHeader } from "../components/ScreenHeader";
import { LEGAL, hasSupportEmail } from "../config/legal";
import { buildDataExport } from "../services/exportService";
import { isDiscoverable } from "../services/searchService";
import { RootStackParamList } from "../models/types";
import { useAuth } from "../services/AuthContext";
import { db } from "../config/firebase";
import {
  changePassword,
  deleteAccount,
  enableSecureSession,
  getSecureError,
  friendlyAuthError,
} from "../services/authService";
import { sendSupportRequest, unblockUser } from "../services/moderationService";
import { registerPushToken } from "../services/notificationService";

type Props = NativeStackScreenProps<RootStackParamList, "AccountSettings">;
type ModalKind = null | "password" | "blocked" | "support" | "bug" | "delete" | "secure";

interface BlockedUser {
  id: string;
  name: string;
  photo?: string | null;
}

export function AccountSettingsScreen({ navigation }: Props) {
  const { profile, logout, secure } = useAuth();
  const [modal, setModal] = useState<ModalKind>(null);

  // Formulaires
  const [curPwd, setCurPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [newPwd2, setNewPwd2] = useState("");
  const [delPwd, setDelPwd] = useState("");
  const [securePwd, setSecurePwd] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Utilisateurs bloqués
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);

  // Réglages lus depuis le profil (ils sont enregistrés, ils survivent au redémarrage)
  const showOnline = profile?.showOnlineStatus !== false;
  const discoverable = profile ? isDiscoverable(profile) : true;
  const notifPush = profile?.notifPush !== false;
  const notifSounds = profile?.notifSounds !== false;
  const notifPreview = profile?.notifPreview !== false;

  const initials =
    profile?.name
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ?? "?";

  async function saveSetting(field: string, value: boolean) {
    if (!profile) return;
    try {
      await updateDoc(doc(db, "users", profile.id), { [field]: value });
    } catch {
      Alert.alert("Erreur", "Impossible d'enregistrer ce réglage.");
    }
  }

  async function togglePush(value: boolean) {
    if (value && profile) await registerPushToken(profile.id); // demande l'autorisation
    saveSetting("notifPush", value);
  }

  function openModal(kind: Exclude<ModalKind, null>) {
    setFormError(null);
    setBusy(false);
    setCurPwd("");
    setNewPwd("");
    setNewPwd2("");
    setDelPwd("");
    setSecurePwd("");
    setMessage("");
    setModal(kind);
  }
  function closeModal() {
    if (busy) return;
    setModal(null);
  }

  // ── Télécharger mes données (droit d'accès) ──
  async function exportData() {
    if (!profile || exporting) return;
    setExporting(true);
    try {
      const { text, resume } = await buildDataExport(profile.id);
      Alert.alert(
        "Tes données sont prêtes",
        `${resume.amis} ami(s), ${resume.stories} story(s), ${resume.messagesEnvoyes} message(s) envoyé(s). Choisis où les envoyer (Fichiers, e-mail…).`,
        [
          { text: "Annuler", style: "cancel" },
          { text: "Partager", onPress: () => Share.share({ title: "Mes données VimoX", message: text }).catch(() => {}) },
        ],
      );
    } catch {
      Alert.alert("Export impossible", "Vérifie ta connexion et réessaie.");
    } finally {
      setExporting(false);
    }
  }

  // ── Utilisateurs bloqués ──
  useEffect(() => {
    if (modal !== "blocked" || !profile) return;
    let cancelled = false;
    setBlockedLoading(true);
    const ids = (profile.blockedUserIds ?? []).slice(0, 100);
    Promise.all(
      ids.map(async (id) => {
        try {
          const snap = await getDoc(doc(db, "users", id));
          const d: any = snap.data();
          return { id, name: d?.name ?? "Utilisateur supprimé", photo: d?.profilePhotoURL ?? null };
        } catch {
          return { id, name: "Utilisateur", photo: null };
        }
      }),
    ).then((list) => {
      if (cancelled) return;
      setBlocked(list);
      setBlockedLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [modal]);

  async function handleUnblock(u: BlockedUser) {
    if (!profile) return;
    try {
      await unblockUser(profile.id, u.id);
      setBlocked((list) => list.filter((x) => x.id !== u.id));
      Haptics.selectionAsync().catch(() => {});
    } catch {
      Alert.alert("Erreur", "Impossible de débloquer cet utilisateur.");
    }
  }

  // ── Mot de passe ──
  async function submitPassword() {
    setFormError(null);
    if (!curPwd) return setFormError("Entre ton mot de passe actuel.");
    if (newPwd.length < 6) return setFormError("Le nouveau mot de passe doit faire au moins 6 caractères.");
    if (newPwd !== newPwd2) return setFormError("Les deux nouveaux mots de passe sont différents.");
    setBusy(true);
    try {
      await changePassword(curPwd, newPwd);
      setBusy(false);
      setModal(null);
      Alert.alert("Mot de passe modifié", "Ton nouveau mot de passe est actif.");
    } catch (e) {
      setBusy(false);
      setFormError(friendlyAuthError(e));
    }
  }

  // ── Support / signalement ──
  async function submitSupport(kind: "bug" | "support") {
    setFormError(null);
    if (message.trim().length < 10) return setFormError("Décris ton message en quelques mots (10 caractères minimum).");
    if (!profile) return;
    setBusy(true);
    try {
      await sendSupportRequest({
        userId: profile.id,
        userName: profile.name,
        email: profile.email,
        type: kind,
        message,
      });
      setBusy(false);
      setModal(null);
      Alert.alert("Merci !", "Ton message a bien été envoyé à l'équipe VimoX.");
    } catch {
      setBusy(false);
      setFormError("Envoi impossible. Vérifie ta connexion et réessaie.");
    }
  }

  // ── Connexion sécurisée (pour une session ouverte avant la mise à jour) ──
  async function submitSecure() {
    setFormError(null);
    if (!securePwd) return setFormError("Entre ton mot de passe.");
    setBusy(true);
    try {
      const ok = await enableSecureSession(securePwd);
      setBusy(false);
      if (ok) {
        setModal(null);
        Alert.alert("Connexion sécurisée activée", "Ton compte est maintenant protégé.");
      } else {
        const reason = getSecureError();
        setFormError(
          "Activation impossible pour le moment. Vérifie ta connexion et réessaie." +
            (reason ? ` (code : ${reason})` : ""),
        );
      }
    } catch (e) {
      setBusy(false);
      setFormError(friendlyAuthError(e));
    }
  }

  // ── Suppression du compte ──
  async function submitDelete() {
    setFormError(null);
    if (!delPwd) return setFormError("Entre ton mot de passe pour confirmer.");
    setBusy(true);
    try {
      await deleteAccount(delPwd);
      // La session est effacée : l'app revient toute seule à l'écran de connexion
    } catch (e) {
      setBusy(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setFormError(friendlyAuthError(e));
    }
  }

  return (
    <SafeAreaView style={s.root}>
      <ScreenHeader
        safeArea={false}
        title="Paramètres"
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={s.scroll}>
        <Pressable style={s.profileBanner} onPress={() => navigation.navigate("EditProfile")}>
          {profile?.profilePhotoURL ? (
            <Image source={{ uri: profile.profilePhotoURL }} style={s.avatar} />
          ) : (
            <View style={s.avatarPh}>
              <Text style={s.avatarTxt}>{initials}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.profileName}>{profile?.name}</Text>
            <Text style={s.profileSub}>Modifier mon profil</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>

        <Section title="MON COMPTE">
          <ActionRow icon="create-outline" label="Nom, photo, bio" onPress={() => navigation.navigate("EditProfile")} />
          <ActionRow icon="key-outline" label="Changer le mot de passe" onPress={() => openModal("password")} />
        </Section>

        <Section title="SÉCURITÉ">
          <View style={sec.row}>
            <Ionicons
              name={(secure ? "shield-checkmark-outline" : "shield-outline") as any}
              size={20}
              color={secure ? "#4ADE80" : colors.muted}
            />
            <View style={{ flex: 1 }}>
              <Text style={sec.rowLabel}>
                Connexion sécurisée : {secure ? "active" : "inactive"}
              </Text>
              <Text style={sec.hint}>
                {secure
                  ? "Ton compte est identifié auprès de la base de données."
                  : "Reconnecte-toi, ou active-la ci-dessous, pour protéger ton compte."}
              </Text>
            </View>
            {!secure && (
              <Pressable onPress={() => openModal("secure")} style={m.unblockBtn}>
                <Text style={m.unblockTxt}>Activer</Text>
              </Pressable>
            )}
          </View>
        </Section>

        <Section title="CONFIDENTIALITÉ">
          <ToggleRow
            label="Afficher que je suis en ligne"
            hint="Si tu le désactives, tes amis ne voient plus quand tu es connecté."
            value={showOnline}
            onToggle={(v) => saveSetting("showOnlineStatus", v)}
          />
          <ToggleRow
            label="Apparaître dans la recherche"
            hint="Les autres peuvent te trouver par ton prénom (prénom, photo et pays visibles) et te voir dans leurs suggestions. Désactivé par défaut pour les moins de 18 ans."
            value={discoverable}
            onToggle={(v) => saveSetting("discoverable", v)}
          />
          <ActionRow
            icon="ban-outline"
            label="Utilisateurs bloqués"
            badge={profile?.blockedUserIds?.length ? String(profile.blockedUserIds.length) : undefined}
            onPress={() => openModal("blocked")}
          />
          <ActionRow
            icon="download-outline"
            label={exporting ? "Préparation de tes données…" : "Télécharger mes données"}
            onPress={exportData}
          />
        </Section>

        <Section title="NOTIFICATIONS">
          <ToggleRow label="Notifications push" value={notifPush} onToggle={togglePush} />
          <ToggleRow label="Sons" value={notifSounds} onToggle={(v) => saveSetting("notifSounds", v)} />
          <ToggleRow
            label="Aperçu des messages"
            hint="Désactivé : la notification indique seulement « Nouveau message »."
            value={notifPreview}
            onToggle={(v) => saveSetting("notifPreview", v)}
          />
        </Section>

        <Section title="MESSAGES">
          <ToggleRow
            label="Traduction automatique"
            hint="Traduit les messages reçus. Leur texte est alors envoyé au service de traduction MyMemory. Désactivé : tu peux traduire un message à la demande (appui long)."
            value={profile?.autoTranslate === true}
            onToggle={(v) => saveSetting("autoTranslate", v)}
          />
        </Section>

        <Section title="ASSISTANCE">
          <ActionRow icon="bug-outline" label="Signaler un problème" onPress={() => openModal("bug")} />
          <ActionRow icon="chatbubble-ellipses-outline" label="Contacter le support" onPress={() => openModal("support")} />
          {hasSupportEmail && (
            <ActionRow
              icon="mail-outline"
              label={`Écrire à ${LEGAL.supportEmail}`}
              onPress={() => Linking.openURL(`mailto:${LEGAL.supportEmail}`).catch(() => {})}
            />
          )}
        </Section>

        <Section title="APPLICATION">
          <ActionRow icon="star-outline" label="Passer à Vim+" onPress={() => navigation.navigate("Premium")} accent />
          <ActionRow icon="document-text-outline" label="Conditions d'utilisation" onPress={() => navigation.navigate("Legal", { type: "cgu" })} />
          <ActionRow icon="lock-closed-outline" label="Confidentialité" onPress={() => navigation.navigate("Legal", { type: "privacy" })} />
          {adPrivacyAvailable() && (
            <ActionRow
              icon="megaphone-outline"
              label="Mes choix publicitaires"
              onPress={() =>
                openAdPrivacyOptions().then((ok) => {
                  if (!ok) Alert.alert("Choix publicitaires", "Le formulaire n'est pas disponible pour le moment. Réessaie plus tard.");
                })
              }
            />
          )}
          <View style={sec.row}>
            <Text style={[sec.rowLabel, { flex: 1 }]}>Version</Text>
            <Text style={s.versionTxt}>VimoX 1.0.0</Text>
          </View>
        </Section>

        <Pressable
          onPress={() =>
            Alert.alert("Déconnexion", "Tu vas être déconnecté.", [
              { text: "Annuler", style: "cancel" },
              { text: "Se déconnecter", style: "destructive", onPress: () => logout() },
            ])
          }
          style={s.logoutBtn}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.neonRed} />
          <Text style={s.logoutTxt}>Se déconnecter</Text>
        </Pressable>

        <Pressable
          onPress={() =>
            Alert.alert(
              "Supprimer le compte",
              "Cette action est définitive. Ton profil, tes stories, tes amis et tes messages seront supprimés.",
              [
                { text: "Annuler", style: "cancel" },
                { text: "Continuer", style: "destructive", onPress: () => openModal("delete") },
              ],
            )
          }
          style={s.deleteBtn}
        >
          <Text style={s.deleteTxt}>Supprimer mon compte</Text>
        </Pressable>
      </ScrollView>

      {/* ── Changer le mot de passe ── */}
      <FormModal
        visible={modal === "password"}
        title="Changer le mot de passe"
        actionLabel="Enregistrer"
        busy={busy}
        error={formError}
        onClose={closeModal}
        onAction={submitPassword}
      >
        <Field label="Mot de passe actuel" value={curPwd} onChangeText={setCurPwd} secure />
        <Field label="Nouveau mot de passe" value={newPwd} onChangeText={setNewPwd} secure />
        <Field label="Confirmer le nouveau mot de passe" value={newPwd2} onChangeText={setNewPwd2} secure />
      </FormModal>

      {/* ── Activer la connexion sécurisée ── */}
      <FormModal
        visible={modal === "secure"}
        title="Activer la connexion sécurisée"
        actionLabel="Activer"
        busy={busy}
        error={formError}
        onClose={closeModal}
        onAction={submitSecure}
      >
        <Text style={m.warn}>
          Entre ton mot de passe une seule fois pour que ton compte soit identifié de façon sécurisée.
        </Text>
        <Field label="Mot de passe" value={securePwd} onChangeText={setSecurePwd} secure />
      </FormModal>

      {/* ── Supprimer le compte ── */}
      <FormModal
        visible={modal === "delete"}
        title="Supprimer mon compte"
        actionLabel={busy ? "Suppression…" : "Supprimer définitivement"}
        destructive
        busy={busy}
        error={formError}
        onClose={closeModal}
        onAction={submitDelete}
      >
        <Text style={m.warn}>
          Pour confirmer, entre ton mot de passe. Cette action ne peut pas être annulée.
        </Text>
        <Field label="Mot de passe" value={delPwd} onChangeText={setDelPwd} secure />
      </FormModal>

      {/* ── Support / signalement ── */}
      <FormModal
        visible={modal === "support" || modal === "bug"}
        title={modal === "bug" ? "Signaler un problème" : "Contacter le support"}
        actionLabel="Envoyer"
        busy={busy}
        error={formError}
        onClose={closeModal}
        onAction={() => submitSupport(modal === "bug" ? "bug" : "support")}
      >
        <Text style={m.warn}>
          {modal === "bug"
            ? "Décris ce qui ne marche pas : où, et ce que tu faisais."
            : "Une question, une demande ? Écris-nous."}
        </Text>
        <Field
          label="Ton message"
          value={message}
          onChangeText={setMessage}
          multiline
          maxLength={2000}
        />
      </FormModal>

      {/* ── Utilisateurs bloqués ── */}
      <FormModal
        visible={modal === "blocked"}
        title="Utilisateurs bloqués"
        onClose={closeModal}
      >
        {blockedLoading ? (
          <ActivityIndicator color={colors.muted} style={{ marginVertical: 20 }} />
        ) : blocked.length === 0 ? (
          <Text style={m.empty}>Tu n'as bloqué personne.</Text>
        ) : (
          blocked.map((u) => (
            <View key={u.id} style={m.userRow}>
              {u.photo ? (
                <Image source={{ uri: u.photo }} style={m.userAvatar} />
              ) : (
                <View style={[m.userAvatar, m.userAvatarPh]}>
                  <Text style={m.userInitial}>{u.name[0]?.toUpperCase()}</Text>
                </View>
              )}
              <Text style={m.userName} numberOfLines={1}>
                {u.name}
              </Text>
              <Pressable onPress={() => handleUnblock(u)} style={m.unblockBtn}>
                <Text style={m.unblockTxt}>Débloquer</Text>
              </Pressable>
            </View>
          ))
        )}
      </FormModal>
    </SafeAreaView>
  );
}

// ───────── Composants ─────────

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={sec.wrap}>
      <Text style={sec.title}>{title}</Text>
      <View style={sec.content}>{children}</View>
    </View>
  );
}

function ActionRow({
  icon,
  label,
  onPress,
  accent = false,
  badge,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  accent?: boolean;
  badge?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [sec.row, accent && sec.accent, pressed && { opacity: 0.85 }]}
    >
      <Ionicons name={icon as any} size={20} color={accent ? colors.neonRed : colors.muted} />
      <Text style={[sec.rowLabel, { flex: 1 }, accent && { color: colors.neonRed }]}>{label}</Text>
      {badge && (
        <View style={sec.badge}>
          <Text style={sec.badgeTxt}>{badge}</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onToggle,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}) {
  return (
    <View style={sec.row}>
      <View style={{ flex: 1 }}>
        <Text style={sec.rowLabel}>{label}</Text>
        {hint && <Text style={sec.hint}>{hint}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.border, true: `${colors.neonRed}88` }}
        thumbColor={value ? colors.neonRedText : "#555"}
      />
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  secure,
  multiline,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  secure?: boolean;
  multiline?: boolean;
  maxLength?: number;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={m.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secure}
        multiline={multiline}
        maxLength={maxLength}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={colors.muted}
        style={[m.input, multiline && { height: 110, textAlignVertical: "top" }]}
      />
    </View>
  );
}

function FormModal({
  visible,
  title,
  children,
  actionLabel,
  onAction,
  onClose,
  busy,
  error,
  destructive,
}: {
  visible: boolean;
  title: string;
  children: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  onClose: () => void;
  busy?: boolean;
  error?: string | null;
  destructive?: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={m.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={m.card}>
          <View style={m.cardHeader}>
            <Text style={m.cardTitle}>{title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={onClose} hitSlop={10} disabled={busy}>
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 380 }}>
            {children}
          </ScrollView>
          {!!error && <Text style={m.error}>{error}</Text>}
          {onAction && (
            <Pressable
              onPress={onAction}
              disabled={busy}
              style={({ pressed }) => [
                m.action,
                destructive && m.actionDestructive,
                (pressed || busy) && { opacity: 0.7 },
              ]}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={m.actionTxt}>{actionLabel ?? "OK"}</Text>
              )}
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  accent: {
    borderColor: "rgba(255,46,77,0.4)",
    backgroundColor: "rgba(255,46,77,0.08)",
  },
  rowLabel: { color: colors.text, fontSize: 14, fontWeight: "600" },
  hint: { color: colors.muted, fontSize: 11, marginTop: 3, lineHeight: 15 },
  badge: {
    backgroundColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeTxt: { color: colors.text, fontSize: 12, fontWeight: "700" },
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
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
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
    backgroundColor: colors.neonRedBg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.neonRed,
  },
  avatarTxt: { color: colors.neonRedText, fontWeight: "900", fontSize: 18 },
  profileName: { color: colors.text, fontSize: 16, fontWeight: "800" },
  profileSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  versionTxt: { color: colors.muted, fontSize: 13 },
  logoutBtn: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "rgba(255,46,77,0.12)",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,46,77,0.4)",
    marginTop: 10,
  },
  logoutTxt: { color: colors.neonRed, fontWeight: "700", fontSize: 14 },
  deleteBtn: { alignItems: "center", paddingVertical: 14, marginTop: 8 },
  deleteTxt: { color: colors.muted, fontWeight: "600", fontSize: 13 },
});

const m = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "center", padding: 20 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: "800", flex: 1 },
  label: { color: colors.muted, fontSize: 12, fontWeight: "700", marginBottom: 6 },
  input: {
    color: colors.text,
    backgroundColor: colors.black,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  warn: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 14 },
  error: { color: "#E26D7D", fontSize: 13, fontWeight: "600", marginTop: 4, marginBottom: 4 },
  action: {
    backgroundColor: colors.neonRed,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
  },
  actionDestructive: { backgroundColor: "#a3202f" },
  actionTxt: { color: "#fff", fontWeight: "800", fontSize: 15 },
  empty: { color: colors.muted, fontSize: 14, textAlign: "center", paddingVertical: 24 },
  userRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  userAvatar: { width: 40, height: 40, borderRadius: 20 },
  userAvatarPh: {
    backgroundColor: colors.neonRedBg,
    borderWidth: 1,
    borderColor: colors.neonRed,
    alignItems: "center",
    justifyContent: "center",
  },
  userInitial: { color: colors.neonRedText, fontWeight: "800" },
  userName: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "700" },
  unblockBtn: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  unblockTxt: { color: colors.text, fontSize: 13, fontWeight: "700" },
});
