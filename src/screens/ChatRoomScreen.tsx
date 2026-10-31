/*VIMOX-V25*/
/*VIMOX-V33*/
/*VIMOX-V22*/
/*VIMOX-V18*/
/*VIMOX-V17*/
/*VIMOX-V16*/
/*VIMOX-V11*/
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ScrollView,
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
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
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Location from "expo-location";
import * as Contacts from "expo-contacts";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { VimoxEmojiKeyboard, removeLastGrapheme } from "../components/VimoxEmojiKeyboard";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  onSnapshot,
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
import { uploadAudioFile } from "../services/storageService";
import { isReallyOnline } from "../services/presence";
import { blockUser, reportUser } from "../services/moderationService";
import { guardText } from "../services/moderationGuard";
import { db } from "../config/firebase";
import { notifyNewMessage } from "../services/notificationService";
import { sendFriendRequest } from "../services/friendService";
import { VoiceMessageButton } from "../components/VoiceMessageButton";
import { AudioBubble } from "../components/AudioBubble";
import { GameLauncher } from "../games/GameLauncher";
import { ageLimitsFor, cancelFindMatch, findMatch, getLastFilters } from "../services/matchService";
import { pagerBus } from "../navigation/pagerBus";
import { registerSkipAndMaybeAd } from "../services/adService";
import { HouseAd } from "../components/HouseAd";
import { useScreenshotNotice } from "../hooks/useScreenshotNotice";
import { createGame, createBotGame, GameType } from "../games/gameService";
import { useVideoPlayer, VideoView } from "expo-video";
import { videoURLFromPoster } from "../services/snapService";
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
// Couleurs des messages façon Snap : une fine barre à gauche
const ME_BAR = colors.neonBlue;
const THEM_BAR = "#B4384D";
function dayLabelOf(ms: number) {
  const d = new Date(ms);
  const now = new Date();
  const y = new Date();
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "Aujourd'hui";
  if (d.toDateString() === y.toDateString()) return "Hier";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}
