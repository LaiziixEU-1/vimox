import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { RootStackParamList } from "../models/types";
import { useAuth } from "../services/AuthContext";
import { startVideoSession, stopVideoSession } from "../services/videoService";
import { VimoXLogo } from "../components/VimoXLogo";
import { colors } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "VideoCall">;
type Effect = "Normal" | "N&B" | "Flou" | "Saturation" | "Néon" | "Avatar Pro";
const effects: Effect[] = ["Normal", "N&B", "Flou", "Saturation", "Néon", "Avatar Pro"];

export function VideoCallScreen({ route, navigation }: Props) {
  const { profile } = useAuth();
  const [camera, setCamera] = useState(true);
  const [mic, setMic] = useState(true);
  const [effect, setEffect] = useState<Effect>("Normal");
  const [status, setStatus] = useState("Connexion vidéo...");

  useEffect(() => {
    if (!profile) return;
    startVideoSession(route.params.roomId, profile.id).then((session) => {
      setStatus(`${session.provider.toUpperCase()} prêt pour ${session.roomId.slice(0, 6)}`);
    });
    return () => {
      void stopVideoSession();
    };
  }, [profile, route.params.roomId]);

  return (
    <View style={styles.root}>
      <LinearGradient colors={[colors.black, "#08182A", "#2A090D"]} style={[styles.video, effectStyle(effect)]}>
        <VimoXLogo size={190} showWordmark={false} />
        <Text style={styles.status}>{status}</Text>
        <Text style={styles.note}>Branche ici react-native-webrtc ou Agora pour le vrai flux vidéo.</Text>

        <View style={styles.preview}>
          <Text style={styles.previewIcon}>{camera ? "◉" : "⊘"}</Text>
          <Text style={styles.previewText}>{camera ? "Moi" : "Cam OFF"}</Text>
        </View>
      </LinearGradient>

      <View style={styles.controls}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.effects}>
            {effects.map((item) => (
              <Pressable key={item} onPress={() => setEffect(item)} style={[styles.effect, effect === item && styles.effectActive]}>
                <Text style={styles.effectText}>{item}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <View style={styles.actions}>
          <Control label={camera ? "Cam" : "Off"} onPress={() => setCamera((v) => !v)} />
          <Control label={mic ? "Mic" : "Mute"} onPress={() => setMic((v) => !v)} />
          <Control label="Texte" onPress={() => navigation.goBack()} />
          <Control label="Quitter" danger onPress={() => navigation.goBack()} />
        </View>
      </View>
    </View>
  );
}

function Control({ label, onPress, danger }: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.control, danger && styles.controlDanger]}>
      <Text style={styles.controlText}>{label}</Text>
    </Pressable>
  );
}

function effectStyle(effect: Effect) {
  switch (effect) {
    case "N&B":
      return { opacity: 0.82 };
    case "Flou":
      return { transform: [{ scale: 1.02 }] };
    case "Saturation":
      return { borderColor: colors.warning };
    case "Néon":
      return { borderColor: colors.neonBlue };
    case "Avatar Pro":
      return { borderColor: colors.neonRed };
    default:
      return {};
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  video: { flex: 1, borderWidth: 2, borderColor: "transparent", alignItems: "center", justifyContent: "center", padding: 22 },
  status: { color: colors.text, fontSize: 22, fontWeight: "900", marginTop: 14 },
  note: { color: colors.muted, textAlign: "center", marginTop: 8 },
  preview: { position: "absolute", top: 58, right: 16, width: 120, height: 170, borderRadius: 18, borderWidth: 1, borderColor: colors.neonBlue, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" },
  previewIcon: { color: colors.neonBlue, fontSize: 42 },
  previewText: { color: colors.text, fontWeight: "900", marginTop: 8 },
  controls: { paddingVertical: 16, backgroundColor: "rgba(0,0,0,0.48)", gap: 16 },
  effects: { flexDirection: "row", gap: 8, paddingHorizontal: 12 },
  effect: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.panelStrong },
  effectActive: { backgroundColor: colors.neonRed },
  effectText: { color: colors.text, fontWeight: "900" },
  actions: { flexDirection: "row", justifyContent: "space-around" },
  control: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.neonBlue, alignItems: "center", justifyContent: "center" },
  controlDanger: { backgroundColor: colors.neonRed },
  controlText: { color: colors.text, fontWeight: "900" }
});
