import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { colors } from "../theme/colors";

type Props = {
  uri: string;
  duration: number;
  mine: boolean;
};

const SPEEDS = [1, 1.5, 2];
const BARS = 30;

function fmt(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Onde sonore : toujours la même pour un message donné (calculée à partir de son adresse)
function waveOf(seed: string): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const out: number[] = [];
  for (let i = 0; i < BARS; i++) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const r = ((h >>> 0) % 1000) / 1000;
    // forme naturelle : plus calme au début et à la fin
    const env = Math.sin((Math.PI * (i + 0.5)) / BARS) * 0.6 + 0.4;
    out.push(0.18 + r * 0.82 * env);
  }
  return out;
}

export function AudioBubble({ uri, duration, mine }: Props) {
  const player = useAudioPlayer(uri || null);
  const status = useAudioPlayerStatus(player);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [waveW, setWaveW] = useState(0);
  const wave = useMemo(() => waveOf(uri || "vimox"), [uri]);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  const total = status.duration > 0 ? status.duration : duration;
  const progress = total > 0 ? Math.min(1, status.currentTime / total) : 0;
  const started = status.playing || status.currentTime > 0;

  function toggle() {
    try {
      if (status.playing) {
        player.pause();
        return;
      }
      if (total > 0 && status.currentTime >= total - 0.1) player.seekTo(0);
      player.play();
    } catch {}
  }

  function changeSpeed() {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    try {
      player.setPlaybackRate(SPEEDS[next]);
    } catch {}
  }

  // Toucher l'onde = aller à cet endroit du message
  function seek(x: number) {
    if (!waveW || !total) return;
    try {
      player.seekTo(Math.max(0, Math.min(total, (x / waveW) * total)));
      if (!status.playing) player.play();
    } catch {}
  }

  const on = mine ? "#FFFFFF" : colors.neonRed;
  const off = mine ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.22)";

  return (
    <View style={[s.bubble, mine ? s.mine : s.theirs]}>
      <Pressable
        onPress={toggle}
        hitSlop={6}
        style={[s.playBtn, mine ? s.playBtnMine : s.playBtnTheirs]}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? "Pause" : "Écouter le message vocal"}
      >
        <Ionicons name={status.playing ? "pause" : "play"} size={16} color="#fff" style={!status.playing && { marginLeft: 2 }} />
      </Pressable>

      <View style={s.mid}>
        <Pressable
          onLayout={(e) => setWaveW(e.nativeEvent.layout.width)}
          onPress={(e) => seek(e.nativeEvent.locationX)}
          style={s.wave}
          accessibilityRole="adjustable"
          accessibilityLabel="Position dans le message vocal"
        >
          {wave.map((h, i) => (
            <View
              key={i}
              style={[s.bar, { height: `${Math.round(h * 100)}%`, backgroundColor: (i + 0.5) / BARS <= progress ? on : off }]}
            />
          ))}
        </Pressable>
        <Text style={[s.time, !mine && { color: colors.muted }]}>
          {status.error ? "⚠ Lecture impossible" : fmt(started ? status.currentTime : total)}
        </Text>
      </View>

      <Pressable onPress={changeSpeed} hitSlop={6} style={s.speed} accessibilityRole="button" accessibilityLabel="Vitesse de lecture">
        <Text style={s.speedTxt}>{SPEEDS[speedIdx]}x</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  bubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: 250,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  mine: { backgroundColor: colors.neonRed },
  theirs: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  playBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  playBtnMine: { backgroundColor: "rgba(255,255,255,0.22)" },
  playBtnTheirs: { backgroundColor: colors.neonRed },
  mid: { flex: 1, gap: 4 },
  wave: { height: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bar: { width: 3, borderRadius: 2, minHeight: 4 },
  time: { color: "rgba(255,255,255,0.8)", fontSize: 11, fontWeight: "700" },
  speed: { paddingHorizontal: 7, paddingVertical: 4, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.14)" },
  speedTxt: { color: colors.text, fontSize: 11, fontWeight: "800" },
});
