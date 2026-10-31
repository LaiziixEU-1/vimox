/*VIMOX-V25-capture*/
/*VIMOX-V28*/
/*VIMOX-V24*/
/*VIMOX-V18*/
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
import type { AlertButton } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { VimoxEmojiKeyboard, removeLastGrapheme } from "../components/VimoxEmojiKeyboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../services/AuthContext";
import { guardText } from "../services/moderationGuard";
import { blockUser, reportContent } from "../services/moderationService";
import { SafetySheet } from "../components/SafetySheet";
import { colors, gradients } from "../theme/colors";
import { LinearGradient } from "expo-linear-gradient";
import { Friend, RootStackParamList } from "../models/types";
import { removeFriend, subscribeFriends } from "../services/friendService";
import { VoiceMessageButton } from "../components/VoiceMessageButton";
import { SwipeToReply } from "../components/SwipeToReply";
import { Avatar } from "../components/Avatar";
import { ImageViewer } from "../components/ImageViewer";
import { useNextTip } from "../services/tipsService";
import { TipBubble } from "../components/TipBubble";
import { AudioBubble } from "../components/AudioBubble";
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from "../config/env";
import { getChatId, restoreStreak, subscribeStreakInfo, StreakInfo } from "../services/snapService";
import { getRestoreCreditsRemaining, useStreakRestore as consumeStreakRestore } from "../services/streakRestoreService";
import { buyItem, getStoreItems, isBillingReady, restoreFlameOnServer } from "../services/purchaseService";
import { getChatOpenedAt, loadChatState, markChatOpened } from "../services/chatListService";
import { FriendshipSheet } from "../components/FriendshipSheet";
import { getPrefs, loadPrefs } from "../services/chatPrefsService";
import { notifyFriendMessage } from "../services/notificationService";
import { GAME_INFO, GameLauncher } from "../games/GameLauncher";
import { GameType, createBotGame, createGame, friendGameChatId, postGameBubble } from "../games/gameService";
import { isReallyOnline } from "../services/presence";
import { useScreenshotNotice } from "../hooks/useScreenshotNotice";
import { logDenied } from "../services/firestoreErrors";

type Props = NativeStackScreenProps<RootStackParamList, "FriendChat">;

interface Reply {
  id: string;
  name: string;
  text: string;
}

interface FMsg {
  id: string;
  text?: string;
  imageURL?: string | null;
  audioURL?: string | null;
  audioDuration?: number;
  isSnap?: boolean;
  snapViewed?: boolean;
  duration?: number;
  senderUid: string;
  sentAt: number;
  replyTo?: Reply | null;
  reactions?: Record<string, string>;
  // Messages d'appel (type « call » : annonce, « call_ended » : fin d'appel)
  type?: string;
  callType?: "audio" | "video";
  callRoomId?: string;
  // Chats éphémères : message enregistré (gardé) et heure à laquelle l'ami l'a vu
  saved?: boolean;
  viewedAt?: number;
  // Message modifié (Vim+) : heure de la dernière modification
  editedAt?: number;
  // Invitation à jouer (🎮)
  gameId?: string;
  gameType?: string;
  // Supprimé : une ligne « Tu as supprimé un chat » reste à sa place (comme sur Snap)
  deleted?: boolean;
  deletedKind?: string;
}

type Item =
  | { type: "day"; id: string; label: string }
  | { type: "new"; id: string }
  | { type: "msg"; id: string; msg: FMsg; head: boolean };

// Couleurs façon Snap, adaptées au thème de l'app
const ME = colors.neonBlue;
const THEM = "#B4384D";
const SNAP_RED = "#D6445A";
const ONLINE = "#28F7A1";
const REACTIONS = ["❤️", "😂", "😮", "😢", "👍", "🔥"];

function Icon({
  name,
  size = 22,
  color = colors.text,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name as any} size={size} color={color} />;
}

function dayKey(ms: number) {
  return new Date(ms).toDateString();
}

function dayLabel(ms: number) {
  const d = new Date(ms);
  const now = new Date();
  const y = new Date();
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "Aujourd'hui";
  if (d.toDateString() === y.toDateString()) return "Hier";
  return d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function timeOf(ms: number) {
  return new Date(ms).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function lastSeenMs(v: any): number {
  if (!v) return 0;
  if (typeof v?.toMillis === "function") return v.toMillis();
  if (typeof v === "number") return v;
  return 0;
}

function formatLastSeen(v: any): string {
  const ms = lastSeenMs(v);
  if (!ms) return "";
  const mins = Math.floor((Date.now() - ms) / 60000);
  if (mins < 2) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.floor(hours / 24)} j`;
}

function previewOf(m: FMsg): string {
  if (m.isSnap) return "Vim";
  if (m.audioURL) return "Message vocal";
  if (m.imageURL) return "Photo";
  return m.text ?? "";
}

async function uploadToCloudinary(
  uri: string,
  kind: "image" | "audio",
): Promise<string> {
  const formData = new FormData();
  formData.append("file", {
    uri,
    type: kind === "audio" ? "audio/m4a" : "image/jpeg",
    name:
      kind === "audio" ? `audio_${Date.now()}.m4a` : `img_${Date.now()}.jpg`,
  } as any);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  if (kind === "audio") formData.append("resource_type", "video");
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${
      kind === "audio" ? "video" : "image"
    }/upload`,
    { method: "POST", body: formData },
  );
  const data = await res.json();
  if (!data.secure_url) {
    throw new Error(data?.error?.message ?? "Upload échoué");
  }
  return data.secure_url as string;
}

