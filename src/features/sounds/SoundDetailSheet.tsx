import React, { useEffect, useState } from 'react';
import { Image, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VX } from '../lenses/projectBindings';
import {
  getSoundUses,
  subscribeSavedSounds,
  toggleSavedSound,
  type SoundClip,
} from './soundService';
import { useClipPlayer } from './useClipPlayer';

type Props = {
  visible: boolean;
  clip: SoundClip | null;
  onClose: () => void;
  /** « Utiliser ce son » : ouvre la caméra avec ce son */
  onUse: (clip: SoundClip) => void;
};

const fmtCount = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',')} M` : n >= 1e3 ? `${(n / 1e3).toFixed(1).replace('.', ',')} K` : String(n);

/** Fiche d'un son, comme sur Snap quand on touche l'étiquette du son. */
export default function SoundDetailSheet({ visible, clip, onClose, onUse }: Props) {
  const [playing, setPlaying] = useState(false);
  const [uses, setUses] = useState<number | null>(null);
  const [savedIds, setSavedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!visible || !clip) {
      setPlaying(false);
      return;
    }
    setPlaying(true);
    setUses(null);
    getSoundUses(clip.sound.id).then(setUses);
    return subscribeSavedSounds((list) => setSavedIds(list.map((s) => s.id)));
  }, [visible, clip?.sound.id]);

  useClipPlayer(
    clip ? { url: clip.sound.audioURL, startSec: clip.startSec, clipSec: Math.max(clip.clipSec, 30), volume: 1 } : null,
    visible && playing,
  );

  if (!clip) return null;
  const s = clip.sound;
  const saved = savedIds.includes(s.id);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.handle} />
          <View style={styles.coverWrap}>
            {s.coverURL ? (
              <Image source={{ uri: s.coverURL }} style={styles.cover} />
            ) : (
              <View style={[styles.cover, styles.coverFallback]}>
                <Ionicons name="musical-notes" size={44} color="#fff" />
              </View>
            )}
            <Pressable
              style={styles.playBtn}
              onPress={() => setPlaying((p) => !p)}
              accessibilityRole="button"
              accessibilityLabel={playing ? 'Pause' : 'Écouter'}
            >
              <Ionicons name={playing ? 'pause' : 'play'} size={26} color="#fff" />
            </Pressable>
          </View>

          <Text style={styles.title} numberOfLines={2}>{s.title}</Text>
          {!!s.artist && (
            <Pressable disabled={!s.externalURL} onPress={() => s.externalURL && Linking.openURL(s.externalURL)}>
              <Text style={styles.artist}>
                {s.artist}
                {s.externalURL ? '  ›' : ''}
              </Text>
            </Pressable>
          )}
          <Text style={styles.uses}>
            {uses === null ? ' ' : uses > 0 ? `${fmtCount(uses)} Snap${uses > 1 ? 's' : ''} avec ce son` : 'Sois le premier à utiliser ce son'}
          </Text>

          <View style={styles.actions}>
            <Pressable
              style={styles.saveBtn}
              onPress={() => toggleSavedSound(s, saved).catch(() => {})}
              accessibilityRole="button"
              accessibilityLabel={saved ? 'Retirer des sons enregistrés' : 'Enregistrer le son'}
            >
              <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={22} color={saved ? VX.red : '#fff'} />
            </Pressable>
            <Pressable
              style={styles.useBtn}
              onPress={() => {
                setPlaying(false);
                onUse(clip);
              }}
              accessibilityRole="button"
            >
              <Ionicons name="camera" size={20} color="#fff" />
              <Text style={styles.useTxt}>Utiliser ce son</Text>
            </Pressable>
          </View>
          {s.source === 'audius' && <Text style={styles.credit}>Musique : {s.artist || 'artiste indépendant'} via Audius</Text>}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: VX.black, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 22, paddingBottom: 36, alignItems: 'center' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#444', marginBottom: 18 },
  coverWrap: { width: 150, height: 150 },
  cover: { width: 150, height: 150, borderRadius: 14 },
  coverFallback: { backgroundColor: VX.red, alignItems: 'center', justifyContent: 'center' },
  playBtn: {
    position: 'absolute', right: -10, bottom: -10, width: 52, height: 52, borderRadius: 26,
    backgroundColor: VX.red, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: VX.black,
  },
  title: { color: VX.text, fontSize: 21, fontWeight: '900', textAlign: 'center', marginTop: 20 },
  artist: { color: VX.textMuted, fontSize: 15, fontWeight: '600', marginTop: 4, textAlign: 'center' },
  uses: { color: VX.textMuted, fontSize: 13, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 12, alignSelf: 'stretch', marginTop: 22 },
  saveBtn: { width: 54, height: 54, borderRadius: 27, backgroundColor: VX.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  useBtn: { flex: 1, height: 54, borderRadius: 27, backgroundColor: VX.red, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  useTxt: { color: '#fff', fontSize: 16, fontWeight: '900' },
  credit: { color: VX.textMuted, fontSize: 11, marginTop: 14 },
});
