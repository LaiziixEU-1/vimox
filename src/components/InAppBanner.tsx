import { useEffect, useRef, useState } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { Image as ExpoImage } from "expo-image";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { InAppNotice, inAppBus } from "../services/inAppBus";
import { pagerBus } from "../navigation/pagerBus";

// Bannière « nouveau message » en haut de l'écran, quand tu es ailleurs dans l'app.
// Touche-la pour ouvrir la conversation ; glisse-la vers le haut pour la fermer.
// Rien ne s'affiche si la conversation concernée est déjà ouverte.
const SHOW_MS = 3800;

export function InAppBanner({ navigationRef }: { navigationRef: any }) {
  const insets = useSafeAreaInsets();
  const [notice, setNotice] = useState<InAppNotice | null>(null);
  const y = useRef(new Animated.Value(-160)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function hide() {
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(y, { toValue: -160, duration: 220, useNativeDriver: true }).start(() => setNotice(null));
  }

  useEffect(
    () =>
      inAppBus.subscribe((n) => {
        // Déjà dans cette conversation : pas de bannière
        const route = navigationRef?.isReady?.() ? navigationRef.getCurrentRoute?.() : null;
        const p: any = route?.params ?? {};
        if (route?.name === n.target.name) {
          if (n.target.name === "FriendChat" && p.friendId === n.target.params?.friendId) return;
          if (n.target.name === "GroupChat" && p.groupId === n.target.params?.groupId) return;
        }
        // Sur la liste des chats, le message s'affiche déjà : pas de bannière
        const STACK_ROOT = !route || route.name === "Matching";
        if (STACK_ROOT && pagerBus.current === "Friends") return;
        // Pendant un appel ou un Vim plein écran : on ne dérange pas
        if (route?.name === "VideoCall" || route?.name === "SnapViewer" || route?.name === "StoryViewer") return;
        setNotice(n);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        y.setValue(-160);
        Animated.spring(y, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(hide, SHOW_MS);
      }),
    [],
  );

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy < -6,
      onPanResponderMove: (_, g) => y.setValue(Math.min(0, g.dy)),
      onPanResponderRelease: (_, g) => {
        if (g.dy < -30) hide();
        else Animated.spring(y, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  if (!notice) return null;

  return (
    <Animated.View
      {...pan.panHandlers}
      style={[st.wrap, { top: Math.max(insets.top, 10) + 4, transform: [{ translateY: y }] }]}
    >
      <Pressable
        onPress={() => {
          const t = notice.target;
          hide();
          if (navigationRef?.isReady?.()) navigationRef.navigate(t.name, t.params);
        }}
        style={st.card}
        accessibilityRole="button"
        accessibilityLabel={`${notice.title} : ${notice.body}`}
      >
        {notice.photo ? (
          <ExpoImage source={{ uri: notice.photo }} style={st.avatar} contentFit="cover" />
        ) : (
          <View style={[st.avatar, st.avatarEmpty]}>
            <Text style={{ fontSize: 20 }}>{notice.emoji ?? notice.title?.[0]?.toUpperCase() ?? "💬"}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={st.title} numberOfLines={1}>{notice.title}</Text>
          <Text style={st.body} numberOfLines={2}>{notice.body}</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  wrap: { position: "absolute", left: 10, right: 10, zIndex: 9998, elevation: 29 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 20,
    backgroundColor: "rgba(28,28,30,0.97)",
    borderWidth: 1,
    borderColor: colors.borderLight,
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarEmpty: { backgroundColor: colors.cardLight, alignItems: "center", justifyContent: "center" },
  title: { color: colors.text, fontSize: 14, fontWeight: "900" },
  body: { color: colors.muted, fontSize: 13, marginTop: 1 },
});
