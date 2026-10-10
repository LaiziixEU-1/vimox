import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Audio } from "expo-av";
import { useAuth } from "../services/AuthContext";
import { UserStories, markStoryViewed } from "../services/storyService";

type Props = NativeStackScreenProps<any, "StoryViewer">;
const { width } = Dimensions.get("window");
const DURATION = 5000;

export function StoryViewerScreen({ route, navigation }: Props) {
  const { stories, initialUserIndex = 0 } = route.params as {
    stories: UserStories[];
    initialUserIndex?: number;
  };
  const { profile } = useAuth();
  const [userIdx, setUserIdx] = useState(initialUserIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const paused = useRef(false);
  const progress = useRef(new Animated.Value(0)).current;
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const currentUser = stories[userIdx];
  const currentStory = currentUser?.stories[storyIdx];

  useEffect(() => {
    if (!currentStory || !profile) return;
    markStoryViewed(currentStory.id, profile.id).catch(() => {});
    progress.setValue(0);
    animRef.current?.stop();
    animRef.current = Animated.timing(progress, {
      toValue: 1,
      duration: DURATION,
      useNativeDriver: false,
    });
    animRef.current.start(({ finished }) => {
      if (finished && !paused.current) goNext();
    });
    return () => animRef.current?.stop();
  }, [userIdx, storyIdx]);

  // Musique de fond de la story courante
  useEffect(() => {
    let cancelled = false;
    soundRef.current?.unloadAsync().catch(() => {});
    soundRef.current = null;

    if (currentStory?.musicURL) {
      Audio.Sound.createAsync(
        { uri: currentStory.musicURL },
        { shouldPlay: true, isLooping: true },
      )
        .then(({ sound }) => {
          if (cancelled) {
            sound.unloadAsync().catch(() => {});
            return;
          }
          soundRef.current = sound;
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
      soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
    };
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
    animRef.current?.stop();
    soundRef.current?.pauseAsync().catch(() => {});
  }

  function onHoldEnd() {
    paused.current = false;
    const current = (progress as any)._value ?? 0;
    const remaining = (1 - current) * DURATION;
    animRef.current = Animated.timing(progress, {
      toValue: 1,
      duration: remaining,
      useNativeDriver: false,
    });
    animRef.current.start(({ finished }) => {
      if (finished) goNext();
    });
    soundRef.current?.playAsync().catch(() => {});
  }

  if (!currentStory) return null;

  const ago = Math.round((Date.now() - currentStory.createdAt) / 60000);
  const agoText =
    ago < 60 ? `il y a ${ago}m` : `il y a ${Math.floor(ago / 60)}h`;

  return (
    <SafeAreaView style={s.root}>
      {/* Progress bars */}
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

      {/* Header */}
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
        <Pressable onPress={() => navigation.goBack()} style={s.closeBtn}>
          <Text style={s.closeText}>✕</Text>
        </Pressable>
      </View>

      {/* Content with touch zones */}
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

        {currentStory.imageURL ? (
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
      </Pressable>

      {/* User navigation */}
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
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
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
