import { ReactNode, useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { Avatar } from "./Avatar";
import { SHOW_SOON_ITEMS } from "../config/features";
import {
  ChatPrefs,
  PrefsError,
  clearConversation,
  prefsProblemText,
  togglePin,
  toggleBest,
  toggleStoryHidden,
  toggleStoryMuted,
} from "../services/chatPrefsService";
import { Mute, getMute, setMute } from "../services/muteService";
import { removeFriend } from "../services/friendService";
import { deleteMyMessages } from "../services/chatToolsService";
import { hideMyStoriesFrom } from "../services/storyService";

type Page = "main" | "friendship" | "chat" | "notif" | "story";

type Props = {
  visible: boolean;
  friend: { id: string; name: string; profilePhotoURL?: string | null } | null;
  me: string;
  prefs: ChatPrefs;
  streak?: ReactNode; // le badge flamme, déjà dessiné par l'écran
  onClose: () => void;
  onOpenChat: () => void;
  onSendVim: () => void;
  onCall: (video: boolean) => void;
  onProfile: () => void;
  onSafety: () => void;
};

// Fiche d'ami : s'ouvre quand on garde le doigt sur un ami de la liste des conversations
export function FriendSheet(p: Props) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [page, setPage] = useState<Page>("main");
  const [mute, setMuteState] = useState<Mute>({ messages: false, calls: false });
  const f = p.friend;

  // À chaque ouverture : page principale, et état actuel de la sourdine
  useEffect(() => {
    if (!p.visible || !f) return;
    setPage("main");
    setMuteState({ messages: false, calls: false });
    let alive = true;
    getMute(p.me, f.id)
      .then((m) => alive && setMuteState(m))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [p.visible, f?.id]);

  if (!f) return null;
  const pinned = p.prefs.pinned.includes(f.id);
  const best = p.prefs.best.includes(f.id);
  const err = (e: any) =>
    Alert.alert(e instanceof PrefsError ? prefsProblemText(e.problem) : "Impossible pour le moment. Vérifie ta connexion et réessaie.");

  async function run(fn: () => Promise<unknown>) {
    try {
      await fn();
    } catch (e) {
      err(e);
    }
  }

  function confirmClear() {
    Alert.alert(
      "Supprimer du fil de Chat ?",
      `La conversation avec ${f!.name} sera effacée chez toi. ${f!.name} garde la sienne et vous restez amis.`,
      [
        { text: "Annuler", style: "cancel" },
        { text: "Supprimer", style: "destructive", onPress: () => run(async () => { await clearConversation(p.me, f!.id); p.onClose(); }) },
      ],
    );
  }
  function confirmRemoveFriend() {
    Alert.alert("Supprimer l'ami ?", `Retirer ${f!.name} de tes amis ?`, [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => run(async () => { await removeFriend(p.me, f!.id); p.onClose(); }) },
    ]);
  }
  function confirmDeleteMine() {
    Alert.alert(
      "Effacer mes messages ?",
      `Tous les messages et Vims que tu as envoyés à ${f!.name} seront supprimés, chez toi ET chez ${f!.name}. Cette action est définitive.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Effacer",
          style: "destructive",
          onPress: () =>
            run(async () => {
              const n = await deleteMyMessages(p.me, f!.id);
              Alert.alert(n > 0 ? `${n} message${n > 1 ? "s" : ""} effacé${n > 1 ? "s" : ""}` : "Rien à effacer");
            }),
        },
      ],
    );
  }
  async function setMuteKey(key: keyof Mute, active: boolean) {
    const next = { ...mute, [key]: !active }; // le commutateur dit « recevoir » : actif = pas de sourdine
    const before = mute;
    setMuteState(next);
    try {
      await setMute(p.me, f!.id, next);
    } catch (e) {
      setMuteState(before);
      err(e);
    }
  }

  // ───────── éléments de construction ─────────
  const Row = ({ label, icon, red, onPress, chevron, right, soon }: { label: string; icon?: string; red?: boolean; onPress: () => void; chevron?: boolean; right?: ReactNode; soon?: boolean }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={soon ? `${label}, bientôt disponible` : label}
      style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.cardLight }]}
    >
      {!!icon && <Ionicons name={icon as any} size={19} color={red ? "#ff6b6b" : soon ? colors.mutedDark : colors.text} />}
      <Text style={[s.rowTxt, red && { color: "#ff6b6b" }, soon && { color: colors.muted }]} numberOfLines={2}>
        {label}
      </Text>
      {soon && (
        <View style={s.soon}>
          <Text style={s.soonTxt}>Bientôt</Text>
        </View>
      )}
      {right}
      {chevron && <Ionicons name="chevron-forward" size={18} color={colors.muted} />}
    </Pressable>
  );
  const SwitchRow = ({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) => (
    <View style={s.row}>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTxt}>{label}</Text>
        {!!hint && <Text style={s.hint}>{hint}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ true: colors.neonRed, false: colors.borderLight }}
        thumbColor="#fff"
      />
    </View>
  );
  const Sep = () => <View style={s.sep} />;
  const Quick = ({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [s.quick, pressed && { opacity: 0.75 }]}
    >
      <Ionicons name={icon as any} size={22} color={colors.text} />
    </Pressable>
  );

  const subTitle: Record<Exclude<Page, "main">, string> = {
    friendship: "Gérer l'amitié",
    chat: "Réglages du Chat",
    notif: "Réglages des notifications",
    story: "Réglages de la Story",
  };

  return (
    <Modal visible={p.visible} transparent animationType="slide" onRequestClose={p.onClose}>
      <View style={s.overlay}>
        <Pressable style={{ flex: 1 }} onPress={p.onClose} accessibilityLabel="Fermer la fiche" />
        <View style={[s.wrap, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {page === "main" ? (
            <>
              <View style={s.card}>
                <View style={s.head}>
                  <Avatar uri={f.profilePhotoURL} name={f.name} size={44} />
                  <Text style={s.name} numberOfLines={1}>
                    {f.name}
                  </Text>
                  <View style={{ flex: 1 }} />
                  {p.streak}
                  <Pressable onPress={p.onProfile} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Voir le profil de ${f.name}`}>
                    <Ionicons name="chevron-forward" size={20} color={colors.muted} />
                  </Pressable>
                </View>
                <View style={s.quickRow}>
                  <Quick icon="camera" label={`Envoyer un Vim à ${f.name}`} onPress={p.onSendVim} />
                  <Quick icon="chatbubble" label={`Ouvrir le chat avec ${f.name}`} onPress={p.onOpenChat} />
                  <Quick icon="call" label={`Appel vocal avec ${f.name}`} onPress={() => p.onCall(false)} />
                  <Quick icon="videocam" label={`Appel vidéo avec ${f.name}`} onPress={() => p.onCall(true)} />
                </View>
              </View>
              <View style={[s.card, { maxHeight: Math.round(height * 0.52) }]}>
                <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
                  <Row label="Supprimer du fil de Chat" red onPress={confirmClear} />
                  <Sep />
                  <Row
                    label="Épingler en tant que meilleur·e ami·e ❤️"
                    onPress={() => run(() => toggleBest(p.me, f.id))}
                    right={
                      <View style={[s.radio, best && s.radioOn]}>
                        {best && <Ionicons name="checkmark" size={14} color="#fff" />}
                      </View>
                    }
                  />
                  <Sep />
                  <Row label={pinned ? "Désépingler la conversation" : "Épingler la conversation"} onPress={() => run(() => togglePin(p.me, f.id))} />
                  <Sep />
                  <Row label="Gérer l'amitié" chevron onPress={() => setPage("friendship")} />
                  <Sep />
                  <Row label="Réglages du Chat" chevron onPress={() => setPage("chat")} />
                  <Sep />
                  <Row label="Réglages des notifications" chevron onPress={() => setPage("notif")} />
                  {SHOW_SOON_ITEMS && (
                    <>
                      <Sep />
                      <Row
                        label={`Créer un groupe avec ${f.name}`}
                        soon
                        onPress={() => Alert.alert("Bientôt disponible", "Les conversations à plusieurs arriveront dans une prochaine version.")}
                      />
                    </>
                  )}
                  <Sep />
                  <Row label="Réglages de la Story" chevron onPress={() => setPage("story")} />
                </ScrollView>
              </View>
            </>
          ) : (
            <View style={s.card}>
              <View style={s.subHead}>
                <Pressable onPress={() => setPage("main")} hitSlop={10} accessibilityRole="button" accessibilityLabel="Retour à la fiche">
                  <Ionicons name="chevron-back" size={22} color={colors.text} />
                </Pressable>
                <Text style={s.subTitle}>{subTitle[page]}</Text>
                <View style={{ width: 22 }} />
              </View>
              {page === "friendship" && (
                <>
                  <Row label="Voir le profil" icon="person-outline" onPress={p.onProfile} />
                  <Sep />
                  <Row label="Signaler ou bloquer…" icon="flag-outline" onPress={p.onSafety} />
                  <Sep />
                  <Row label="Supprimer l'ami" icon="person-remove-outline" red onPress={confirmRemoveFriend} />
                </>
              )}
              {page === "chat" && (
                <>
                  <Text style={s.info}>
                    Efface ce que tu as envoyé à {f.name} : les messages, les photos et les Vims. Ils disparaissent aussi chez {f.name}. Ses propres messages ne sont pas touchés.
                  </Text>
                  <Sep />
                  <Row label="Effacer mes messages envoyés" icon="trash-outline" red onPress={confirmDeleteMine} />
                </>
              )}
              {page === "notif" && (
                <>
                  <Text style={s.info}>Tu choisis ce que {f.name} peut te notifier. {f.name} n'est pas prévenu·e de ce réglage dans l'application.</Text>
                  <Sep />
                  <SwitchRow label="Messages et Vims" value={!mute.messages} onChange={(v) => setMuteKey("messages", v)} />
                  <Sep />
                  <SwitchRow label="Appels" value={!mute.calls} onChange={(v) => setMuteKey("calls", v)} />
                </>
              )}
              {page === "story" && (
                <>
                  <SwitchRow
                    label={`Montrer ma story à ${f.name}`}
                    hint="Désactivé : il ou elle ne voit plus mes stories en cours ni les prochaines."
                    value={!p.prefs.storyHidden.includes(f.id)}
                    onChange={(show) =>
                      run(async () => {
                        await toggleStoryHidden(p.me, f.id);
                        if (!show) await hideMyStoriesFrom(p.me, f.id).catch(() => 0);
                      })
                    }
                  />
                  <Sep />
                  <SwitchRow
                    label={`Voir les stories de ${f.name}`}
                    hint="Désactivé : ses stories n'apparaissent plus dans ton fil."
                    value={!p.prefs.storyMuted.includes(f.id)}
                    onChange={() => run(() => toggleStoryMuted(p.me, f.id))}
                  />
                </>
              )}
            </View>
          )}
          <Pressable onPress={p.onClose} accessibilityRole="button" accessibilityLabel="Terminé" style={({ pressed }) => [s.done, pressed && { opacity: 0.8 }]}>
            <Text style={s.doneTxt}>Terminé</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  wrap: { paddingHorizontal: 12, gap: 10 },
  card: { backgroundColor: colors.card, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: colors.border },
  head: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 14 },
  name: { color: colors.text, fontSize: 18, fontWeight: "800", flexShrink: 1 },
  quickRow: { flexDirection: "row", justifyContent: "space-between", gap: 10, padding: 14 },
  quick: { flex: 1, height: 46, borderRadius: 23, backgroundColor: colors.neonRedBg, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, minHeight: 52, paddingVertical: 8 },
  rowTxt: { flex: 1, color: colors.text, fontSize: 16, fontWeight: "600" },
  hint: { color: colors.muted, fontSize: 12, marginTop: 2, lineHeight: 17 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderLight },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.mutedDark, alignItems: "center", justifyContent: "center" },
  radioOn: { backgroundColor: colors.neonRed, borderColor: colors.neonRed },
  soon: { backgroundColor: colors.neonRedBg, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3 },
  soonTxt: { color: colors.neonRedText, fontSize: 11, fontWeight: "800" },
  subHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, height: 52 },
  subTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  info: { color: colors.muted, fontSize: 13, lineHeight: 19, paddingHorizontal: 18, paddingVertical: 12 },
  done: { backgroundColor: colors.card, borderRadius: 16, height: 54, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  doneTxt: { color: colors.text, fontSize: 16, fontWeight: "800" },
});
