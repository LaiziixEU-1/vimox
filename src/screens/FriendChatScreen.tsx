import { useEffect, useRef, useState } from "react";
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
import * as ImagePicker from "expo-image-picker";
import EmojiKeyboard from "rn-emoji-keyboard";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  doc,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../services/AuthContext";
import { colors } from "../theme/colors";
import { RootStackParamList } from "../models/types";
import { VoiceMessageButton } from "../components/VoiceMessageButton";
import { AudioBubble } from "../components/AudioBubble";
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from "../config/env";
import { getChatId } from "../services/snapService";

type Props = NativeStackScreenProps<RootStackParamList, "FriendChat">;

interface FMsg {
  id: string;
  text?: string;
  imageURL?: string | null;
  audioURL?: string | null;
  audioDuration?: number;
  isSnap?: boolean;
  snapViewed?: boolean;
  senderUid: string;
  sentAt: number;
}

export function FriendChatScreen({ route, navigation }: Props) {
  const { friendId, friendName } = route.params;
  const { profile } = useAuth();
  const [messages, setMessages] = useState<FMsg[]>([]);
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [sending, setSending] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);
  const listRef = useRef<FlatList<any>>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cid = getChatId(profile?.id ?? "", friendId);

  useEffect(() => {
    const q = query(
      collection(db, "friendChats", cid, "messages"),
      orderBy("sentAt", "asc"),
    );
    return onSnapshot(q, (snap) => {
      setMessages(
        snap.docs.map((d) => ({
          id: d.id,
          text: d.data().text,
          imageURL: d.data().imageURL ?? null,
          audioURL: d.data().audioURL ?? null,
          audioDuration: d.data().audioDuration ?? 0,
          isSnap: d.data().isSnap ?? false,
          snapViewed: d.data().snapViewed ?? false,
          senderUid: d.data().senderUid,
          sentAt:
            d.data().sentAt instanceof Timestamp
              ? d.data().sentAt.toMillis()
              : Date.now(),
        })),
      );
    });
  }, [cid]);

  useEffect(() => {
    const ref = doc(db, "friendChats", cid, "typing", friendId);
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setFriendTyping(false);
        return;
      }
      const ts = snap.data()?.updatedAt;
      if (ts) {
        const age = Date.now() - (ts instanceof Timestamp ? ts.toMillis() : ts);
        setFriendTyping(age < 4000);
      }
    });
  }, [cid, friendId]);

  useEffect(() => {
    return () => {
      if (profile?.id)
        deleteDoc(doc(db, "friendChats", cid, "typing", profile.id)).catch(
          () => {},
        );
    };
  }, []);

  function handleTextChange(val: string) {
    setText(val);
    if (!profile?.id) return;
    const tRef = doc(db, "friendChats", cid, "typing", profile.id);
    setDoc(tRef, { updatedAt: serverTimestamp() }).catch(() => {});
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(
      () => deleteDoc(tRef).catch(() => {}),
      3000,
    );
  }

  async function send() {
    if (!profile || !text.trim()) return;
    const val = text.trim();
    setText("");
    deleteDoc(doc(db, "friendChats", cid, "typing", profile.id)).catch(
      () => {},
    );
    await addDoc(collection(db, "friendChats", cid, "messages"), {
      text: val,
      imageURL: null,
      audioURL: null,
      senderUid: profile.id,
      sentAt: serverTimestamp(),
    });
  }

  async function sendAudio(uri: string, duration: number) {
    if (!profile) return;
    setSending(true);
    try {
      const formData = new FormData();
      formData.append("file", {
        uri,
        type: "audio/m4a",
        name: `audio_${Date.now()}.m4a`,
      } as any);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
      formData.append("resource_type", "video");
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`,
        { method: "POST", body: formData },
      );
      const data = await res.json();
      if (!data.secure_url) throw new Error("Upload échoué");
      await addDoc(collection(db, "friendChats", cid, "messages"), {
        text: "",
        imageURL: null,
        audioURL: data.secure_url,
        audioDuration: duration,
        senderUid: profile.id,
        sentAt: serverTimestamp(),
      });
    } catch {
      Alert.alert("Erreur", "Impossible d'envoyer l'audio.");
    } finally {
      setSending(false);
    }
  }

  async function sendImage(uri: string) {
    if (!profile) return;
    setSending(true);
    try {
      const formData = new FormData();
      formData.append("file", {
        uri,
        type: "image/jpeg",
        name: `img_${Date.now()}.jpg`,
      } as any);
      formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        { method: "POST", body: formData },
      );
      const data = await res.json();
      if (!data.secure_url) throw new Error("Upload échoué");
      await addDoc(collection(db, "friendChats", cid, "messages"), {
        text: "",
        imageURL: data.secure_url,
        audioURL: null,
        senderUid: profile.id,
        sentAt: serverTimestamp(),
      });
    } catch {
      Alert.alert("Erreur", "Impossible d'envoyer la photo.");
    } finally {
      setSending(false);
    }
  }

  function handlePhoto() {
    Alert.alert("Photo", "Choisir depuis :", [
      {
        text: "📷 Caméra VimoX",
        onPress: () => {
          navigation.navigate("CameraDirect", {
            directSendTo: { friendId, friendName },
          });
        },
      },
      {
        text: "🖼️ Galerie",
        onPress: async () => {
          const { status } =
            await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== "granted") return;
          const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 0.7,
          });
          if (!res.canceled && res.assets[0])
            await sendImage(res.assets[0].uri);
        },
      },
      { text: "Annuler", style: "cancel" },
    ]);
  }

  return (
    <View style={s.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View style={s.header}>
          <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.backText}>‹</Text>
          </Pressable>
          <View style={s.partnerInfo}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{friendName?.[0]?.toUpperCase()}</Text>
              <View style={s.onlineDot} />
            </View>
            <View>
              <Text style={s.partnerName}>{friendName}</Text>
              {friendTyping ? (
                <Text style={s.typingTxt}>✍️ en train d'écrire...</Text>
              ) : (
                <Text style={s.statusTxt}>Ami</Text>
              )}
            </View>
          </View>
          <Pressable
            onPress={() => Alert.alert("Appel", "Bientôt disponible 📞")}
            style={s.iconBtn}
          >
            <Text style={s.iconBtnTxt}>📞</Text>
          </Pressable>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(i) => i.id}
          contentContainerStyle={s.msgs}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: true })
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyIcon}>💬</Text>
              <Text style={s.emptyTxt}>Dis bonjour à {friendName} !</Text>
            </View>
          }
          renderItem={({ item }) => {
            const mine = item.senderUid === profile?.id;
            const big =
              [...(item.text ?? "")].length <= 3 &&
              /\p{Emoji}/u.test(item.text ?? "");

            if (item.isSnap) {
              const opened = item.snapViewed;
              return (
                <View style={[s.row, mine ? s.rowMe : s.rowThem]}>
                  <Pressable
                    disabled={opened && !item.imageURL}
                    onPress={() => {
                      if (!item.imageURL) return;
                      navigation.navigate("SnapViewer", {
                        imageURL: item.imageURL,
                        chatId: cid,
                        messageId: item.id,
                        senderName: mine ? "Toi" : friendName,
                        senderUid: item.senderUid,
                      });
                    }}
                    style={[
                      s.snapBubble,
                      mine ? s.bubbleMe : s.bubbleThem,
                      opened && s.snapBubbleOpened,
                    ]}
                  >
                    <Text style={s.snapIcon}>{opened ? "🔒" : "📩"}</Text>
                    <Text style={s.snapLabel}>
                      {opened ? "Snap ouvert" : "Appuie pour voir"}
                    </Text>
                    <Text style={s.time}>
                      {new Date(item.sentAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </Pressable>
                </View>
              );
            }

            return (
              <View style={[s.row, mine ? s.rowMe : s.rowThem]}>
                <View
                  style={[
                    s.bubble,
                    mine ? s.bubbleMe : s.bubbleThem,
                    (item.audioURL || item.imageURL) && {
                      padding: 0,
                      backgroundColor: "transparent",
                      borderWidth: 0,
                    },
                  ]}
                >
                  {item.audioURL ? (
                    <AudioBubble
                      uri={item.audioURL}
                      duration={item.audioDuration ?? 0}
                      mine={mine}
                    />
                  ) : item.imageURL ? (
                    <Image
                      source={{ uri: item.imageURL }}
                      style={s.img}
                      resizeMode="cover"
                    />
                  ) : (
                    <Text style={[s.bubbleTxt, big && s.bigEmoji]}>
                      {item.text}
                    </Text>
                  )}
                  {!item.audioURL && (
                    <Text style={s.time}>
                      {new Date(item.sentAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  )}
                </View>
              </View>
            );
          }}
        />

        {friendTyping && (
          <View style={s.typingBubble}>
            <Text style={s.typingDots}>● ● ●</Text>
          </View>
        )}

        <View style={s.composer}>
          <Pressable
            onPress={() => setShowEmoji((v) => !v)}
            style={[s.cBtn, showEmoji && s.cBtnOn]}
          >
            <Text style={s.cBtnTxt}>{showEmoji ? "⌨️" : "😊"}</Text>
          </Pressable>
          <Pressable
            onPress={handlePhoto}
            style={[s.cBtn, sending && { opacity: 0.5 }]}
            disabled={sending}
          >
            <Text style={s.cBtnTxt}>{sending ? "⏳" : "📷"}</Text>
          </Pressable>
          <TextInput
            value={text}
            onChangeText={handleTextChange}
            placeholder="Message..."
            placeholderTextColor={colors.muted}
            style={s.input}
            multiline
            onFocus={() => setShowEmoji(false)}
          />
          {!text.trim() && <VoiceMessageButton onRecorded={sendAudio} />}
          {!!text.trim() && (
            <Pressable onPress={send} style={s.sendBtn}>
              <Text style={s.sendTxt}>➤</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>
      <EmojiKeyboard
        onEmojiSelected={(e: { emoji: string }) => setText((v) => v + e.emoji)}
        open={showEmoji}
        onClose={() => setShowEmoji(false)}
        theme={{
          backdrop: "transparent",
          knob: colors.neonRed,
          container: colors.card,
          header: colors.text,
          skinTonesContainer: colors.card,
          category: {
            icon: colors.muted,
            iconActive: colors.neonRed,
            container: colors.card,
            containerActive: "rgba(232,0,10,0.15)",
          },
        }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  header: {
    paddingTop: 54,
    paddingHorizontal: 14,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(232,0,10,0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.neonRed,
    position: "relative",
  },
  avatarText: { color: colors.neonRed, fontWeight: "900", fontSize: 16 },
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
  partnerName: { color: colors.text, fontWeight: "800", fontSize: 15 },
  statusTxt: { color: "#28F7A1", fontSize: 11, fontWeight: "600" },
  typingTxt: { color: colors.neonRed, fontSize: 11, fontWeight: "600" },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnTxt: { fontSize: 18 },
  msgs: { padding: 14, gap: 10, flexGrow: 1 },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 8,
  },
  emptyIcon: { fontSize: 48 },
  emptyTxt: { color: colors.muted, fontSize: 15 },
  row: { flexDirection: "row" },
  rowMe: { justifyContent: "flex-end", paddingLeft: 50 },
  rowThem: { justifyContent: "flex-start", paddingRight: 50 },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: "100%",
  },
  snapBubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
    gap: 4,
    minWidth: 140,
  },
  snapBubbleOpened: { opacity: 0.5 },
  snapIcon: { fontSize: 22 },
  snapLabel: { color: "#fff", fontSize: 12, fontWeight: "700" },
  bubbleMe: { backgroundColor: colors.neonRed },
  bubbleThem: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleTxt: { color: colors.text, fontSize: 15, lineHeight: 22 },
  bigEmoji: { fontSize: 36, lineHeight: 44 },
  img: { width: 220, height: 220, borderRadius: 10 },
  time: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
    marginTop: 4,
    alignSelf: "flex-end",
  },
  typingBubble: { paddingHorizontal: 18, paddingBottom: 6 },
  typingDots: { color: colors.muted, fontSize: 18, letterSpacing: 4 },
  composer: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: "flex-end",
  },
  cBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  cBtnOn: {
    backgroundColor: "rgba(232,0,10,0.15)",
    borderColor: "rgba(232,0,10,0.4)",
  },
  cBtnTxt: { fontSize: 22 },
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
  sendTxt: { color: colors.text, fontSize: 18, fontWeight: "900" },
});