const TEXT_SIZES = { small: 13, medium: 15, large: 18 };
const BACKGROUNDS = [
  { key: "default", label: "Défaut", color: colors.black },
  { key: "dark", label: "Sombre", color: "#09090C" },
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


// 💡 Brise-glace pour lancer la conversation avec un inconnu
const ICEBREAKERS = [
  "Salut ! Tu viens d'où ?",
  "Quel est le meilleur film que tu aies vu ?",
  "Tu écoutes quoi en ce moment ?",
  "Si tu pouvais vivre n'importe où, ce serait où ?",
  "Ton plat préféré, c'est quoi ?",
  "Plutôt mer ou montagne ?",
  "Quelle série tu me conseilles ?",
  "Tu as un talent caché ?",
  "Le dernier truc qui t'a fait rire ?",
  "Tu joues à des jeux vidéo ?",
  "Un voyage de rêve ?",
  "Chat ou chien ?",
  "Tu fais du sport ?",
  "Ta chanson du moment ?",
  "Qu'est-ce qui t'a rendu heureux cette semaine ?",
  "Plutôt soirée ou matinée ?",
  "Si tu gagnais au loto, tu ferais quoi en premier ?",
  "Un super-pouvoir que tu aimerais avoir ?",
  "Ton emoji préféré ?",
  "Le meilleur conseil qu'on t'ait donné ?",
  "Tu préfères les films d'horreur ou les comédies ?",
  "C'est quoi ta passion ?",
];

export function ChatRoomScreen({ route, navigation }: Props) {
  const { roomId, video } = route.params;
  const { profile } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [partnerId, setPartnerId] = useState<string>();
  const [partnerProfile, setPartnerProfile] = useState<VimoXUser | null>(null);
  const [isActive, setIsActive] = useState(true);
  // 💡 Brise-glace : 3 questions au début de la conversation (tant que je n'ai rien écrit)
  const [iceSeed, setIceSeed] = useState(() => Math.floor(Math.random() * 1000));
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
  // Défilement intelligent : on ne redescend tout seul que si on est déjà en bas
  const nearBottom = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const [kbOpen, setKbOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setKbOpen(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKbOpen(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
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
    return onSnapshot(
      doc(db, "users", partnerId),
      (snap) => {
        if (snap.exists())
          setPartnerProfile({ id: snap.id, ...snap.data() } as VimoXUser);
      },
      () => {},
    );
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

  const partnerOnline = isReallyOnline(partnerProfile as any);

  // Prévient le PARTENAIRE (et pas soi-même) d'un message qu'on vient d'envoyer,
  // seulement s'il n'est pas en ligne : sinon il le voit déjà en direct.
  function notifyPartner(preview: string) {
    const pid = partnerId ?? partnerIdRef.current;
    if (!pid || !profile || partnerOnline) return;
    notifyNewMessage(pid, profile.name ?? "Quelqu'un", preview, { roomId }).catch(() => {});
  }

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
    const verdict = await guardText(text, {
      userId: profile.id,
      where: `room:${roomId}`,
    });
    if (!verdict.ok) {
      Alert.alert("Message non envoyé", verdict.message);
      return;
    }
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
      notifyPartner(value);
      await setTypingStatus(roomId, profile.id, false).catch(() => {});
      return;
    }

    await sendMessage(roomId, profile.id, value).catch(() => setText(value));
    notifyPartner(value);
    await setTypingStatus(roomId, profile.id, false).catch(() => {});
  }

  async function handleAudioReady(uri: string, duration: number) {
    if (!profile) return;
    try {
      const audioUrl = await uploadAudioFile(uri, `chats/${roomId}`);
      await addDoc(collection(db, "rooms", roomId, "messages"), {
        type: "audio",
        audioUrl,
        duration,
        senderId: profile.id,
        createdAt: serverTimestamp(),
        sentAt: serverTimestamp(),
        readBy: [profile.id],
      });
      notifyPartner("🎤 Message vocal");
    } catch (e: any) {
      Alert.alert("Erreur", `Impossible d'envoyer l'audio : ${e?.message ?? "erreur réseau"}`);
    }
  }

  async function handleGameSelect(gameType: GameType, opts?: { bot?: boolean; level?: number }) {
    if (!profile) return;
    // Contre l'ordinateur : pas besoin du partenaire
    if (opts?.bot) {
      try {
        const gameId = await createBotGame(roomId, gameType, profile.id, opts.level ?? 2);
        navigation.navigate("GameScreen", { chatId: roomId, gameId });
      } catch (e) {
        Alert.alert("Erreur jeu", `${e instanceof Error ? e.message : String(e)}`);
      }
      return;
    }
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
        sentAt: serverTimestamp(),
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

  // « En train d'écrire » : une écriture toutes les 2,5 s au plus. Avant : une écriture Firestore
  // par lettre tapée, qui saturait le document de la conversation et coûtait cher.
  const lastTypingWrite = useRef(0);
  function handleTextChange(value: string) {
    setText(value);
    if (!profile) return;
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    if (value.length === 0) {
      lastTypingWrite.current = 0;
      setTypingStatus(roomId, profile.id, false).catch(() => {});
      return;
    }
    const now = Date.now();
    if (now - lastTypingWrite.current > 2500) {
      lastTypingWrite.current = now;
      setTypingStatus(roomId, profile.id, true).catch(() => {});
    }
    typingTimeout.current = setTimeout(() => {
      lastTypingWrite.current = 0;
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
      mediaTypes: ["images"] as any,
      allowsEditing: true,
      quality: 0.7,
    });
    if (result.canceled || !result.assets[0]) return;
    await uploadAndSend(result.assets[0].uri);
  }

  // La caméra VimoX complète (effets, musique, texte, dessin, vidéo...), comme sur Snap :
  // la photo ou la vidéo part directement dans cette conversation
  async function openCamera() {
    setShowEmojiPicker(false);
    navigation.navigate("CameraDirect", {
      directSendToRoom: {
        roomId,
        partnerName: partnerProfile?.name ?? "Partenaire",
      },
    });
  }

  async function uploadAndSend(uri: string) {
    if (!profile) return;
    setSendingImage(true);
    try {
      await sendImageMessage(roomId, profile.id, uri);
      notifyPartner("📷 Photo");
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

  // ───── Façon Omegle : « Suivant », inconnu parti, intérêts communs, vidéo auto ─────
  const [nexting, setNexting] = useState(false);
  const [commonInterests, setCommonInterests] = useState<string[]>([]);
  // Âges copiés dans la conversation au moment du match (le seul endroit où l'âge est visible)
  const [roomAges, setRoomAges] = useState<Record<string, number>>({});
  const autoVideoDone = useRef(false);

  // Capture d'écran : l'inconnu en est prévenu dans la conversation
  useScreenshotNotice(() => {
    if (!profile) return;
    addDoc(collection(db, "rooms", roomId, "messages"), {
      type: "screenshot",
      text: `${profile.name ?? "L'inconnu"} a fait une capture d'écran`,
      senderId: profile.id,
      readBy: [profile.id],
      createdAt: serverTimestamp(),
      sentAt: serverTimestamp(),
    }).catch(() => {});
  }, !!profile);

  // ➕ Ajouter l'inconnu en ami sans quitter la conversation (comme sur Snap)
  const [friendAsked, setFriendAsked] = useState(false);
  async function addPartnerAsFriend() {
    const pid = partnerId ?? partnerIdRef.current;
    if (!profile || !pid || friendAsked) return;
    setFriendAsked(true);
    try {
      await sendFriendRequest(profile.id, profile.name, profile.profilePhotoURL, pid);
    } catch {
      setFriendAsked(false);
      Alert.alert("Demande impossible", "Réessaie dans un instant.");
    }
  }

  // 🚩 Signaler et passer : signalement + blocage + nouvel inconnu, en un geste
  async function reportAndNext() {
    if (!profile) return;
    const pid = partnerId ?? partnerIdRef.current;
    await reportUser(profile.id, roomId, pid).catch(() => {});
    if (pid) await blockUser(profile.id, pid).catch(() => {});
    goNext({ noAd: true });
  }

  useEffect(
    () =>
      onSnapshot(
        doc(db, "rooms", roomId),
        (snap) => {
          setCommonInterests((snap.data()?.commonInterests as string[]) ?? []);
          setRoomAges((snap.data()?.ages as Record<string, number>) ?? {});
        },
        () => {},
      ),
    [roomId],
  );

  // Match en mode vidéo : l'appel s'ouvre tout seul chez les deux personnes
  useEffect(() => {
    if (!video || autoVideoDone.current) return;
    autoVideoDone.current = true;
    const t = setTimeout(
      () => navigation.navigate("VideoCall", { roomId, audioOnly: false, joining: true }),
      400,
    );
    return () => clearTimeout(t);
  }, [video]);

  // « Suivant » : on quitte et on enchaîne aussitôt sur un nouvel inconnu, mêmes réglages
  // Pub maison (quand aucune pub AdMob n'est disponible)
  const [houseAd, setHouseAd] = useState(false);
  const houseAdDone = useRef<(() => void) | null>(null);
  const goPremiumAfterAd = useRef(false);
  function closeHouseAd(toPremium: boolean) {
    goPremiumAfterAd.current = toPremium;
    setHouseAd(false);
    houseAdDone.current?.();
    houseAdDone.current = null;
  }

  async function goNext(opts?: any) {
    if (!profile || nexting) return;
    setNexting(true);
    leaveRoom(roomId, profile.id).catch(() => {});
    // Version gratuite : une pub toutes les 3 personnes passées. Jamais avec Premium,
    // et jamais après « Signaler et passer » (on ne pénalise pas un signalement).
    if (opts?.noAd !== true) {
      const ad = await registerSkipAndMaybeAd(!!profile.isPremium, (profile.age ?? 0) < 18);
      if (ad === "house") {
        await new Promise<void>((resolve) => {
          houseAdDone.current = resolve;
          setHouseAd(true);
        });
        if (goPremiumAfterAd.current) {
          goPremiumAfterAd.current = false;
          setNexting(false);
          navigation.navigate("Premium");
          return;
        }
      }
    }
    const lim = ageLimitsFor(profile.age);
    const f = getLastFilters() ?? { ageMin: lim.min, ageMax: lim.max };
    try {
      const id = await findMatch(profile, f);
      navigation.replace("ChatRoom", { roomId: id, video: f.mode === "video" });
    } catch (e) {
      setNexting(false);
      if (!(e instanceof Error && e.message === "Cancelled")) {
        Alert.alert("Connexion interrompue", "Réessaie dans un instant.");
      }
    }
  }

  function cancelNext() {
    cancelFindMatch();
    setNexting(false);
    navigation.replace("Matching");
    setTimeout(() => pagerBus.go("Matching"), 400);
  }

  async function handleLeave() {
    const pid = partnerId ?? partnerIdRef.current;
    const doLeave = () => {
      navigation.replace("Matching");
      // On revient sur la page Match (et pas sur la caméra)
      setTimeout(() => pagerBus.go("Matching"), 400);
      if (profile) leaveRoom(roomId, profile.id).catch(() => {});
    };
    if (pid && partnerProfile && !friendAsked) {
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
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 44) + 4 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={handleLeave} hitSlop={10} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={28} color={colors.text} />
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
                    backgroundColor: partnerOnline ? "#28F7A1" : "#444",
                  },
                ]}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.partnerName} numberOfLines={1}>
                {partnerProfile?.name ?? "Chat anonyme"}
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  styles.partnerStatus,
                  !isActive && { color: "#FF4444" },
                  (isTyping || partnerActivity) && { color: colors.neonRedText },
                ]}
              >
                {isTyping
                  ? "écrit…"
                  : partnerActivity === "recording"
                    ? "enregistre un audio…"
                    : partnerActivity === "photo"
                      ? "prend une photo…"
                      : partnerOnline
                        ? "En ligne"
                        : title}
              </Text>
            </View>
          </Pressable>
          <View style={styles.headerActions}>
            <Pressable
              onPress={addPartnerAsFriend}
              disabled={friendAsked || !partnerId}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={friendAsked ? "Demande d'ami envoyée" : "Ajouter en ami"}
              style={styles.headerIcon}
            >
              <Ionicons
                name={friendAsked ? "checkmark-circle" : "person-add-outline"}
                size={21}
                color={friendAsked ? "#28F7A1" : colors.text}
              />
            </Pressable>
            <Pressable
              onPress={goNext}
              disabled={nexting}
              accessibilityRole="button"
              accessibilityLabel="Inconnu suivant"
              style={({ pressed }) => [styles.nextBtn, pressed && { opacity: 0.8 }]}
            >
              <Text style={styles.nextBtnTxt}>Suivant</Text>
              <Ionicons name="play-skip-forward" size={14} color="#fff" />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Appel vocal" onPress={handleCallPress} hitSlop={8} style={styles.headerIcon}>
              <Ionicons name="call-outline" size={22} color={colors.text} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Plus d'options"
              onPress={() =>
                Alert.alert("Plus d'options", "", [
                  { text: "Rechercher", onPress: () => setShowSearch((v) => !v) },
                  { text: "Médias partagés", onPress: () => setShowMedia(true) },
                  { text: "Apparence du chat", onPress: () => setShowAppearance(true) },
                  { text: "🚩 Signaler et passer", style: "destructive", onPress: reportAndNext },
                  { text: "Signaler", style: "destructive", onPress: report },
                  { text: "Bloquer", style: "destructive", onPress: block },
                  { text: "Annuler", style: "cancel" },
                ])
              }
              hitSlop={8}
              style={styles.headerIcon}
            >
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.text} />
            </Pressable>
          </View>
        </View>

        {!isActive && !nexting && (
          <View style={styles.leftBar}>
            <Text style={styles.leftTxt}>L'inconnu a quitté la conversation</Text>
            <Pressable onPress={goNext} style={styles.leftBtn} accessibilityRole="button">
              <Text style={styles.leftBtnTxt}>Nouvel inconnu</Text>
            </Pressable>
          </View>
        )}
        {commonInterests.length > 0 && (
          <View style={styles.interestBar}>
            <Ionicons name="sparkles" size={14} color={colors.gold} />
            <Text style={styles.interestTxt} numberOfLines={1}>
              Vous aimez tous les deux : {commonInterests.join(", ")}
            </Text>
          </View>
        )}

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
              <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={() => setSearchQuery("")}>
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
                {[
                  partnerId && typeof roomAges[partnerId] === "number" ? `${roomAges[partnerId]} ans` : "",
                  partnerProfile.gender,
                  partnerProfile.country,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
              {partnerProfile.bio ? (
                <Text style={styles.partnerCardBio}>
                  "{partnerProfile.bio}"
                </Text>
              ) : null}
            </View>
          </View>
        )}

        <View style={{ flex: 1 }}>
        <FlatList
          ref={listRef}
          // Fluidité : seuls les messages proches de l'écran sont dessinés
          initialNumToRender={20}
          maxToRenderPerBatch={12}
          windowSize={11}
          data={filteredMessages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.msgList}
          onContentSizeChange={() => {
            const last = filteredMessages[filteredMessages.length - 1];
            if (nearBottom.current || last?.senderId === profile?.id) {
              listRef.current?.scrollToEnd({ animated: true });
            }
          }}
          onScroll={(e) => {
            const { contentOffset, contentSize, layoutMeasurement } =
              e.nativeEvent;
            const dist =
              contentSize.height - contentOffset.y - layoutMeasurement.height;
            nearBottom.current = dist < 120;
            const far = dist > 260;
            setShowJump((v) => (v === far ? v : far));
          }}
          scrollEventThrottle={100}
          ListEmptyComponent={
            <View style={styles.welcome}>
              <Text style={styles.welcomeIcon}>👋</Text>
              <Text style={styles.welcomeTitle}>Tu parles avec un inconnu</Text>
              <Text style={styles.welcomeTxt}>
                Dis bonjour ! Reste respectueux, et ne partage jamais ton adresse, ton école ou ton numéro.
                {"\n"}Un problème ? Touche ⋯ puis « Signaler et passer ».
              </Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const prev = index > 0 ? filteredMessages[index - 1] : undefined;
            const newDay =
              !prev ||
              new Date(prev.sentAt).toDateString() !==
                new Date(item.sentAt).toDateString();
            const head =
              newDay ||
              !prev ||
              prev.senderId !== item.senderId ||
              item.sentAt - prev.sentAt > 5 * 60 * 1000 ||
              !!(prev as any).type;
            return (
            <View>
              {newDay && <Text style={styles.dayLabel}>{dayLabelOf(item.sentAt)}</Text>}
            <Bubble
              message={item}
              head={head}
              partnerName={partnerProfile?.name}
              mine={item.senderId === profile?.id}
              myId={profile?.id ?? ""}
              roomId={roomId}
              textSize={textSize}
              autoTranslate={(profile as any)?.autoTranslate === true}
              onOpenImage={(uri) => setViewerUri(uri)}
              onReport={() => reportMessage(roomId, item.id)}
              onOpenGame={(gameId) =>
                navigation.navigate("GameScreen", { chatId: roomId, gameId })
              }
              onJoinCall={() =>
                navigation.navigate("VideoCall", {
                  roomId: (item as any).callRoomId ?? roomId,
                  audioOnly: (item as any).callType === "audio",
                  joining: true,
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
            </View>
            );
          }}
        />
        {showJump && (
          <Pressable
            onPress={() => {
              nearBottom.current = true;
              listRef.current?.scrollToEnd({ animated: true });
            }}
            accessibilityRole="button"
            accessibilityLabel="Aller aux derniers messages"
            style={({ pressed }) => [
              {
                position: "absolute",
                right: 14,
                bottom: 12,
                width: 42,
                height: 42,
                borderRadius: 21,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#242220",
                borderWidth: 1,
                borderColor: "#3a362f",
              },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Ionicons name="chevron-down" size={22} color="#f2f0ec" />
          </Pressable>
        )}
        </View>

        <Modal
          visible={!!viewerUri}
          transparent
          animationType="fade"
          statusBarTranslucent
          onRequestClose={() => setViewerUri(null)}
        >
          <Pressable
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.95)",
              justifyContent: "center",
            }}
            onPress={() => setViewerUri(null)}
          >
            {viewerUri && videoURLFromPoster(viewerUri) ? (
              <ChatVideo uri={videoURLFromPoster(viewerUri) as string} />
            ) : viewerUri ? (
              <Image
                source={{ uri: viewerUri }}
                style={{ width: "100%", height: "82%" }}
                resizeMode="contain"
              />
            ) : null}
            <Pressable
              onPress={() => setViewerUri(null)}
              hitSlop={14}
              accessibilityRole="button"
              accessibilityLabel="Fermer la photo"
              style={{
                position: "absolute",
                top: insets.top + 12,
                right: 16,
                width: 42,
                height: 42,
                borderRadius: 21,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255,255,255,0.14)",
              }}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
          </Pressable>
        </Modal>

        {isTyping && (
          <View style={styles.typingBar}>
            <Text style={styles.typingText}>écrit…</Text>
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
                {replyTo.imageURL ? "Photo" : replyTo.text}
              </Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={() => setReplyTo(null)}>
              <Ionicons name="close" size={20} color={colors.muted} />
            </Pressable>
          </View>
        )}

        {editingId && (
          <View style={styles.replyBar}>
            <Text style={styles.replyBarLabel}>Modifier le message</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Fermer"
              onPress={() => {
                setEditingId(null);
                setText("");
              }}
            >
              <Ionicons name="close" size={20} color={colors.muted} />
            </Pressable>
          </View>
        )}

        {isActive && !text && !editingId && !messages.some((m) => m.senderId === profile?.id && !(m as any).deleted && !(m as any).type) && (
          <View style={styles.iceRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}>
              {[0, 1, 2].map((k) => {
                const q = ICEBREAKERS[(iceSeed + k * 7) % ICEBREAKERS.length];
                return (
                  <Pressable
                    key={q}
                    onPress={() => setText(q)}
                    style={({ pressed }) => [styles.iceChip, pressed && { opacity: 0.75 }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Utiliser : ${q}`}
                  >
                    <Text style={styles.iceTxt}>💡 {q}</Text>
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => setIceSeed((v) => v + 3)}
                style={({ pressed }) => [styles.iceChip, styles.iceMore, pressed && { opacity: 0.75 }]}
                accessibilityRole="button"
                accessibilityLabel="Autres idées"
              >
                <Ionicons name="shuffle" size={16} color={colors.text} />
              </Pressable>
            </ScrollView>
          </View>
        )}

        <View
          style={[
            styles.composerBar,
            { paddingBottom: kbOpen ? 8 : Math.max(insets.bottom, 10) },
          ]}
        >
          <Pressable accessibilityRole="button" accessibilityLabel="Prendre une photo"
            onPress={handlePhotoPress}
            disabled={sendingImage}
            style={({ pressed }) => [
              styles.roundBtn,
              (pressed || sendingImage) && { opacity: 0.6 },
            ]}
          >
            <Ionicons
              name={(sendingImage ? "hourglass-outline" : "camera") as any}
              size={22}
              color={colors.text}
            />
          </Pressable>
          <View style={styles.pill}>
            <TextInput
              value={text}
              onChangeText={handleTextChange}
              placeholder="Envoyer un chat"
              placeholderTextColor={colors.muted}
              style={[styles.pillInput, { fontSize: textSize }]}
              multiline
              onFocus={() => setShowEmojiPicker(false)}
            />
            <Pressable accessibilityRole="button" accessibilityLabel="Joindre" onPress={handleAttachPress} hitSlop={8}>
              <Ionicons name="attach" size={22} color={colors.muted} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Afficher ou masquer les emojis"
              onPress={() => {
                Keyboard.dismiss();
                setShowEmojiPicker((v) => !v);
              }}
              hitSlop={8}
            >
              <Ionicons
                name={showEmojiPicker ? "keypad-outline" : "happy-outline"}
                size={23}
                color={colors.muted}
              />
            </Pressable>
          </View>
          {text.trim().length > 0 ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Envoyer"
              onPress={send}
              style={({ pressed }) => [styles.sendBtn2, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name="arrow-up" size={22} color="#fff" />
            </Pressable>
          ) : (
            <>
              <GameLauncher onSelect={handleGameSelect} />
              <VoiceMessageButton onRecorded={handleAudioReady} maxSeconds={30} />
            </>
          )}
        </View>
      </KeyboardAvoidingView>

      {nexting && (
        <View style={styles.nextOverlay}>
          <ActivityIndicator color={colors.neonRed} size="large" />
          <Text style={styles.nextTitle}>Recherche d'un nouvel inconnu…</Text>
          <Pressable onPress={cancelNext} style={styles.nextCancel} accessibilityRole="button">
            <Text style={styles.nextCancelTxt}>Arrêter</Text>
          </Pressable>
        </View>
      )}

      <HouseAd visible={houseAd} onClose={() => closeHouseAd(false)} onPremium={() => closeHouseAd(true)} />

      <VimoxEmojiKeyboard
        open={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
        onEmoji={(e) => setText((v) => v + e)}
        onBackspace={() => setText((v) => removeLastGrapheme(v))}
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
            <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={() => setShowMedia(false)}>
              <Text style={styles.mediaClose}>✕</Text>
            </Pressable>
          </View>
          <FlatList
            data={mediaMessages}
            keyExtractor={(m) => m.id}
            numColumns={3}
            contentContainerStyle={{ padding: 8 }}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  setShowMedia(false);
                  setTimeout(() => setViewerUri(item.imageURL ?? null), 350);
                }}
                accessibilityRole="imagebutton"
                accessibilityLabel="Ouvrir la photo"
              >
                <Image
                  source={{ uri: item.imageURL }}
                  style={styles.mediaThumb}
                />
              </Pressable>
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
  head,
  partnerName,
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
  autoTranslate,
  onOpenImage,
}: {
  message: ChatMessage;
  head: boolean;
  partnerName?: string;
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
  autoTranslate: boolean;
  onOpenImage: (uri: string) => void;
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

  // Le texte des messages n'est envoyé au service de traduction (MyMemory) que si l'utilisateur
  // a activé la traduction automatique (Paramètres) ou le demande pour CE message.
  useEffect(() => {
    if (!autoTranslate || mine || !message.text || (message as any).type || isDeleted) return;
    translateText(message.text, getDeviceLang()).then((t) => {
      if (t && t !== message.text) setTranslated(t);
    });
  }, [message.text, autoTranslate]);

  async function translateNow() {
    const t = await translateText(message.text, getDeviceLang());
    if (t && t !== message.text) {
      setTranslated(t);
      setShowOriginal(false);
    } else {
      Alert.alert(
        "Traduction",
        "Rien à traduire : le message est déjà dans ta langue, ou le service est indisponible.",
      );
    }
  }

  function handleLongPress() {
    if (isDeleted) return;
    const actions: any[] = [
      { text: "😀 Réagir", onPress: () => setShowReactions(true) },
      { text: "↩️ Répondre", onPress: onReply },
      { text: "📋 Copier", onPress: onCopy },
      ...(!mine && message.text && !(message as any).type
        ? [{ text: "🌍 Traduire", onPress: translateNow }]
        : []),
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

  if ((message as any).type === "screenshot") {
    return (
      <View style={styles.sysRow}>
        <Ionicons name="camera-outline" size={14} color={colors.gold} />
        <Text style={styles.sysTxt}>{mine ? "Tu as fait une capture d'écran" : message.text}</Text>
      </View>
    );
  }

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
  const barColor = mine ? ME_BAR : THEM_BAR;

  return (
    <View>
      <Pressable
        onLongPress={handleLongPress}
        delayLongPress={300}
        style={[styles.msgRow, head && styles.msgHead]}
      >
        <View style={[styles.msgBar, { backgroundColor: barColor }]} />
        <View style={styles.msgBody}>
          {head && (
            <View style={styles.msgLabelRow}>
              <Text style={[styles.msgLabel, { color: barColor }]}>
                {mine ? "MOI" : (partnerName ?? "INCONNU").toUpperCase()}
              </Text>
              <Text style={styles.msgTime}>
                {new Date(message.sentAt).toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
              {mine && (
                <Ionicons
                  name={(isRead ? "checkmark-done" : "checkmark") as any}
                  size={13}
                  color={isRead ? colors.neonBlue : colors.mutedDark}
                />
              )}
            </View>
          )}
          {replyToText && !isDeleted && (
            <View style={styles.replyQuote}>
              <Text style={styles.replyQuoteTxt} numberOfLines={1}>
                {replyToSenderId === myId ? "Toi" : "Partenaire"} : {replyToText}
              </Text>
            </View>
          )}
          {message.imageURL && !isDeleted ? (
            <Pressable
              onPress={() => onOpenImage(message.imageURL as string)}
              onLongPress={handleLongPress}
              delayLongPress={300}
              accessibilityRole="imagebutton"
              accessibilityLabel="Ouvrir la photo"
            >
              <Image
                source={{ uri: message.imageURL }}
                style={styles.msgImage}
                resizeMode="cover"
              />
              {videoURLFromPoster(message.imageURL) ? (
                <View style={styles.playOverlay} pointerEvents="none">
                  <Ionicons name="play" size={36} color="#fff" />
                </View>
              ) : null}
            </Pressable>
          ) : isDeleted ? (
            <Text style={[styles.msgText, styles.deletedText]}>
              {mine ? "Tu as supprimé un chat" : `${partnerName ?? "L'inconnu"} a supprimé un chat`}
            </Text>
          ) : (
            <LinkifiedText
              text={displayText ?? ""}
              style={[
                styles.msgText,
                { fontSize: textSize },
                emojiBig && styles.bigEmoji,
              ]}
            />
          )}
          {!mine && translated && !isDeleted && (
            <Pressable onPress={() => setShowOriginal((v) => !v)}>
              <Text style={styles.translateToggle}>
                {showOriginal ? "Voir la traduction" : "Voir l'original"}
              </Text>
            </Pressable>
          )}
          {isEdited && !isDeleted && <Text style={styles.editedTag}>modifié</Text>}
          {reactionEntries.length > 0 && (
            <View style={styles.reactionsRow}>
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
        </View>
      </Pressable>
      {showReactions && (
        <View style={[styles.reactionPicker, { left: 28, right: undefined }]}>
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
  );
}

// Lecture d'une vidéo envoyée dans le chat
function ChatVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={{ width: "100%", height: "82%" }}
      contentFit="contain"
      nativeControls
    />
  );
}

const styles = StyleSheet.create({
  iceRow: { paddingVertical: 8 },
  iceChip: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iceMore: { width: 36, paddingHorizontal: 0, alignItems: "center" },
  iceTxt: { color: colors.text, fontSize: 13, fontWeight: "700" },
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
    backgroundColor: "rgba(255,46,77,0.2)",
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
    backgroundColor: "rgba(255,46,77,0.2)",
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
    backgroundColor: "rgba(255,46,77,0.2)",
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
  bubbleRow: { flexDirection: "row", paddingHorizontal: 14, marginTop: 8 },
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
    backgroundColor: "rgba(255,46,77,0.1)",
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
    backgroundColor: "rgba(255,46,77,0.15)",
    borderColor: "rgba(255,46,77,0.4)",
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
    backgroundColor: "rgba(255,46,77,0.25)",
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
  headerIcon: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  sysRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  sysTxt: { color: colors.gold, fontSize: 12, fontWeight: "700", textAlign: "center" },
  welcome: { alignItems: "center", paddingTop: 70, paddingHorizontal: 36, gap: 8 },
  welcomeIcon: { fontSize: 44 },
  welcomeTitle: { color: colors.text, fontSize: 17, fontWeight: "900" },
  welcomeTxt: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: "center" },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.neonRed,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  nextBtnTxt: { color: "#fff", fontSize: 13, fontWeight: "900" },
  leftBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(255,46,77,0.12)",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  leftTxt: { flex: 1, color: colors.text, fontSize: 13, fontWeight: "700" },
  leftBtn: { backgroundColor: colors.neonRed, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 },
  leftBtnTxt: { color: "#fff", fontSize: 12, fontWeight: "900" },
  interestBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  interestTxt: { flex: 1, color: colors.gold, fontSize: 12, fontWeight: "700" },
  nextOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(10,10,10,0.94)",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
  },
  nextTitle: { color: colors.text, fontSize: 17, fontWeight: "900" },
  nextCancel: {
    paddingHorizontal: 26,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nextCancelTxt: { color: colors.text, fontWeight: "800" },
  dayLabel: {
    alignSelf: "center",
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginVertical: 14,
  },
  msgList: { paddingVertical: 10 },
  msgRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingVertical: 2 },
  msgHead: { marginTop: 12 },
  msgBar: { width: 3, borderRadius: 2, alignSelf: "stretch" },
  msgBody: { flex: 1, gap: 2 },
  msgLabelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 1 },
  msgLabel: { fontSize: 11, fontWeight: "900", letterSpacing: 0.8 },
  msgTime: { color: colors.mutedDark, fontSize: 10, fontWeight: "600" },
  msgText: { color: colors.text, fontSize: 16, lineHeight: 22 },
  msgImage: { width: 220, height: 220, borderRadius: 12 },
  playOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 220,
    height: 220,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  composerBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 8,
    backgroundColor: colors.black,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  roundBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillInput: { flex: 1, color: colors.text, maxHeight: 100, paddingTop: 0, paddingBottom: 0 },
  sendBtn2: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neonRed,
    alignItems: "center",
    justifyContent: "center",
  },
});
