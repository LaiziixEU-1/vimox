import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Modal, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { Asset, usePermissions as useMediaPermissions } from "expo-media-library";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Visionneuse plein écran des photos de chat :
// double tap = zoom ×2,5 (puis glisser pour se déplacer), glisser vers le bas = fermer,
// ⬇ enregistrer dans la galerie, ↗ partager.
const ZOOM = 2.5;

export function ImageViewer({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [perm, requestPerm] = useMediaPermissions();
  const [busy, setBusy] = useState<"save" | "share" | null>(null);
  const scale = useRef(new Animated.Value(1)).current;
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;
  const zoomed = useRef(false);
  const lastTap = useRef(0);
  const offset = useRef({ x: 0, y: 0 });

  // Remise à zéro à chaque nouvelle photo
  useEffect(() => {
    zoomed.current = false;
    offset.current = { x: 0, y: 0 };
    scale.setValue(1);
    tx.setValue(0);
    ty.setValue(0);
  }, [uri]);

  function toggleZoom() {
    zoomed.current = !zoomed.current;
    offset.current = { x: 0, y: 0 };
    Haptics.selectionAsync().catch(() => {});
    Animated.parallel([
      Animated.spring(scale, { toValue: zoomed.current ? ZOOM : 1, useNativeDriver: true, bounciness: 4 }),
      Animated.spring(tx, { toValue: 0, useNativeDriver: true }),
      Animated.spring(ty, { toValue: 0, useNativeDriver: true }),
    ]).start();
  }

  const latestClose = useRef(onClose);
  latestClose.current = onClose;
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
      onPanResponderGrant: () => {},
      onPanResponderMove: (_, g) => {
        if (zoomed.current) {
          tx.setValue(offset.current.x + g.dx);
          ty.setValue(offset.current.y + g.dy);
        } else if (g.dy > 0) {
          ty.setValue(g.dy);
        }
      },
      onPanResponderRelease: (_, g) => {
        const moved = Math.abs(g.dx) > 6 || Math.abs(g.dy) > 6;
        if (!moved) {
          // tap simple / double tap
          const now = Date.now();
          if (now - lastTap.current < 300) {
            lastTap.current = 0;
            toggleZoom();
          } else lastTap.current = now;
          return;
        }
        if (zoomed.current) {
          offset.current = { x: offset.current.x + g.dx, y: offset.current.y + g.dy };
          return;
        }
        if (g.dy > 120) {
          latestClose.current();
          return;
        }
        Animated.spring(ty, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  // Téléchargement dans un fichier au nom unique (un même nom ferait échouer le 2e enregistrement)
  async function localFile(): Promise<File> {
    const ext = (uri!.match(/\.(jpe?g|png|webp|gif|heic)(\?|$)/i)?.[1] ?? "jpg").toLowerCase();
    const dest = new File(Paths.cache, `vimox-photo-${Date.now()}.${ext}`);
    return await File.downloadFileAsync(uri!, dest);
  }

  async function save() {
    if (!uri || busy) return;
    if (!perm?.granted) {
      const r = await requestPerm();
      if (!r.granted) {
        Alert.alert("Permission refusée", "Autorise l'accès à tes photos dans les réglages pour enregistrer.");
        return;
      }
    }
    setBusy("save");
    try {
      const f = await localFile();
      await Asset.create(f.uri);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert("Photo enregistrée", "Elle est dans ta galerie.");
    } catch {
      Alert.alert("Enregistrement impossible", "Vérifie ta connexion et réessaie.");
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    if (!uri || busy) return;
    setBusy("share");
    try {
      const f = await localFile();
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(f.uri);
    } catch {
      Alert.alert("Partage impossible", "Vérifie ta connexion et réessaie.");
    } finally {
      setBusy(null);
    }
  }

  const bgOpacity = ty.interpolate({ inputRange: [0, 300], outputRange: [0.97, 0.3], extrapolate: "clamp" });

  return (
    <Modal visible={!!uri} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "#000", opacity: bgOpacity }]} />
      <Animated.View
        {...pan.panHandlers}
        style={[StyleSheet.absoluteFill, { transform: [{ translateX: tx }, { translateY: ty }, { scale }] }]}
      >
        {uri && <ExpoImage source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" />}
      </Animated.View>

      <View style={[st.top, { paddingTop: Math.max(insets.top, 20) + 6 }]} pointerEvents="box-none">
        <Pressable onPress={onClose} hitSlop={12} style={st.btn} accessibilityRole="button" accessibilityLabel="Fermer">
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable onPress={save} hitSlop={8} style={st.btn} accessibilityRole="button" accessibilityLabel="Enregistrer dans la galerie">
            {busy === "save" ? <ActivityIndicator color="#fff" /> : <Ionicons name="download-outline" size={22} color="#fff" />}
          </Pressable>
          <Pressable onPress={share} hitSlop={8} style={st.btn} accessibilityRole="button" accessibilityLabel="Partager">
            {busy === "share" ? <ActivityIndicator color="#fff" /> : <Ionicons name="share-outline" size={22} color="#fff" />}
          </Pressable>
        </View>
      </View>
      <Text style={[st.hint, { bottom: Math.max(insets.bottom, 16) + 10 }]} pointerEvents="none">
        Double tap pour zoomer · glisse vers le bas pour fermer
      </Text>
    </Modal>
  );
}

const st = StyleSheet.create({
  top: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16 },
  btn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  hint: { position: "absolute", left: 0, right: 0, textAlign: "center", color: "rgba(255,255,255,0.6)", fontSize: 12, fontWeight: "700" },
});
