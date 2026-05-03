import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../models/types";
import { useAuth } from "../services/AuthContext";
import { VideoCallService } from "../services/videoService";
import { VimoXLogo } from "../components/VimoXLogo";
import { colors } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "VideoCall">;
type Effect = "Normal" | "N&B" | "Flou" | "Saturation" | "Néon" | "Avatar Pro";
const effects: Effect[] = [
  "Normal",
  "N&B",
  "Flou",
  "Saturation",
  "Néon",
  "Avatar Pro",
];

export function VideoCallScreen({ route, navigation }: Props) {
  const { profile } = useAuth();
  const { roomId } = route.params;
  const serviceRef = useRef<VideoCallService | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isAudioOnly, setIsAudioOnly] = useState(false);
  const [effect, setEffect] = useState<Effect>("Normal");
  const [status, setStatus] = useState("Connexion vidéo...");
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!profile) return;
    const service = new VideoCallService(roomId, profile.id);
    serviceRef.current = service;
    setStatus("En appel");
    return () => {
      service.hangUp().catch(() => {});
    };
  }, [profile, roomId]);

  useEffect(() => {
    const timer = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  function formatDuration(s: number) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  }

  function toggleMute() {
    if (!serviceRef.current) return;
    setIsMuted(serviceRef.current.toggleMute());
  }

  function toggleCamera() {
    if (!serviceRef.current) return;
    setIsCameraOff(serviceRef.current.toggleCamera());
  }

  function switchToAudioOnly() {
    if (!serviceRef.current) return;
    serviceRef.current.switchToAudioOnly();
    setIsAudioOnly(true);
    setIsCameraOff(true);
  }

  async function hangUp() {
    Alert.alert("Raccrocher", "Tu vas terminer l'appel.", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Raccrocher",
        style: "destructive",
        onPress: async () => {
          await serviceRef.current?.hangUp().catch(() => {});
          navigation.goBack();
        },
      },
    ]);
  }

  return (
    <View style={styles.root}>
      {/* Zone vidéo principale */}
      <View style={styles.videoArea}>
        <View style={styles.remoteVideo}>
          <VimoXLogo size={120} showWordmark={false} />
          <Text style={styles.videoStatus}>{status}</Text>
          <Text style={styles.duration}>{formatDuration(duration)}</Text>
          {isAudioOnly && (
            <Text style={styles.audioOnlyBadge}>🎵 Audio uniquement</Text>
          )}
        </View>

        {/* Preview locale */}
        <View style={styles.localVideo}>
          <Text style={styles.localIcon}>{isCameraOff ? "⊘" : "◉"}</Text>
        </View>
      </View>

      {/* Effets */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.effectsBar}
        contentContainerStyle={styles.effectsContent}
      >
        {effects.map((e) => (
          <Pressable
            key={e}
            onPress={() => setEffect(e)}
            style={[styles.effectChip, effect === e && styles.effectChipActive]}
          >
            <Text
              style={[
                styles.effectText,
                effect === e && styles.effectTextActive,
              ]}
            >
              {e}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Contrôles */}
      <View style={styles.controls}>
        <View style={styles.controlsRow}>
          <Pressable
            onPress={toggleMute}
            style={[styles.ctrlBtn, isMuted && styles.ctrlBtnActive]}
          >
            <Text style={styles.ctrlIcon}>{isMuted ? "🔇" : "🎤"}</Text>
            <Text style={styles.ctrlLabel}>{isMuted ? "Muet" : "Micro"}</Text>
          </Pressable>

          <Pressable
            onPress={toggleCamera}
            style={[styles.ctrlBtn, isCameraOff && styles.ctrlBtnActive]}
          >
            <Text style={styles.ctrlIcon}>{isCameraOff ? "📷" : "📸"}</Text>
            <Text style={styles.ctrlLabel}>
              {isCameraOff ? "Cam OFF" : "Caméra"}
            </Text>
          </Pressable>

          <Pressable
            onPress={switchToAudioOnly}
            style={[styles.ctrlBtn, isAudioOnly && styles.ctrlBtnActive]}
          >
            <Text style={styles.ctrlIcon}>🎵</Text>
            <Text style={styles.ctrlLabel}>Audio</Text>
          </Pressable>

          <Pressable onPress={() => navigation.goBack()} style={styles.ctrlBtn}>
            <Text style={styles.ctrlIcon}>💬</Text>
            <Text style={styles.ctrlLabel}>Texte</Text>
          </Pressable>
        </View>

        <Pressable onPress={hangUp} style={styles.hangupBtn}>
          <Text style={styles.hangupIcon}>📵</Text>
          <Text style={styles.hangupText}>Raccrocher</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0A0A0A" },
  videoArea: { flex: 1, position: "relative" },
  remoteVideo: {
    flex: 1,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  videoStatus: { color: "rgba(255,255,255,0.6)", fontSize: 14 },
  duration: { color: colors.text, fontSize: 22, fontWeight: "900" },
  audioOnlyBadge: { color: colors.neonRed, fontWeight: "700", fontSize: 13 },
  localVideo: {
    position: "absolute",
    top: 54,
    right: 16,
    width: 110,
    height: 160,
    borderRadius: 12,
    backgroundColor: "#222",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.neonRed,
  },
  localIcon: { fontSize: 36 },
  effectsBar: { maxHeight: 50, backgroundColor: "#111" },
  effectsContent: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  effectChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#333",
  },
  effectChipActive: {
    borderColor: colors.neonRed,
    backgroundColor: "rgba(232,0,10,0.15)",
  },
  effectText: {
    color: "rgba(255,255,255,0.5)",
    fontWeight: "600",
    fontSize: 13,
  },
  effectTextActive: { color: colors.neonRed },
  controls: {
    backgroundColor: "#111",
    paddingTop: 16,
    paddingBottom: 34,
    paddingHorizontal: 20,
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: "#222",
  },
  controlsRow: { flexDirection: "row", justifyContent: "space-around" },
  ctrlBtn: {
    alignItems: "center",
    gap: 6,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#1A1A1A",
    minWidth: 70,
  },
  ctrlBtnActive: {
    backgroundColor: "rgba(232,0,10,0.15)",
    borderWidth: 1,
    borderColor: colors.neonRed,
  },
  ctrlIcon: { fontSize: 24 },
  ctrlLabel: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 11,
    fontWeight: "600",
  },
  hangupBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.neonRed,
    borderRadius: 12,
    padding: 14,
  },
  hangupIcon: { fontSize: 22 },
  hangupText: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: 1,
  },
});
