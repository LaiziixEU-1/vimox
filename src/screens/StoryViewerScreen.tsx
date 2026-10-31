/*VIMOX-V25*/
/*VIMOX-V24*/
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { guardText } from "../services/moderationGuard";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import type { AudioPlayer } from "expo-audio";
import { useVideoPlayer, VideoView } from "expo-video";
import { useAuth } from "../services/AuthContext";
import {
  UserStories,
  markStoryRewatched,
  markStoryViewed,
  musicMetaOf,
  replyToStory,
  deleteStory,
} from "../services/storyService";
import SoundTag from "../features/sounds/SoundTag";
import SoundDetailSheet from "../features/sounds/SoundDetailSheet";
import { clipFromMeta, type SoundClip } from "../features/sounds/soundService";
import { soundStore } from "../features/sounds/soundStore";
import { blockUser, reportContent } from "../services/moderationService";
import { doc as fsDoc, getDoc } from "firebase/firestore";
import { db } from "../config/firebase";
import { SafetySheet } from "../components/SafetySheet";

type Props = NativeStackScreenProps<any, "StoryViewer">;
const { width } = Dimensions.get("window");
const DURATION = 5000;
// Une story vidéo dure le temps de la vidéo (60 s maximum)
const MAX_VIDEO_MS = 60000;

