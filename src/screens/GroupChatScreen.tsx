import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { SwipeToReply } from "../components/SwipeToReply";
import { ImageViewer } from "../components/ImageViewer";
import { VoiceMessageButton } from "../components/VoiceMessageButton";
import { AudioBubble } from "../components/AudioBubble";
import { VimoxEmojiKeyboard, removeLastGrapheme } from "../components/VimoxEmojiKeyboard";
import { arrayUnion, doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import { colors, gradients } from "../theme/colors";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "../services/AuthContext";
import { guardText } from "../services/moderationGuard";
import {
  Group,
  addGroupSystem,
  deleteGroupMessage,
  GroupReply,
  reactGroupMessage,
  pinGroupMessage,
  editGroupMessage,
  markGroupOpened,
  setGroupTyping,
  subscribeGroupTyping,
  sendGroupAudio,
  leaveGroup,
  renameGroup,
  sendGroupImage,
  sendGroupText,
  subscribeGroup,
  subscribeGroupMessages,
} from "../services/groupService";

// Chaque membre a sa couleur, comme sur Snap
const SNAP_RED = "#D6445A";
const MEMBER_COLORS = ["#4D7CFE", "#B4384D", "#14C38E", "#A35BFF", "#FFB020", "#00B8D9", "#FF4FA3", "#FF7A00"];

// Alerte de capture d'écran (si expo-screen-capture est installé)
let ScreenCapture: any = null;
try {
  ScreenCapture = require("expo-screen-capture");
} catch {}

function timeOf(ms: number) {
  return new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function GroupChatScreen({ route, navigation }: any) {
  const { groupId } = route.params as { groupId: string; name?: string };
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [group, setGroup] = useState<Group | null | undefined>(undefined);
  const [messages, setMessages] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  // Groupe ouvert : il n'est plus « non lu » (à l'ouverture et à chaque nouveau message vu)
  useEffect(() => {
    if (profile) markGroupOpened(profile.id, groupId);
  }, [messages.length, profile?.id]);
  // « Léa écrit… »
  const [typingIds, setTypingIds] = useState<string[]>([]);
  useEffect(() => (profile ? subscribeGroupTyping(groupId, profile.id, setTypingIds) : undefined), [groupId, profile?.id]);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingWrite = useRef(0);
  function onChangeText(v: string) {
    setText(v);
    if (!profile) return;
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (!v) {
      lastTypingWrite.current = 0;
      setGroupTyping(groupId, profile.id, false);
      return;
    }
    if (Date.now() - lastTypingWrite.current > 2500) {
      lastTypingWrite.current = Date.now();
      setGroupTyping(groupId, profile.id, true);
    }
    typingTimer.current = setTimeout(() => {
      lastTypingWrite.current = 0;
      setGroupTyping(groupId, profile.id, false);
    }, 3500);
  }
  useEffect(
    () => () => {
      if (profile) setGroupTyping(groupId, profile.id, false);
    },
    [groupId, profile?.id],
  );

  // Réponse en cours (glisser un message vers la droite, ou appui long → Répondre)
  const [replyTo, setReplyTo] = useState<GroupReply | null>(null);
  const lastTap = useRef<{ id: string; at: number }>({ id: "", at: 0 });
  const listRef = useRef<FlatList<any>>(null);
  const me = profile ? { id: profile.id, name: profile.name } : null;

  useEffect(() => subscribeGroup(groupId, setGroup), [groupId]);
  useEffect(() => subscribeGroupMessages(groupId, setMessages), [groupId]);

  // Prénoms des membres (lus un par un)
  const membersKey = (group?.members ?? []).join(",");
  useEffect(() => {
    if (!group) return;
    let alive = true;
    Promise.all(
      group.members.map(async (id) => {
        try {
          return [id, ((await getDoc(doc(db, "users", id))).data() as any)?.name ?? "Membre"] as const;
        } catch {
          return [id, "Membre"] as const;
        }
      }),
    ).then((list) => alive && setNames(Object.fromEntries(list)));
    return () => {
      alive = false;
    };
  }, [membersKey]);

  // Quelqu'un a quitté le groupe (ou je l'ai quitté) : retour à la liste
  useEffect(() => {
    if (group === null || (group && profile && !group.members.includes(profile.id))) {
      navigation.goBack();
    }
  }, [group, profile?.id]);

  // Capture d'écran : tout le groupe est prévenu
  useEffect(() => {
    if (!ScreenCapture?.addScreenshotListener || !me) return;
    let last = 0;
    let sub: any = null;
    try {
      sub = ScreenCapture.addScreenshotListener(() => {
        if (Date.now() - last < 3000) return;
        last = Date.now();
        addGroupSystem(groupId, me, `${me.name} a fait une capture d'écran du chat`, "screenshot");
      });
    } catch {}
    return () => {
      try {
        sub?.remove?.();
      } catch {}
    };
  }, [groupId, me?.id]);

  // « Vu par… » : je note les messages des autres que j'ai vus (pas les Vims : eux comptent à l'ouverture)
  useEffect(() => {
    if (!profile) return;
    messages
      .filter((m) => m.senderUid !== profile.id && !m.type && !m.isSnap && !m.deleted && !(m.viewedBy ?? []).includes(profile.id))
      .slice(-25)
      .forEach((m) => {
        updateDoc(doc(db, "groups", groupId, "messages", m.id), { viewedBy: arrayUnion(profile.id) }).catch(() => {});
      });
  }, [messages, profile?.id]);
  // Mon dernier message (si personne n'a écrit après) : on affiche qui l'a vu
  const lastMineId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.type || m.deleted) continue;
      return m.senderUid === profile?.id && !m.isSnap ? m.id : null;
    }
    return null;
  }, [messages, profile?.id]);

  const colorOf = useMemo(() => {
    const ids = group?.members ?? [];
    return (uid: string) => (uid === profile?.id ? colors.neonBlue : MEMBER_COLORS[(Math.max(0, ids.indexOf(uid)) + 1) % MEMBER_COLORS.length]);
  }, [membersKey, profile?.id]);

  // ✏️ Modifier un message (Vim+, pendant 15 minutes)
  const [editingId, setEditingId] = useState<string | null>(null);
  function startEdit(m: any) {
    if (!profile) return;
    if (profile.isPremium !== true) {
      Alert.alert("Modifier un message", "Corriger un message après l'avoir envoyé est un avantage Vim+.", [
        { text: "Plus tard", style: "cancel" },
        { text: "Découvrir Vim+", onPress: () => navigation.navigate("Premium") },
      ]);
      return;
    }
    if (Date.now() - m.sentAt > 15 * 60 * 1000) {
      Alert.alert("Trop tard", "On peut modifier un message pendant 15 minutes après l'avoir envoyé.");
      return;
    }
    setReplyTo(null);
    setEditingId(m.id);
    setText(m.text ?? "");
  }

  async function send() {
    if (!group || !me || !text.trim()) return;
    const verdict = await guardText(text, { userId: me.id, where: `group:${groupId}` });
    if (!verdict.ok) {
      Alert.alert(editingId ? "Modification refusée" : "Message non envoyé", verdict.message);
      return;
    }
    if (editingId) {
      const id = editingId;
      const val = text;
      setEditingId(null);
      setText("");
      editGroupMessage(groupId, id, val).catch(() => Alert.alert("Modification impossible", "Vérifie ta connexion et réessaie."));
      return;
    }
    const value = text;
    const reply = replyTo;
    setText("");
    setReplyTo(null);
    setGroupTyping(groupId, me.id, false);
    try {
      await sendGroupText(group, me, value, reply);
    } catch {
      setText(value);
      setReplyTo(reply);
      Alert.alert("Message non envoyé", "Vérifie ta connexion et réessaie.");
    }
  }

  async function sendPhoto() {
    if (!group || !me) return;
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"] as any, quality: 0.85 });
      if (res.canceled || !res.assets?.[0]) return;
      setSending(true);
      await sendGroupImage(group, me, res.assets[0].uri);
    } catch {
      Alert.alert("Photo non envoyée", "Vérifie ta connexion et réessaie.");
    } finally {
      setSending(false);
    }
  }

  function previewOf(m: any): string {
    if (m.isSnap) return "Vim";
    if (m.audioURL) return "Message vocal";
    if (m.imageURL) return "Photo";
    return String(m.text ?? "");
  }
  function startReply(m: any) {
    if (!me || m.deleted || m.type) return;
    setReplyTo({
      id: m.id,
      name: m.senderUid === me.id ? "Toi" : names[m.senderUid] ?? m.senderName ?? "Membre",
      text: previewOf(m).slice(0, 80),
    });
  }
  function react(m: any, emoji: string | null) {
    if (!me) return;
    reactGroupMessage(groupId, m.id, me.id, emoji).catch(() => {});
  }
  // Double tap = ❤️ (sur un texte ou un vocal ; un Vim ou une photo s'ouvre au premier tap)
  function onTap(m: any) {
    if (!me || m.deleted || m.type || m.isSnap || m.imageURL) return;
    const now = Date.now();
    if (lastTap.current.id === m.id && now - lastTap.current.at < 320) {
      lastTap.current = { id: "", at: 0 };
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      react(m, m.reactions?.[me.id] === "❤️" ? null : "❤️");
      return;
    }
    lastTap.current = { id: m.id, at: now };
  }
  function onLongPress(m: any) {
    if (!me || m.deleted || m.type) return;
    const isPinned = group?.pinned?.messageId === m.id;
    const buttons: any[] = [
      { text: "↩️ Répondre", onPress: () => startReply(m) },
      ...(!m.isSnap
        ? [
            isPinned
              ? { text: "📌 Désépingler", onPress: () => pinGroupMessage(groupId, null).catch(() => {}) }
              : {
                  text: "📌 Épingler",
                  onPress: () =>
                    pinGroupMessage(groupId, { messageId: m.id, text: previewOf(m), by: me.id }).catch(() =>
                      Alert.alert("Impossible d'épingler", "Vérifie ta connexion et réessaie."),
                    ),
                },
          ]
        : []),
      {
        text: "😀 Réagir",
        onPress: () =>
          Alert.alert(
            "Réagir",
            undefined,
            [
              ...["❤️", "😂", "😮", "😢", "👍", "🔥"].map((e) => ({
                text: e,
                onPress: () => react(m, m.reactions?.[me.id] === e ? null : e),
              })),
              { text: "Annuler", style: "cancel" as const },
            ],
          ),
      },
    ];
    if (m.text) buttons.push({ text: "📋 Copier", onPress: () => Clipboard.setStringAsync(m.text).catch(() => {}) });
    if (m.senderUid === me.id && m.text && !m.isSnap && !m.audioURL && !m.imageURL)
      buttons.unshift({ text: "✏️ Modifier", onPress: () => startEdit(m) });
    if (m.senderUid === me.id) {
      buttons.push({
        text: "Supprimer pour tout le monde",
        style: "destructive",
        onPress: () => deleteGroupMessage(groupId, m).catch(() => Alert.alert("Suppression impossible", "Réessaie.")),
      });
    }
    buttons.push({ text: "Annuler", style: "cancel" });
    Alert.alert("Message", undefined, buttons);
  }

  async function sendAudio(uri: string, duration: number) {
    if (!group || !me) return;
    setSending(true);
    try {
      await sendGroupAudio(group, me, uri, duration);
    } catch {
      Alert.alert("Message vocal non envoyé", "Vérifie ta connexion et réessaie.");
    } finally {
      setSending(false);
    }
  }

  function openMenu() {
    if (!group || !me) return;
    Alert.alert(`${group.emoji} ${group.name}`, `${group.members.length} membres`, [
      {
        text: "👥 Voir les membres",
        onPress: () =>
          Alert.alert("Membres", group.members.map((id) => (id === me.id ? `${names[id] ?? "Toi"} (toi)` : names[id] ?? "Membre")).join("\n")),
      },
      {
        text: "✏️ Renommer le groupe",
        onPress: () => {
          setNewName(group.name);
          setRenaming(true);
        },
      },
      {
        text: "Quitter le groupe",
        style: "destructive",
        onPress: () =>
          Alert.alert("Quitter le groupe ?", "Tu ne recevras plus ses messages.", [
            { text: "Annuler", style: "cancel" },
            {
              text: "Quitter",
              style: "destructive",
              onPress: () => leaveGroup(group, me).catch(() => Alert.alert("Impossible pour le moment", "Réessaie.")),
            },
          ]),
      },
      { text: "Annuler", style: "cancel" },
    ]);
  }

  async function saveName() {
    if (!group || !me) return;
    const verdict = await guardText(newName, { userId: me.id, where: "groupName" });
    if (!verdict.ok) {
      Alert.alert("Nom refusé", verdict.message);
      return;
    }
    setRenaming(false);
    renameGroup(group, me, newName, group.emoji).catch(() => Alert.alert("Nom non enregistré", "Réessaie."));
  }

  if (group === undefined) {
    return (
      <View style={[s.root, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator color={colors.neonRed} />
      </View>
    );
  }
  if (!group) return <View style={s.root} />;

  return (
    <View style={s.root}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={[s.header, { paddingTop: Math.max(insets.top, 44) + 4 }]}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={s.back} accessibilityRole="button" accessibilityLabel="Retour">
            <Ionicons name="chevron-back" size={28} color={colors.text} />
          </Pressable>
          <View style={s.groupIcon}>
            <Text style={{ fontSize: 20 }}>{group.emoji}</Text>
          </View>
          <Pressable style={{ flex: 1 }} onPress={openMenu}>
            <Text style={s.title} numberOfLines={1}>{group.name}</Text>
            <Text style={s.sub} numberOfLines={1}>
              {typingIds.length > 0
                ? `${typingIds.map((id) => names[id] ?? "Quelqu'un").join(", ")} ${typingIds.length > 1 ? "écrivent" : "écrit"}…`
                : group.members.map((id) => (id === profile?.id ? "toi" : names[id] ?? "…")).join(", ")}
            </Text>
          </Pressable>
          <Pressable onPress={openMenu} hitSlop={8} style={s.iconBtn} accessibilityRole="button" accessibilityLabel="Options du groupe">
            <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
          </Pressable>
        </View>

        {group.pinned && (
          <View style={s.pinBar}>
            <Pressable
              onPress={() => {
                const idx = messages.findIndex((x) => x.id === group.pinned!.messageId);
                if (idx >= 0) listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
              }}
              style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Aller au message épinglé"
            >
              <Text style={{ fontSize: 15 }}>📌</Text>
              <Text style={s.pinTxt} numberOfLines={1}>{group.pinned.text || "Message épinglé"}</Text>
            </Pressable>
            <Pressable onPress={() => pinGroupMessage(groupId, null).catch(() => {})} hitSlop={10} accessibilityRole="button" accessibilityLabel="Désépingler">
              <Ionicons name="close" size={18} color={colors.muted} />
            </Pressable>
          </View>
        )}
        <FlatList
          ref={listRef}
          onScrollToIndexFailed={(info) => {
            listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
            setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 }), 300);
          }}
          // Fluidité : seuls les messages proches de l'écran sont dessinés
          initialNumToRender={20}
          maxToRenderPerBatch={12}
          windowSize={11}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ paddingVertical: 10, flexGrow: 1 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={{ fontSize: 42 }}>{group.emoji}</Text>
              <Text style={s.emptyTxt}>Dis bonjour au groupe !</Text>
            </View>
          }
          renderItem={({ item: m, index }) => {
            if (m.type) {
              return (
                <View style={s.sysRow}>
                  <Ionicons name={m.type === "screenshot" ? "camera-outline" : "information-circle-outline"} size={13} color={colors.gold} />
                  <Text style={s.sysTxt}>{m.text}</Text>
                </View>
              );
            }
            const mine = m.senderUid === profile?.id;
            const prev = index > 0 ? messages[index - 1] : null;
            const head = !prev || prev.type || prev.senderUid !== m.senderUid || m.sentAt - prev.sentAt > 5 * 60 * 1000;
            const color = colorOf(m.senderUid);
            const who = mine ? "MOI" : (names[m.senderUid] ?? m.senderName ?? "MEMBRE").toUpperCase();
            if (m.deleted) {
              const what = m.deletedKind === "snap" ? "un Vim" : m.deletedKind === "photo" ? "une photo" : "un chat";
              return (
                <View style={s.delRow}>
                  <Ionicons name="trash-outline" size={13} color={colors.muted} />
                  <Text style={s.delTxt}>
                    {mine ? `Tu as supprimé ${what}` : `${names[m.senderUid] ?? m.senderName ?? "Quelqu'un"} a supprimé ${what}`}
                  </Text>
                </View>
              );
            }
            return (
              <SwipeToReply onReply={() => startReply(m)}>
              <Pressable
                onPress={() => onTap(m)}
                onLongPress={() => onLongPress(m)}
                delayLongPress={300}
                style={[s.msgRow, head && { marginTop: 12 }]}
              >
                <View style={[s.bar, { backgroundColor: color }]} />
                <View style={{ flex: 1, gap: 2 }}>
                  {head && (
                    <View style={s.labelRow}>
                      <Text style={[s.label, { color }]}>{who}</Text>
                      <Text style={s.time}>{timeOf(m.sentAt)}</Text>
                    </View>
                  )}
                  {m.replyTo && (
                    <View style={s.quote}>
                      <Text style={s.quoteName}>{m.replyTo.name}</Text>
                      <Text style={s.quoteTxt} numberOfLines={1}>{m.replyTo.text}</Text>
                    </View>
                  )}
                  {m.isSnap ? (
                    (() => {
                      const viewedBy: string[] = m.viewedBy ?? [];
                      const seen = !!profile && viewedBy.includes(profile.id);
                      const others = Math.max(1, group.members.length - 1);
                      const label = mine
                        ? `Vim envoyé · vu par ${viewedBy.length}/${others}`
                        : seen || !m.imageURL
                          ? "Vim ouvert"
                          : "Nouveau Vim · touche pour voir";
                      const canOpen = !mine && !seen && !!m.imageURL;
                      return (
                        <Pressable
                          disabled={!canOpen}
                          onPress={() =>
                            navigation.navigate("SnapViewer", {
                              imageURL: m.imageURL,
                              chatId: groupId,
                              groupId,
                              messageId: m.id,
                              senderName: names[m.senderUid] ?? m.senderName ?? "",
                              senderUid: m.senderUid,
                              duration: m.duration,
                            })
                          }
                          onLongPress={() => onLongPress(m)}
                          style={s.snapRow}
                          accessibilityRole="button"
                        >
                          <Ionicons name={mine ? "send" : canOpen ? "square" : "square-outline"} size={17} color={SNAP_RED} />
                          <Text style={[s.snapTxt, !canOpen && !mine && { color: colors.muted, fontWeight: "600" }]}>{label}</Text>
                        </Pressable>
                      );
                    })()
                  ) : m.imageURL ? (
                    <Pressable onPress={() => setViewer(m.imageURL)} onLongPress={() => onLongPress(m)}>
                      <ExpoImage source={{ uri: m.imageURL }} style={s.img} contentFit="cover" />
                    </Pressable>
                  ) : m.audioURL ? (
                    <AudioBubble uri={m.audioURL} duration={m.audioDuration ?? 0} mine={mine} />
                  ) : (
                    <Text style={s.txt}>
                      {m.text}
                      {m.editedAt ? <Text style={s.editedTxt}>  · modifié</Text> : null}
                    </Text>
                  )}
                  {(() => {
                    const counts: Record<string, number> = {};
                    Object.values((m.reactions ?? {}) as Record<string, string>).forEach((e) => {
                      counts[e] = (counts[e] ?? 0) + 1;
                    });
                    const list = Object.entries(counts);
                    return list.length > 0 ? (
                      <View style={s.reactRow}>
                        {list.map(([e, c]) => (
                          <View key={e} style={s.reactChip}>
                            <Text style={s.reactTxt}>
                              {e}
                              {c > 1 ? ` ${c}` : ""}
                            </Text>
                          </View>
                        ))}
                      </View>
                    ) : null;
                  })()}
                  {mine && m.id === lastMineId && (
                    <Text style={s.seenTxt} numberOfLines={1}>
                      {(m.viewedBy ?? []).length === 0
                        ? "Envoyé"
                        : (m.viewedBy ?? []).length >= group.members.length - 1
                          ? "Vu par tout le monde"
                          : `Vu par ${(m.viewedBy ?? []).map((id: string) => names[id] ?? "…").join(", ")}`}
                    </Text>
                  )}
                </View>
              </Pressable>
              </SwipeToReply>
            );
          }}
        />

        {editingId && (
          <View style={s.replyBar}>
            <View style={[s.bar, { backgroundColor: colors.gold }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.quoteName}>✏️ Modification du message</Text>
              <Text style={s.quoteTxt} numberOfLines={1}>Corrige ton texte puis envoie</Text>
            </View>
            <Pressable
              onPress={() => {
                setEditingId(null);
                setText("");
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Annuler la modification"
            >
              <Ionicons name="close" size={20} color={colors.muted} />
            </Pressable>
          </View>
        )}
        {replyTo && (
          <View style={s.replyBar}>
            <View style={[s.bar, { backgroundColor: colors.gold }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.quoteName}>Réponse à {replyTo.name}</Text>
              <Text style={s.quoteTxt} numberOfLines={1}>{replyTo.text}</Text>
            </View>
            <Pressable onPress={() => setReplyTo(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Annuler la réponse">
              <Ionicons name="close" size={20} color={colors.muted} />
            </Pressable>
          </View>
        )}

        {sending && (
          <View style={s.sendingRow}>
            <ActivityIndicator size="small" color={colors.muted} />
            <Text style={s.sendingTxt}>Envoi en cours…</Text>
          </View>
        )}

        <View style={[s.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <Pressable onPress={sendPhoto} disabled={sending} style={s.roundBtn} accessibilityRole="button" accessibilityLabel="Envoyer une photo">
            <Ionicons name="image-outline" size={22} color={colors.text} />
          </Pressable>
          <View style={s.pill}>
            <TextInput
              value={text}
              onChangeText={onChangeText}
              placeholder={editingId ? "Corrige ton message…" : `Écrire à ${group.name}…`}
              placeholderTextColor={colors.muted}
              style={s.input}
              multiline
              maxLength={2000}
              onFocus={() => setShowEmoji(false)}
            />
            <Pressable
              onPress={() => {
                Keyboard.dismiss();
                setShowEmoji((v) => !v);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Emojis"
            >
              <Ionicons name={showEmoji ? "keypad-outline" : "happy-outline"} size={23} color={colors.muted} />
            </Pressable>
          </View>
          {text.trim().length > 0 ? (
            <Pressable onPress={send} style={({ pressed }) => [s.sendBtn, pressed && { transform: [{ scale: 0.94 }] }]} accessibilityRole="button" accessibilityLabel={editingId ? "Enregistrer la modification" : "Envoyer"}>
              <LinearGradient colors={gradients.brand as unknown as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Ionicons name={editingId ? "checkmark" : "arrow-up"} size={22} color="#fff" />
            </Pressable>
          ) : (
            <VoiceMessageButton onRecorded={sendAudio} />
          )}
        </View>
      </KeyboardAvoidingView>

      <VimoxEmojiKeyboard
        open={showEmoji}
        onClose={() => setShowEmoji(false)}
        onEmoji={(e) => onChangeText(text + e)}
        onBackspace={() => onChangeText(removeLastGrapheme(text))}
      />

      <ImageViewer uri={viewer} onClose={() => setViewer(null)} />

      <Modal visible={renaming} transparent animationType="fade" onRequestClose={() => setRenaming(false)}>
        <Pressable style={s.renameBack} onPress={() => setRenaming(false)}>
          <Pressable style={s.renameCard} onPress={() => Keyboard.dismiss()}>
            <Text style={s.renameTitle}>Renommer le groupe</Text>
            <TextInput value={newName} onChangeText={setNewName} maxLength={30} style={s.renameInput} autoFocus />
            <Pressable onPress={saveName} style={s.renameBtn} accessibilityRole="button">
              <Text style={s.renameBtnTxt}>Enregistrer</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  header: {
    paddingHorizontal: 10,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#0D0D12",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  back: { width: 34, height: 40, alignItems: "center", justifyContent: "center" },
  groupIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.border },
  title: { color: colors.text, fontWeight: "800", fontSize: 16 },
  sub: { color: colors.muted, fontSize: 12, marginTop: 1 },
  iconBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", justifyContent: "center", paddingTop: 90, gap: 10 },
  emptyTxt: { color: colors.muted, fontSize: 15 },
  sysRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 24 },
  sysTxt: { color: colors.gold, fontSize: 12, fontWeight: "700", textAlign: "center", flexShrink: 1 },
  delRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 29, paddingVertical: 6 },
  delTxt: { color: colors.muted, fontSize: 12, fontStyle: "italic" },
  msgRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingVertical: 2 },
  bar: { width: 3, borderRadius: 2, alignSelf: "stretch" },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 1 },
  label: { fontSize: 11, fontWeight: "900", letterSpacing: 0.8 },
  time: { color: colors.mutedDark, fontSize: 10, fontWeight: "600" },
  txt: { color: colors.text, fontSize: 16, lineHeight: 22 },
  pinBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    borderLeftColor: colors.gold,
  },
  pinTxt: { flex: 1, color: colors.text, fontSize: 13, fontWeight: "700" },
  quote: { borderLeftWidth: 2, borderLeftColor: colors.mutedDark, paddingLeft: 8, marginBottom: 3 },
  quoteName: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  quoteTxt: { color: colors.muted, fontSize: 13 },
  reactRow: { flexDirection: "row", gap: 6, marginTop: 4 },
  reactChip: { backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: colors.border },
  reactTxt: { color: colors.text, fontSize: 13 },
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  editedTxt: { color: colors.mutedDark, fontSize: 11, fontWeight: "700", fontStyle: "italic" },
  seenTxt: { color: colors.mutedDark, fontSize: 11, fontWeight: "700", marginTop: 2 },
  snapRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 3 },
  snapTxt: { color: SNAP_RED, fontSize: 14, fontWeight: "800" },
  img: { width: 220, height: 220, borderRadius: 16 },
  sendingRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 18, paddingVertical: 4 },
  sendingTxt: { color: colors.muted, fontSize: 12 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 8,
    backgroundColor: "#0D0D12",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  roundBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: "center", justifyContent: "center" },
  pill: { flex: 1, flexDirection: "row", alignItems: "flex-end", gap: 8, minHeight: 42, maxHeight: 120, backgroundColor: colors.cardLight, borderRadius: 21, paddingHorizontal: 15, paddingVertical: 10 },
  input: { flex: 1, color: colors.text, fontSize: 15, maxHeight: 100, paddingTop: 0, paddingBottom: 0 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.neonRed, alignItems: "center", justifyContent: "center", overflow: "hidden", elevation: 6 },
  viewer: { flex: 1, backgroundColor: "rgba(0,0,0,0.96)" },
  renameBack: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: 24 },
  renameCard: { backgroundColor: colors.card, borderRadius: 18, padding: 18, gap: 12, borderWidth: 1, borderColor: colors.border },
  renameTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  renameInput: { backgroundColor: colors.black, borderRadius: 12, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: 16, paddingHorizontal: 14, paddingVertical: 12 },
  renameBtn: { backgroundColor: colors.neonRed, borderRadius: 14, paddingVertical: 13, alignItems: "center" },
  renameBtnTxt: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
