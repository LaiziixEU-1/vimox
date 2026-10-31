import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { useAudioPlayer } from 'expo-audio';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as Sharing from 'expo-sharing';

import { LensEngineProvider, LensPreview, useLensEngine } from './LensEngine';
import { EXPLORER_CATEGORIES, filterLenses, QUICK_CATEGORIES } from './lensCatalog';
import { useIsPremium, useLensPrefs } from './lensPrefs';
import { VX, type RootStackParamList } from './projectBindings';
import { STR } from './strings';
import type { LensCategoryId, VimoxLens } from './types';
import LensCarousel from './components/LensCarousel';
import LensExplorerSheet from './components/LensExplorerSheet';
import PremiumLensPrompt from './components/PremiumLensPrompt';
import SoundPickerSheet from '../sounds/SoundPickerSheet';
import type { VimoxSound } from '../sounds/soundService';

const ZOOM_STEPS = [
  // expo-camera utilise un zoom de 0 à 1 ; ces paliers sont approximatifs selon l'appareil.
  { label: '1×', value: 0 },
  { label: '2×', value: 0.08 },
  { label: '4×', value: 0.2 },
];
const MAX_VIDEO_MS = 60_000;

type Capture = { uri: string; kind: 'photo' | 'video' };

export default function LensCameraScreen() {
  const [camPerm, requestCamPerm] = useCameraPermissions();

  if (!camPerm) return <View style={styles.fill} />;
  if (!camPerm.granted) {
    return (
      <View style={[styles.fill, styles.center, { padding: 32 }]}>
        <Ionicons name="camera-outline" size={56} color={VX.red} />
        <Text style={styles.permTitle}>{STR.cameraPermissionTitle}</Text>
        <Text style={styles.permBody}>{STR.cameraPermissionBody}</Text>
        <Pressable style={styles.permBtn} onPress={requestCamPerm} accessibilityRole="button">
          <Text style={styles.permBtnText}>{STR.allowCamera}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <LensEngineProvider>
      <CameraContent />
    </LensEngineProvider>
  );
}

function CameraContent() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const engine = useLensEngine();
  const isPremium = useIsPremium();
  const prefs = useLensPrefs();
  const [, requestMicPerm] = useMicrophonePermissions();

  const [quickCategory, setQuickCategory] = useState<LensCategoryId>('forYou');
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [soundsOpen, setSoundsOpen] = useState(false);
  const [lockedLens, setLockedLens] = useState<VimoxLens | null>(null);
  const [sound, setSound] = useState<VimoxSound | null>(null);
  const [capture, setCapture] = useState<Capture | null>(null);
  const [busy, setBusy] = useState(false);
  const [recordStart, setRecordStart] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const holding = useRef(false);

  const soundPlayer = useAudioPlayer(sound ? { uri: sound.audioURL } : null);
  useEffect(() => {
    soundPlayer.loop = true;
  }, [soundPlayer, sound]);

  // Carrousel : lenses de la catégorie rapide, récentes en tête pour "Pour toi"
  const carouselLenses = useMemo(() => {
    const list = filterLenses(engine.lenses, quickCategory, prefs);
    if (quickCategory !== 'forYou') return list;
    const recent = filterLenses(engine.lenses, 'recents', prefs).slice(0, 5);
    const ids = new Set(recent.map((l) => l.id));
    return [...recent, ...list.filter((l) => !ids.has(l.id))];
  }, [engine.lenses, quickCategory, prefs.favorites, prefs.recents]);

  const selectLens = useCallback(
    async (lens: VimoxLens) => {
      if (lens.premium && !isPremium) {
        setLockedLens(lens);
        return;
      }
      try {
        await engine.applyLens(lens);
        prefs.pushRecent(lens.id);
      } catch (e) {
        console.warn('[lens] application impossible', e);
      }
    },
    [engine, isPremium, prefs.pushRecent],
  );

  const toggleFavorite = useCallback(
    (lens: VimoxLens) => {
      const added = prefs.toggleFavorite(lens.id);
      Alert.alert(added ? STR.addedToFavorites : STR.removedFromFavorites, lens.name);
    },
    [prefs.toggleFavorite],
  );

  // --- Capture ---
  const takePhoto = async () => {
    if (busy || engine.isRecording) return;
    setBusy(true);
    try {
      const uri = await engine.takePhoto();
      if (uri) setCapture({ uri, kind: 'photo' });
    } catch {
      Alert.alert(STR.captureError);
    } finally {
      setBusy(false);
    }
  };

  const startVideo = async () => {
    holding.current = true;
    const mic = await requestMicPerm();
    if (!holding.current) return;
    if (!mic.granted) console.warn('[camera] micro refusé : vidéo sans son');
    try {
      await engine.startRecording();
      if (!holding.current) {
        // Relâché pendant le démarrage : on arrête et on jette la vidéo
        await engine.stopRecording().catch(() => null);
        return;
      }
      setRecordStart(Date.now());
      if (sound) {
        soundPlayer.seekTo(0);
        soundPlayer.play();
      }
    } catch {
      Alert.alert(STR.captureError);
    }
  };

  const stopVideo = async () => {
    holding.current = false;
    if (!engine.isRecording && recordStart === null) return;
    soundPlayer.pause();
    setRecordStart(null);
    try {
      const uri = await engine.stopRecording();
      if (uri) setCapture({ uri, kind: 'video' });
    } catch {
      Alert.alert(STR.captureError);
    }
  };

  // Chrono d'enregistrement + arrêt automatique à 60 s
  useEffect(() => {
    if (recordStart === null) {
      setElapsed(0);
      return;
    }
    const id = setInterval(() => {
      const ms = Date.now() - recordStart;
      setElapsed(ms);
      if (ms >= MAX_VIDEO_MS) stopVideo();
    }, 250);
    return () => clearInterval(id);
  }, [recordStart]);

  const recording = engine.isRecording || recordStart !== null;
  const activeId = engine.activeLens?.id ?? null;

  if (capture) {
    return <CapturePreview capture={capture} sound={sound} onClose={() => setCapture(null)} />;
  }

  return (
    <View style={styles.fill}>
      {engine.ready ? <LensPreview /> : <ActivityIndicator style={StyleSheet.absoluteFill} color={VX.red} />}

      {/* Barre du haut */}
      <View style={[styles.topBar, { top: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.roundBtn} hitSlop={8} accessibilityRole="button" accessibilityLabel="Fermer la caméra">
          <Ionicons name="close" size={24} color="#fff" />
        </Pressable>

        {engine.supportsZoom && (
          <View style={styles.zoom}>
            {ZOOM_STEPS.map((z) => {
              const active = engine.zoom === z.value;
              return (
                <Pressable key={z.label} onPress={() => engine.setZoom(z.value)} style={[styles.zoomItem, active && styles.zoomItemActive]}>
                  <Text style={[styles.zoomText, active && styles.zoomTextActive]}>{z.label}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={{ width: 40 }} />
      </View>

      {/* Outils à droite */}
      <View style={[styles.sideTools, { top: insets.top + 64 }]}>
        <ToolButton icon="camera-reverse-outline" label="Changer de caméra" onPress={() => engine.setFacing(engine.facing === 'front' ? 'back' : 'front')} />
        {engine.supportsTorch && (
          <ToolButton icon={engine.torch ? 'flash' : 'flash-off-outline'} label="Flash" onPress={() => engine.setTorch(!engine.torch)} />
        )}
        <ToolButton icon="musical-notes-outline" label={STR.sounds} onPress={() => setSoundsOpen(true)} active={!!sound} />
      </View>

      {sound && (
        <Pressable style={[styles.soundChip, { top: insets.top + 60 }]} onPress={() => setSoundsOpen(true)}>
          <Ionicons name="musical-note" size={14} color="#fff" />
          <Text style={styles.soundChipText} numberOfLines={1}>{sound.title}</Text>
        </Pressable>
      )}

      {engine.mode === 'demo' && (
        <View style={[styles.demoBanner, { top: insets.top + (sound ? 96 : 60) }]}>
          <Text style={styles.demoText}>{STR.demoBanner}</Text>
        </View>
      )}

      {/* Bas de l'écran */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + 10 }]}>
        {engine.activeLens && !recording && (
          <Text style={styles.lensName} numberOfLines={1}>{engine.activeLens.name}</Text>
        )}
        {recording ? (
          <Text style={styles.timer}>● {Math.floor(elapsed / 1000)}s</Text>
        ) : (
          <Text style={styles.hold}>{STR.holdToRecord}</Text>
        )}

        <View style={styles.captureRow}>
          <Pressable
            style={styles.sideCircle}
            onPress={() => setExplorerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Explorer les lenses"
          >
            <Ionicons name="grid-outline" size={24} color="#fff" />
          </Pressable>

          <Pressable
            onPress={takePhoto}
            onLongPress={startVideo}
            delayLongPress={250}
            onPressOut={() => {
              if (holding.current || recording) stopVideo();
            }}
            style={[styles.shutter, recording && styles.shutterRecording]}
            accessibilityRole="button"
            accessibilityLabel="Prendre une photo, maintenir pour filmer"
          >
            {busy ? <ActivityIndicator color="#fff" /> : <View style={[styles.shutterInner, recording && styles.shutterInnerRecording]} />}
          </Pressable>

          <View style={styles.carouselWrap}>
            <LensCarousel
              lenses={carouselLenses}
              activeLensId={activeId}
              isPremiumUser={isPremium}
              onSelect={selectLens}
              onClear={() => engine.removeLens()}
              onLongPress={toggleFavorite}
            />
          </View>
        </View>

        {!recording && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickCats}>
            {QUICK_CATEGORIES.map((id) => {
              const cat = EXPLORER_CATEGORIES.find((c) => c.id === id)!;
              const active = id === quickCategory;
              return (
                <Pressable key={id} onPress={() => setQuickCategory(id)} style={[styles.quickCat, active && styles.quickCatActive]}>
                  <Text style={[styles.quickCatText, active && styles.quickCatTextActive]}>{cat.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      <LensExplorerSheet
        visible={explorerOpen}
        onClose={() => setExplorerOpen(false)}
        lenses={engine.lenses}
        favorites={prefs.favorites}
        recents={prefs.recents}
        activeLensId={activeId}
        isPremiumUser={isPremium}
        initialCategory={quickCategory}
        onSelect={(lens) => {
          setExplorerOpen(false);
          selectLens(lens);
        }}
        onToggleFavorite={toggleFavorite}
      />

      <SoundPickerSheet visible={soundsOpen} onClose={() => setSoundsOpen(false)} selectedSoundId={sound?.id} onSelect={setSound} />

      <PremiumLensPrompt
        lens={lockedLens}
        onClose={() => setLockedLens(null)}
        onDiscover={() => {
          setLockedLens(null);
          navigation.navigate('Premium');
        }}
      />
    </View>
  );
}

function ToolButton({ icon, label, onPress, active }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; active?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.tool, active && styles.toolActive]} hitSlop={6} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={24} color="#fff" />
    </Pressable>
  );
}

function CapturePreview({ capture, sound, onClose }: { capture: Capture; sound: VimoxSound | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const uri = capture.uri.startsWith('file://') || capture.uri.startsWith('content://') ? capture.uri : `file://${capture.uri}`;
  const videoPlayer = useVideoPlayer(capture.kind === 'video' ? uri : null, (p) => {
    p.loop = true;
    p.play();
  });
  const soundPlayer = useAudioPlayer(sound ? { uri: sound.audioURL } : null);

  useEffect(() => {
    if (!sound) return;
    soundPlayer.loop = true;
    soundPlayer.play();
    return () => soundPlayer.pause();
  }, [sound, soundPlayer]);

  const share = async () => {
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType: capture.kind === 'photo' ? 'image/jpeg' : 'video/mp4' });
    }
  };

  return (
    <View style={styles.fill}>
      {capture.kind === 'photo' ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <VideoView player={videoPlayer} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      )}
      <Pressable onPress={onClose} style={[styles.roundBtn, { position: 'absolute', top: insets.top + 8, left: 16 }]} accessibilityRole="button" accessibilityLabel={STR.discard}>
        <Ionicons name="close" size={24} color="#fff" />
      </Pressable>
      <View style={[styles.previewActions, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable style={styles.previewSecondary} onPress={onClose} accessibilityRole="button">
          <Ionicons name="trash-outline" size={20} color="#fff" />
          <Text style={styles.previewBtnText}>{STR.discard}</Text>
        </Pressable>
        <Pressable style={styles.previewPrimary} onPress={share} accessibilityRole="button">
          <Ionicons name="share-outline" size={20} color="#fff" />
          <Text style={styles.previewBtnText}>{STR.share}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: VX.black },
  center: { alignItems: 'center', justifyContent: 'center' },
  permTitle: { color: VX.text, fontSize: 20, fontWeight: '800', marginTop: 16, textAlign: 'center' },
  permBody: { color: VX.textMuted, fontSize: 15, marginTop: 8, textAlign: 'center', lineHeight: 21 },
  permBtn: { marginTop: 24, backgroundColor: VX.red, borderRadius: 26, paddingHorizontal: 28, height: 52, justifyContent: 'center' },
  permBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  topBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: VX.overlay, alignItems: 'center', justifyContent: 'center' },
  zoom: { flexDirection: 'row', backgroundColor: VX.overlay, borderRadius: 22, padding: 4 },
  zoomItem: { width: 40, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  zoomItemActive: { backgroundColor: 'rgba(255,255,255,0.15)' },
  zoomText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  zoomTextActive: { color: VX.red },

  sideTools: { position: 'absolute', right: 14, gap: 14 },
  tool: { width: 44, height: 44, borderRadius: 22, backgroundColor: VX.overlay, alignItems: 'center', justifyContent: 'center' },
  toolActive: { backgroundColor: VX.red },
  soundChip: {
    position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: VX.overlay, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, maxWidth: '60%',
  },
  soundChipText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  demoBanner: { position: 'absolute', alignSelf: 'center', backgroundColor: 'rgba(255,46,77,0.85)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, maxWidth: '80%' },
  demoText: { color: '#fff', fontSize: 12, fontWeight: '600', textAlign: 'center' },

  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  lensName: { color: '#fff', fontSize: 15, fontWeight: '800', marginBottom: 2, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },
  hold: { color: 'rgba(255,255,255,0.75)', fontSize: 12, marginBottom: 8 },
  timer: { color: VX.red, fontSize: 15, fontWeight: '800', marginBottom: 8 },
  captureRow: { flexDirection: 'row', alignItems: 'center', width: '100%', paddingLeft: 16 },
  sideCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: VX.overlay, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  shutter: { width: 84, height: 84, borderRadius: 42, borderWidth: 5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  shutterRecording: { borderColor: VX.red, transform: [{ scale: 1.12 }] },
  shutterInner: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.15)' },
  shutterInnerRecording: { width: 30, height: 30, borderRadius: 8, backgroundColor: VX.red },
  carouselWrap: { flex: 1, marginLeft: 8 },
  quickCats: { paddingHorizontal: 16, gap: 8, marginTop: 12 },
  quickCat: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  quickCatActive: { backgroundColor: VX.overlay, borderWidth: 1.5, borderColor: VX.red },
  quickCatText: { color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: '700' },
  quickCatTextActive: { color: '#fff' },

  previewActions: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'center', gap: 14, paddingHorizontal: 20 },
  previewSecondary: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: VX.overlay, borderRadius: 26, paddingHorizontal: 22, height: 52 },
  previewPrimary: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: VX.red, borderRadius: 26, paddingHorizontal: 26, height: 52 },
  previewBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
