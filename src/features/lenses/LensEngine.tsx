import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { NativeModules, StyleSheet, View, type ViewStyle } from 'react-native';
import { CameraView } from 'expo-camera';
import { SNAP_CAMERA_PROPS, cameraFillStyle } from '../../utils/cameraFormat';
import type { VideoRecording } from '@snap/camera-kit-react-native';
import { DEMO_LENSES, fromCameraKitLens } from './lensCatalog';
import type { VimoxLens } from './types';

// ---------------------------------------------------------------------------
// Configuration (fichier .env à la racine du projet)
//   EXPO_PUBLIC_CAMERA_KIT_API_TOKEN=...      (portail Camera Kit)
//   EXPO_PUBLIC_CAMERA_KIT_GROUP_IDS=id1,id2  (tes groupes de lenses)
// ---------------------------------------------------------------------------
const CAMERA_KIT_API_TOKEN = process.env.EXPO_PUBLIC_CAMERA_KIT_API_TOKEN ?? '';
const CAMERA_KIT_GROUP_IDS = (process.env.EXPO_PUBLIC_CAMERA_KIT_GROUP_IDS ?? '')
  .split(',')
  .map((s: string) => s.trim())
  .filter(Boolean);

/**
 * true seulement dans un build natif (EAS) contenant Camera Kit ET avec un token.
 * Dans Expo Go, le module natif n'existe pas : on bascule sur le mode démo.
 */
export const isCameraKitAvailable = !!NativeModules.CameraKitContext && CAMERA_KIT_API_TOKEN.length > 0;

export type Facing = 'front' | 'back';

export interface LensEngine {
  mode: 'camerakit' | 'demo';
  ready: boolean;
  lenses: VimoxLens[];
  activeLens: VimoxLens | null;
  facing: Facing;
  setFacing: (f: Facing) => void;
  applyLens: (lens: VimoxLens) => Promise<void>;
  removeLens: () => Promise<void>;
  takePhoto: () => Promise<string | null>;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>;
  isRecording: boolean;
  /** Zoom et flash : disponibles seulement en mode démo (le wrapper Camera Kit ne les expose pas). */
  supportsZoom: boolean;
  zoom: number;
  setZoom: (z: number) => void;
  supportsTorch: boolean;
  torch: boolean;
  setTorch: (t: boolean) => void;
}

const LensEngineContext = createContext<LensEngine | null>(null);

export function useLensEngine(): LensEngine {
  const ctx = useContext(LensEngineContext);
  if (!ctx) throw new Error('useLensEngine doit être utilisé dans <LensEngineProvider>');
  return ctx;
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(() => resolve(), ms));

// ===========================================================================
// Mode démo : expo-camera (fonctionne dans Expo Go)
// ===========================================================================
function DemoEngineProvider({ children }: { children: React.ReactNode }) {
  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<Facing>('front');
  const [activeLens, setActiveLens] = useState<VimoxLens | null>(null);
  const [zoom, setZoom] = useState(0);
  const [torch, setTorch] = useState(false);
  const [cameraMode, setCameraMode] = useState<'picture' | 'video'>('picture');
  const [isRecording, setIsRecording] = useState(false);
  const recording = useRef<Promise<{ uri: string } | undefined> | null>(null);
  const cancelStart = useRef(false);

  const applyLens = useCallback(async (lens: VimoxLens) => {
    setActiveLens(lens);
    if (lens.facing) setFacing(lens.facing);
  }, []);

  const removeLens = useCallback(async () => setActiveLens(null), []);

  const takePhoto = useCallback(async () => {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.85 });
    return photo?.uri ?? null;
  }, []);

  const startRecording = useCallback(async () => {
    cancelStart.current = false;
    // expo-camera doit être en mode "video" pour enregistrer : le changement prend un instant.
    setCameraMode('video');
    await wait(350);
    if (cancelStart.current || !cameraRef.current) {
      setCameraMode('picture');
      return;
    }
    setIsRecording(true);
    recording.current = cameraRef.current.recordAsync({ maxDuration: 60 });
  }, []);

  const stopRecording = useCallback(async () => {
    cancelStart.current = true;
    if (!recording.current) return null;
    cameraRef.current?.stopRecording();
    try {
      const result = await recording.current;
      return result?.uri ?? null;
    } finally {
      recording.current = null;
      setIsRecording(false);
      setCameraMode('picture');
    }
  }, []);

  const previewState = useMemo(
    () => ({ cameraRef, facing, cameraMode, zoom, torch, tint: activeLens?.demoTint }),
    [facing, cameraMode, zoom, torch, activeLens],
  );

  const value: LensEngine = {
    mode: 'demo',
    ready: true,
    lenses: DEMO_LENSES,
    activeLens,
    facing,
    setFacing,
    applyLens,
    removeLens,
    takePhoto,
    startRecording,
    stopRecording,
    isRecording,
    supportsZoom: true,
    zoom,
    setZoom,
    supportsTorch: facing === 'back',
    torch,
    setTorch,
  };

  return (
    <LensEngineContext.Provider value={value}>
      <DemoPreviewContext.Provider value={previewState}>{children}</DemoPreviewContext.Provider>
    </LensEngineContext.Provider>
  );
}

