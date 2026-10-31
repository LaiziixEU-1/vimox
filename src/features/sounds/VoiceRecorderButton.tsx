import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

const RED = '#FF2E4D';
const MIN_DURATION_MS = 800;   // en dessous : considéré comme un tap accidentel
const MAX_DURATION_MS = 60_000; // 1 minute max

type Props = {
  onRecorded: (uri: string, durationMs: number) => Promise<void> | void;
  onRecordingChange?: (isRecording: boolean) => void; // pour masquer le TextInput pendant l'enregistrement
  disabled?: boolean;
  hintLabel?: string; // passe t('chat.releaseToSend') pour l'i18n
};

export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export default function VoiceRecorderButton({
  onRecorded,
  onRecordingChange,
  disabled,
  hintLabel = 'Relâchez pour envoyer',
}: Props) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 200);
  const [sending, setSending] = useState(false);
  const pressing = useRef(false);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    onRecordingChange?.(state.isRecording);
    if (!state.isRecording) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [state.isRecording]);

  const start = useCallback(async () => {
    if (disabled || sending) return;
    pressing.current = true;
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Micro', "Autorise l'accès au micro dans les réglages pour envoyer des vocaux.");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      if (!pressing.current) return; // relâché pendant la préparation
      recorder.record();
    } catch (e) {
      console.warn('Erreur démarrage enregistrement', e);
    }
  }, [disabled, sending, recorder]);

  const stop = useCallback(async () => {
    pressing.current = false;
    const status = recorder.getStatus();
    if (!status.isRecording) return;

    try {
      await recorder.stop();
      // Remet le son sur le haut-parleur (sinon l'écouteur est utilisé sur iOS)
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    } catch (e) {
      console.warn('Erreur arrêt enregistrement', e);
      return;
    }

    const uri = recorder.uri;
    if (!uri || status.durationMillis < MIN_DURATION_MS) return;

    setSending(true);
    try {
      await onRecorded(uri, status.durationMillis);
    } catch (e) {
      Alert.alert('Erreur', "Le message vocal n'a pas pu être envoyé.");
    } finally {
      setSending(false);
    }
  }, [recorder, onRecorded]);

  // Arrêt automatique à la durée max
  useEffect(() => {
    if (state.isRecording && state.durationMillis >= MAX_DURATION_MS) stop();
  }, [state.durationMillis, state.isRecording, stop]);

  return (
    <View style={styles.row}>
      {state.isRecording && (
        <View style={styles.info}>
          <View style={styles.dot} />
          <Text style={styles.timer}>{formatDuration(state.durationMillis)}</Text>
          <Text style={styles.hint} numberOfLines={1}>{hintLabel}</Text>
        </View>
      )}
      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <Pressable
          onPressIn={start}
          onPressOut={stop}
          disabled={disabled || sending}
          hitSlop={8}
          style={[styles.button, (disabled || sending) && styles.disabled]}
          accessibilityRole="button"
          accessibilityLabel="Maintenir pour enregistrer un message vocal"
        >
          {sending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons name="mic" size={22} color="#fff" />
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  info: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 10 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: RED, marginRight: 8 },
  timer: { color: RED, fontWeight: '700', fontVariant: ['tabular-nums'], marginRight: 10 },
  hint: { color: '#888', fontSize: 13, flexShrink: 1 },
  button: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: RED,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
});
