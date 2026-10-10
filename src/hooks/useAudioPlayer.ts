import { useState, useRef, useCallback, useEffect } from "react";
import { Audio } from "expo-av";

export type PlaybackState =
  | "idle"
  | "loading"
  | "playing"
  | "paused"
  | "finished";

export function useAudioPlayer(audioUrl: string) {
  const [state, setState] = useState<PlaybackState>("idle");
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const loadAndPlay = useCallback(async () => {
    try {
      setState("loading");
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded) return;
          if (status.isPlaying && status.durationMillis) {
            setProgress(status.positionMillis / status.durationMillis);
            setCurrentTime(Math.round(status.positionMillis / 1000));
          }
          if (status.didJustFinish) {
            setState("finished");
            setProgress(0);
            setCurrentTime(0);
          }
        },
      );
      soundRef.current = sound;
      setState("playing");
    } catch {
      setState("idle");
    }
  }, [audioUrl]);

  const pause = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.pauseAsync();
      setState("paused");
    }
  }, []);

  const resume = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.playAsync();
      setState("playing");
    }
  }, []);

  const toggle = useCallback(async () => {
    if (state === "idle" || state === "finished") await loadAndPlay();
    else if (state === "playing") await pause();
    else if (state === "paused") await resume();
  }, [state, loadAndPlay, pause, resume]);

  const seekTo = useCallback(async (ratio: number, totalDuration: number) => {
    if (soundRef.current) {
      const posMs = Math.round(ratio * totalDuration * 1000);
      await soundRef.current.setPositionAsync(posMs);
      setProgress(ratio);
      setCurrentTime(Math.round(posMs / 1000));
    }
  }, []);

  return { state, progress, currentTime, toggle, seekTo };
}
