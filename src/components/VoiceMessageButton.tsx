import { useEffect, useRef, useState } from "react";
import { Alert, PanResponder, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { colors } from "../theme/colors";

type Props = {
  onRecorded: (uri: string, duration: number) => void | Promise<void>;
  // Durée maximale : l'enregistrement s'arrête tout seul (60 s par défaut)
  maxSeconds?: number;
};

const MAX_SECONDS = 60;
const MIN_SECONDS = 1;
const CANCEL_DX = -70;

export function VoiceMessageButton({ onRecorded, maxSeconds }: Props) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [willCancel, setWillCancel] = useState(false);

  const holding = useRef(false);
  const active = useRef(false);
  const busy = useRef(false);
  const cancelled = useRef(false);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  // Toujours la dernière version (le geste est créé une seule fois)
  const latest = useRef({ recorder, onRecorded, max: maxSeconds ?? MAX_SECONDS });
  latest.current = { recorder, onRecorded, max: maxSeconds ?? MAX_SECONDS };

  function clearTimer() {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }

  useEffect(() => {
    return () => clearTimer();
  }, []);

  async function stop(cancel: boolean) {
    if (!active.current) return;
    active.current = false;
    clearTimer();
    setRecording(false);
    setWillCancel(false);
    const secs = (Date.now() - startedAt.current) / 1000;
    try {
      const rec = latest.current.recorder;
      await rec.stop();
      const uri = rec.uri;
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      }).catch(() => {});
      if (!cancel && uri && secs >= MIN_SECONDS) {
        await latest.current.onRecorded(uri, Math.round(secs));
      }
    } catch {
    } finally {
      busy.current = false;
    }
  }

  async function start() {
    if (busy.current) return;
    busy.current = true;
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Micro refusé",
          "Autorise le micro dans Réglages pour envoyer des messages vocaux.",
        );
        busy.current = false;
        return;
      }
      // Doigt relâché pendant la demande de permission : on n'enregistre pas
      if (!holding.current) {
        busy.current = false;
        return;
      }
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
      });
      const rec = latest.current.recorder;
      await rec.prepareToRecordAsync();
      if (!holding.current) {
        busy.current = false;
        return;
      }
      rec.record();
      active.current = true;
      startedAt.current = Date.now();
      setSeconds(0);
      setRecording(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      timer.current = setInterval(() => {
        const sec = Math.floor((Date.now() - startedAt.current) / 1000);
        setSeconds(sec);
        if (sec >= latest.current.max) {
          holding.current = false;
          stop(cancelled.current);
        }
      }, 250);
    } catch {
      busy.current = false;
      active.current = false;
      setRecording(false);
      Alert.alert("Erreur", "Impossible de démarrer l'enregistrement.");
    }
  }

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        holding.current = true;
        cancelled.current = false;
        setWillCancel(false);
        start();
      },
      onPanResponderMove: (_, g) => {
        const c = g.dx < CANCEL_DX;
        if (c !== cancelled.current) {
          cancelled.current = c;
          setWillCancel(c);
          if (c) Haptics.selectionAsync().catch(() => {});
        }
      },
      onPanResponderRelease: () => {
        holding.current = false;
        if (active.current) stop(cancelled.current);
      },
      onPanResponderTerminate: () => {
        holding.current = false;
        if (active.current) stop(true);
      },
    }),
  ).current;

  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <View style={st.wrap}>
      {recording && (
        <View
          style={[st.banner, willCancel && st.bannerCancel]}
          pointerEvents="none"
        >
          <View style={st.recDot} />
          <Text style={st.timer}>
            {mm}:{ss}
          </Text>
          <Text style={st.hint} numberOfLines={1}>
            {willCancel ? "Relâche pour annuler" : "‹ Glisse pour annuler"}
          </Text>
        </View>
      )}
      <View
        {...responder.panHandlers}
        style={[st.btn, recording && st.btnRec, willCancel && st.btnCancel]}
      >
        <Ionicons
          name={(willCancel ? "trash-outline" : "mic") as any}
          size={22}
          color="#fff"
        />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { width: 40, height: 40 },
  btn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  btnRec: { backgroundColor: colors.neonRed },
  btnCancel: { backgroundColor: "#6b1d28" },
  banner: {
    position: "absolute",
    right: 50,
    bottom: 0,
    height: 40,
    width: 230,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    zIndex: 10,
  },
  bannerCancel: { borderColor: colors.neonRed },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#E03A52",
  },
  timer: { color: colors.text, fontSize: 14, fontWeight: "800", minWidth: 34 },
  hint: { flex: 1, color: colors.muted, fontSize: 12, fontWeight: "600" },
});
