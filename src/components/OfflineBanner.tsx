import { useEffect, useRef, useState } from "react";
import { Animated, AppState, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";

// Bandeau « Pas de connexion » : vérifie le réseau toutes les 12 s (et au retour dans l'app).
// Une seule vérification ratée ne suffit pas (réseau lent) : il en faut deux d'affilée.
const PING_URL = "https://www.gstatic.com/generate_204";
const EVERY_MS = 12000;

async function online(): Promise<boolean> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const r = await fetch(PING_URL, { method: "HEAD", cache: "no-store", signal: ctrl.signal });
    return r.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export function OfflineBanner() {
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);
  const fails = useRef(0);
  const y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const check = async () => {
      if (!alive || AppState.currentState !== "active") return;
      const ok = await online();
      if (!alive) return;
      fails.current = ok ? 0 : fails.current + 1;
      setOffline(fails.current >= 2);
      timer = setTimeout(check, ok ? EVERY_MS : 5000);
    };
    check();
    const sub = AppState.addEventListener("change", (st) => {
      if (st === "active") {
        if (timer) clearTimeout(timer);
        check();
      }
    });
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, []);

  useEffect(() => {
    Animated.timing(y, { toValue: offline ? 1 : 0, duration: 260, useNativeDriver: true }).start();
  }, [offline]);

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[
        st.wrap,
        {
          paddingTop: Math.max(insets.top, 10) + 4,
          opacity: y,
          transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [-90, 0] }) }],
        },
      ]}
    >
      <Ionicons name="cloud-offline-outline" size={16} color="#fff" />
      <Text style={st.txt}>Pas de connexion · tes messages partiront dès le retour du réseau</Text>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingBottom: 8,
    paddingHorizontal: 14,
    backgroundColor: "rgba(120,20,28,0.96)",
    borderBottomWidth: 1,
    borderBottomColor: colors.neonRed,
  },
  txt: { color: "#fff", fontSize: 12, fontWeight: "800", flexShrink: 1, textAlign: "center" },
});