export function FriendChatScreen({ route, navigation }: Props) {
  const { friendId, friendName } = route.params;
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<FMsg[]>([]);
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [sending, setSending] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);
  const [friend, setFriend] = useState<Friend | null>(null);
  const [replyTo, setReplyTo] = useState<Reply | null>(null);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [kb, setKb] = useState(false);
  const listRef = useRef<FlatList<any>>(null);
  // Défilement intelligent : on ne redescend tout seul que si on est déjà en bas
  const nearBottom = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingWrite = useRef(0);
  const myId = profile?.id ?? "";
  const cid = getChatId(myId, friendId);
  // 💡 Astuces du chat (une seule fois chacune, quand il y a des messages)
  const { tip: chatTip, dismiss: dismissChatTip } = useNextTip(
    [
      { id: "chat_swipe", text: "Glisse un message vers la droite pour y répondre." },
      { id: "chat_heart", text: "Tape deux fois sur un message pour réagir avec ❤️." },
      { id: "chat_friendship", text: "Touche le nom de ton ami en haut pour voir votre profil d'amitié." },
    ],
    messages.length >= 2,
    1500,
  );
  // Ligne « Nouveaux messages » et profil d'amitié
  // lu tout de suite (la liste des chats l'a déjà chargé), avant que l'ouverture ne soit notée
  const [prevOpenedAt, setPrevOpenedAt] = useState(() => (myId ? getChatOpenedAt(myId, friendId) : 0));
  const [showFriendship, setShowFriendship] = useState(false);

  // ───── Chats éphémères (comme sur Snap) ─────
  // « viewed » : effacé quand vous l'avez vu tous les deux et quitté la conversation
  // « 24h »    : effacé au bout de 24 heures
  // « off »    : on garde tout
  type Ephemeral = "off" | "viewed" | "24h";
  const [ephemeral, setEphemeral] = useState<Ephemeral>("off");
  const openedAtRef = useRef(Date.now());
  const cleaned = useRef(new Set<string>());
  useEffect(
    () =>
      onSnapshot(
        doc(db, "friendChats", cid, "meta", "settings"),
        (snap) => {
          const v = snap.data()?.ephemeral;
          setEphemeral(v === "viewed" || v === "24h" ? v : "off");
        },
        () => {},
      ),
    [cid],
  );
  function isExpired(m: FMsg): boolean {
    if (ephemeral === "off" || m.saved || m.isSnap) return false;
    if (ephemeral === "24h") return Date.now() - m.sentAt > 24 * 3600 * 1000;
    return !!m.viewedAt && m.viewedAt < openedAtRef.current;
  }
  // Je marque « vus » les messages de mon ami (c'est ce qui lance l'effacement après lecture)
  useEffect(() => {
    if (!myId) return;
    messages
      .filter((m) => m.senderUid !== myId && !m.viewedAt && !m.isSnap && !(m as any).deleted)
      .slice(0, 25)
      .forEach((m) => {
        updateDoc(doc(db, "friendChats", cid, "messages", m.id), { viewedAt: serverTimestamp() }).catch(() => {});
      });
  }, [messages, myId, cid]);
  // J'efface pour de bon MES messages expirés (les règles ne laissent effacer que les siens)
  useEffect(() => {
    if (!myId || ephemeral === "off") return;
    messages
      .filter((m) => m.senderUid === myId && isExpired(m) && !cleaned.current.has(m.id))
      .slice(0, 50)
      .forEach((m) => {
        cleaned.current.add(m.id);
        deleteDoc(doc(db, "friendChats", cid, "messages", m.id)).catch(() => {});
      });
  }, [messages, ephemeral, myId, cid]);

  // ───── Flamme éteinte : la restaurer (Vim+ : 2 restaurations gratuites par mois) ─────
  const [streak, setStreak] = useState<StreakInfo | null>(null);
  const [restoring, setRestoring] = useState(false);
  useEffect(() => subscribeStreakInfo(cid, setStreak), [cid]);
  async function restoreFlame() {
    if (!profile || restoring) return;
    const billing = isBillingReady();
    const paid = Number((profile as any).paidRestores ?? 0);
    const done = () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert("🔥 Flamme restaurée !", "Envoyez-vous un Vim aujourd'hui pour la garder.");
    };
    // 1) Vim+ (2 par mois) ou restauration déjà achetée : le serveur s'en charge
    if (profile.isPremium === true || paid > 0) {
      setRestoring(true);
      try {
        const r = await restoreFlameOnServer(friendId);
        if (r.ok) return done();
        // Mode démo (serveur pas encore en ligne) : ancienne méthode, réservée aux tests
        if (!billing && profile.isPremium === true) {
          const left = await getRestoreCreditsRemaining(profile.id, true);
          if (left <= 0) {
            Alert.alert("Plus de restauration ce mois-ci", "Tu as déjà utilisé tes 2 restaurations gratuites de Vim+ ce mois-ci.");
            return;
          }
          await consumeStreakRestore(profile.id, true);
          await restoreStreak(cid);
          return done();
        }
        if ((r.code ?? "").includes("resource-exhausted") && profile.isPremium === true && paid === 0) {
          // Les 2 restaurations Vim+ du mois sont utilisées : on propose l'achat à l'unité
        } else {
          Alert.alert("Restauration impossible", r.message ?? "Réessaie plus tard.");
          return;
        }
      } finally {
        setRestoring(false);
      }
    }
    // 2) Sinon : acheter une restauration (ou découvrir Vim+)
    const items = billing ? await getStoreItems() : {};
    const item = items.restore;
    const buttons: any[] = [{ text: "Plus tard", style: "cancel" }];
    if (profile.isPremium !== true) {
      buttons.push({ text: "Vim+ (2 par mois)", onPress: () => (navigation as any).navigate("Premium") });
    }
    if (item) {
      buttons.push({
        text: `Restaurer · ${item.priceString}`,
        onPress: async () => {
          setRestoring(true);
          try {
            const b = await buyItem(item);
            if (!b.ok) {
              if (!b.cancelled) Alert.alert("Achat impossible", "Tu n'as pas été débité. Réessaie plus tard.");
              return;
            }
            const r = await restoreFlameOnServer(friendId);
            if (r.ok) done();
            else Alert.alert("Restauration en attente", "Ton achat est enregistré : touche à nouveau « Restaurer » dans un instant.");
          } finally {
            setRestoring(false);
          }
        },
      });
    }
    Alert.alert(
      "Restaurer la flamme",
      item
        ? `Rallume votre flamme avant qu'il ne soit trop tard.${profile.isPremium ? "" : " Avec Vim+, 2 restaurations par mois sont incluses."}`
        : profile.isPremium
          ? "Tu as utilisé tes 2 restaurations Vim+ du mois."
          : "La restauration des flammes est incluse dans Vim+ (2 par mois).",
      buttons,
    );
  }

  function chooseEphemeral() {
    if (!profile) return;
    const set = async (v: Ephemeral) => {
      try {
        await setDoc(doc(db, "friendChats", cid, "meta", "settings"), {
          ephemeral: v,
          by: profile.id,
          at: serverTimestamp(),
        });
        const label = v === "viewed" ? "pour qu'ils s'effacent après lecture" : v === "24h" ? "pour qu'ils s'effacent après 24 h" : "pour qu'ils ne s'effacent plus";
        await addDoc(collection(db, "friendChats", cid, "messages"), {
          type: "ephemeral",
          text: `${profile.name ?? "Ton ami"} a réglé les chats ${label}`,
          imageURL: null,
          audioURL: null,
          saved: true,
          senderUid: profile.id,
          sentAt: serverTimestamp(),
        });
      } catch {
        Alert.alert("Réglage non enregistré", "Vérifie ta connexion et réessaie.");
      }
    };
    Alert.alert("Effacer les chats", "Ce réglage s'applique à vous deux. Les messages déjà vus (ou de plus de 24 h) disparaîtront, sauf ceux que vous avez enregistrés.", [
      { text: `👁 Après lecture${ephemeral === "viewed" ? "  ✓" : ""}`, onPress: () => set("viewed") },
      { text: `⏱ Après 24 heures${ephemeral === "24h" ? "  ✓" : ""}`, onPress: () => set("24h") },
      { text: `💾 Jamais${ephemeral === "off" ? "  ✓" : ""}`, onPress: () => set("off") },
      { text: "Annuler", style: "cancel" },
    ]);
  }
  // Vim+ : chacun peut choisir la couleur de ses messages (Profil > Vim+)
  const myColor: string =
    (profile as any)?.isPremium === true && (profile as any)?.chatColor ? (profile as any).chatColor : ME;
  const theirColor: string = (friend as any)?.chatColor || THEM;

  // Comme sur Snap : ton ami voit dans la conversation que tu as fait une capture d'écran
  useScreenshotNotice(() => {
    if (!profile) return;
    addDoc(collection(db, "friendChats", cid, "messages"), {
      type: "screenshot",
      text: `${profile.name ?? "Ton ami"} a fait une capture d'écran du chat`,
      imageURL: null,
      audioURL: null,
      senderUid: profile.id,
      sentAt: serverTimestamp(),
    }).catch(() => {});
    // Comme sur Snap : ton ami reçoit aussi une notification
    notifyFriendMessage(friendId, profile.id, profile.name ?? "Ton ami", "📸 a fait une capture d'écran du chat").catch(() => {});
  }, !!profile);

  // Clavier visible ou non (sert à régler l'espace sous la barre du bas)
  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setKb(true),
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKb(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Conversation effacée chez moi (Gérer les chats) : on n'affiche que les messages plus récents
  const clearedRef = useRef(0);
  const [clearedTick, setClearedTick] = useState(0);
  useEffect(() => {
    if (!myId) return;
    loadPrefs(myId)
      .then(() => {
        clearedRef.current = getPrefs(myId).cleared[friendId] ?? 0;
        setClearedTick((n) => n + 1);
      })
      .catch(() => {});
  }, [myId, friendId]);

  // Messages
  useEffect(() => {
    // Conversation ouverte : tout ce qui arrive ici est vu (statut « Non lu » de la liste des amis)
    if (myId)
      loadChatState(myId)
        .then(() => {
          // Dernière ouverture AVANT celle-ci : les messages reçus après sont « nouveaux »
          setPrevOpenedAt((v) => v || getChatOpenedAt(myId, friendId));
          markChatOpened(myId, friendId);
        })
        .catch(() => {});
    const q = query(
      collection(db, "friendChats", cid, "messages"),
      orderBy("sentAt", "asc"),
    );
    const unsub = onSnapshot(q, (snap) => {
      if (myId) markChatOpened(myId, friendId);
      setMessages(
        snap.docs.map((d) => {
          const x = d.data();
          return {
            id: d.id,
            text: x.text,
            imageURL: x.imageURL ?? null,
            audioURL: x.audioURL ?? null,
            audioDuration: x.audioDuration ?? 0,
            isSnap: x.isSnap ?? false,
            snapViewed: x.snapViewed ?? false,
            duration: x.duration ?? 6,
            senderUid: x.senderUid,
            sentAt:
              x.sentAt instanceof Timestamp ? x.sentAt.toMillis() : Date.now(),
            replyTo: x.replyTo ?? null,
            reactions: x.reactions ?? undefined,
            type: x.type,
            callType: x.callType,
            callRoomId: x.callRoomId,
            saved: x.saved === true,
            viewedAt: lastSeenMs(x.viewedAt) || undefined,
            deleted: x.deleted === true,
            deletedKind: x.deletedKind,
            editedAt: lastSeenMs(x.editedAt) || undefined,
            gameId: x.gameId,
            gameType: x.gameType,
          } as FMsg;
        }).filter((m) => m.sentAt > clearedRef.current),
      );
    }, (e) => logDenied("messages du chat ami", e));
    return () => {
      unsub();
      if (myId) markChatOpened(myId, friendId);
    };
  }, [cid, clearedTick]);

  // Photo et statut de l'ami
  useEffect(() => {
    if (!profile) return;
    return subscribeFriends(profile.id, (list) =>
      setFriend(list.find((f) => f.id === friendId) ?? null),
    );
  }, [profile?.id, friendId]);

  // « écrit... »
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
    }, (e) => logDenied("« … écrit » du chat ami", e));
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
    if (typingTimer.current) clearTimeout(typingTimer.current);
    if (val.length === 0) {
      lastTypingWrite.current = 0;
      deleteDoc(tRef).catch(() => {});
      return;
    }
    // Une écriture toutes les 2,5 s au plus (avant : une par lettre tapée)
    const now = Date.now();
    if (now - lastTypingWrite.current > 2500) {
      lastTypingWrite.current = now;
      setDoc(tRef, { updatedAt: serverTimestamp() }).catch(() => {});
    }
    typingTimer.current = setTimeout(() => {
      lastTypingWrite.current = 0;
      deleteDoc(tRef).catch(() => {});
    }, 3000);
  }

  // Prévient l'ami (jamais s'il est déjà en ligne : il voit le message en direct)
  function notifyFriend(preview: string) {
    if (!profile || isReallyOnline(friend as any)) return;
    notifyFriendMessage(friendId, profile.id, profile.name ?? "Un ami", preview).catch(() => {});
  }

  // 🎮 Jouer avec son ami (ou contre l'ordinateur) : la partie est rangée dans votre conversation
  async function startGame(gameType: GameType, opts?: { bot?: boolean; level?: number }) {
    if (!profile) return;
    const chatId = friendGameChatId(cid);
    try {
      if (opts?.bot) {
        const gameId = await createBotGame(chatId, gameType, profile.id, opts.level ?? 2);
        navigation.navigate("GameScreen" as any, { chatId, gameId } as any);
        return;
      }
      const gameId = await createGame(chatId, gameType, profile.id, friendId);
      const label = GAME_INFO[gameType]?.label ?? "Jeu";
      await postGameBubble(chatId, gameId, gameType, profile.id, label);
      notifyFriendMessage(friendId, profile.id, profile.name ?? "Ton ami", `🎮 t'invite à jouer : ${label}`).catch(() => {});
      navigation.navigate("GameScreen" as any, { chatId, gameId } as any);
    } catch {
      Alert.alert("Jeu impossible", "Vérifie ta connexion et réessaie.");
    }
  }

  // ✏️ Modifier un message (Vim+, pendant 15 minutes)
  const [editing, setEditing] = useState<{ id: string } | null>(null);
  function startEdit(m: FMsg) {
    if (!profile) return;
    if (profile.isPremium !== true) {
      Alert.alert("Modifier un message", "Corriger un message après l'avoir envoyé est un avantage Vim+.", [
        { text: "Plus tard", style: "cancel" },
        { text: "Découvrir Vim+", onPress: () => (navigation as any).navigate("Premium") },
      ]);
      return;
    }
    if (Date.now() - m.sentAt > 15 * 60 * 1000) {
      Alert.alert("Trop tard", "On peut modifier un message pendant 15 minutes après l'avoir envoyé.");
      return;
    }
    setReplyTo(null);
    setEditing({ id: m.id });
    setText(m.text ?? "");
  }

  async function send() {
    if (!profile || !text.trim()) return;
    if (editing) {
      const verdictEdit = await guardText(text, { userId: profile.id, where: `friendChat:${cid}` });
      if (!verdictEdit.ok) {
        Alert.alert("Modification refusée", verdictEdit.message);
        return;
      }
      const id = editing.id;
      const val = text.trim();
      setEditing(null);
      setText("");
      updateDoc(doc(db, "friendChats", cid, "messages", id), { text: val, editedAt: serverTimestamp() }).catch(() =>
        Alert.alert("Modification impossible", "Vérifie ta connexion et réessaie."),
      );
      return;
    }
    const verdict = await guardText(text, {
      userId: profile.id,
      where: `friendChat:${cid}`,
    });
    if (!verdict.ok) {
      Alert.alert("Message non envoyé", verdict.message);
      return;
    }
    const val = text.trim();
    const reply = replyTo;
    setText("");
    setReplyTo(null);
    deleteDoc(doc(db, "friendChats", cid, "typing", profile.id)).catch(
      () => {},
    );
    try {
      await addDoc(collection(db, "friendChats", cid, "messages"), {
        text: val,
        imageURL: null,
        audioURL: null,
        senderUid: profile.id,
        sentAt: serverTimestamp(),
        ...(reply ? { replyTo: reply } : {}),
      });
      notifyFriend(val);
    } catch (e: any) {
      setText(val);
      Alert.alert("Erreur", `Message non envoyé : ${e?.message ?? e}`);
    }
  }

  async function sendImage(uri: string) {
    if (!profile) return;
    const reply = replyTo;
    setSending(true);
    try {
      const url = await uploadToCloudinary(uri, "image");
      await addDoc(collection(db, "friendChats", cid, "messages"), {
        text: "",
        imageURL: url,
        audioURL: null,
        senderUid: profile.id,
        sentAt: serverTimestamp(),
        ...(reply ? { replyTo: reply } : {}),
      });
      setReplyTo(null);
      notifyFriend("📷 Photo");
    } catch (e: any) {
      Alert.alert(
        "Erreur",
        `Impossible d'envoyer la photo : ${e?.message ?? e}`,
      );
    } finally {
      setSending(false);
    }
  }

  async function sendAudio(uri: string, duration: number) {
    if (!profile) return;
    const reply = replyTo;
    setSending(true);
    try {
      const url = await uploadToCloudinary(uri, "audio");
      await addDoc(collection(db, "friendChats", cid, "messages"), {
        text: "",
        imageURL: null,
        audioURL: url,
        audioDuration: duration,
        senderUid: profile.id,
        sentAt: serverTimestamp(),
        ...(reply ? { replyTo: reply } : {}),
      });
      setReplyTo(null);
      notifyFriend("🎤 Message vocal");
    } catch (e: any) {
      Alert.alert(
        "Erreur",
        `Impossible d'envoyer l'audio : ${e?.message ?? e}`,
      );
    } finally {
      setSending(false);
    }
  }

  async function pickFromGallery() {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"] as any,
        quality: 0.9,
      });
      if (!res.canceled && res.assets?.[0]) await sendImage(res.assets[0].uri);
    } catch (e: any) {
      Alert.alert(
        "Galerie",
        `Impossible d'ouvrir la galerie : ${e?.message ?? e}`,
      );
    }
  }

  // L'appareil photo envoie un Snap directement à cet ami
  function openCamera() {
    navigation.navigate("CameraDirect", {
      directSendTo: { friendId, friendName },
    });
  }

  // Nouvel appel : la salle porte un nom aléatoire (impossible à deviner), partagé via le message d'appel
  function startCall(video: boolean) {
    const callId = `${cid}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    navigation.navigate("VideoCall", {
      roomId: callId,
      audioOnly: !video,
      friend: { cid, friendId, friendName: friendName ?? "" },
    });
  }
  async function reportFriend(reason: string) {
    if (!profile) return;
    await reportContent({
      reporterId: profile.id,
      reportedId: friendId,
      kind: "friendChat",
      reason,
      chatId: cid,
    });
  }
  async function blockFriend() {
    if (!profile) return;
    await blockUser(profile.id, friendId);
    await removeFriend(profile.id, friendId).catch(() => {});
    navigation.goBack();
  }

  function joinCall(m: FMsg) {
    if (!m.callRoomId) return;
    navigation.navigate("VideoCall", {
      roomId: m.callRoomId,
      audioOnly: m.callType === "audio",
      joining: true,
      friend: { cid, friendId, friendName: friendName ?? "" },
    });
  }
  // Un appel annoncé reste « rejoignable » tant qu'aucun message « Appel terminé » ne le suit
  const lastCallEndedAt = messages.reduce(
    (a, m) => (m.type === "call_ended" && m.sentAt > a ? m.sentAt : a),
    0,
  );

  // --- Actions sur un message (appui long) ---
  async function setReaction(m: FMsg, emoji: string | null) {
    if (!profile) return;
    try {
      await updateDoc(doc(db, "friendChats", cid, "messages", m.id), {
        [`reactions.${profile.id}`]: emoji ?? deleteField(),
      });
    } catch (e: any) {
      Alert.alert("Erreur", `Réaction impossible : ${e?.message ?? e}`);
    }
  }

  function pickReaction(m: FMsg) {
    const current = m.reactions?.[myId];
    const buttons: AlertButton[] = REACTIONS.map((e) => ({
      text: e,
      onPress: () => setReaction(m, current === e ? null : e),
    }));
    buttons.push({ text: "Annuler", style: "cancel" });
    Alert.alert("Réagir", undefined, buttons);
  }

  function confirmDelete(m: FMsg) {
    Alert.alert("Supprimer ce message ?", `Il sera supprimé pour vous deux. ${friendName} verra que tu as supprimé quelque chose.`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            const kind = m.isSnap ? "snap" : m.audioURL ? "audio" : m.imageURL ? "photo" : "chat";
            await updateDoc(doc(db, "friendChats", cid, "messages", m.id), {
              deleted: true,
              deletedKind: kind,
              deletedAt: serverTimestamp(),
              text: "",
              imageURL: null,
              videoURL: null,
              audioURL: null,
              musicURL: null,
              musicMeta: null,
              replyTo: null,
              reactions: {},
            });
          } catch (e: any) {
            Alert.alert(
              "Erreur",
              `Suppression impossible : ${e?.message ?? e}`,
            );
          }
        },
      },
    ]);
  }

  function openMessageMenu(m: FMsg) {
    if (m.deleted) return;
    Haptics.selectionAsync().catch(() => {});
    const mine = m.senderUid === myId;
    const pinBtn: AlertButton[] =
      !m.isSnap && !m.type
        ? [
            pinned?.messageId === m.id
              ? { text: "📌 Désépingler", onPress: () => setPin(null) }
              : { text: "📌 Épingler", onPress: () => setPin(m) },
          ]
        : [];
    const editBtn: AlertButton[] =
      mine && !m.isSnap && !m.type && !m.imageURL && !m.audioURL && !!m.text
        ? [{ text: "✏️ Modifier", onPress: () => startEdit(m) }]
        : [];
    const buttons: AlertButton[] = [
      ...editBtn,
      ...pinBtn,
      {
        text: "Répondre",
        onPress: () =>
          setReplyTo({
            id: m.id,
            name: mine ? "Toi" : friendName,
            text: previewOf(m),
          }),
      },
      { text: "Réagir", onPress: () => pickReaction(m) },
    ];
    if (m.text) {
      buttons.push({
        text: "Copier",
        onPress: () => {
          Clipboard.setStringAsync(m.text ?? "").catch(() => {});
        },
      });
    }
    if (ephemeral !== "off" && !m.isSnap) {
      buttons.push({
        text: m.saved ? "Ne plus enregistrer" : "💾 Enregistrer dans le chat",
        onPress: () => {
          updateDoc(doc(db, "friendChats", cid, "messages", m.id), { saved: !m.saved }).catch(() => {});
        },
      });
    }
    if (mine) {
      buttons.push({
        text: "Supprimer",
        style: "destructive",
        onPress: () => confirmDelete(m),
      });
    }
    buttons.push({ text: "Annuler", style: "cancel" });
    Alert.alert("Message", undefined, buttons);
  }

  // Double tap sur un message = ❤️ (comme sur Snap / Instagram)
  const lastTap = useRef<{ id: string; at: number }>({ id: "", at: 0 });
  function onMessageTap(m: FMsg, mine: boolean) {
    if (searching) {
      jumpTo(m.id);
      return;
    }
    if (m.isSnap || m.imageURL || m.deleted || m.type) {
      onMessagePress(m, mine);
      return;
    }
    const now = Date.now();
    if (lastTap.current.id === m.id && now - lastTap.current.at < 320) {
      lastTap.current = { id: "", at: 0 };
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setReaction(m, m.reactions?.[myId] === "❤️" ? null : "❤️");
      return;
    }
    lastTap.current = { id: m.id, at: now };
  }

  function onMessagePress(m: FMsg, mine: boolean) {
    if (m.isSnap) {
      if (!m.imageURL) return;
      navigation.navigate("SnapViewer", {
        imageURL: m.imageURL,
        chatId: cid,
        messageId: m.id,
        senderName: mine ? "Toi" : friendName,
        senderUid: m.senderUid,
        duration: m.duration,
      });
      return;
    }
    if (m.imageURL) setViewerUri(m.imageURL);
  }

  // Liste : séparateurs de jour + regroupement des messages d'une même personne
  // Mon dernier message (hors appels / lignes automatiques) : sert à afficher « Vu · 14:32 »
  const lastMineId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.type || m.deleted) continue;
      if (m.senderUid !== myId) return null; // l'ami a répondu après : inutile
      return m.id;
    }
    return null;
  }, [messages, myId]);

  const items = useMemo(() => {
    const out: Item[] = [];
    let newMarked = false;
    let prev: FMsg | null = null;
    for (const m of messages) {
      if (isExpired(m)) continue;
      const newDay = !prev || dayKey(prev.sentAt) !== dayKey(m.sentAt);
      if (newDay) {
        out.push({
          type: "day",
          id: `d_${dayKey(m.sentAt)}`,
          label: dayLabel(m.sentAt),
        });
      }
      const head =
        newDay ||
        !prev ||
        prev.senderUid !== m.senderUid ||
        m.sentAt - prev.sentAt > 5 * 60 * 1000;
      if (!newMarked && prevOpenedAt > 0 && m.senderUid !== myId && !m.type && m.sentAt > prevOpenedAt) {
        newMarked = true;
        out.push({ type: "new", id: "new-messages" });
      }
      out.push({ type: "msg", id: m.id, msg: m, head });
      prev = m;
    }
    return out;
  }, [messages, ephemeral, prevOpenedAt, myId]);

  // ── 📌 Message épinglé (commun aux deux) ──
  const [pinned, setPinned] = useState<{ messageId: string; text: string; by: string } | null>(null);
  useEffect(
    () =>
      onSnapshot(
        doc(db, "friendChats", cid, "meta", "pin"),
        (snap) => {
          const d: any = snap.data();
          setPinned(d?.messageId ? { messageId: d.messageId, text: String(d.text ?? ""), by: String(d.by ?? "") } : null);
        },
        () => setPinned(null),
      ),
    [cid],
  );
  function setPin(m: FMsg | null) {
    if (!profile) return;
    const ref = doc(db, "friendChats", cid, "meta", "pin");
    if (!m) {
      deleteDoc(ref).catch(() => {});
      return;
    }
    setDoc(ref, { messageId: m.id, text: previewOf(m).slice(0, 200), by: profile.id, at: serverTimestamp() }).catch(() =>
      Alert.alert("Impossible d'épingler", "Vérifie ta connexion et réessaie."),
    );
  }

  // ── 🔍 Recherche dans la conversation ──
  const [searchQ, setSearchQ] = useState<string | null>(null);
  const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const searching = searchQ !== null && searchQ.trim().length >= 2;
  const searchItems = useMemo(() => {
    if (!searching) return [];
    const q = norm(searchQ!.trim());
    return items.filter((i) => i.type === "msg" && !!i.msg.text && !i.msg.deleted && norm(i.msg.text).includes(q));
  }, [searching, searchQ, items]);
  function jumpTo(id: string) {
    setSearchQ(null);
    setTimeout(() => {
      const idx = items.findIndex((i) => i.id === id);
      if (idx >= 0) listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.5 });
    }, 350);
  }


  // Statut dans l'en-tête
  let status = "";
  let statusColor: string = colors.muted;
  if (friendTyping) {
    status = "écrit…";
    statusColor = colors.neonRedText;
  } else if (friend?.isOnline) {
    status = "En ligne";
    statusColor = ONLINE;
  } else {
    const seen = formatLastSeen(friend?.lastSeen);
    status = seen ? `Vu ${seen}` : "";
  }

  const hasText = !!text.trim();

  return (
    <View style={s.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {/* En-tête */}
        <View style={[s.header, { paddingTop: Math.max(insets.top, 44) + 4 }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={10}
            style={s.backBtn}
          >
            <Icon name="chevron-back" size={28} />
          </Pressable>
          <Pressable
            onPress={() => setShowFriendship(true)}
            style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}
            accessibilityRole="button"
            accessibilityLabel={`Profil d'amitié avec ${friendName}`}
          >
          <View style={s.avatarWrap}>
            {/* Même avatar que partout ailleurs (photo en cache, ou initiales sur dégradé) */}
            <Avatar uri={friend?.profilePhotoURL} name={friendName} size={42} />
            {friend?.isOnline && <View style={s.onlineDot} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.partnerName} numberOfLines={1}>
              {friendName}
            </Text>
            {!!status && (
              <Text
                style={[s.statusTxt, { color: statusColor }]}
                numberOfLines={1}
              >
                {status}
              </Text>
            )}
          </View>
          </Pressable>
          <Pressable
            onPress={chooseEphemeral}
            hitSlop={8}
            style={s.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Réglage d'effacement des chats"
          >
            <Icon name="timer-outline" size={21} color={ephemeral === "off" ? colors.text : colors.gold} />
          </Pressable>
          <Pressable
            onPress={() => startCall(false)}
            hitSlop={8}
            style={s.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Appel vocal"
          >
            <Icon name="call-outline" size={22} />
          </Pressable>
          <Pressable
            onPress={() => startCall(true)}
            hitSlop={8}
            style={s.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Appel vidéo"
          >
            <Icon name="videocam-outline" size={25} />
          </Pressable>
          <Pressable
            onPress={() => setSafetyOpen(true)}
            hitSlop={8}
            style={s.iconBtn}
            accessibilityRole="button"
            accessibilityLabel="Plus d'options : signaler ou bloquer"
          >
            <Icon name="ellipsis-vertical" size={20} />
          </Pressable>
        </View>
        {searchQ !== null && (
          <View style={s.searchBar}>
            <Icon name="search" size={18} color={colors.muted} />
            <TextInput
              value={searchQ}
              onChangeText={setSearchQ}
              placeholder="Rechercher un message…"
              placeholderTextColor={colors.muted}
              style={s.searchInput}
              autoFocus
              autoCorrect={false}
              returnKeyType="search"
            />
            {searching && (
              <Text style={s.searchCount}>
                {searchItems.length} résultat{searchItems.length > 1 ? "s" : ""}
              </Text>
            )}
            <Pressable onPress={() => setSearchQ(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fermer la recherche">
              <Icon name="close" size={20} color={colors.text} />
            </Pressable>
          </View>
        )}
        {pinned && searchQ === null && (
          <View style={s.pinBar}>
            <Pressable
              onPress={() => jumpTo(pinned.messageId)}
              style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Aller au message épinglé"
            >
              <Text style={{ fontSize: 15 }}>📌</Text>
              <Text style={s.pinTxt} numberOfLines={1}>{pinned.text || "Message épinglé"}</Text>
            </Pressable>
            <Pressable onPress={() => setPin(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Désépingler">
              <Icon name="close" size={18} color={colors.muted} />
            </Pressable>
          </View>
        )}
        <SafetySheet
          visible={safetyOpen}
          title={friendName ?? "cet ami"}
          onClose={() => setSafetyOpen(false)}
          onReport={reportFriend}
          onBlock={blockFriend}
        />

        {/* Messages */}
        <View style={{ flex: 1 }}>
        <FlatList
          ref={listRef}
          // Fluidité : seuls les messages proches de l'écran sont dessinés
          initialNumToRender={20}
          maxToRenderPerBatch={12}
          windowSize={11}
          data={searching ? searchItems : items}
          keyExtractor={(i) => i.id}
          onScrollToIndexFailed={(info) => {
            listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
            setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 }), 300);
          }}
          contentContainerStyle={s.msgs}
          onContentSizeChange={() => {
            const last = items[items.length - 1];
            const lastMine = last?.type === "msg" && last.msg.senderUid === myId;
            if (nearBottom.current || lastMine) {
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
          ListHeaderComponent={
            <>
              {streak?.canRestore && (
                <Pressable onPress={restoreFlame} disabled={restoring} style={s.restoreBar} accessibilityRole="button">
                  <Text style={s.restoreTxt}>🔥 Votre flamme s'est éteinte</Text>
                  <Text style={s.restoreBtn}>{restoring ? "…" : "Restaurer"}</Text>
                </Pressable>
              )}
              {ephemeral !== "off" ? (
                <Text style={s.ephBanner}>
                  {ephemeral === "viewed"
                    ? "👁 Les chats s'effacent après lecture · appui long pour en enregistrer un"
                    : "⏱ Les chats s'effacent après 24 h · appui long pour en enregistrer un"}
                </Text>
              ) : null}
            </>
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Icon
                name="chatbubbles-outline"
                size={48}
                color={colors.mutedDark}
              />
              <Text style={s.emptyTxt}>Dis bonjour à {friendName} !</Text>
            </View>
          }
          ListFooterComponent={
            friendTyping ? (
              <View style={[s.msgRow, s.msgHead]}>
                <View style={[s.bar, { backgroundColor: THEM }]} />
                <View style={s.msgBody}>
                  <Text style={[s.label, { color: THEM }]}>
                    {friendName.toUpperCase()}
                  </Text>
                  <Text style={s.typingDots}>● ● ●</Text>
                </View>
              </View>
            ) : undefined
          }
          renderItem={({ item }) => {
            if (item.type === "day") {
              return <Text style={s.day}>{item.label}</Text>;
            }
            if (item.type === "new") {
              return (
                <View style={s.newRow}>
                  <View style={s.newLine} />
                  <Text style={s.newTxt}>Nouveaux messages</Text>
                  <View style={s.newLine} />
                </View>
              );
            }
            const m = item.msg;
            const mine = m.senderUid === myId;
            const color = mine ? myColor : theirColor;
            const emojiOnly =
              !m.audioURL &&
              !m.imageURL &&
              !m.isSnap &&
              [...(m.text ?? "")].length <= 3 &&
              /\p{Emoji}/u.test(m.text ?? "");

            // Réactions regroupées
            const counts: Record<string, number> = {};
            Object.values(
              (m.reactions ?? {}) as Record<string, string>,
            ).forEach((e) => {
              counts[e] = (counts[e] ?? 0) + 1;
            });
            const reactionEntries = Object.entries(counts);

            if (m.type === "screenshot") {
              return (
                <View style={s.sysRow}>
                  <Icon name="camera-outline" size={14} color={colors.gold} />
                  <Text style={s.sysTxt}>
                    {mine
                      ? `Tu as fait une capture d'écran ${(m.text ?? "").includes("Vim") ? "du Vim" : "du chat"}`
                      : m.text}
                  </Text>
                </View>
              );
            }
            if (m.type === "game" && m.gameId) {
              // 🎮 Invitation à jouer : touche pour ouvrir la partie
              const g = GAME_INFO[(m.gameType ?? "") as GameType];
              return (
                <View style={[s.msgRow, item.head && s.msgHead]}>
                  <Pressable
                    onPress={() => navigation.navigate("GameScreen" as any, { chatId: friendGameChatId(cid), gameId: m.gameId } as any)}
                    style={({ pressed }) => [s.gameBubble, pressed && { opacity: 0.85 }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Jouer : ${g?.label ?? "jeu"}`}
                  >
                    <Text style={{ fontSize: 30 }}>{g?.emoji ?? "🎮"}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.gameTitle}>{g?.label ?? "Jeu"}</Text>
                      <Text style={s.gameSub}>
                        {m.senderUid === myId ? "Tu as lancé une partie · touche pour jouer" : `${friendName} t'invite · touche pour jouer`}
                      </Text>
                    </View>
                    <Icon name="chevron-forward" size={18} color={colors.muted} />
                  </Pressable>
                </View>
              );
            }
            if (m.type === "ephemeral" || m.type === "gift") {
              // Lignes dorées : réglage d'effacement, ou Pass Vim+ offert
              return (
                <View style={s.ephRow}>
                  <Icon name={m.type === "gift" ? "gift-outline" : "timer-outline"} size={13} color={colors.gold} />
                  <Text style={s.ephTxt}>{m.text}</Text>
                </View>
              );
            }
            if (m.deleted) {
              const what =
                ({ snap: "un Vim", photo: "une photo", audio: "un message vocal", chat: "un chat" } as Record<string, string>)[
                  m.deletedKind ?? "chat"
                ] ?? "un chat";
              return (
                <View style={s.delRow}>
                  <Icon name="trash-outline" size={13} color={colors.muted} />
                  <Text style={s.delTxt}>{mine ? `Tu as supprimé ${what}` : `${friendName} a supprimé ${what}`}</Text>
                </View>
              );
            }
            let content;
            if (m.type === "call" || m.type === "call_ended") {
              const ended = m.type === "call_ended";
              const video = m.callType === "video";
              const joinable =
                !ended &&
                m.sentAt > lastCallEndedAt &&
                Date.now() - m.sentAt < 30 * 60 * 1000;
              const secs = m.duration ?? 0;
              const clock = `${String(Math.floor(secs / 60)).padStart(2, "0")}:${String(secs % 60).padStart(2, "0")}`;
              content = (
                <View style={s.callRow}>
                  <View style={s.callIcon}>
                    <Icon name={!ended && video ? "videocam" : "call"} size={18} color="#fff" />
                  </View>
                  <View style={{ flexShrink: 1 }}>
                    <Text style={s.callTitle}>
                      {ended ? "Appel terminé" : video ? "Appel vidéo" : "Appel vocal"}
                    </Text>
                    <Text style={s.callSub}>
                      {ended
                        ? clock
                        : mine
                          ? "Tu as appelé"
                          : `${friendName} t'appelle`}
                    </Text>
                  </View>
                  {joinable && (
                    <Pressable
                      onPress={() => joinCall(m)}
                      accessibilityRole="button"
                      accessibilityLabel="Rejoindre l'appel"
                      style={s.callJoin}
                    >
                      <Text style={s.callJoinTxt}>Rejoindre</Text>
                    </Pressable>
                  )}
                </View>
              );
            } else if (m.isSnap) {
              const opened = !!m.snapViewed;
              const label = mine
                ? opened
                  ? "Ouvert"
                  : "Envoyé"
                : opened
                  ? "Ouvert"
                  : "Touche pour voir";
              const icon = mine
                ? opened
                  ? "send-outline"
                  : "send"
                : opened
                  ? "square-outline"
                  : "square";
              content = (
                <View style={s.snapRow}>
                  <Icon name={icon} size={18} color={SNAP_RED} />
                  <Text style={[s.snapTxt, opened && s.snapTxtOpened]}>
                    {label}
                  </Text>
                </View>
              );
            } else if (m.audioURL) {
              content = (
                <AudioBubble
                  uri={m.audioURL}
                  duration={m.audioDuration ?? 0}
                  mine={mine}
                />
              );
            } else if (m.imageURL) {
              content = (
                <ExpoImage
                  source={{ uri: m.imageURL }}
                  style={s.img}
                  contentFit="cover"
                />
              );
            } else {
              content = (
                <Text style={[s.txt, emojiOnly && s.bigEmoji]}>
                  {m.text}
                  {m.editedAt ? <Text style={s.editedTxt}>  · modifié</Text> : null}
                </Text>
              );
            }

            return (
              <SwipeToReply
                enabled={!m.type}
                onReply={() => setReplyTo({ id: m.id, name: mine ? "Toi" : friendName, text: previewOf(m) })}
              >
              <Pressable
                onPress={() => onMessageTap(m, mine)}
                onLongPress={() => openMessageMenu(m)}
                delayLongPress={300}
                style={[s.msgRow, item.head && s.msgHead, m.saved && ephemeral !== "off" && m.type !== "ephemeral" && s.savedRow]}
              >
                <View style={[s.bar, { backgroundColor: color }]} />
                <View style={s.msgBody}>
                  {item.head && (
                    <View style={s.labelRow}>
                      <Text style={[s.label, { color }]}>
                        {mine ? "MOI" : friendName.toUpperCase()}
                      </Text>
                      <Text style={s.labelTime}>{timeOf(m.sentAt)}</Text>
                    </View>
                  )}
                  {m.replyTo && (
                    <View style={s.reply}>
                      <Text style={s.replyName}>{m.replyTo.name}</Text>
                      <Text style={s.replyTxt} numberOfLines={1}>
                        {m.replyTo.text}
                      </Text>
                    </View>
                  )}
                  {content}
                  {mine && m.id === lastMineId && !m.isSnap && (
                    <Text style={s.seenTxt}>{m.viewedAt ? `Vu · ${timeOf(m.viewedAt)}` : "Envoyé"}</Text>
                  )}
                  {reactionEntries.length > 0 && (
                    <View style={s.reactRow}>
                      {reactionEntries.map(([e, c]) => (
                        <View key={e} style={s.reactChip}>
                          <Text style={s.reactTxt}>
                            {e}
                            {c > 1 ? ` ${c}` : ""}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </Pressable>
              </SwipeToReply>
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

        {/* Réponse en cours */}
        {editing && (
          <View style={s.replyBar}>
            <View style={[s.bar, { backgroundColor: colors.gold }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.replyName}>✏️ Modification du message</Text>
              <Text style={s.replyTxt} numberOfLines={1}>Corrige ton texte puis envoie</Text>
            </View>
            <Pressable
              onPress={() => {
                setEditing(null);
                setText("");
              }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Annuler la modification"
            >
              <Icon name="close" size={20} color={colors.muted} />
            </Pressable>
          </View>
        )}
        {replyTo && (
          <View style={s.replyBar}>
            <View style={[s.bar, { backgroundColor: THEM }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.replyName}>Réponse à {replyTo.name}</Text>
              <Text style={s.replyTxt} numberOfLines={1}>
                {replyTo.text}
              </Text>
            </View>
            <Pressable onPress={() => setReplyTo(null)} hitSlop={10}>
              <Icon name="close" size={20} color={colors.muted} />
            </Pressable>
          </View>
        )}

        {sending && (
          <View style={s.sendingRow}>
            <ActivityIndicator size="small" color={colors.muted} />
            <Text style={s.sendingTxt}>Envoi en cours…</Text>
          </View>
        )}

        {/* Barre du bas façon Snap */}
        <View
          style={[
            s.composer,
            { paddingBottom: kb ? 8 : Math.max(insets.bottom, 10) },
          ]}
        >
          <GameLauncher onSelect={startGame} who="ami" />
          <Pressable
            onPress={openCamera}
            style={({ pressed }) => [s.camBtn, pressed && { transform: [{ scale: 0.94 }] }]}
            accessibilityRole="button"
            accessibilityLabel={`Envoyer un Vim à ${friendName}`}
          >
            <LinearGradient colors={gradients.brand as unknown as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <Icon name="camera" size={22} color="#fff" />
          </Pressable>

          <View style={s.pill}>
            <TextInput
              value={text}
              onChangeText={handleTextChange}
              placeholder={editing ? "Corrige ton message…" : `Écrire à ${friendName}…`}
              placeholderTextColor={colors.muted}
              style={s.input}
              multiline
              onFocus={() => setShowEmoji(false)}
            />
            <Pressable
              onPress={() => {
                Keyboard.dismiss();
                setShowEmoji((v) => !v);
              }}
              hitSlop={8}
            >
              <Icon
                name={showEmoji ? "keypad-outline" : "happy-outline"}
                size={23}
                color={colors.muted}
              />
            </Pressable>
          </View>

          {hasText ? (
            <Pressable
              onPress={send}
              style={({ pressed }) => [s.sendBtn, pressed && { transform: [{ scale: 0.94 }] }]}
              accessibilityRole="button"
              accessibilityLabel={editing ? "Enregistrer la modification" : "Envoyer"}
            >
              <LinearGradient colors={gradients.brand as unknown as [string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
              <Icon name={editing ? "checkmark" : "arrow-up"} size={22} color="#fff" />
            </Pressable>
          ) : (
            <>
              <VoiceMessageButton onRecorded={sendAudio} />
              <Pressable
                onPress={pickFromGallery}
                disabled={sending}
                style={({ pressed }) => [
                  s.roundBtn,
                  (pressed || sending) && { opacity: 0.6 },
                ]}
              >
                <Icon name="image-outline" size={22} />
              </Pressable>
            </>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* Photo en plein écran : zoom, glisser pour fermer, enregistrer, partager */}
      <ImageViewer uri={viewerUri} onClose={() => setViewerUri(null)} />

      {chatTip && <TipBubble text={chatTip.text} onDismiss={dismissChatTip} bottom={110} />}

      {profile && (
        <FriendshipSheet
          visible={showFriendship}
          onClose={() => setShowFriendship(false)}
          me={profile.id}
          friend={{ id: friendId, name: friendName, photo: friend?.profilePhotoURL ?? null }}
          onProfile={() => {
            setShowFriendship(false);
            navigation.navigate("UserProfile", { userId: friendId });
          }}
          onSendVim={() => {
            setShowFriendship(false);
            openCamera();
          }}
          onSearch={() => {
            setShowFriendship(false);
            setSearchQ("");
          }}
        />
      )}

      <VimoxEmojiKeyboard
        open={showEmoji}
        onClose={() => setShowEmoji(false)}
        onEmoji={(e) => setText((v) => v + e)}
        onBackspace={() => setText((v) => removeLastGrapheme(v))}
      />
    </View>
  );
}

const s = StyleSheet.create({
  restoreBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,140,0,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,140,0,0.45)",
  },
  restoreTxt: { color: colors.text, fontSize: 13, fontWeight: "700" },
  restoreBtn: { color: "#FF9F1C", fontSize: 13, fontWeight: "900" },
  newRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, marginVertical: 12 },
  newLine: { flex: 1, height: 1, backgroundColor: colors.neonRed, opacity: 0.6 },
  newTxt: { color: colors.neonRedText, fontSize: 11, fontWeight: "900", letterSpacing: 0.6, textTransform: "uppercase" },
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
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 0 },
  searchCount: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  gameBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    maxWidth: 300,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(255,194,75,0.45)",
  },
  gameTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
  gameSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  editedTxt: { color: colors.mutedDark, fontSize: 11, fontWeight: "700", fontStyle: "italic" },
  seenTxt: { color: colors.mutedDark, fontSize: 11, fontWeight: "700", marginTop: 2 },
  delRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 29, paddingVertical: 6 },
  delTxt: { color: colors.muted, fontSize: 12, fontStyle: "italic" },
  ephBanner: { color: colors.muted, fontSize: 12, textAlign: "center", paddingHorizontal: 24, paddingVertical: 10 },
  ephRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 24 },
  ephTxt: { color: colors.gold, fontSize: 12, fontWeight: "700", textAlign: "center", flexShrink: 1 },
  savedRow: { backgroundColor: "rgba(255,255,255,0.05)" },
  sysRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 24,
  },
  sysTxt: { color: colors.gold, fontSize: 12, fontWeight: "700", textAlign: "center" },
  callRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 2 },
  callIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  callTitle: { color: "#fff", fontSize: 15, fontWeight: "800" },
  callSub: { color: "rgba(255,255,255,0.72)", fontSize: 12, marginTop: 1 },
  callJoin: {
    marginLeft: 6,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  callJoinTxt: { color: "#111", fontSize: 12, fontWeight: "800" },
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
  backBtn: {
    width: 34,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarWrap: { position: "relative" },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarEmpty: {
    backgroundColor: colors.neonRedBg,
    borderWidth: 1,
    borderColor: colors.neonRed,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.neonRedText, fontWeight: "800", fontSize: 17 },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: ONLINE,
    borderWidth: 2,
    borderColor: colors.black,
  },
  partnerName: { color: colors.text, fontWeight: "800", fontSize: 16 },
  statusTxt: { fontSize: 12, fontWeight: "600", marginTop: 1 },
  iconBtn: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },

  msgs: { paddingVertical: 10, flexGrow: 1 },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 90,
    gap: 10,
  },
  emptyTxt: { color: colors.muted, fontSize: 15 },
  day: {
    alignSelf: "center",
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginVertical: 14,
    backgroundColor: colors.card,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    overflow: "hidden",
  },
  msgRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 2,
  },
  msgHead: { marginTop: 12 },
  bar: { width: 3, borderRadius: 2, alignSelf: "stretch" },
  msgBody: { flex: 1, gap: 2 },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 1,
  },
  label: { fontSize: 11, fontWeight: "900", letterSpacing: 0.8 },
  labelTime: { color: colors.mutedDark, fontSize: 10, fontWeight: "600" },
  txt: { color: colors.text, fontSize: 16, lineHeight: 22 },
  bigEmoji: { fontSize: 38, lineHeight: 46 },
  img: { width: 220, height: 220, borderRadius: 16 },
  snapRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 3,
  },
  snapTxt: { color: SNAP_RED, fontSize: 14, fontWeight: "800" },
  snapTxtOpened: { color: colors.muted, fontWeight: "600" },
  reply: {
    borderLeftWidth: 2,
    borderLeftColor: colors.mutedDark,
    paddingLeft: 8,
    marginBottom: 3,
  },
  replyName: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  replyTxt: { color: colors.muted, fontSize: 13 },
  reactRow: { flexDirection: "row", gap: 6, marginTop: 4 },
  reactChip: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reactTxt: { color: colors.text, fontSize: 13 },
  typingDots: { color: colors.muted, fontSize: 16, letterSpacing: 4 },

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
  sendingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 4,
  },
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
  camBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: colors.neonRed,
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
    gap: 8,
    minHeight: 42,
    maxHeight: 120,
    backgroundColor: colors.cardLight,
    borderRadius: 21,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    maxHeight: 100,
    paddingTop: 0,
    paddingBottom: 0,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.neonRed,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: colors.neonRed,
    shadowOpacity: 0.45,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },

  viewer: { flex: 1, backgroundColor: "rgba(0,0,0,0.96)" },
  viewerClose: {
    position: "absolute",
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
});