type DemoPreviewState = {
  cameraRef: React.RefObject<CameraView | null>;
  facing: Facing;
  cameraMode: 'picture' | 'video';
  zoom: number;
  torch: boolean;
  tint?: string;
};
const DemoPreviewContext = createContext<DemoPreviewState | null>(null);

// Composant défini une seule fois : la caméra n'est pas remontée à chaque changement de zoom.
function DemoPreview({ style }: { style?: ViewStyle }) {
  const s = useContext(DemoPreviewContext);
  if (!s) return null;
  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }, style]}>
      <CameraView
        ref={s.cameraRef}
        style={cameraFillStyle()}
        {...SNAP_CAMERA_PROPS}
        facing={s.facing}
        mode={s.cameraMode}
        zoom={s.zoom}
        enableTorch={s.torch}
        mirror={s.facing === 'front'}
      />
      {s.tint ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: s.tint }]} /> : null}
    </View>
  );
}

// ===========================================================================
// Mode Camera Kit : vraies lenses AR (build EAS uniquement)
// ===========================================================================
type CameraKitModule = typeof import('@snap/camera-kit-react-native');

function CameraKitEngineProvider({ children }: { children: React.ReactNode }) {
  // require paresseux : le module n'est jamais chargé dans Expo Go.
  const CK = useMemo(() => require('@snap/camera-kit-react-native') as CameraKitModule, []);
  return (
    <CK.CameraKitContext apiToken={CAMERA_KIT_API_TOKEN}>
      <CameraKitEngineInner CK={CK}>{children}</CameraKitEngineInner>
    </CK.CameraKitContext>
  );
}

function CameraKitEngineInner({ CK, children }: { CK: CameraKitModule; children: React.ReactNode }) {
  const ck = CK.useCameraKit();
  const [lenses, setLenses] = useState<VimoxLens[]>([]);
  const [activeLens, setActiveLens] = useState<VimoxLens | null>(null);
  const [facing, setFacing] = useState<Facing>('front');
  const [isRecording, setIsRecording] = useState(false);
  const videoRef = useRef<VideoRecording | null>(null);

  useEffect(() => {
    if (!ck.isSessionReady) return;
    let cancelled = false;
    Promise.all(CAMERA_KIT_GROUP_IDS.map((groupId: string) => ck.loadLensGroup(groupId).catch(() => [])))
      .then((groups) => {
        if (cancelled) return;
        const seen = new Set<string>();
        const list = groups
          .flat()
          .map(fromCameraKitLens)
          .filter((l) => (seen.has(l.id) ? false : (seen.add(l.id), true)));
        setLenses(list);
      })
      .catch((e) => console.warn('[CameraKit] chargement des lenses impossible', e));
    return () => {
      cancelled = true;
    };
  }, [ck.isSessionReady]);

  const applyLens = useCallback(
    async (lens: VimoxLens) => {
      if (lens.facing) setFacing(lens.facing);
      await ck.applyLens(lens.id);
      setActiveLens(lens);
    },
    [ck],
  );

  const removeLens = useCallback(async () => {
    await ck.removeLens();
    setActiveLens(null);
  }, [ck]);

  const takePhoto = useCallback(async () => {
    const { uri } = await ck.takeSnapshot('JPEG', 90);
    return uri ?? null;
  }, [ck]);

  const startRecording = useCallback(async () => {
    videoRef.current = ck.takeVideo();
    setIsRecording(true);
  }, [ck]);

  const stopRecording = useCallback(async () => {
    if (!videoRef.current) return null;
    try {
      const { uri } = await videoRef.current.stop();
      return uri ?? null;
    } finally {
      videoRef.current = null;
      setIsRecording(false);
    }
  }, []);

  const previewState = useMemo(() => ({ CK, facing }), [CK, facing]);

  const value: LensEngine = {
    mode: 'camerakit',
    ready: ck.isSessionReady,
    lenses,
    activeLens,
    facing,
    setFacing,
    applyLens,
    removeLens,
    takePhoto,
    startRecording,
    stopRecording,
    isRecording,
    supportsZoom: false,
    zoom: 0,
    setZoom: () => {},
    supportsTorch: false,
    torch: false,
    setTorch: () => {},
  };

  return (
    <LensEngineContext.Provider value={value}>
      <CameraKitPreviewContext.Provider value={previewState}>{children}</CameraKitPreviewContext.Provider>
    </LensEngineContext.Provider>
  );
}

const CameraKitPreviewContext = createContext<{ CK: CameraKitModule; facing: Facing } | null>(null);

function CameraKitPreview({ style }: { style?: ViewStyle }) {
  const s = useContext(CameraKitPreviewContext);
  if (!s) return null;
  const { CameraPreviewView } = s.CK;
  return (
    <CameraPreviewView
      style={[StyleSheet.absoluteFill, style]}
      cameraPosition={s.facing}
      mirrorFramesHorizontally={s.facing === 'front'}
      // Zone où la lens peut placer ses éléments (évite l'encoche et les contrôles du bas)
      safeRenderArea={{ top: 100, bottom: 220, left: 0, right: 0 }}
    />
  );
}

/** Choisit automatiquement le bon moteur selon l'environnement. */
export const LensEngineProvider = isCameraKitAvailable ? CameraKitEngineProvider : DemoEngineProvider;

/** Aperçu caméra (avec la lens active) correspondant au moteur utilisé. */
export const LensPreview = isCameraKitAvailable ? CameraKitPreview : DemoPreview;
