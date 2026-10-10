import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Location from "expo-location";
import * as Contacts from "expo-contacts";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import EmojiKeyboard from "rn-emoji-keyboard";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { ChatMessage, RootStackParamList, VimoXUser } from "../models/types";
import { colors } from "../theme/colors";
import { useAuth } from "../services/AuthContext";
import {
  listenMessages,
  listenRoom,
  sendMessage,
  sendImageMessage,
  setTypingStatus,
  subscribeToTyping,
  leaveRoom,
  reportMessage,
  toggleReaction,
  deleteMessage,
} from "../services/chatService";
import { loadLocalHistory } from "../services/localHistory";
import { blockUser, reportUser } from "../services/moderationService";
import { db } from "../config/firebase";
import { notifyNewMessage } from "../services/notificationService";
import { sendFriendRequest } from "../services/friendService";
import { VoiceMessageButton } from "../components/VoiceMessageButton";
import { AudioBubble } from "../components/AudioBubble";
import { GameLauncher } from "../games/GameLauncher";
import { createGame, GameType } from "../games/gameService";
import { translateText, getDeviceLang } from "../services/translationService";
import {
  uploadDocument,
  sendDocumentMessage,
  sendLocationMessage,
  sendContactMessage,
  sendReplyTextMessage,
  editTextMessage,
  setActivityStatus,
  subscribeActivity,
} from "../services/chatExtras";

type Props = NativeStackScreenProps<RootStackParamList, "ChatRoom">;
const REACTION_EMOJIS = ["❤️", "😂", "😮", "😢", "👍", "🔥"];
const TEXT_SIZES = { small: 13, medium: 15, large: 18 };
const BACKGROUNDS = [
  { key: "default", label: "Défaut", color: colors.black },
  { key: "dark", label: "Sombre", color: "#0a0a0a" },
  { key: "navy", label: "Marine", color: "#0a0f1e" },
  { key: "wine", label: "Bordeaux", color: "#1a0a0e" },
];
const APPEARANCE_KEY = "vimox_chat_appearance";

interface Appearance {
  background: string;
  textSize: keyof typeof TEXT_SIZES;
}

