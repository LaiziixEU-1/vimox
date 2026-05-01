import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { ChatMessage, RootStackParamList } from "../models/types";
import { quickEmojis, colors } from "../theme/colors";
import { useAuth } from "../services/AuthContext";
import { listenMessages, listenRoom, sendMessage } from "../services/chatService";
import { loadLocalHistory } from "../services/localHistory";
import { blockUser, reportUser } from "../services/moderationService";

type Props = NativeStackScreenProps<RootStackParamList, "ChatRoom">;

export function ChatRoomScreen({ route, navigation }: Props) {
  const { roomId } = route.params;
  const { profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [partnerId, setPartnerId] = useState<string>();
  const [isActive, setIsActive] = useState(true);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    loadLocalHistory(roomId).then(setMessages);
    const unsubMessages = listenMessages(roomId, setMessages);
    const unsubRoom = profile ? listenRoom(roomId, profile.id, (state) => {
      setIsActive(state.isActive);
      setPartnerId(state.partnerId);
    }) : undefined;
    return () => {
      unsubMessages();
      unsubRoom?.();
    };
  }, [profile, roomId]);

  const title = useMemo(() => (isActive ? "Connecté en temps réel" : "Partenaire déconnecté"), [isActive]);

  async function send() {
    if (!profile) return;
    const value = text;
    setText("");
    await sendMessage(roomId, profile.id, value).catch(() => setText(value));
  }

  async function report() {
    if (!profile) return;
    await reportUser(profile.id, roomId, partnerId);
    Alert.alert("Signalement envoyé", "Notre modération va analyser cette conversation.");
  }

  async function block() {
    if (!profile || !partnerId) return Alert.alert("Blocage impossible", "Partenaire introuvable.");
    await blockUser(profile.id, partnerId);
    Alert.alert("Utilisateur bloqué");
    navigation.goBack();
  }

  return (
    <LinearGradient colors={[colors.black, "#111122", "#16080D"]} style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()}><Text style={styles.icon}>‹</Text></Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Chat anonyme</Text>
            <Text style={[styles.headerStatus, !isActive && { color: colors.neonRed }]}>{title}</Text>
          </View>
          <Pressable onPress={() => navigation.navigate("VideoCall", { roomId })}><Text style={styles.headerButton}>Vidéo</Text></Pressable>
          <Pressable onPress={report}><Text style={styles.danger}>!</Text></Pressable>
          <Pressable onPress={block}><Text style={styles.danger}>×</Text></Pressable>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => <Bubble message={item} mine={item.senderId === profile?.id} />}
        />

        <View style={styles.emojiBar}>
          {quickEmojis.map((emoji) => (
            <Pressable key={emoji} onPress={() => setText((value) => value + emoji)} style={styles.emoji}>
              <Text style={styles.emojiText}>{emoji}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.composer}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Message 😄🔥✨"
            placeholderTextColor={colors.muted}
            style={styles.input}
            multiline
          />
          <Pressable onPress={send} style={styles.send}><Text style={styles.sendText}>➤</Text></Pressable>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function Bubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
  const emojiBig = [...message.text].length <= 3 && /\p{Emoji}/u.test(message.text);
  return (
    <View style={[styles.bubbleRow, mine ? styles.mineRow : styles.partnerRow]}>
      <View style={[styles.bubble, mine ? styles.mine : styles.partner]}>
        <Text style={[styles.bubbleText, emojiBig && styles.bigEmoji]}>{message.text}</Text>
        <Text style={styles.time}>{new Date(message.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingTop: 54, paddingHorizontal: 14, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(0,0,0,0.28)" },
  icon: { color: colors.text, fontSize: 36 },
  headerTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  headerStatus: { color: colors.neonBlue, fontSize: 12, fontWeight: "800" },
  headerButton: { color: colors.text, backgroundColor: colors.neonBlue, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, overflow: "hidden", fontWeight: "900" },
  danger: { color: colors.text, backgroundColor: colors.neonRed, width: 32, height: 32, textAlign: "center", textAlignVertical: "center", borderRadius: 16, overflow: "hidden", fontSize: 20, fontWeight: "900" },
  messages: { padding: 14, gap: 12 },
  bubbleRow: { flexDirection: "row" },
  mineRow: { justifyContent: "flex-end", paddingLeft: 50 },
  partnerRow: { justifyContent: "flex-start", paddingRight: 50 },
  bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, maxWidth: "100%" },
  mine: { backgroundColor: colors.neonBlue },
  partner: { backgroundColor: colors.neonRed },
  bubbleText: { color: colors.text, fontSize: 17, lineHeight: 23 },
  bigEmoji: { fontSize: 36, lineHeight: 44 },
  time: { color: "rgba(255,255,255,0.65)", fontSize: 10, marginTop: 5, alignSelf: "flex-end" },
  emojiBar: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "rgba(0,0,0,0.22)" },
  emoji: { width: 38, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 12, backgroundColor: colors.panelStrong },
  emojiText: { fontSize: 23 },
  composer: { flexDirection: "row", gap: 10, padding: 12, backgroundColor: "rgba(0,0,0,0.34)", alignItems: "flex-end" },
  input: { flex: 1, maxHeight: 110, color: colors.text, backgroundColor: colors.panelStrong, borderRadius: 16, padding: 12, fontSize: 16 },
  send: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.neonBlue, alignItems: "center", justifyContent: "center" },
  sendText: { color: colors.text, fontSize: 22, fontWeight: "900" }
});

