import { useEffect, useRef } from "react";
import { Animated, AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { setAppBadge } from "../services/notificationService";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { useBadges } from "../services/badgeStore";

export type TabKey = "Matching" | "Friends" | "Camera" | "StoriesFeed" | "Profile";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "Matching", label: "Match", icon: "heart" },
  { key: "Friends", label: "Messages", icon: "chatbubble-ellipses" },
  { key: "Camera", label: "Caméra", icon: "camera" },
  // Cet onglet affiche les stories des amis (il s'appelait « Notifications » à tort)
  { key: "StoriesFeed", label: "Stories", icon: "albums" },
  { key: "Profile", label: "Profil", icon: "person" },
];

function TabButton({
  icon,
  label,
  isActive,
  onPress,
  badge = 0,
}: {
  icon: string;
  label: string;
  isActive: boolean;
  onPress: () => void;
  badge?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  function pressIn() {
    Animated.spring(scale, {
      toValue: 0.82,
      useNativeDriver: true,
      speed: 40,
    }).start();
  }
  function pressOut() {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
  }

  return (
    <Pressable
      style={s.btn}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge > 0 ? `${label}, ${badge} nouveau${badge > 1 ? "x" : ""}` : label}
      onPressIn={pressIn}
      onPressOut={pressOut}
    >
      <Animated.View style={{ transform: [{ scale }], alignItems: "center" }}>
        <View>
          <Ionicons
            name={(isActive ? icon : `${icon}-outline`) as any}
            size={22}
            color={isActive ? colors.neonRed : colors.muted}
          />
          {badge > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeTxt}>{badge > 9 ? "9+" : badge}</Text>
            </View>
          )}
        </View>
        <Text style={[s.label, isActive && s.labelActive]}>{label}</Text>
      </Animated.View>
      {isActive && <View style={s.dot} />}
    </Pressable>
  );
}

export function BottomTabBar({
  active,
  onTabPress,
  pages,
}: {
  active: TabKey;
  onTabPress: (key: TabKey) => void;
  // Pages à afficher, dans l'ordre (sans « Match » pour les mineurs). Sans valeur : toutes.
  pages?: TabKey[];
}) {
  const tabs = pages ? pages.map((k) => TABS.find((t) => t.key === k)).filter((t): t is (typeof TABS)[number] => !!t) : TABS;
  const badges = useBadges();
  // En quittant l'app, l'icône affiche le nombre de messages et de demandes non lus (comme Snap)
  const totalRef = useRef(0);
  totalRef.current = badges.Friends ?? 0;
  useEffect(() => {
    const sub = AppState.addEventListener("change", (st) => {
      if (st === "background" || st === "inactive") setAppBadge(totalRef.current);
    });
    return () => sub.remove();
  }, []);
  return (
    <View style={s.bar}>
      {tabs.map((tab) => (
        <TabButton
          key={tab.key}
          icon={tab.icon}
          label={tab.label}
          isActive={tab.key === active}
          badge={badges[tab.key] ?? 0}
          onPress={() => onTabPress(tab.key)}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: "#0D0D12",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.08)",
    paddingBottom: 22,
    paddingTop: 10,
  },
  btn: { flex: 1, alignItems: "center", gap: 3 },
  icon: { fontSize: 18, opacity: 0.5 },
  iconActive: { opacity: 1 },
  label: { fontSize: 10, color: colors.muted, fontWeight: "700" },
  labelActive: { color: colors.neonRed, fontWeight: "900" },
  badge: {
    position: "absolute",
    top: -5,
    right: -10,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.neonRed,
    borderWidth: 2,
    borderColor: colors.black,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeTxt: { color: "#fff", fontSize: 9, fontWeight: "900" },
  dot: {
    width: 22,
    height: 3,
    backgroundColor: colors.neonRed,
    borderRadius: 2,
    marginTop: 4,
    shadowColor: colors.neonRed,
    shadowOpacity: 0.9,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
});
