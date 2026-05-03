import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { doc, getDoc } from "firebase/firestore";
import { ChatMessage, RootStackParamList, VimoXUser } from "../models/types";
import { quickEmojis, colors } from "../theme/colors";
import { useAuth } from "../services/AuthContext";
import {
  listenMessages,
  listenRoom,
  sendMessage,
  setTypingStatus,
  subscribeToTyping,
  leaveRoom,
  reportMessage,
} from "../services/chatService";
import { loadLocalHistory } from "../services/localHistory";
import { blockUser, reportUser } from "../services/moderationService";
import { db } from "../config/firebase";
import { notifyNewMessage } from "../services/notificationService";

type Props = NativeStackScreenProps<RootStackParamList, "ChatRoom">;

export function ChatRoomScreen({ route, navigation }: Props) {
  const { roomId } = route.params;
  const { profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [partnerId, setPartnerId] = useState<string>();
  const [partnerProfile, setPartnerProfile] = useState<VimoXUser | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [showPartnerProfile, setShowPartnerProfile] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadLocalHistory(roomId).then(setMessages);
    const unsubMessages = listenMessages(roomId, setMessages);
    const unsubRoom = profile
      ? listenRoom(roomId, profile.id, (state) => {
          setIsActive(state.isActive);
          setPartnerId(state.partnerId);
        })
      : undefined;
    return () => {
      unsubMessages();
      unsubRoom?.();
    };
  }, [profile, roomId]);

  useEffect(() => {
    if (!partnerId) return;
    getDoc(doc(db, "users", partnerId)).then((snap) => {
      if (snap.exists())
        setPartnerProfile({ id: snap.id, ...snap.data() } as VimoXUser);
    });
  }, [partnerId]);

  useEffect(() => {
    if (!profile) return;
    return subscribeToTyping(roomId, profile.id, setIsTyping);
  }, [profile, roomId]);

  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.senderId === profile?.id) return;
    notifyNewMessage(partnerProfile?.name ?? "Inconnu", last.text).catch(
      () => {},
    );
  }, [messages]);

  const title = useMemo(
    () => (isActive ? "Connecté en temps réel" : "Partenaire déconnecté"),
    [isActive],
  );

  async function send() {
    if (!profile) return;
    const value = text;
    setText("");
    await sendMessage(roomId, profile.id, value).catch(() => setText(value));
    await setTypingStatus(roomId, profile.id, false).catch(() => {});
  }

  function handleTextChange(value: string) {
    setText(value);
    if (!profile) return;
    setTypingStatus(roomId, profile.id, value.length > 0).catch(() => {});
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      setTypingStatus(roomId, profile.id, false).catch(() => {});
    }, 2000);
  }

  async function handleLeave() {
    Alert.alert("Quitter", "Tu vas quitter cette conversation.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Quitter",
        style: "destructive",
        onPress: async () => {
          if (profile) await leaveRoom(roomId, profile.id);
          navigation.goBack();
        },
      },
    ]);
  }

  async function report() {
    if (!profile) return;
    await reportUser(profile.id, roomId, partnerId);
    Alert.alert(
      "Signalement envoyé",
      "Notre modération va analyser cette conversation.",
    );
  }

  async function block() {
    if (!profile || !partnerId)
      return Alert.alert("Blocage impossible", "Partenaire introuvable.");
    await blockUser(profile.id, partnerId);
    Alert.alert("Utilisateur bloqué");
    navigation.goBack();
  }

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleLeave} style={styles.backBtn}>
            <Text style={styles.backText}>‹</Text>
          </Pressable>

          <Pressable
            onPress={() => setShowPartnerProfile((v) => !v)}
            style={styles.partnerInfo}
          >
            <View style={styles.partnerAvatar}>
              {partnerProfile?.profilePhotoURL ? (
                <Image
                  source={{ uri: partnerProfile.profilePhotoURL }}
                  style={styles.partnerAvatarImg}
                />
              ) : (
                <Text style={styles.partnerAvatarText}>
                  {partnerProfile?.name?.[0]?.toUpperCase() ?? "?"}
                </Text>
              )}
              <View
                style={[styles.onlineDot, !isActive && styles.offlineDot]}
              />
            </View>
            <View>
              <Text style={styles.partnerName}>
                {partnerProfile?.name ?? "Chat anonyme"}
              </Text>
              <Text
                style={[
                  styles.partnerStatus,
                  !isActive && { color: "#FF4444" },
                ]}
              >
                {isTyping ? "En train d'écrire..." : title}
              </Text>
            </View>
          </Pressable>

          <View style={styles.headerActions}>
            <Pressable
              onPress={() => navigation.navigate("VideoCall", { roomId })}
              style={styles.actionBtn}
            >
              <Text style={styles.actionText}>📹</Text>
            </Pressable>
            <Pressable onPress={report} style={styles.actionBtn}>
              <Text style={styles.actionText}>⚠</Text>
            </Pressable>
            <Pressable
              onPress={block}
              style={[styles.actionBtn, styles.blockBtn]}
            >
              <Text style={styles.actionText}>✕</Text>
            </Pressable>
          </View>
        </View>

        {/* Profil partenaire */}
        {showPartnerProfile && partnerProfile && (
          <View style={styles.partnerCard}>
            <View style={styles.partnerCardAvatar}>
              {partnerProfile.profilePhotoURL ? (
                <Image
                  source={{ uri: partnerProfile.profilePhotoURL }}
                  style={styles.partnerCardAvatarImg}
                />
              ) : (
                <Text style={styles.partnerCardInitial}>
                  {partnerProfile.name?.[0]?.toUpperCase()}
                </Text>
              )}
            </View>
            <View>
              <Text style={styles.partnerCardName}>{partnerProfile.name}</Text>
              <Text style={styles.partnerCardInfo}>
                {partnerProfile.age} ans · {partnerProfile.gender} ·{" "}
                {partnerProfile.country}
              </Text>
            </View>
          </View>
        )}

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: true })
          }
          renderItem={({ item }) => (
            <Bubble
              message={item}
              mine={item.senderId === profile?.id}
              myId={profile?.id ?? ""}
              onReport={() => reportMessage(roomId, item.id)}
            />
          )}
        />

        {isTyping && (
          <View style={styles.typingBar}>
            <Text style={styles.typingText}>En train d'écrire...</Text>
          </View>
        )}

        {/* Emojis */}
        <View style={styles.emojiBar}>
          {quickEmojis.map((emoji) => (
            <Pressable
              key={emoji}
              onPress={() => setText((v) => v + emoji)}
              style={styles.emojiBtn}
            >
              <Text style={styles.emojiText}>{emoji}</Text>
            </Pressable>
          ))}
        </View>

        {/* Composer */}
        <View style={styles.composer}>
          <TextInput
            value={text}
            onChangeText={handleTextChange}
            placeholder="Message..."
            placeholderTextColor={colors.muted}
            style={styles.input}
            multiline
          />
          <Pressable onPress={send} style={styles.sendBtn}>
            <Text style={styles.sendText}>➤</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function Bubble({
  message,
  mine,
  myId,
  onReport,
}: {
  message: ChatMessage;
  mine: boolean;
  myId: string;
  onReport: () => void;
}) {
  const emojiBig =
    [...message.text].length <= 3 && /\p{Emoji}/u.test(message.text);
  const isRead = message.readBy?.length > 1;
  return (
    <Pressable
      onLongPress={() =>
        Alert.alert("Signaler", "Veux-tu signaler ce message ?", [
          { text: "Annuler", style: "cancel" },
          { text: "Signaler", style: "destructive", onPress: onReport },
        ])
      }
    >
      <View
        style={[styles.bubbleRow, mine ? styles.mineRow : styles.partnerRow]}
      >
        <View
          style={[
            styles.bubble,
            mine ? styles.mineBubble : styles.partnerBubble,
          ]}
        >
          <Text style={[styles.bubbleText, emojiBig && styles.bigEmoji]}>
            {message.text}
          </Text>
          <View style={styles.bubbleMeta}>
            <Text style={styles.time}>
              {new Date(message.sentAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
            {mine && (
              <Text style={styles.readStatus}>{isRead ? "✓✓" : "✓"}</Text>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  header: {
    paddingTop: 54,
    paddingHorizontal: 14,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: { color: colors.text, fontSize: 28, fontWeight: "300" },
  partnerInfo: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  partnerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(232,0,10,0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.neonRed,
  },
  partnerAvatarImg: { width: 40, height: 40, borderRadius: 20 },
  partnerAvatarText: { color: colors.neonRed, fontWeight: "900", fontSize: 16 },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#28F7A1",
    borderWidth: 2,
    borderColor: colors.card,
  },
  offlineDot: { backgroundColor: "#FF4444" },
  partnerName: { color: colors.text, fontWeight: "800", fontSize: 15 },
  partnerStatus: { color: "#28F7A1", fontSize: 11, fontWeight: "600" },
  headerActions: { flexDirection: "row", gap: 6 },
  actionBtn: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  blockBtn: { backgroundColor: "rgba(232,0,10,0.15)" },
  actionText: { fontSize: 14 },
  partnerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  partnerCardAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(232,0,10,0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.neonRed,
  },
  partnerCardAvatarImg: { width: 48, height: 48, borderRadius: 24 },
  partnerCardInitial: {
    color: colors.neonRed,
    fontWeight: "900",
    fontSize: 20,
  },
  partnerCardName: { color: colors.text, fontWeight: "800", fontSize: 15 },
  partnerCardInfo: { color: colors.muted, fontSize: 12 },
  messages: { padding: 14, gap: 10 },
  bubbleRow: { flexDirection: "row" },
  mineRow: { justifyContent: "flex-end", paddingLeft: 50 },
  partnerRow: { justifyContent: "flex-start", paddingRight: 50 },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: "100%",
  },
  mineBubble: { backgroundColor: colors.neonRed },
  partnerBubble: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleText: { color: colors.text, fontSize: 15, lineHeight: 22 },
  bigEmoji: { fontSize: 36, lineHeight: 44 },
  bubbleMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    justifyContent: "flex-end",
    marginTop: 4,
  },
  time: { color: "rgba(255,255,255,0.5)", fontSize: 10 },
  readStatus: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontWeight: "700",
  },
  typingBar: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: colors.card,
  },
  typingText: { color: colors.muted, fontSize: 12, fontStyle: "italic" },
  emojiBar: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  emojiBtn: {
    width: 36,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  emojiText: { fontSize: 20 },
  composer: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: "flex-end",
  },
  input: {
    flex: 1,
    maxHeight: 100,
    color: colors.text,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 10,
    padding: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.neonRed,
    alignItems: "center",
    justifyContent: "center",
  },
  sendText: { color: colors.text, fontSize: 18, fontWeight: "900" },
});
