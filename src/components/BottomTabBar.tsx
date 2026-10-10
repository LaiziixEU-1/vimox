import { useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

type TabKey = "Matching" | "Friends" | "Camera" | "StoriesFeed" | "Profile";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "Matching", label: "Match", icon: "❤️" },
  { key: "Friends", label: "Messages", icon: "💬" },
  { key: "Camera", label: "Caméra", icon: "📷" },
  { key: "StoriesFeed", label: "Notifications", icon: "🔔" },
  { key: "Profile", label: "Profil", icon: "👤" },
];

function TabButton({
  icon,
  label,
  isActive,
  onPress,
}: {
  icon: string;
  label: string;
  isActive: boolean;
  onPress: () => void;
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
      onPressIn={pressIn}
      onPressOut={pressOut}
    >
      <Animated.View style={{ transform: [{ scale }], alignItems: "center" }}>
        <Text style={[s.icon, isActive && s.iconActive]}>{icon}</Text>
        <Text style={[s.label, isActive && s.labelActive]}>{label}</Text>
      </Animated.View>
      {isActive && <View style={s.dot} />}
    </Pressable>
  );
}

export function BottomTabBar({
  active,
  onTabPress,
}: {
  active: TabKey;
  onTabPress: (key: TabKey) => void;
}) {
  return (
    <View style={s.bar}>
      {TABS.map((tab) => (
        <TabButton
          key={tab.key}
          icon={tab.icon}
          label={tab.label}
          isActive={tab.key === active}
          onPress={() => onTabPress(tab.key)}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: colors.black,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingBottom: 20,
    paddingTop: 10,
  },
  btn: { flex: 1, alignItems: "center", gap: 3 },
  icon: { fontSize: 18, opacity: 0.5 },
  iconActive: { opacity: 1 },
  label: { fontSize: 9, color: colors.muted, fontWeight: "600" },
  labelActive: { color: colors.neonRed },
  dot: {
    width: 16,
    height: 2,
    backgroundColor: colors.neonRed,
    borderRadius: 1,
    marginTop: 4,
  },
});
