import { useState, useRef, useCallback } from "react";
import { Audio } from "expo-av";
import { Alert } from "react-native";

export type RecordingState = "idle" | "recording" | "stopped";
export interface RecordingResult {
  uri: string;
  duration: number;
}

export function useVoiceRecorder() {
  const [state, setState] = useState<RecordingState>("idle");
  const [duration, setDuration] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert("Permission refusée", "Active le micro dans les réglages.");
        return false;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      setState("recording");
      setDuration(0);
      timerRef.current = setInterval(
        () => setDuration((prev) => prev + 1),
        1000,
      );
      return true;
    } catch (err) {
      Alert.alert("Erreur", "Impossible de démarrer l'enregistrement.");
      return false;
    }
  }, []);

  const stopRecording =
    useCallback(async (): Promise<RecordingResult | null> => {
      if (!recordingRef.current) return null;
      try {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        await recordingRef.current.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        const uri = recordingRef.current.getURI();
        recordingRef.current = null;
        setState("stopped");
        if (!uri) return null;
        return { uri, duration };
      } catch {
        return null;
      }
    }, [duration]);

  const cancelRecording = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch {}
      recordingRef.current = null;
    }
    setState("idle");
    setDuration(0);
  }, []);

  return { state, duration, startRecording, stopRecording, cancelRecording };
}
