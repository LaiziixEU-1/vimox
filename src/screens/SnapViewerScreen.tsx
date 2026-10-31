/*VIMOX-V30-capture*/
/*VIMOX-V30*/
/*VIMOX-V18*/
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useVideoPlayer, VideoView } from "expo-video";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase";
import { RootStackParamList } from "../models/types";
import { markSnapViewed, videoURLFromPoster } from "../services/snapService";
import { markGroupSnapViewed } from "../services/groupService";
import { useAuth } from "../services/AuthContext";
import { useScreenshotNotice } from "../hooks/useScreenshotNotice";
import { notifyFriendMessage } from "../services/notificationService";
import SoundTag from "../features/sounds/SoundTag";
import SoundDetailSheet from "../features/sounds/SoundDetailSheet";
import { clipFromMeta, type MusicMeta, type SoundClip } from "../features/sounds/soundService";
import { soundStore } from "../features/sounds/soundStore";
import { useClipPlayer } from "../features/sounds/useClipPlayer";

type Props = NativeStackScreenProps<RootStackParamList, "SnapViewer">;
const DEFAULT_SECONDS = 6;
// Un Snap vidéo dure le temps de la vidéo (60 s maximum)
const MAX_VIDEO_MS = 60000;

export function SnapViewerScreen({ route, navigation }: Props) {
  const { imageURL, chatId, messageId, senderName, senderUid, duration, groupId } =
    route.params as any;
  // Snap vidéo : la vidéo est retrouvée à partir de sa première image
  const videoURL = videoURLFromPoster(imageURL);
  // Durée choisie par l'expéditeur (1 à 10 s) pour une photo
  const DURATION = Math.max(1, duration ?? DEFAULT_SECONDS) * 1000;
  const { profile } = useAuth();
  // Comme sur Snap : l'expéditeur est prévenu si tu fais une capture d'écran de son Vim
  useScreenshotNotice(() => {
    if (!profile || profile.id === senderUid) return;
    const who = profile.name ?? "Ton ami";
    addDoc(groupId ? collection(db, "groups", groupId, "messages") : collection(db, "friendChats", chatId, "messages"), {
      type: "screenshot",
      text: `${who} a fait une capture d'écran du Vim`,
      imageURL: null,
      audioURL: null,
      senderUid: profile.id,
      sentAt: serverTimestamp(),
    }).catch(() => {});
    notifyFriendMessage(senderUid, profile.id, who, "📸 a fait une capture d'écran de ton Vim").catch(() => {});
  }, !!profile);
  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const [closing, setClosing] = useState(false);
  // Son du Snap (choisi par l'expéditeur), lu depuis le message
  const [music, setMusic] = useState<{ url: string; meta: MusicMeta } | null>(null);
  const [soundSheet, setSoundSheet] = useState<SoundClip | null>(null);

  useClipPlayer(
    music
      ? {
          url: music.url,
          startSec: music.meta.startSec ?? 0,
          clipSec: Math.max(music.meta.clipSec ?? 15, 60),
          volume: music.meta.musicVolume ?? 1,
        }
      : null,
    !!music && !soundSheet,
  );

  function startProgress(ms: number) {
    animRef.current?.stop();
    progress.setValue(0);
    animRef.current = Animated.timing(progress, {
      toValue: 1,
      duration: ms,
      useNativeDriver: false,
    });
    animRef.current.start(({ finished }) => {
      if (finished) close();
    });
  }

  useEffect(() => {
    // Photo : la barre démarre tout de suite. Vidéo : quand on connaît sa durée.
    if (!videoURL) startProgress(DURATION);

    // On lit d'abord le son du Snap, puis on le marque comme vu
    // (seulement si c'est le destinataire qui regarde, pas l'expéditeur)
    (async () => {
      try {
        const d = await getDoc(
          groupId
            ? doc(db, "groups", groupId, "messages", messageId)
            : doc(db, "friendChats", chatId, "messages", messageId),
        );
        const data = d.data() as any;
        if (data?.musicURL) setMusic({ url: data.musicURL, meta: data.musicMeta ?? {} });
      } catch {}
      if (profile && profile.id !== senderUid) {
        // Groupe : on note juste que JE l'ai vu (les autres membres peuvent encore l'ouvrir)
        if (groupId) markGroupSnapViewed(groupId, messageId, profile.id).catch(() => {});
        else markSnapViewed(chatId, messageId).catch(() => {});
      }
    })();

    return () => animRef.current?.stop();
  }, []);

  function close() {
    if (closing) return;
    setClosing(true);
    navigation.goBack();
  }

  return (
    <SafeAreaView style={s.root}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close}>
        {videoURL ? (
          <SnapVideo
            uri={videoURL}
            volume={music ? (music.meta.videoVolume ?? 1) : 1}
            onReady={(sec) =>
              startProgress(Math.min(MAX_VIDEO_MS, Math.max(1000, (sec || 5) * 1000)))
            }
          />
        ) : (
          <Image
            source={{ uri: imageURL }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        )}
      </Pressable>
      <View style={s.bar}>
        <Animated.View
          style={[
            s.barFill,
            {
              width: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
            },
          ]}
        />
      </View>
      {music && (
        <View style={s.soundTagWrap}>
          <SoundTag
            title={music.meta.title ?? "Son original"}
            artist={music.meta.artist}
            coverURL={music.meta.coverURL}
            onPress={() => {
              animRef.current?.stop();
              setSoundSheet(clipFromMeta(music.url, music.meta));
            }}
          />
        </View>
      )}
      <SoundDetailSheet
        visible={!!soundSheet}
        clip={soundSheet}
        onClose={() => {
          setSoundSheet(null);
          close();
        }}
        onUse={(clip) => {
          setSoundSheet(null);
          soundStore.setPending(clip);
          close();
        }}
      />
      <View style={s.header}>
        <Text style={s.senderName}>{senderName}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Fermer" onPress={close} style={s.closeBtn}>
          <Text style={s.closeTxt}>✕</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// Lecture du Snap vidéo : une seule fois, avec le son, et la durée pour la barre
function SnapVideo({
  uri,
  volume,
  onReady,
}: {
  uri: string;
  volume: number;
  onReady: (seconds: number) => void;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
    p.play();
  });
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    let done = false;
    const fire = (sec: number) => {
      if (done) return;
      done = true;
      onReadyRef.current(sec);
    };
    const sub = player.addListener("sourceLoad", (e) => fire(e.duration));
    const t = setTimeout(() => fire(player.duration || 10), 5000);
    return () => {
      sub.remove();
      clearTimeout(t);
    };
  }, [player]);

  useEffect(() => {
    player.volume = Math.max(0, Math.min(1, volume));
  }, [volume, player]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  bar: {
    marginHorizontal: 10,
    marginTop: 8,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.3)",
    overflow: "hidden",
  },
  barFill: { height: "100%", backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  senderName: { color: "#fff", fontWeight: "800", fontSize: 14 },
  soundTagWrap: { position: "absolute", left: 14, right: 14, bottom: 40 },
  closeBtn: { padding: 6 },
  closeTxt: { color: "#fff", fontSize: 20, fontWeight: "300" },
});