function linkifyParts(text: string) {
  const regex = /(https?:\/\/[^\s]+|#\w+|@\w+)/g;
  const parts = text.split(regex);
  return parts.map((part, i) => {
    if (/^https?:\/\//.test(part)) {
      return { key: i, text: part, type: "link" as const };
    }
    if (/^#\w+/.test(part)) {
      return { key: i, text: part, type: "hashtag" as const };
    }
    if (/^@\w+/.test(part)) {
      return { key: i, text: part, type: "mention" as const };
    }
    return { key: i, text: part, type: "plain" as const };
  });
}

function LinkifiedText({ text, style }: { text: string; style: any }) {
  const parts = linkifyParts(text ?? "");
  return (
    <Text style={style}>
      {parts.map((p) => {
        if (p.type === "link") {
          return (
            <Text
              key={p.key}
              style={{ color: "#6EC1FF", textDecorationLine: "underline" }}
              onPress={() => Linking.openURL(p.text).catch(() => {})}
            >
              {p.text}
            </Text>
          );
        }
        if (p.type === "hashtag" || p.type === "mention") {
          return (
            <Text key={p.key} style={{ color: "#FFD700", fontWeight: "700" }}>
              {p.text}
            </Text>
          );
        }
        return <Text key={p.key}>{p.text}</Text>;
      })}
    </Text>
  );
}

export function ChatRoomScreen({ route, navigation }: Props) {
  const { roomId } = route.params;
  const { profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [partnerId, setPartnerId] = useState<string>();
  const [partnerProfile, setPartnerProfile] = useState<VimoXUser | null>(null);
  const [isActive, setIsActive] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [partnerActivity, setPartnerActivity] = useState<string | null>(null);
  const [showPartnerProfile, setShowPartnerProfile] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [sendingImage, setSendingImage] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showMedia, setShowMedia] = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
  const [appearance, setAppearance] = useState<Appearance>({
    background: "default",
    textSize: "medium",
  });
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const partnerIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    AsyncStorage.getItem(APPEARANCE_KEY).then((v) => {
      if (v) {
        try {
          setAppearance(JSON.parse(v));
        } catch {}
      }
    });
  }, []);

  function saveAppearance(next: Appearance) {
    setAppearance(next);
    AsyncStorage.setItem(APPEARANCE_KEY, JSON.stringify(next)).catch(() => {});
  }

  useEffect(() => {
    if (partnerId) partnerIdRef.current = partnerId;
  }, [partnerId]);

  useEffect(() => {
    loadLocalHistory(roomId).then(setMessages);
    const unsubMessages = listenMessages(roomId, setMessages);
    const unsubRoom = profile
      ? listenRoom(roomId, profile.id, (state) => {
          setIsActive(state.isActive);
          if (state.partnerId) {
            setPartnerId(state.partnerId);
            partnerIdRef.current = state.partnerId;
          }
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
    const pid = partnerId ?? partnerIdRef.current;
    if (!pid) return;
    return subscribeActivity(roomId, pid, setPartnerActivity);
  }, [roomId, partnerId]);

  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (last.senderId === profile?.id) return;
    const pid = partnerId ?? partnerIdRef.current;
    if (pid) {
      notifyNewMessage(
        pid,
        profile?.name ?? "Quelqu'un",
        last.imageURL ? "📷 Photo" : (last.text ?? ""),
      ).catch(() => {});
    }
  }, [messages]);

  const title = useMemo(
    () => (isActive ? "Connecté en temps réel" : "Partenaire déconnecté"),
    [isActive],
  );

  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter((m) => (m.text ?? "").toLowerCase().includes(q));
  }, [messages, searchQuery]);

  const mediaMessages = useMemo(
    () => messages.filter((m) => !!m.imageURL),
    [messages],
  );

  async function send() {
    if (!profile || !text.trim()) return;
    const value = text;
    setText("");

    if (editingId) {
      await editTextMessage(roomId, editingId, value).catch(() => {});
      setEditingId(null);
      return;
    }

    if (replyTo) {
      await sendReplyTextMessage(
        roomId,
        profile.id,
        value,
        replyTo.id,
        replyTo.imageURL ? "📷 Photo" : (replyTo.text ?? ""),
        replyTo.senderId,
      ).catch(() => setText(value));
      setReplyTo(null);
      await setTypingStatus(roomId, profile.id, false).catch(() => {});
      return;
    }

    await sendMessage(roomId, profile.id, value).catch(() => setText(value));
    await setTypingStatus(roomId, profile.id, false).catch(() => {});
  }

  async function handleAudioReady(uri: string, duration: number) {
    if (!profile) return;
    if (duration > 30) {
      Alert.alert("Trop long", "Maximum 30 secondes pour un message audio.");
      return;
    }
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const reader = new FileReader();
      const base64: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      await addDoc(collection(db, "rooms", roomId, "messages"), {
        type: "audio",
        audioUrl: base64,
        duration,
        senderId: profile.id,
        createdAt: serverTimestamp(),
        sentAt: Date.now(),
        readBy: [profile.id],
      });
    } catch {
      Alert.alert("Erreur", "Impossible d'envoyer l'audio.");
    }
  }

  async function handleGameSelect(gameType: GameType) {
    if (!profile) return;
    const pid = partnerId ?? partnerIdRef.current;
    if (!pid) {
      Alert.alert("Jeu impossible", "Le partenaire n'est pas encore chargé.");
      return;
    }
    try {
      const gameId = await createGame(roomId, gameType, profile.id, pid);
      addDoc(collection(db, "rooms", roomId, "messages"), {
        type: "game",
        gameId,
        gameType,
        senderId: profile.id,
        createdAt: serverTimestamp(),
        sentAt: Date.now(),
        readBy: [profile.id],
      }).catch(() => {});
      navigation.navigate("GameScreen", { chatId: roomId, gameId });
    } catch (e) {
      Alert.alert(
        "Erreur jeu",
        `${e instanceof Error ? e.message : String(e)}`,
      );
    }
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

  async function openGallery() {
    setShowEmojiPicker(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission refusée", "Autorise l'accès à ta galerie.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    await uploadAndSend(result.assets[0].uri);
  }

  async function openCamera() {
    setShowEmojiPicker(false);
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission refusée", "Autorise l'accès à ta caméra.");
      return;
    }
    if (profile) setActivityStatus(roomId, profile.id, "photo").catch(() => {});
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
    });
    if (profile) setActivityStatus(roomId, profile.id, null).catch(() => {});
    if (result.canceled || !result.assets[0]) return;
    await uploadAndSend(result.assets[0].uri);
  }

  async function uploadAndSend(uri: string) {
    if (!profile) return;
    setSendingImage(true);
    try {
      await sendImageMessage(roomId, profile.id, uri);
    } catch {
      Alert.alert("Erreur", "Impossible d'envoyer la photo.");
    } finally {
      setSendingImage(false);
    }
  }

  function handlePhotoPress() {
    Alert.alert("Envoyer une photo", "Choisir depuis :", [
      { text: "📷  Caméra", onPress: openCamera },
      { text: "🖼️  Galerie", onPress: openGallery },
      { text: "Annuler", style: "cancel" },
    ]);
  }

  function handleCallPress() {
    Alert.alert("Démarrer un appel", "", [
      {
        text: "📞  Appel audio",
        onPress: () =>
          navigation.navigate("VideoCall", { roomId, audioOnly: true }),
      },
      {
        text: "📹  Appel vidéo",
        onPress: () =>
          navigation.navigate("VideoCall", { roomId, audioOnly: false }),
      },
      { text: "Annuler", style: "cancel" },
    ]);
  }

  async function handleShareLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission refusée",
          "Active la localisation pour la partager.",
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      if (!profile) return;
      await sendLocationMessage(
        roomId,
        profile.id,
        pos.coords.latitude,
        pos.coords.longitude,
      );
    } catch {
      Alert.alert("Erreur", "Impossible de récupérer ta position.");
    }
  }

  async function handleShareContact() {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission refusée", "Autorise l'accès à tes contacts.");
        return;
      }
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
      });
      if (data.length === 0) {
        Alert.alert("Aucun contact", "Tu n'as pas de contact à partager.");
        return;
      }
      Alert.alert(
        "Choisir un contact",
        "",
        data
          .slice(0, 8)
          .map((c) => ({
            text: c.name ?? "Sans nom",
            onPress: async () => {
              if (!profile) return;
              const phone = c.phoneNumbers?.[0]?.number ?? "N/A";
              await sendContactMessage(
                roomId,
                profile.id,
                c.name ?? "Contact",
                phone,
              );
            },
          }))
          .concat([{ text: "Annuler", onPress: async () => {} }]),
      );
    } catch {
      Alert.alert("Erreur", "Impossible de charger tes contacts.");
    }
  }

  async function handleShareDocument() {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      if (!profile) return;
      const url = await uploadDocument(asset.uri, asset.name ?? "document");
      await sendDocumentMessage(
        roomId,
        profile.id,
        url,
        asset.name ?? "Document",
      );
    } catch {
      Alert.alert("Erreur", "Impossible d'envoyer le document.");
    }
  }

  function handleAttachPress() {
    Alert.alert("Joindre", "", [
      { text: "📍 Position", onPress: handleShareLocation },
      { text: "👤 Contact", onPress: handleShareContact },
      { text: "📄 Document", onPress: handleShareDocument },
      { text: "Annuler", style: "cancel" },
    ]);
  }

  async function handleLeave() {
    const pid = partnerId ?? partnerIdRef.current;
    const doLeave = () => {
      navigation.replace("Matching");
      if (profile) leaveRoom(roomId, profile.id).catch(() => {});
    };
    if (pid && partnerProfile) {
      Alert.alert("Quitter", `Ajouter ${partnerProfile.name} en ami ?`, [
        { text: "Juste quitter", style: "destructive", onPress: doLeave },
        {
          text: "Ajouter ✅",
          onPress: () => {
            sendFriendRequest(
              profile!.id,
              profile!.name,
              profile!.profilePhotoURL,
              pid,
            ).catch(() => {});
            doLeave();
          },
        },
        { text: "Annuler", style: "cancel" },
      ]);
    } else {
      Alert.alert("Quitter", "Tu vas quitter cette conversation.", [
        { text: "Annuler", style: "cancel" },
        { text: "Quitter", style: "destructive", onPress: doLeave },
      ]);
    }
  }

  async function report() {
    if (!profile) return;
    const pid = partnerId ?? partnerIdRef.current;
    await reportUser(profile.id, roomId, pid);
    Alert.alert(
      "Signalement envoyé",
      "Notre modération va analyser cette conversation.",
    );
  }

  async function block() {
    if (!profile) return;
    const pid = partnerId ?? partnerIdRef.current;
    if (!pid) {
      Alert.alert("Blocage impossible", "Le partenaire se charge encore.");
      return;
    }
    try {
      await blockUser(profile.id, pid);
      await leaveRoom(roomId, profile.id).catch(() => {});
      Alert.alert("Utilisateur bloqué", "Tu ne verras plus cette personne.");
      navigation.goBack();
    } catch {
      Alert.alert("Erreur", "Impossible de bloquer. Vérifie ta connexion.");
    }
  }

  const bgColor =
    BACKGROUNDS.find((b) => b.key === appearance.background)?.color ??
    colors.black;
  const textSize = TEXT_SIZES[appearance.textSize];

  return (
    <View style={[styles.root, { backgroundColor: bgColor }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
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
                style={[
                  styles.onlineDot,
                  {
                    backgroundColor: partnerProfile?.isOnline
                      ? "#28F7A1"
                      : "#444",
                  },
                ]}
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
                {isTyping
                  ? "✍️ En train d'écrire..."
                  : partnerActivity === "recording"
                    ? "🎙️ Enregistre un audio..."
                    : partnerActivity === "photo"
                      ? "📷 Prend une photo..."
                      : partnerProfile?.isOnline
                        ? "En ligne"
                        : title}
              </Text>
            </View>
          </Pressable>
          <View style={styles.headerActions}>
            <Pressable
              onPress={handleCallPress}
              style={[styles.actionBtn, styles.actionBtnPrimary]}
            >
              <Text style={styles.actionTextLg}>📞</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                Alert.alert("Plus d'options", "", [
                  {
                    text: "🔍 Rechercher",
                    onPress: () => setShowSearch((v) => !v),
                  },
                  {
                    text: "🖼️ Médias partagés",
                    onPress: () => setShowMedia(true),
                  },
                  {
                    text: "🎨 Apparence du chat",
                    onPress: () => setShowAppearance(true),
                  },
                  { text: "⚠ Signaler", style: "destructive", onPress: report },
                  { text: "✕ Bloquer", style: "destructive", onPress: block },
                  { text: "Annuler", style: "cancel" },
                ])
              }
              style={styles.actionBtn}
            >
              <Text style={styles.actionTextLg}>⋯</Text>
            </Pressable>
          </View>
        </View>

        {showSearch && (
          <View style={styles.searchBar}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Rechercher dans la conversation..."
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery("")}>
                <Text style={styles.searchClear}>✕</Text>
              </Pressable>
            )}
          </View>
        )}

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
              {partnerProfile.bio ? (
                <Text style={styles.partnerCardBio}>
                  "{partnerProfile.bio}"
                </Text>
              ) : null}
            </View>
          </View>
        )}

        <FlatList
          ref={listRef}
          data={filteredMessages}
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
              roomId={roomId}
              textSize={textSize}
              onReport={() => reportMessage(roomId, item.id)}
              onOpenGame={(gameId) =>
                navigation.navigate("GameScreen", { chatId: roomId, gameId })
              }
              onJoinCall={() =>
                navigation.navigate("VideoCall", {
                  roomId: (item as any).callRoomId ?? roomId,
                  audioOnly: (item as any).callType === "audio",
                })
              }
              onReply={() => setReplyTo(item)}
              onEdit={() => {
                setEditingId(item.id);
                setText(item.text ?? "");
              }}
              onCopy={async () => {
                if (item.text) {
                  await Clipboard.setStringAsync(item.text);
                  Alert.alert("Copié", "Le texte a été copié.");
                }
              }}
              onForward={async () => {
                await Share.share({
                  message:
                    item.text ??
                    (item.imageURL ? "Photo partagée depuis VimoX" : ""),
                });
              }}
            />
          )}
        />

        {isTyping && (
          <View style={styles.typingBar}>
            <Text style={styles.typingText}>✍️ En train d'écrire...</Text>
          </View>
        )}

        {replyTo && (
          <View style={styles.replyBar}>
            <View style={{ flex: 1 }}>
              <Text style={styles.replyBarLabel}>
                Répondre à{" "}
                {replyTo.senderId === profile?.id
                  ? "toi-même"
                  : partnerProfile?.name}
              </Text>
              <Text style={styles.replyBarText} numberOfLines={1}>
                {replyTo.imageURL ? "📷 Photo" : replyTo.text}
              </Text>
            </View>
            <Pressable onPress={() => setReplyTo(null)}>
              <Text style={styles.replyBarClose}>✕</Text>
            </Pressable>
          </View>
        )}

        {editingId && (
          <View style={styles.replyBar}>
            <Text style={styles.replyBarLabel}>Modifier le message</Text>
            <Pressable
              onPress={() => {
                setEditingId(null);
                setText("");
              }}
            >
              <Text style={styles.replyBarClose}>✕</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.composer}>
          <Pressable
            onPress={() => setShowEmojiPicker((v) => !v)}
            style={[
              styles.composerBtn,
              showEmojiPicker && styles.composerBtnActive,
            ]}
          >
            <Text style={styles.composerBtnText}>
              {showEmojiPicker ? "⌨️" : "😊"}
            </Text>
          </Pressable>
          <Pressable
            onPress={handlePhotoPress}
            style={[styles.composerBtn, sendingImage && { opacity: 0.5 }]}
            disabled={sendingImage}
          >
            <Text style={styles.composerBtnText}>
              {sendingImage ? "⏳" : "📷"}
            </Text>
          </Pressable>
          <Pressable onPress={handleAttachPress} style={styles.composerBtn}>
            <Text style={styles.composerBtnText}>📎</Text>
          </Pressable>
          <GameLauncher onSelect={handleGameSelect} />
          <TextInput
            value={text}
            onChangeText={handleTextChange}
            placeholder="Message..."
            placeholderTextColor={colors.muted}
            style={[styles.input, { fontSize: textSize }]}
            multiline
            onFocus={() => setShowEmojiPicker(false)}
          />
          {text.trim().length === 0 && (
            <VoiceMessageButton onRecorded={handleAudioReady} />
          )}
          {text.trim().length > 0 && (
            <Pressable onPress={send} style={styles.sendBtn}>
              <Text style={styles.sendText}>➤</Text>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>

      <EmojiKeyboard
        onEmojiSelected={(emoji: { emoji: string }) =>
          setText((v) => v + emoji.emoji)
        }
        open={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
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

      <Modal
        visible={showMedia}
        animationType="slide"
        onRequestClose={() => setShowMedia(false)}
      >
        <View style={styles.mediaModal}>
          <View style={styles.mediaHeader}>
            <Text style={styles.mediaTitle}>
              Médias partagés ({mediaMessages.length})
            </Text>
            <Pressable onPress={() => setShowMedia(false)}>
              <Text style={styles.mediaClose}>✕</Text>
            </Pressable>
          </View>
          <FlatList
            data={mediaMessages}
            keyExtractor={(m) => m.id}
            numColumns={3}
            contentContainerStyle={{ padding: 8 }}
            renderItem={({ item }) => (
              <Image
                source={{ uri: item.imageURL }}
                style={styles.mediaThumb}
              />
            )}
            ListEmptyComponent={
              <Text style={styles.mediaEmpty}>
                Aucune photo partagée pour l'instant
              </Text>
            }
          />
        </View>
      </Modal>

      <Modal
        visible={showAppearance}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAppearance(false)}
      >
        <Pressable
          style={styles.appearanceOverlay}
          onPress={() => setShowAppearance(false)}
        >
          <Pressable style={styles.appearancePanel} onPress={() => {}}>
            <Text style={styles.appearanceTitle}>Fond du chat</Text>
            <View style={styles.appearanceRow}>
              {BACKGROUNDS.map((b) => (
                <Pressable
                  key={b.key}
                  onPress={() =>
                    saveAppearance({ ...appearance, background: b.key })
                  }
                  style={[
                    styles.bgSwatch,
                    { backgroundColor: b.color },
                    appearance.background === b.key && styles.bgSwatchActive,
                  ]}
                >
                  {appearance.background === b.key && (
                    <Text style={styles.bgSwatchCheck}>✓</Text>
                  )}
                </Pressable>
              ))}
            </View>
            <Text style={styles.appearanceTitle}>Taille du texte</Text>
            <View style={styles.appearanceRow}>
              {(Object.keys(TEXT_SIZES) as (keyof typeof TEXT_SIZES)[]).map(
                (k) => (
                  <Pressable
                    key={k}
                    onPress={() =>
                      saveAppearance({ ...appearance, textSize: k })
                    }
                    style={[
                      styles.sizeChip,
                      appearance.textSize === k && styles.sizeChipActive,
                    ]}
                  >
                    <Text
                      style={{
                        color:
                          appearance.textSize === k ? "#fff" : colors.muted,
                        fontSize: TEXT_SIZES[k],
                      }}
                    >
                      Aa
                    </Text>
                  </Pressable>
                ),
              )}
            </View>
            <Pressable
              onPress={() => setShowAppearance(false)}
              style={styles.appearanceDone}
            >
              <Text style={styles.appearanceDoneTxt}>Terminé</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function Bubble({
  message,
  mine,
  myId,
  roomId,
  textSize,
  onReport,
  onOpenGame,
  onJoinCall,
  onReply,
  onEdit,
  onCopy,
  onForward,
}: {
  message: ChatMessage;
  mine: boolean;
  myId: string;
  roomId: string;
  textSize: number;
  onReport: () => void;
  onOpenGame: (gameId: string) => void;
  onJoinCall: () => void;
  onReply: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onForward: () => void;
}) {
  const emojiBig =
    [...(message.text ?? "")].length <= 3 &&
    /\p{Emoji}/u.test(message.text ?? "");
  const isRead = message.readBy?.length > 1;
  const [translated, setTranslated] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const isDeleted = (message as any).deleted;
  const isEdited = (message as any).edited;
  const reactions: Record<string, string[]> = (message as any).reactions ?? {};
  const replyToText = (message as any).replyToText as string | undefined;
  const replyToSenderId = (message as any).replyToSenderId as
    | string
    | undefined;

  useEffect(() => {
    if (mine || !message.text || (message as any).type || isDeleted) return;
    translateText(message.text, getDeviceLang()).then((t) => {
      if (t && t !== message.text) setTranslated(t);
    });
  }, [message.text]);

  function handleLongPress() {
    if (isDeleted) return;
    const actions: any[] = [
      { text: "😀 Réagir", onPress: () => setShowReactions(true) },
      { text: "↩️ Répondre", onPress: onReply },
      { text: "📋 Copier", onPress: onCopy },
      { text: "➤ Transférer", onPress: onForward },
    ];
    if (mine) {
      actions.push({ text: "✏️ Modifier", onPress: onEdit });
      actions.push({
        text: "🗑 Supprimer",
        style: "destructive" as const,
        onPress: () =>
          deleteMessage((message as any).roomId ?? roomId, message.id),
      });
    }
    actions.push({
      text: "⚠ Signaler",
      style: "destructive" as const,
      onPress: onReport,
    });
    actions.push({ text: "Annuler", style: "cancel" as const });
    Alert.alert("Message", undefined, actions);
  }

  const reactionEntries = Object.entries(reactions).filter(
    ([, u]) => u.length > 0,
  );

  if ((message as any).type === "call") {
    const callType = (message as any).callType === "audio" ? "audio" : "vidéo";
    return (
      <View style={[styles.bubbleRow, styles.partnerRow]}>
        <View style={styles.callBubble}>
          <Text style={styles.callBubbleIcon}>
            {callType === "audio" ? "📞" : "📹"}
          </Text>
          <View style={styles.callBubbleText}>
            <Text style={styles.callBubbleTitle}>
              Appel {callType} en cours
            </Text>
            <Text style={styles.callBubbleSub}>Rejoins maintenant</Text>
          </View>
          <Pressable onPress={onJoinCall} style={styles.joinBtn}>
            <Text style={styles.joinBtnTxt}>Rejoindre</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if ((message as any).type === "call_ended") {
    const dur = (message as any).duration ?? 0;
    const m = Math.floor(dur / 60);
    const s = dur % 60;
    return (
      <View style={[styles.bubbleRow, styles.partnerRow]}>
        <View style={styles.callEndedBubble}>
          <Text style={styles.callEndedIcon}>📵</Text>
          <Text style={styles.callEndedTxt}>
            Appel terminé · {m.toString().padStart(2, "0")}:
            {s.toString().padStart(2, "0")}
          </Text>
        </View>
      </View>
    );
  }

  if ((message as any).type === "audio") {
    return (
      <View
        style={[styles.bubbleRow, mine ? styles.mineRow : styles.partnerRow]}
      >
        <AudioBubble
          uri={(message as any).audioUrl}
          duration={(message as any).duration ?? 0}
          mine={mine}
        />
      </View>
    );
  }

  if ((message as any).type === "location") {
    const lat = (message as any).latitude;
    const lng = (message as any).longitude;
    return (
      <View
        style={[styles.bubbleRow, mine ? styles.mineRow : styles.partnerRow]}
      >
        <View
          style={[
            styles.bubble,
            mine ? styles.mineBubble : styles.partnerBubble,
          ]}
        >
          <Text style={styles.bubbleText}>📍 Position partagée</Text>
          <Pressable
            onPress={() =>
              Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`).catch(
                () => {},
              )
            }
          >
            <Text style={styles.locationLink}>Voir sur la carte →</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if ((message as any).type === "contact") {
    return (
      <View
        style={[styles.bubbleRow, mine ? styles.mineRow : styles.partnerRow]}
      >
        <View
          style={[
            styles.bubble,
            mine ? styles.mineBubble : styles.partnerBubble,
          ]}
        >
          <Text style={styles.bubbleText}>
            👤 {(message as any).contactName}
          </Text>
          <Text style={[styles.bubbleText, { fontSize: 12, opacity: 0.8 }]}>
            {(message as any).phone}
          </Text>
        </View>
      </View>
    );
  }

  if ((message as any).type === "document") {
    return (
      <View
        style={[styles.bubbleRow, mine ? styles.mineRow : styles.partnerRow]}
      >
        <Pressable
          onPress={() =>
            Linking.openURL((message as any).documentUrl).catch(() => {})
          }
          style={[
            styles.bubble,
            mine ? styles.mineBubble : styles.partnerBubble,
          ]}
        >
          <Text style={styles.bubbleText}>
            📄 {(message as any).documentName}
          </Text>
          <Text style={[styles.bubbleText, { fontSize: 11, opacity: 0.7 }]}>
            Ouvrir le document →
          </Text>
        </Pressable>
      </View>
    );
  }

  if ((message as any).type === "game") {
    const labels: Record<string, string> = {
      connect4: "4 à la suite",
      tictactoe: "Morpion",
      battleship: "Bataille navale",
      checkers: "Dames",
      ludo: "Ludo",
      uno: "UNO",
      drawing: "Dessin deviné",
    };
    const emojis: Record<string, string> = {
      connect4: "🔴",
      tictactoe: "❌",
      battleship: "🚢",
      checkers: "⚫",
      ludo: "🎲",
      uno: "🃏",
      drawing: "🎨",
    };
    return (
      <View
        style={[styles.bubbleRow, mine ? styles.mineRow : styles.partnerRow]}
      >
        <Pressable
          onPress={() => onOpenGame((message as any).gameId)}
          style={styles.gameBubble}
        >
          <Text style={styles.gameEmoji}>
            {emojis[(message as any).gameType] ?? "🎮"}
          </Text>
          <View>
            <Text style={styles.gameLabel}>
              {labels[(message as any).gameType] ??
                (message as any).gameType ??
                "Jeu"}
            </Text>
            <Text style={styles.gameAction}>Appuie pour jouer →</Text>
          </View>
        </Pressable>
      </View>
    );
  }

  const displayText =
    !mine && translated && !showOriginal ? translated : message.text;

  return (
    <View style={[styles.bubbleRow, mine ? styles.mineRow : styles.partnerRow]}>
      <View>
        <Pressable onLongPress={handleLongPress}>
          <View
            style={[
              styles.bubble,
              mine ? styles.mineBubble : styles.partnerBubble,
              isDeleted && styles.deletedBubble,
            ]}
          >
            {replyToText && !isDeleted && (
              <View style={styles.replyQuote}>
                <Text style={styles.replyQuoteTxt} numberOfLines={1}>
                  ↩️ {replyToSenderId === myId ? "Toi" : "Partenaire"}:{" "}
                  {replyToText}
                </Text>
              </View>
            )}
            {message.imageURL && !isDeleted ? (
              <Image
                source={{ uri: message.imageURL }}
                style={styles.bubbleImage}
                resizeMode="cover"
              />
            ) : isDeleted ? (
              <Text style={[styles.bubbleText, styles.deletedText]}>
                🚫 Message supprimé
              </Text>
            ) : (
              <LinkifiedText
                text={displayText ?? ""}
                style={[
                  styles.bubbleText,
                  { fontSize: textSize },
                  emojiBig && styles.bigEmoji,
                ]}
              />
            )}
            {!mine && translated && !isDeleted && (
              <Pressable onPress={() => setShowOriginal((v) => !v)}>
                <Text style={styles.translateToggle}>
                  🌍 {showOriginal ? "Voir traduction" : "Voir original"}
                </Text>
              </Pressable>
            )}
            <View style={styles.bubbleMeta}>
              {isEdited && !isDeleted && (
                <Text style={styles.editedTag}>modifié · </Text>
              )}
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
        </Pressable>
        {reactionEntries.length > 0 && (
          <View
            style={[
              styles.reactionsRow,
              mine && { justifyContent: "flex-end" },
            ]}
          >
            {reactionEntries.map(([emoji, users]) => (
              <Pressable
                key={emoji}
                style={[
                  styles.reactionBubble,
                  users.includes(myId) && styles.reactionBubbleActive,
                ]}
                onPress={() =>
                  toggleReaction(
                    (message as any).roomId ?? roomId,
                    message.id,
                    myId,
                    emoji,
                  )
                }
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
                {users.length > 1 && (
                  <Text style={styles.reactionCount}>{users.length}</Text>
                )}
              </Pressable>
            ))}
          </View>
        )}
        {showReactions && (
          <View
            style={[
              styles.reactionPicker,
              mine && { right: 0, left: undefined },
            ]}
          >
            {REACTION_EMOJIS.map((emoji) => (
              <Pressable
                key={emoji}
                style={styles.reactionPickerBtn}
                onPress={() => {
                  toggleReaction(
                    (message as any).roomId ?? roomId,
                    message.id,
                    myId,
                    emoji,
                  );
                  setShowReactions(false);
                }}
              >
                <Text style={styles.reactionPickerEmoji}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
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
  partnerAvatar: {
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
  partnerAvatarImg: { width: 40, height: 40, borderRadius: 20 },
  partnerAvatarText: { color: colors.neonRed, fontWeight: "900", fontSize: 16 },
  onlineDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.card,
  },
  partnerName: { color: colors.text, fontWeight: "800", fontSize: 15 },
  partnerStatus: { color: "#28F7A1", fontSize: 11, fontWeight: "600" },
  headerActions: { flexDirection: "row", gap: 8, alignItems: "center" },
  actionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionBtnPrimary: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(139,38,53,0.2)",
    borderWidth: 1,
    borderColor: "#4a2a2e",
  },
  actionTextLg: { fontSize: 17 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  searchClear: { color: colors.muted, fontSize: 16, paddingHorizontal: 6 },
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
  partnerCardBio: {
    color: "#555",
    fontSize: 11,
    fontStyle: "italic",
    marginTop: 2,
  },
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
  deletedBubble: {
    opacity: 0.5,
    backgroundColor: "#1a1a1a",
    borderColor: "#2a2a2a",
  },
  bubbleText: { color: colors.text, fontSize: 15, lineHeight: 22 },
  bigEmoji: { fontSize: 36, lineHeight: 44 },
  deletedText: { color: "#555", fontStyle: "italic" },
  bubbleImage: { width: 220, height: 220, borderRadius: 10 },
  bubbleMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    justifyContent: "flex-end",
    marginTop: 4,
  },
  editedTag: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 10,
    fontStyle: "italic",
  },
  time: { color: "rgba(255,255,255,0.5)", fontSize: 10 },
  readStatus: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontWeight: "700",
  },
  translateToggle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
    marginTop: 4,
    fontStyle: "italic",
  },
  replyQuote: {
    borderLeftWidth: 3,
    borderLeftColor: "rgba(255,255,255,0.4)",
    paddingLeft: 8,
    marginBottom: 6,
  },
  replyQuoteTxt: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontStyle: "italic",
  },
  locationLink: {
    color: "#6EC1FF",
    fontSize: 12,
    marginTop: 6,
    fontWeight: "700",
  },
  reactionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  reactionBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#2a2a2a",
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  reactionBubbleActive: {
    borderColor: colors.neonRed,
    backgroundColor: "rgba(232,0,10,0.1)",
  },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { color: "#888", fontSize: 11, fontWeight: "700" },
  reactionPicker: {
    position: "absolute",
    bottom: "100%",
    left: 0,
    flexDirection: "row",
    backgroundColor: "#1a1a1a",
    borderRadius: 20,
    padding: 6,
    gap: 4,
    borderWidth: 1,
    borderColor: "#2a2a2a",
    zIndex: 99,
  },
  reactionPickerBtn: { padding: 4 },
  reactionPickerEmoji: { fontSize: 22 },
  callBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(40,247,161,0.08)",
    borderWidth: 1,
    borderColor: "rgba(40,247,161,0.3)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    maxWidth: 280,
  },
  callBubbleIcon: { fontSize: 28 },
  callBubbleText: { flex: 1 },
  callBubbleTitle: { color: "#fff", fontSize: 13, fontWeight: "700" },
  callBubbleSub: { color: "rgba(255,255,255,0.4)", fontSize: 11 },
  joinBtn: {
    backgroundColor: "#28F7A1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  joinBtnTxt: { color: "#000", fontSize: 12, fontWeight: "900" },
  callEndedBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  callEndedIcon: { fontSize: 18, opacity: 0.5 },
  callEndedTxt: { color: "rgba(255,255,255,0.3)", fontSize: 12 },
  typingBar: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: colors.card,
  },
  typingText: { color: colors.muted, fontSize: 12, fontStyle: "italic" },
  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  replyBarLabel: { color: colors.neonRed, fontSize: 11, fontWeight: "700" },
  replyBarText: { color: colors.muted, fontSize: 12 },
  replyBarClose: { color: colors.muted, fontSize: 16, paddingHorizontal: 6 },
  composer: {
    flexDirection: "row",
    gap: 6,
    padding: 12,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: "flex-end",
  },
  composerBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  composerBtnActive: {
    backgroundColor: "rgba(232,0,10,0.15)",
    borderColor: "rgba(232,0,10,0.4)",
  },
  composerBtnText: { fontSize: 20 },
  input: {
    flex: 1,
    maxHeight: 100,
    color: colors.text,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 10,
    padding: 10,
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
  gameBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    maxWidth: 240,
  },
  gameEmoji: { fontSize: 28 },
  gameLabel: { color: colors.text, fontSize: 14, fontWeight: "700" },
  gameAction: { color: colors.muted, fontSize: 12, marginTop: 2 },
  mediaModal: { flex: 1, backgroundColor: colors.black },
  mediaHeader: {
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  mediaTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  mediaClose: { color: colors.muted, fontSize: 20 },
  mediaThumb: { flex: 1 / 3, aspectRatio: 1, margin: 2, borderRadius: 6 },
  mediaEmpty: { color: colors.muted, textAlign: "center", marginTop: 60 },
  appearanceOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 24,
  },
  appearancePanel: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  appearanceTitle: { color: colors.text, fontSize: 13, fontWeight: "700" },
  appearanceRow: { flexDirection: "row", gap: 10 },
  bgSwatch: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  bgSwatchActive: { borderColor: colors.neonRed },
  bgSwatchCheck: { color: "#fff", fontWeight: "900" },
  sizeChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.border,
  },
  sizeChipActive: {
    backgroundColor: "rgba(232,0,10,0.25)",
    borderColor: colors.neonRed,
  },
  appearanceDone: {
    backgroundColor: colors.neonRed,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 6,
  },
  appearanceDoneTxt: { color: "#fff", fontWeight: "800" },
});