export function StoryViewerScreen({ route, navigation }: Props) {
  const { stories, initialUserIndex = 0 } = route.params as {
    stories: UserStories[];
    initialUserIndex?: number;
  };
  const { profile } = useAuth();
  const [userIdx, setUserIdx] = useState(initialUserIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const [reply, setReply] = useState("");
  const [replySent, setReplySent] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);
  // Pause (doigt appuyé, clavier ouvert...) : met aussi la vidéo en pause
  const [holding, setHolding] = useState(false);
  // Fiche du son ouverte depuis l'étiquette
  const [soundSheet, setSoundSheet] = useState<SoundClip | null>(null);
  // Liste de ceux qui ont vu ma story (et, avec Vim+, ceux qui l'ont revue)
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewerNames, setViewerNames] = useState<Record<string, string>>({});
  const [live, setLive] = useState<{ viewedBy: string[]; rewatchedBy: string[] } | null>(null);
  const paused = useRef(false);
  // Relance l'affichage après la suppression d'une story
  const [bump, setBump] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const playerRef = useRef<AudioPlayer | null>(null);
  const durationRef = useRef(DURATION);
  const waitingVideo = useRef(false);

  const currentUser = stories[userIdx];
  const currentStory = currentUser?.stories[storyIdx];
  const isMine = currentUser?.userId === profile?.id;
  const viewers = currentStory
    ? currentStory.viewedBy.filter((id) => id !== profile?.id).length
    : 0;

  // Arrête VRAIMENT la musique : sur certains téléphones, libérer le lecteur
  // sans le mettre en pause laisse le son continuer après avoir quitté la story
  function releasePlayer() {
    const p = playerRef.current;
    playerRef.current = null;
    if (!p) return;
    try {
      p.pause();
    } catch {}
    try {
      p.remove();
    } catch {}
  }

  // On quitte la story (croix, glissement, retour…) : la musique s'arrête tout de suite
  useEffect(() => {
    const offBlur = navigation.addListener("blur", releasePlayer);
    const offRemove = navigation.addListener("beforeRemove", releasePlayer);
    return () => {
      offBlur();
      offRemove();
      releasePlayer();
    };
  }, [navigation]);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  function startProgress(ms: number) {
    durationRef.current = ms;
    progress.setValue(0);
    animRef.current?.stop();
    animRef.current = Animated.timing(progress, {
      toValue: 1,
      duration: ms,
      useNativeDriver: false,
    });
    animRef.current.start(({ finished }) => {
      if (finished && !paused.current) goNext();
    });
  }

  useEffect(() => {
    if (!currentStory || !profile) return;
    if (currentStory.userId !== profile.id) {
      // Déjà vue avant : c'est une story « revue »
      if (currentStory.viewedBy.includes(profile.id)) markStoryRewatched(currentStory.id, profile.id).catch(() => {});
      else markStoryViewed(currentStory.id, profile.id).catch(() => {});
    }
    progress.setValue(0);
    animRef.current?.stop();
    if (currentStory.videoURL) {
      // La barre démarre quand la vidéo est chargée (on connaît alors sa durée)
      waitingVideo.current = true;
      durationRef.current = DURATION;
    } else {
      waitingVideo.current = false;
      startProgress(DURATION);
    }
    return () => animRef.current?.stop();
  }, [userIdx, storyIdx, bump]);

  function onVideoReady(seconds: number) {
    if (!waitingVideo.current) return;
    waitingVideo.current = false;
    const ms = Math.min(MAX_VIDEO_MS, Math.max(1000, (seconds || 5) * 1000));
    if (paused.current) {
      durationRef.current = ms;
      return;
    }
    startProgress(ms);
  }

  // Musique de fond de la story courante
  useEffect(() => {
    releasePlayer();
    if (currentStory?.musicURL) {
      try {
        const p = createAudioPlayer({ uri: currentStory.musicURL });
        p.loop = true;
        // Passage et volume choisis par l'auteur (comme sur Snap)
        p.volume = Math.max(0, Math.min(1, currentStory.musicVolume ?? 1));
        const start = currentStory.musicStart ?? 0;
        if (start > 0) p.seekTo(start).catch(() => {});
        p.play();
        playerRef.current = p;
      } catch {}
    }
    return () => releasePlayer();
  }, [currentStory?.id]);

  function goNext() {
    if (storyIdx < currentUser.stories.length - 1) {
      setStoryIdx((i) => i + 1);
    } else if (userIdx < stories.length - 1) {
      setUserIdx((u) => u + 1);
      setStoryIdx(0);
    } else navigation.goBack();
  }

  function goPrev() {
    if (storyIdx > 0) {
      setStoryIdx((i) => i - 1);
    } else if (userIdx > 0) {
      setUserIdx((u) => u - 1);
      setStoryIdx(stories[userIdx - 1].stories.length - 1);
    }
  }

  function onHoldStart() {
    paused.current = true;
    setHolding(true);
    animRef.current?.stop();
    try {
      playerRef.current?.pause();
    } catch {}
  }

  function onHoldEnd() {
    paused.current = false;
    setHolding(false);
    try {
      playerRef.current?.play();
    } catch {}
    if (waitingVideo.current) return; // la vidéo n'est pas encore chargée
    const current = (progress as any)._value ?? 0;
    const remaining = (1 - current) * durationRef.current;
    animRef.current = Animated.timing(progress, {
      toValue: 1,
      duration: remaining,
      useNativeDriver: false,
    });
    animRef.current.start(({ finished }) => {
      if (finished) goNext();
    });
  }

  async function openViewers() {
    if (!currentStory) return;
    onHoldStart();
    setViewersOpen(true);
    try {
      const snap = await getDoc(fsDoc(db, "stories", currentStory.id));
      const d: any = snap.data() ?? {};
      const viewedBy: string[] = (d.viewedBy ?? []).filter((id: string) => id !== profile?.id);
      const rewatchedBy: string[] = (d.rewatchedBy ?? []).filter((id: string) => id !== profile?.id);
      setLive({ viewedBy, rewatchedBy });
      const names: Record<string, string> = {};
      await Promise.all(
        viewedBy.slice(0, 60).map(async (id) => {
          try {
            const u = await getDoc(fsDoc(db, "users", id));
            names[id] = (u.data() as any)?.name ?? "Utilisateur";
          } catch {
            names[id] = "Utilisateur";
          }
        }),
      );
      setViewerNames(names);
    } catch {}
  }
  function closeViewers() {
    setViewersOpen(false);
    onHoldEnd();
  }

  function confirmDeleteStory() {
    if (!currentStory) return;
    onHoldStart();
    Alert.alert("Supprimer cette story ?", "Elle disparaîtra pour tous tes amis.", [
      { text: "Annuler", style: "cancel", onPress: onHoldEnd },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteStory(currentStory.id);
          } catch {
            Alert.alert("Suppression impossible", "Vérifie ta connexion et réessaie.");
            onHoldEnd();
            return;
          }
          const list = currentUser.stories;
          list.splice(storyIdx, 1);
          paused.current = false;
          setHolding(false);
          if (list.length === 0) {
            navigation.goBack();
            return;
          }
          setStoryIdx((i) => Math.min(i, list.length - 1));
          setBump((b) => b + 1);
        },
      },
    ]);
  }

  function openSafety() {
    onHoldStart();
    setSafetyOpen(true);
  }
  function closeSafety() {
    setSafetyOpen(false);
    onHoldEnd();
  }
  async function reportStory(reason: string) {
    if (!profile || !currentStory) return;
    await reportContent({
      reporterId: profile.id,
      reportedId: currentUser.userId,
      kind: "story",
      reason,
      refId: currentStory.id,
    });
  }
  async function blockAuthor() {
    if (!profile) return;
    await blockUser(profile.id, currentUser.userId);
    navigation.goBack();
  }

  // Réaction rapide (comme sur Snap) : un emoji part en message privé à l'auteur
  async function sendQuickReaction(emoji: string) {
    if (!profile || !currentStory) return;
    try {
      await replyToStory(profile.id, profile.name, currentStory, emoji);
      setReplySent(true);
      setTimeout(() => setReplySent(false), 1800);
    } catch {
      Alert.alert("Erreur", "Ta réaction n'a pas pu être envoyée.");
    }
  }

  async function sendReply() {
    if (!profile || !currentStory || !reply.trim()) return;
    const verdict = await guardText(reply, {
      userId: profile.id,
      where: "storyReply",
    });
    if (!verdict.ok) {
      Alert.alert("Message non envoyé", verdict.message);
      return;
    }
    const value = reply;
    setReply("");
    Keyboard.dismiss();
    try {
      await replyToStory(profile.id, profile.name, currentStory, value);
      setReplySent(true);
      setTimeout(() => setReplySent(false), 2200);
    } catch {
      setReply(value);
      Alert.alert("Erreur", "Ton message n'a pas pu être envoyé.");
    }
  }

  if (!currentStory) return null;

  const ago = Math.round((Date.now() - currentStory.createdAt) / 60000);
  const agoText =
    ago < 60 ? `il y a ${ago}m` : `il y a ${Math.floor(ago / 60)}h`;

  return (
    <SafeAreaView style={s.root}>
      <View style={s.bars}>
        {currentUser.stories.map((_, i) => (
          <View key={i} style={s.bar}>
            <Animated.View
              style={[
                s.barFill,
                {
                  width:
                    i < storyIdx
                      ? "100%"
                      : i === storyIdx
                        ? progress.interpolate({
                            inputRange: [0, 1],
                            outputRange: ["0%", "100%"],
                          })
                        : "0%",
                },
              ]}
            />
          </View>
        ))}
      </View>

      <View style={s.header}>
        <View style={s.headerLeft}>
          {currentUser.userPhoto ? (
            <Image source={{ uri: currentUser.userPhoto }} style={s.avatar} />
          ) : (
            <View style={s.avatarPlaceholder}>
              <Text style={s.avatarInitial}>
                {currentUser.userName?.[0]?.toUpperCase()}
              </Text>
            </View>
          )}
          <View>
            <Text style={s.userName}>{currentUser.userName}</Text>
            <Text style={s.storyAgo}>{agoText}</Text>
          </View>
          {currentStory.musicURL && <Text style={s.musicIcon}>🎵</Text>}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          {isMine && (
            <Pressable
              onPress={confirmDeleteStory}
              hitSlop={8}
              style={s.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Supprimer cette story"
            >
              <Ionicons name="trash-outline" size={21} color="#fff" />
            </Pressable>
          )}
          {!isMine && (
            <Pressable
              onPress={openSafety}
              hitSlop={8}
              style={s.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Plus d'options : signaler ou bloquer"
            >
              <Ionicons name="ellipsis-horizontal" size={22} color="#fff" />
            </Pressable>
          )}
          <Pressable
            onPress={() => navigation.goBack()}
            style={s.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
          >
            <Text style={s.closeText}>✕</Text>
          </Pressable>
        </View>
      </View>

      <Pressable
        style={s.content}
        onLongPress={onHoldStart}
        onPressOut={onHoldEnd}
        delayLongPress={200}
      >
        <View style={s.tapZones}>
          <Pressable style={s.tapLeft} onPress={goPrev} />
          <Pressable style={s.tapRight} onPress={goNext} />
        </View>

        {currentStory.videoURL ? (
          <StoryVideo
            key={currentStory.id}
            uri={currentStory.videoURL}
            paused={holding}
            volume={currentStory.musicURL ? (currentStory.videoVolume ?? 1) : 1}
            onReady={onVideoReady}
          />
        ) : currentStory.imageURL ? (
          <Image
            source={{ uri: currentStory.imageURL }}
            style={s.image}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[
              s.textCard,
              { backgroundColor: currentStory.bgColor ?? "#111" },
            ]}
          >
            <Text
              style={[s.storyText, { color: currentStory.textColor ?? "#fff" }]}
            >
              {currentStory.text}
            </Text>
          </View>
        )}

        {currentStory.imageURL && currentStory.overlayText ? (
          <View style={s.overlay}>
            <Text style={s.overlayText}>{currentStory.overlayText}</Text>
          </View>
        ) : null}

        {/* Étiquette du son, comme sur Snap : on la touche pour voir le son */}
        {currentStory.musicURL ? (
          <View style={s.soundTagWrap}>
            <SoundTag
              title={currentStory.musicTitle ?? "Son original"}
              artist={currentStory.musicArtist}
              coverURL={currentStory.musicCover}
              onPress={() => {
                const meta = musicMetaOf(currentStory);
                if (!meta || !currentStory.musicURL) return;
                onHoldStart();
                try {
                  playerRef.current?.pause();
                } catch {}
                setSoundSheet(clipFromMeta(currentStory.musicURL, meta));
              }}
            />
          </View>
        ) : null}
      </Pressable>

      <SoundDetailSheet
        visible={!!soundSheet}
        clip={soundSheet}
        onClose={() => {
          setSoundSheet(null);
          onHoldEnd();
        }}
        onUse={(clip) => {
          setSoundSheet(null);
          soundStore.setPending(clip);
          navigation.goBack();
        }}
      />

      {stories.length > 1 && (
        <View style={s.userNav}>
          {userIdx > 0 && (
            <Pressable
              onPress={() => {
                setUserIdx((u) => u - 1);
                setStoryIdx(0);
              }}
              style={s.userNavBtn}
            >
              <Text style={s.userNavText}>
                ‹ {stories[userIdx - 1].userName}
              </Text>
            </Pressable>
          )}
          <View style={{ flex: 1 }} />
          {userIdx < stories.length - 1 && (
            <Pressable
              onPress={() => {
                setUserIdx((u) => u + 1);
                setStoryIdx(0);
              }}
              style={s.userNavBtn}
            >
              <Text style={s.userNavText}>
                {stories[userIdx + 1].userName} ›
              </Text>
            </Pressable>
          )}
        </View>
      )}
      <SafetySheet
        visible={safetyOpen}
        title={currentUser.userName}
        subject="cette story"
        onClose={closeSafety}
        onReport={reportStory}
        onBlock={blockAuthor}
      />
      <Modal visible={viewersOpen} transparent animationType="slide" onRequestClose={closeViewers}>
        <Pressable style={s.vOverlay} onPress={closeViewers}>
          <Pressable style={s.vSheet} onPress={() => {}}>
            <Text style={s.vTitle}>
              {live ? `Vue par ${live.viewedBy.length}` : "Chargement…"}
            </Text>
            <ScrollView style={{ maxHeight: 380 }}>
              {live && live.viewedBy.length === 0 && (
                <Text style={s.vEmpty}>Personne n'a encore vu cette story.</Text>
              )}
              {live?.viewedBy.map((id) => (
                <View key={id} style={s.vRow}>
                  <Ionicons name="person-circle-outline" size={26} color="rgba(255,255,255,0.6)" />
                  <Text style={s.vName} numberOfLines={1}>{viewerNames[id] ?? "…"}</Text>
                  {profile?.isPremium && live.rewatchedBy.includes(id) && <Text style={s.vRe}>🔁 revue</Text>}
                </View>
              ))}
            </ScrollView>
            {!profile?.isPremium && live && live.rewatchedBy.length > 0 && (
              <Pressable
                onPress={() => {
                  closeViewers();
                  navigation.navigate("Premium");
                }}
                style={s.vUpsell}
                accessibilityRole="button"
              >
                <Text style={s.vUpsellTxt}>
                  🔁 {live.rewatchedBy.length} personne{live.rewatchedBy.length > 1 ? "s l'ont" : " l'a"} revue · Passe à Vim+ pour voir qui
                </Text>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {isMine ? (
          <Pressable style={s.bottomBar} onPress={openViewers} accessibilityRole="button" accessibilityLabel="Voir qui a vu ma story">
            <Ionicons name="eye-outline" size={18} color="rgba(255,255,255,0.85)" />
            <Text style={s.viewersTxt}>
              {viewers === 0
                ? "Pas encore de vue"
                : `Vue par ${viewers} personne${viewers > 1 ? "s" : ""}`}
              {profile?.isPremium && (currentStory.rewatchedBy?.filter((id) => id !== profile?.id).length ?? 0) > 0
                ? `  ·  🔁 ${currentStory.rewatchedBy!.filter((id) => id !== profile?.id).length}`
                : ""}
            </Text>
            <Ionicons name="chevron-up" size={16} color="rgba(255,255,255,0.7)" />
          </Pressable>
        ) : (
          <>
          {reply.trim().length === 0 && (
            <View style={s.quickRow}>
              {["😂", "😍", "🔥", "😮", "👏", "😢"].map((e) => (
                <Pressable
                  key={e}
                  onPress={() => sendQuickReaction(e)}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Réagir ${e}`}
                  style={({ pressed }) => [s.quickBtn, pressed && { transform: [{ scale: 1.25 }] }]}
                >
                  <Text style={s.quickEmoji}>{e}</Text>
                </Pressable>
              ))}
            </View>
          )}
          <View style={s.bottomBar}>
            <TextInput
              style={s.replyInput}
              value={reply}
              onChangeText={setReply}
              placeholder={`Répondre à ${currentUser.userName}…`}
              placeholderTextColor="rgba(255,255,255,0.6)"
              onFocus={onHoldStart}
              onBlur={onHoldEnd}
              returnKeyType="send"
              onSubmitEditing={sendReply}
              maxLength={500}
            />
            {reply.trim().length > 0 && (
              <Pressable
                onPress={sendReply}
                accessibilityRole="button"
                accessibilityLabel="Envoyer"
                style={s.replySend}
              >
                <Ionicons name="send" size={18} color="#fff" />
              </Pressable>
            )}
          </View>
          </>
        )}
        {replySent && <Text style={s.replySentTxt}>Message envoyé ✓</Text>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Lecture d'une story vidéo : joue une fois, se met en pause quand on appuie,
// et indique sa durée pour que la barre de progression suive la vidéo.
function StoryVideo({
  uri,
  paused,
  volume,
  onReady,
}: {
  uri: string;
  paused: boolean;
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
    // Sécurité : si l'événement n'arrive pas, on démarre quand même
    const t = setTimeout(() => fire(player.duration || 10), 5000);
    return () => {
      sub.remove();
      clearTimeout(t);
    };
  }, [player]);

  useEffect(() => {
    try {
      if (paused) player.pause();
      else player.play();
    } catch {}
  }, [paused, player]);

  useEffect(() => {
    player.volume = Math.max(0, Math.min(1, volume));
  }, [volume, player]);

  return (
    <VideoView
      player={player}
      style={s.image}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

const s = StyleSheet.create({
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  quickRow: { flexDirection: "row", justifyContent: "space-around", paddingHorizontal: 18, paddingTop: 6 },
  quickBtn: { padding: 4 },
  quickEmoji: { fontSize: 28 },
  replyInput: {
    flex: 1,
    color: "#fff",
    fontSize: 15,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  replySend: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FF2E4D",
  },
  replySentTxt: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    paddingBottom: 8,
  },
  viewersTxt: { color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: "600", flex: 1 },
  vOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  vSheet: {
    backgroundColor: "#141414",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 18,
    paddingBottom: 34,
    gap: 10,
  },
  vTitle: { color: "#fff", fontSize: 17, fontWeight: "900", marginBottom: 4 },
  vEmpty: { color: "rgba(255,255,255,0.6)", fontSize: 14, paddingVertical: 20, textAlign: "center" },
  vRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  vName: { color: "#fff", fontSize: 15, fontWeight: "700", flex: 1 },
  vRe: { color: "#FFB020", fontSize: 13, fontWeight: "800" },
  vUpsell: { backgroundColor: "rgba(255,46,77,0.15)", borderRadius: 14, padding: 12, marginTop: 6 },
  vUpsellTxt: { color: "#fff", fontSize: 13, fontWeight: "700", textAlign: "center" },
  root: { flex: 1, backgroundColor: "#000" },
  bars: {
    flexDirection: "row",
    gap: 3,
    paddingHorizontal: 10,
    paddingTop: 8,
    zIndex: 20,
  },
  bar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.3)",
    overflow: "hidden",
  },
  barFill: { height: "100%", backgroundColor: "#fff", borderRadius: 2 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    zIndex: 20,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: "#fff",
  },
  avatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: { color: "#fff", fontWeight: "900", fontSize: 16 },
  userName: { color: "#fff", fontWeight: "800", fontSize: 14 },
  storyAgo: { color: "rgba(255,255,255,0.55)", fontSize: 11 },
  musicIcon: { fontSize: 14, marginLeft: 4 },
  closeBtn: { padding: 8 },
  closeText: { color: "#fff", fontSize: 22, fontWeight: "300" },
  content: { flex: 1 },
  tapZones: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    zIndex: 10,
  },
  tapLeft: { flex: 1 },
  tapRight: { flex: 2 },
  image: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
  textCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  storyText: {
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
    lineHeight: 38,
  },
  soundTagWrap: {
    position: "absolute",
    left: 14,
    bottom: 18,
    right: 14,
    zIndex: 15,
  },
  overlay: {
    position: "absolute",
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 15,
  },
  overlayText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    overflow: "hidden",
  },
  userNav: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 16,
    zIndex: 20,
  },
  userNavBtn: {
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  userNavText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "700",
  },
});
