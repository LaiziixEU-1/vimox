import React, { useRef, useState } from 'react';
import { Image, Modal, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VX } from '../lenses/projectBindings';
import type { SoundClip } from './soundService';

function Slider({ value, onChange, label, icon }: { value: number; onChange: (v: number) => void; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }) {
  const trackRef = useRef<React.ComponentRef<typeof View>>(null);
  const geo = useRef({ x: 0, w: 1 });
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const setFromPageX = (pageX: number) => {
    const v = Math.max(0, Math.min(1, (pageX - geo.current.x) / geo.current.w));
    onChangeRef.current(Math.round(v * 100) / 100);
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const pageX = e.nativeEvent.pageX;
        trackRef.current?.measure((_x, _y, w, _h, px) => {
          geo.current = { x: px, w: Math.max(1, w) };
          setFromPageX(pageX);
        });
      },
      onPanResponderMove: (_e, g) => setFromPageX(g.moveX),
    }),
  ).current;

  return (
    <View style={styles.sliderRow}>
      <View style={styles.sliderHead}>
        <Ionicons name={icon} size={18} color="#fff" />
        <Text style={styles.sliderLabel}>{label}</Text>
        <Text style={styles.sliderValue}>{Math.round(value * 100)} %</Text>
      </View>
      <View
        ref={trackRef}
        style={styles.track}
        {...responder.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) =>
          onChange(Math.max(0, Math.min(1, value + (e.nativeEvent.actionName === 'increment' ? 0.1 : -0.1))))
        }
      >
        <View style={styles.trackBg} />
        <View style={[styles.trackFill, { width: `${value * 100}%` }]} />
        <View style={[styles.thumb, { left: `${value * 100}%` }]} />
      </View>
    </View>
  );
}

type Props = {
  visible: boolean;
  clip: SoundClip | null;
  /** true pour une vidéo : affiche aussi le volume du son original */
  hasVideo: boolean;
  onChange: (clip: SoundClip) => void;
  onTrim: () => void;
  onRemove: () => void;
  onClose: () => void;
};

/** Réglages du son, comme sur Snap : volumes, passage du morceau, retirer le son. */
export default function VolumeMixer({ visible, clip, hasVideo, onChange, onTrim, onRemove, onClose }: Props) {
  if (!clip) return null;
  const s = clip.sound;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.header}>
            {s.coverURL ? (
              <Image source={{ uri: s.coverURL }} style={styles.cover} />
            ) : (
              <View style={[styles.cover, styles.coverFallback]}>
                <Ionicons name="musical-notes" size={20} color="#fff" />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>{s.title}</Text>
              {!!s.artist && <Text style={styles.artist} numberOfLines={1}>{s.artist}</Text>}
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fermer">
              <Ionicons name="close" size={24} color="#fff" />
            </Pressable>
          </View>

          <Slider
            label="Musique"
            icon="musical-notes"
            value={clip.musicVolume}
            onChange={(v) => onChange({ ...clip, musicVolume: v })}
          />
          {hasVideo && (
            <Slider
              label="Son original"
              icon="videocam"
              value={clip.videoVolume}
              onChange={(v) => onChange({ ...clip, videoVolume: v })}
            />
          )}

          <Pressable style={styles.row} onPress={onTrim} accessibilityRole="button">
            <Ionicons name="cut-outline" size={20} color="#fff" />
            <Text style={styles.rowTxt}>Choisir le passage ({clip.clipSec} s)</Text>
            <Ionicons name="chevron-forward" size={18} color={VX.textMuted} />
          </Pressable>
          <Pressable style={styles.row} onPress={onRemove} accessibilityRole="button">
            <Ionicons name="trash-outline" size={20} color={VX.red} />
            <Text style={[styles.rowTxt, { color: VX.red }]}>Retirer le son</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: VX.black, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 34, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cover: { width: 46, height: 46, borderRadius: 8 },
  coverFallback: { backgroundColor: VX.red, alignItems: 'center', justifyContent: 'center' },
  title: { color: VX.text, fontSize: 16, fontWeight: '800' },
  artist: { color: VX.textMuted, fontSize: 13, marginTop: 2 },
  sliderRow: { gap: 8 },
  sliderHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sliderLabel: { color: '#fff', fontSize: 15, fontWeight: '700', flex: 1 },
  sliderValue: { color: VX.textMuted, fontSize: 13, fontVariant: ['tabular-nums'] },
  track: { height: 32, justifyContent: 'center' },
  trackBg: { height: 6, borderRadius: 3, backgroundColor: VX.surfaceHigh },
  trackFill: { position: 'absolute', left: 0, height: 6, borderRadius: 3, backgroundColor: VX.red },
  thumb: { position: 'absolute', width: 24, height: 24, marginLeft: -12, borderRadius: 12, backgroundColor: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#333' },
  rowTxt: { color: '#fff', fontSize: 15, fontWeight: '700', flex: 1 },
});
