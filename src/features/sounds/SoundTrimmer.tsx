import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VX } from '../lenses/projectBindings';
import { CLIP_LENGTHS, DEFAULT_CLIP_SEC, type VimoxSound } from './soundService';
import { useClipPlayer } from './useClipPlayer';

const SCREEN_W = Dimensions.get('window').width;
const PX_PER_SEC = 8;
const BAR_W = 3;
const BAR_GAP = 2;

const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

// Onde sonore décorative, toujours la même pour un même son
function useBars(seed: string, count: number) {
  return useMemo(() => {
    let h = 2166136261;
    for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
    const out: number[] = [];
    for (let i = 0; i < count; i++) {
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      const r = ((h >>> 0) % 1000) / 1000;
      const wave = 0.55 + 0.45 * Math.sin(i / 7) * Math.sin(i / 23);
      out.push(0.18 + 0.82 * Math.min(1, Math.max(0, r * 0.6 + wave * 0.5)));
    }
    return out;
  }, [seed, count]);
}

type Props = {
  visible: boolean;
  sound: VimoxSound | null;
  initialStart?: number;
  initialClip?: number;
  onCancel: () => void;
  onDone: (startSec: number, clipSec: number) => void;
};

/**
 * Comme sur Snap : on fait glisser l'onde sonore pour choisir le passage,
 * l'extrait choisi est joué en boucle, et on règle sa durée (10, 15, 30 ou 60 s).
 */
export default function SoundTrimmer({ visible, sound, initialStart = 0, initialClip = DEFAULT_CLIP_SEC, onCancel, onDone }: Props) {
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [clipSec, setClipSec] = useState(initialClip);
  const [startSec, setStartSec] = useState(initialStart);
  const [liveStart, setLiveStart] = useState(initialStart);

  const total = Math.max(sound?.durationSec || 60, clipSec);
  const maxStart = Math.max(0, total - clipSec);
  const winW = clipSec * PX_PER_SEC;
  const pad = (SCREEN_W - winW) / 2;
  const barCount = Math.ceil((total * PX_PER_SEC) / (BAR_W + BAR_GAP));
  const bars = useBars(sound?.id ?? 'x', barCount);

  useEffect(() => {
    if (!visible) return;
    const s = Math.min(initialStart, Math.max(0, total - initialClip));
    setClipSec(initialClip);
    setStartSec(s);
    setLiveStart(s);
    const t = setTimeout(() => scrollRef.current?.scrollTo({ x: s * PX_PER_SEC, animated: false }), 60);
    return () => clearTimeout(t);
  }, [visible, sound?.id]);

  useClipPlayer(
    visible && sound ? { url: sound.audioURL, startSec, clipSec, volume: 1 } : null,
    visible && !!sound,
  );

  const settle = (x: number) => {
    const s = Math.max(0, Math.min(maxStart, x / PX_PER_SEC));
    setLiveStart(s);
    setStartSec(s);
  };

  const changeClip = (c: number) => {
    setClipSec(c);
    const s = Math.min(startSec, Math.max(0, total - c));
    setStartSec(s);
    setLiveStart(s);
    setTimeout(() => scrollRef.current?.scrollTo({ x: s * PX_PER_SEC, animated: true }), 30);
  };

  if (!sound) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            {sound.coverURL ? (
              <Image source={{ uri: sound.coverURL }} style={styles.cover} />
            ) : (
              <View style={[styles.cover, styles.coverFallback]}>
                <Ionicons name="musical-notes" size={24} color="#fff" />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>{sound.title}</Text>
              {!!sound.artist && <Text style={styles.artist} numberOfLines={1}>{sound.artist}</Text>}
            </View>
          </View>

          <Text style={styles.time}>
            {fmt(liveStart)} – {fmt(Math.min(total, liveStart + clipSec))}
          </Text>

          <View style={styles.waveWrap}>
            <ScrollView
              ref={scrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: pad, alignItems: 'center' }}
              scrollEventThrottle={32}
              onScroll={(e) =>
                setLiveStart(Math.max(0, Math.min(maxStart, e.nativeEvent.contentOffset.x / PX_PER_SEC)))
              }
              onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.x)}
              onScrollEndDrag={(e) => {
                if (Math.abs(e.nativeEvent.velocity?.x ?? 0) < 0.05) settle(e.nativeEvent.contentOffset.x);
              }}
            >
              <View style={[styles.bars, { width: total * PX_PER_SEC }]}>
                {bars.map((h, i) => {
                  const sec = (i * (BAR_W + BAR_GAP)) / PX_PER_SEC;
                  const inClip = sec >= liveStart && sec <= liveStart + clipSec;
                  return (
                    <View
                      key={i}
                      style={[styles.bar, { height: 10 + h * 54, backgroundColor: inClip ? '#fff' : 'rgba(255,255,255,0.35)' }]}
                    />
                  );
                })}
              </View>
            </ScrollView>
            {/* Fenêtre fixe au centre : le passage qui sera utilisé */}
            <View pointerEvents="none" style={[styles.window, { width: winW, left: pad }]} />
          </View>
          <Text style={styles.hint}>Fais glisser pour choisir le passage</Text>

          <View style={styles.chips}>
            {CLIP_LENGTHS.map((c) => (
              <Pressable
                key={c}
                onPress={() => changeClip(c)}
                style={[styles.chip, c === clipSec && styles.chipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: c === clipSec }}
              >
                <Text style={styles.chipTxt}>{c} s</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.actions}>
            <Pressable style={styles.cancel} onPress={onCancel} accessibilityRole="button">
              <Text style={styles.cancelTxt}>Annuler</Text>
            </Pressable>
            <Pressable style={styles.done} onPress={() => onDone(startSec, clipSec)} accessibilityRole="button">
              <Text style={styles.doneTxt}>Terminé</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: VX.black,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 18,
    paddingBottom: 34,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18 },
  cover: { width: 54, height: 54, borderRadius: 8 },
  coverFallback: { backgroundColor: VX.red, alignItems: 'center', justifyContent: 'center' },
  title: { color: VX.text, fontSize: 17, fontWeight: '800' },
  artist: { color: VX.textMuted, fontSize: 14, marginTop: 2 },
  time: { color: VX.text, fontSize: 15, fontWeight: '800', textAlign: 'center', marginTop: 18, fontVariant: ['tabular-nums'] },
  waveWrap: { height: 90, marginTop: 10, justifyContent: 'center' },
  bars: { flexDirection: 'row', alignItems: 'center', gap: BAR_GAP, height: 80 },
  bar: { width: BAR_W, borderRadius: 2 },
  window: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    borderWidth: 3,
    borderColor: VX.red,
    borderRadius: 12,
  },
  hint: { color: VX.textMuted, fontSize: 12, textAlign: 'center', marginTop: 4 },
  chips: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 16 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18, backgroundColor: VX.surfaceHigh },
  chipActive: { backgroundColor: VX.red },
  chipTxt: { color: '#fff', fontWeight: '800' },
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 18, marginTop: 20 },
  cancel: { flex: 1, height: 50, borderRadius: 25, backgroundColor: VX.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  cancelTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  done: { flex: 1.4, height: 50, borderRadius: 25, backgroundColor: VX.red, alignItems: 'center', justifyContent: 'center' },
  doneTxt: { color: '#fff', fontSize: 16, fontWeight: '900' },
});
