import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import {
  Animated,
  StyleSheet,
  View,
  Text,
  Pressable,
  Image,
  ScrollView,
  TextInput,
  PanResponder,
  Alert,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Linking,
  Modal,
  Switch,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  CameraView,
  CameraType,
  FlashMode,
  useCameraPermissions,
} from "expo-camera";
import {
  Asset,
  usePermissions as useMediaPermissions,
} from "expo-media-library";
import { MusicPickerPressable } from "../features/lenses/CameraScreenButtons";
import SoundTrimmer from "../features/sounds/SoundTrimmer";
import VolumeMixer from "../features/sounds/VolumeMixer";
import { useClipPlayer } from "../features/sounds/useClipPlayer";
import { soundStore } from "../features/sounds/soundStore";
import {
  incrementSoundUse,
  metaFromClip,
  soundLabel,
  type SoundClip,
} from "../features/sounds/soundService";
import LensExplorerSheet from "../features/lenses/components/LensExplorerSheet";

// Effets visage (lenses, fonds, jeux visage) : RETIRÉS de toutes les caméras.
// La caméra reste complète : photo, vidéo, filtres de couleur, flash, zoom, Scan, musique, éditeur.
// (Pour les remettre un jour : passer à true.)
const FACE_EFFECTS = false;
import PremiumLensPrompt from "../features/lenses/components/PremiumLensPrompt";
import { LensThumb, PremiumBadge } from "../features/lenses/components/LensCarousel";
import {
  DEMO_LENSES,
  EXPLORER_CATEGORIES,
  QUICK_CATEGORIES,
  featuredThisWeek,
  filterLenses,
} from "../features/lenses/lensCatalog";
import { useIsPremium, useLensPrefs } from "../features/lenses/lensPrefs";
import type { LensCategoryId, VimoxLens } from "../features/lenses/types";
import { AR_LENSES } from "../features/lenses/arLenses";
import { ACC_LENSES } from "../features/lenses/accLenses";
import { incrementLensUse, useLensUsage } from "../features/lenses/lensStats";
import { FaceLensView, type FaceLensHandle } from "../features/lenses/FaceLensView";
import { useVideoPlayer, VideoView } from "expo-video";
import * as Sharing from "expo-sharing";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { Image as ExpoImage } from "expo-image";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import type { AudioPlayer } from "expo-audio";
import { captureRef } from "react-native-view-shot";
import Svg, {
  Path,
  Defs,
  ClipPath,
  Image as SvgImage,
  G,
  Mask,
  Rect,
  Circle as SvgCircle,
} from "react-native-svg";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "../config/firebase";
import { colors } from "../theme/colors";
import { useAuth } from "../services/AuthContext";
import { scanBus } from "../services/scanBus";
import { StickerSheet } from "../components/StickerSheet";
import { SNAP_CAMERA_PROPS, cameraFillStyle } from "../utils/cameraFormat";
import { useNextTip } from "../services/tipsService";
import { TipBubble } from "../components/TipBubble";
import {
  createPhotoStory,
  createVideoStory,
  uploadStoryMusic,
} from "../services/storyService";
import {
  registerSnapMusic,
  uploadSnapImage,
  uploadSnapVideo,
  sendSnapToFriend,
} from "../services/snapService";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// Marge autour d'une découpe, pour laisser la place au contour blanc
const CUT_PAD = 10;

// Étiquette du bouton téléobjectif : mets "3" si ton iPhone a un zoom optique 3x
const TELE_LABEL = "5";

// Noms des objectifs de l'iPhone (valeurs acceptées par expo-camera)
const LENS_ULTRA = "builtInUltraWideCamera";
const LENS_WIDE = "builtInWideAngleCamera";
const LENS_TELE = "builtInTelephotoCamera";

// Zone « poubelle » : on lâche un élément en bas au centre pour le supprimer
const TRASH_TOP = SCREEN_H - 190;

// Glisser sur la photo fait défiler ces filtres : couleurs, puis filtres « infos » (heure, date, lieu)
type FilterDef = {
  key: string;
  label: string;
  color: string | null;
  overlay?: "time" | "date" | "place";
};
const FILTERS: FilterDef[] = [
  { key: "none", label: "Normal", color: null },
  { key: "warm", label: "Chaud", color: "rgba(255,140,0,0.18)" },
  { key: "cool", label: "Froid", color: "rgba(0,140,255,0.18)" },
  { key: "bw", label: "N&B", color: "rgba(120,120,120,0.35)" },
  { key: "vivid", label: "Vif", color: "rgba(255,46,77,0.15)" },
  { key: "vintage", label: "Vintage", color: "rgba(180,140,80,0.28)" },
  { key: "vignette", label: "Vignette", color: "rgba(0,0,0,0.2)" },
  { key: "time", label: "Heure", color: null, overlay: "time" },
  { key: "date", label: "Date", color: null, overlay: "date" },
  { key: "place", label: "Lieu", color: null, overlay: "place" },
];

// Effets du carrousel : effets visage gratuits (MediaPipe) + filtres couleur
const DUPLICATE_DEMO = new Set(["demo-couronne", "demo-neon"]);
const ALL_LENSES: VimoxLens[] = [
  ...AR_LENSES,
  ...ACC_LENSES,
  ...DEMO_LENSES.filter((l) => !!l.demoTint && !DUPLICATE_DEMO.has(l.id)),
];

// Fond de la barre de légende façon Snap
const CAPTION_BAR_BG = "rgba(0,0,0,0.55)";

const MIN_ZOOM = 0;
const MAX_ZOOM = 1;

const DURATIONS = [1, 3, 5, 10];
const TIMER_OPTIONS = [0, 3, 5, 10];
const CROP_OPTIONS = [
  { label: "Story 9:16", ratio: 9 / 16 },
  { label: "Carré 1:1", ratio: 1 },
];
const TEXT_COLORS = [
  "#ffffff",
  "#000000",
  "#FF2E4D",
  "#FFD700",
  "#28F7A1",
  "#00A8FF",
  "#FF69B4",
  "#FF8C00",
];
const PEN_COLORS = [
  "#ffffff",
  "#000000",
  "#FF3B30",
  "#FF9500",
  "#FFD60A",
  "#34C759",
  "#00C7BE",
  "#0A84FF",
  "#BF5AF2",
  "#FF2D95",
];
const PEN_SIZES = [4, 8, 14];
const ERASER_SIZES = [16, 30, 52];
type PenStyle = "pen" | "neon" | "marker";
const PEN_STYLES: { key: PenStyle; label: string }[] = [
  { key: "pen", label: "Stylo" },
  { key: "neon", label: "Néon" },
  { key: "marker", label: "Marqueur" },
];
const STICKER_EMOJIS = [
  "😎",
  "🥳",
  "😍",
  "😂",
  "🤣",
  "😭",
  "😡",
  "🥺",
  "😴",
  "🤔",
  "🙈",
  "😈",
  "❤️",
  "🔥",
  "💯",
  "✨",
  "⭐",
  "🎉",
  "🎂",
  "🎁",
  "🌈",
  "☀️",
  "🌙",
  "⚡",
  "👑",
  "🕶️",
  "🎩",
  "💎",
  "🍕",
  "🍔",
  "🍟",
  "🍩",
  "☕",
  "🍺",
  "⚽",
  "🎮",
  "🐶",
  "🐱",
  "🦄",
  "🐼",
  "🦁",
  "🐸",
  "🌸",
  "🌴",
  "🚗",
  "✈️",
  "🏖️",
  "📍",
];

const TEXT_STYLE_PRESETS: {
  label: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  bar: boolean;
  size: number;
}[] = [
  // « Snap » = la barre de légende noire sur toute la largeur, comme sur Snapchat
  { label: "Snap", bold: false, italic: false, underline: false, bar: true, size: 22 },
  { label: "Grand", bold: true, italic: false, underline: false, bar: false, size: 44 },
  { label: "Classique", bold: false, italic: false, underline: false, bar: false, size: 26 },
  { label: "Gras", bold: true, italic: false, underline: false, bar: false, size: 26 },
  { label: "Élégant", bold: false, italic: true, underline: false, bar: false, size: 26 },
  { label: "Souligné", bold: true, italic: false, underline: true, bar: false, size: 26 },
];

function Icon({
  name,
  size = 20,
  color = "#fff",
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name as any} size={size} color={color} />;
}
function McIcon({
  name,
  size = 20,
  color = "#fff",
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  return (
    <MaterialCommunityIcons name={name as any} size={size} color={color} />
  );
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(() => resolve(), ms));

function unavailable(feature: string, why: string) {
  Alert.alert(feature, why);
}
function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

type Pt = { x: number; y: number };

// Supprime les points trop proches (le doigt en génère des centaines)
function simplifyPoints(pts: Pt[], minDist = 4): Pt[] {
  if (pts.length === 0) return [];
  const out: Pt[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const last = out[out.length - 1];
    if (Math.hypot(pts[i].x - last.x, pts[i].y - last.y) >= minDist)
      out.push(pts[i]);
  }
  return out;
}

// Lissage « coins coupés » (Chaikin) sur une forme fermée : le tracé devient une courbe douce
function smoothClosed(pts: Pt[], iterations = 2): Pt[] {
  let p = pts;
  for (let k = 0; k < iterations; k++) {
    const q: Pt[] = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i];
      const b = p[(i + 1) % p.length];
      q.push({ x: 0.75 * a.x + 0.25 * b.x, y: 0.75 * a.y + 0.25 * b.y });
      q.push({ x: 0.25 * a.x + 0.75 * b.x, y: 0.25 * a.y + 0.75 * b.y });
    }
    p = q;
  }
  return p;
}

type ElKind = "text" | "sticker" | "gif" | "image" | "cutout";
interface CanvasEl {
  id: string;
  kind: ElKind;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  zIndex: number;
  locked?: boolean;
  hidden?: boolean;
  autoCenter?: boolean;
  text?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  outline?: boolean;
  shadow?: boolean;
  bgColor?: string | null;
  align?: "left" | "center" | "right";
  bar?: boolean;
  fontSize?: number;
  emoji?: string;
  gifUrl?: string;
  imageUri?: string;
  imgW?: number;
  imgH?: number;
  shape?: "rounded" | "circle" | "free";
  cutPath?: string;
  cutBox?: { x: number; y: number; w: number; h: number };
  cutSrc?: string;
  cutView?: { w: number; h: number };
}

function makeText(partial?: Partial<CanvasEl>): CanvasEl {
  return {
    id: uid(),
    kind: "text",
    x: 0,
    y: SCREEN_H * 0.35,
    rotation: 0,
    scale: 1,
    zIndex: Date.now(),
    autoCenter: true,
    text: "Texte",
    color: "#ffffff",
    bold: true,
    italic: false,
    underline: false,
    outline: false,
    shadow: true,
    bgColor: null,
    align: "center",
    ...partial,
  };
}

interface TextDraft {
  text: string;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  shadow: boolean;
  outline: boolean;
  bgColor: string | null;
  align: "left" | "center" | "right";
  bar: boolean;
  fontSize: number;
}
// Par défaut : la barre de légende façon Snap
const DEFAULT_DRAFT: TextDraft = {
  text: "",
  color: "#ffffff",
  bold: false,
  italic: false,
  underline: false,
  shadow: false,
  outline: false,
  bgColor: null,
  align: "center",
  bar: true,
  fontSize: 22,
};

// Une opération de dessin : un trait de stylo, ou un coup de gomme
type DrawOp =
  | { kind: "pen"; d: string; color: string; width: number; style: PenStyle }
  | { kind: "erase"; d: string; width: number }
  // Flou : la zone frottée affiche une version floue de la photo (comme l'outil « Flouter » de Snap)
  | { kind: "blur"; d: string; width: number };
type PenMeta = {
  tool: "pen" | "eraser" | "blur";
  color: string;
  width: number;
  style: PenStyle;
};

function buildOp(d: string, m: PenMeta): DrawOp {
  if (m.tool === "blur") return { kind: "blur", d, width: m.width };
  return m.tool === "eraser"
    ? { kind: "erase", d, width: m.width }
    : { kind: "pen", d, color: m.color, width: m.width, style: m.style };
}

interface Memory {
  id: string;
  imageURL: string;
  createdAtMs: number;
}

interface MySticker {
  id: string;
  imageURL: string;
  ratio: number;
  createdAtMs: number;
}

// Un trait de dessin : stylo, néon (halo lumineux) ou marqueur (semi-transparent)
function Stroke({
  p,
}: {
  p: { d: string; color: string; width: number; style: PenStyle };
}) {
  const common = {
    fill: "none" as const,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (p.style === "neon") {
    return (
      <>
        <Path
          d={p.d}
          stroke={p.color}
          strokeOpacity={0.3}
          strokeWidth={p.width * 2.8}
          {...common}
        />
        <Path
          d={p.d}
          stroke={p.color}
          strokeOpacity={0.65}
          strokeWidth={p.width * 1.5}
          {...common}
        />
        <Path
          d={p.d}
          stroke="#ffffff"
          strokeWidth={p.width * 0.55}
          {...common}
        />
      </>
    );
  }
  if (p.style === "marker") {
    return (
      <Path
        d={p.d}
        stroke={p.color}
        strokeOpacity={0.5}
        strokeWidth={p.width * 2.4}
        {...common}
      />
    );
  }
  return <Path d={p.d} stroke={p.color} strokeWidth={p.width} {...common} />;
}

// Calque de dessin : se redessine tout seul pendant un geste, sans refaire tout l'écran.
// La gomme est un masque : elle cache seulement ce qui a été dessiné AVANT elle (comme sur Snap).
type DrawingHandle = { setLive: (op: DrawOp | null) => void };
const DrawingLayer = forwardRef<
  DrawingHandle,
  { ops: DrawOp[]; w: number; h: number; blurUri?: string | null }
>(function DrawingLayer({ ops, w, h, blurUri }, ref) {
  const [live, setLive] = useState<DrawOp | null>(null);
  useImperativeHandle(ref, () => ({ setLive }), []);
  const all = live ? [...ops, live] : ops;
  if (all.length === 0) return null;
  const masks: ReactNode[] = [];
  let content: ReactNode = null;
  const blurs: { d: string; width: number }[] = [];
  for (let i = 0; i < all.length; i++) {
    const op = all[i];
    if (op.kind === "blur") {
      blurs.push(op);
      continue;
    }
    if (op.kind === "pen") {
      content = (
        <>
          {content}
          <Stroke p={op} />
        </>
      );
    } else {
      masks.push(
        <Mask
          key={`m${i}`}
          id={`erase${i}`}
          maskUnits="userSpaceOnUse"
          x={0}
          y={0}
          width={w}
          height={h}
        >
          <Rect x={0} y={0} width={w} height={h} fill="#ffffff" />
          <Path
            d={op.d}
            stroke="#000000"
            strokeWidth={op.width}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Mask>,
      );
      content = <G mask={`url(#erase${i})`}>{content}</G>;
    }
  }
  // Zones floutées : la photo en très basse résolution (donc floue), visible seulement là où on a frotté
  const blurLayer =
    blurUri && blurs.length > 0 ? (
      <>
        <Defs>
          <Mask id="blurZones" maskUnits="userSpaceOnUse" x={0} y={0} width={w} height={h}>
            <Rect x={0} y={0} width={w} height={h} fill="#000000" />
            {blurs.map((b, i) => (
              <Path key={i} d={b.d} stroke="#ffffff" strokeWidth={b.width} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </Mask>
        </Defs>
        <SvgImage href={{ uri: blurUri }} x={0} y={0} width={w} height={h} preserveAspectRatio="xMidYMid slice" mask="url(#blurZones)" />
      </>
    ) : null;
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>{masks}</Defs>
      {blurLayer}
      {content}
    </Svg>
  );
});

// Contour en direct pendant la découpe aux ciseaux
function cutLiveNode(d: string) {
  return (
    <>
      <Path
        d={d}
        stroke="rgba(255,255,255,0.35)"
        strokeWidth={10}
        fill="rgba(255,255,255,0.10)"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d={d}
        stroke="#fff"
        strokeWidth={3}
        strokeDasharray="8,6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  );
}

// Calque léger pour la découpe
type LiveSvgHandle = { set: (node: ReactNode) => void };
const LiveSvg = forwardRef<LiveSvgHandle>(function LiveSvg(_props, ref) {
  const [node, setNode] = useState<ReactNode>(null);
  useImperativeHandle(ref, () => ({ set: (n: ReactNode) => setNode(n) }), []);
  if (!node) return null;
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      {node}
    </Svg>
  );
});

export function CameraScreen({
  navigation,
  route,
  onEditingChange,
  active = true,
}: {
  navigation: any;
  route?: any;
  onEditingChange?: (editing: boolean) => void;
  // false = écran caché dans le pager : la caméra est coupée (batterie, chaleur, témoin iOS)
  active?: boolean;
}) {
  // Photo prise depuis le chat aléatoire : elle part directement dans cette conversation
  const directSendToRoom = route?.params?.directSendToRoom as
    | { roomId: string; partnerName: string }
    | undefined;
  const directSendTo = route?.params?.directSendTo as
    | { friendId: string; friendName: string }
    | undefined;
  const { profile } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [mediaPermission, requestMediaPermission] = useMediaPermissions({
    writeOnly: true,
  });
  const cameraRef = useRef<CameraView>(null);
  const cameraReadyRef = useRef(false);
  const capturingRef = useRef(false);
  const recordingRef = useRef(false);
  const recordIntentRef = useRef(false);
  const holdFired = useRef(false);
  const shotRef = useRef<React.ComponentRef<typeof View>>(null);
  const cutoutRefs = useRef<Record<string, View | null>>({});
  const savingStickerRef = useRef(false);
  const soundRef = useRef<AudioPlayer | null>(null);
  const drawingLayer = useRef<DrawingHandle>(null);
  const liveCut = useRef<LiveSvgHandle>(null);

  const [facing, setFacing] = useState<CameraType>("back");
  const [flash, setFlash] = useState<FlashMode>("off");
  // 0 = vrai zoom 1x (aucun zoom numérique) ; 1 = zoom maximum de l'appareil
  const [zoom, setZoom] = useState(0);
  const zoomRef = useRef(0);
  zoomRef.current = zoom;
  const pinchStartZoom = useRef(0);
  const pinchStartDist = useRef(0);
  // Objectifs de l'iPhone (ultra grand-angle, principal, téléobjectif)
  const [lens, setLens] = useState<string>(LENS_WIDE);
  const [lenses, setLenses] = useState<string[]>([]);
  // Photo = mode « picture » (qualité maximale) ; on passe en « video » seulement pour filmer
  const [camMode, setCamMode] = useState<"picture" | "video">("picture");
  const [hd, setHd] = useState(false);
  const [filterIdx, setFilterIdx] = useState(0);
  const filterIdxRef = useRef(0);
  filterIdxRef.current = filterIdx;
  const [durationIdx, setDurationIdx] = useState(1);
  const [showDuration, setShowDuration] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");
  const [showMentionInput, setShowMentionInput] = useState(false);
  const [mentionDraft, setMentionDraft] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  // « Sons » : son de l'obturateur + vibrations
  const [soundsOn, setSoundsOn] = useState(true);
  const [handsFree, setHandsFree] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [showGrid, setShowGrid] = useState(false);
  const [mirrorPhoto, setMirrorPhoto] = useState(false);
  const [stabilization, setStabilization] = useState(false);
  const [burst, setBurst] = useState(false);
  const [burstUris, setBurstUris] = useState<string[]>([]);
  const [countdown, setCountdown] = useState<number | null>(null);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ── Façon Snap : chrono de la vidéo, verrou mains libres en glissant, zoom en glissant vers le haut ──
  const [recSec, setRecSec] = useState(0);
  const [recLocked, setRecLocked] = useState(false);
  const recLockedRef = useRef(false);
  const lockStopRef = useRef(false);
  const shutterTouch = useRef<{ x: number; y: number; zoom: number } | null>(null);
  const [zoomBadge, setZoomBadge] = useState<string | null>(null);
  const zoomBadgeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Flash d'écran pour les selfies (caméra avant) : l'écran devient une lumière chaude
  const [screenFlash, setScreenFlash] = useState(false);
  // Scan (comme Snap) : maintenir le doigt sur l'écran = chercher un code QR
  const [scanning, setScanning] = useState(false);
  const scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scannedRef = useRef(false);
  // Selfie miroir : la photo de la caméra avant est enregistrée comme dans un miroir
  const [mirrorSelfie, setMirrorSelfie] = useState(false);

  // Chrono de l'enregistrement (et remise à zéro du verrou quand la vidéo s'arrête)
  useEffect(() => {
    if (!isRecording) {
      setRecSec(0);
      recLockedRef.current = false;
      lockStopRef.current = false;
      setRecLocked(false);
      return;
    }
    const started = Date.now();
    const id = setInterval(() => setRecSec(Math.floor((Date.now() - started) / 1000)), 250);
    return () => clearInterval(id);
  }, [isRecording]);


  const [elements, setElements] = useState<CanvasEl[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const historyRef = useRef<CanvasEl[][]>([[]]);
  const historyIndexRef = useRef(0);
  const [, bump] = useState(0);
  const [showLayers, setShowLayers] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifQuery, setGifQuery] = useState("");
  const [gifResults, setGifResults] = useState<{ id: string; url: string }[]>(
    [],
  );
  const [gifLoading, setGifLoading] = useState(false);

  // Déplacement d'un élément : affiche la poubelle
  const [dragging, setDragging] = useState(false);
  const trashHot = useRef(new Animated.Value(0)).current;

  // Petit message temporaire (« Sticker créé », nom du filtre...)
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function showToast(msg: string, ms = 2400) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  }

  // Mode texte plein écran (façon Snap)
  const [textMode, setTextMode] = useState<{
    id: string | null;
    y?: number;
  } | null>(null);
  const [draft, setDraft] = useState<TextDraft>(DEFAULT_DRAFT);

  // Son choisi, comme sur Snap : morceau, passage, durée de l'extrait et volumes
  const [soundClip, setSoundClip] = useState<SoundClip | null>(null);
  const musicName = soundClip ? soundLabel(soundClip.sound) : null;
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [uploadingMusic, setUploadingMusic] = useState(false);
  const [trimOpen, setTrimOpen] = useState(false);
  const [mixerOpen, setMixerOpen] = useState(false);

  // Souvenirs
  const [showMemories, setShowMemories] = useState(false);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [memoriesError, setMemoriesError] = useState<string | null>(null);

  // Mes stickers (découpes enregistrées)
  const [myStickers, setMyStickers] = useState<MySticker[]>([]);

  // Taille réelle de la zone d'édition (sert à la découpe et à la gomme)
  const [viewSize, setViewSize] = useState({ w: SCREEN_W, h: SCREEN_H });

  // --- Dessin (stylo / néon / marqueur + gomme) ---
  const [drawMode, setDrawMode] = useState(false);
  const [drawTool, setDrawTool] = useState<"pen" | "eraser" | "blur">("pen");
  // Version très basse résolution de la photo : sert de « flou » pour l'outil Flouter
  const [blurUri, setBlurUri] = useState<string | null>(null);
  useEffect(() => {
    setBlurUri(null); // nouvelle photo : nouveau flou
  }, [photoUri]);
  const [penColor, setPenColor] = useState("#ffffff");
  const [penSize, setPenSize] = useState(PEN_SIZES[1]);
  const [eraserSize, setEraserSize] = useState(ERASER_SIZES[1]);
  const [penStyle, setPenStyle] = useState<PenStyle>("pen");
  const penRef = useRef<PenMeta>({
    tool: "pen",
    color: "#ffffff",
    width: PEN_SIZES[1],
    style: "pen",
  });
  penRef.current = {
    tool: drawTool,
    color: penColor,
    width: drawTool === "eraser" ? eraserSize : drawTool === "blur" ? 38 : penSize,
    style: penStyle,
  };
  const strokeMeta = useRef<PenMeta>(penRef.current);
  const [drawPaths, setDrawPaths] = useState<DrawOp[]>([]);
  const drawPathsRef = useRef<DrawOp[]>([]);
  drawPathsRef.current = drawPaths;
  const [drawRedo, setDrawRedo] = useState<DrawOp[]>([]);
  const currentPath = useRef("");
  const lastPt = useRef<{ x: number; y: number } | null>(null);

  function endStroke() {
    if (currentPath.current) {
      const last = lastPt.current;
      const d = currentPath.current + (last ? ` L${last.x},${last.y}` : "");
      const op = buildOp(d, strokeMeta.current);
      setDrawPaths((prev) => [...prev, op]);
      setDrawRedo([]);
    }
    currentPath.current = "";
    lastPt.current = null;
    drawingLayer.current?.setLive(null);
  }
  function undoStroke() {
    const cur = drawPathsRef.current;
    if (cur.length === 0) return;
    const last = cur[cur.length - 1];
    setDrawPaths(cur.slice(0, -1));
    setDrawRedo((r) => [...r, last]);
  }
  function redoStroke() {
    if (drawRedo.length === 0) return;
    const last = drawRedo[drawRedo.length - 1];
    setDrawRedo(drawRedo.slice(0, -1));
    setDrawPaths([...drawPathsRef.current, last]);
  }

  const drawResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        strokeMeta.current = penRef.current;
        currentPath.current = `M${locationX},${locationY} L${locationX},${locationY}`;
        lastPt.current = { x: locationX, y: locationY };
        drawingLayer.current?.setLive(
          buildOp(currentPath.current, strokeMeta.current),
        );
      },
      onPanResponderMove: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        // Courbe lissée : on passe par le milieu de chaque segment
        const last = lastPt.current ?? { x: locationX, y: locationY };
        const mx = (last.x + locationX) / 2;
        const my = (last.y + locationY) / 2;
        currentPath.current += ` Q${last.x},${last.y} ${mx},${my}`;
        lastPt.current = { x: locationX, y: locationY };
        drawingLayer.current?.setLive(
          buildOp(currentPath.current, strokeMeta.current),
        );
      },
      onPanResponderRelease: () => endStroke(),
      onPanResponderTerminate: () => endStroke(),
    }),
  ).current;

  // --- Ciseaux : découpe à la main ---
  const [cutMode, setCutMode] = useState(false);
  const cutPath = useRef("");
  const cutPoints = useRef<{ x: number; y: number }[]>([]);
  const latestCut = useRef<(pts: { x: number; y: number }[]) => void>(() => {});
  latestCut.current = finishCut;

  const cutResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        cutPath.current = `M${locationX},${locationY}`;
        cutPoints.current = [{ x: locationX, y: locationY }];
        liveCut.current?.set(cutLiveNode(cutPath.current));
      },
      onPanResponderMove: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        cutPath.current += ` L${locationX},${locationY}`;
        cutPoints.current.push({ x: locationX, y: locationY });
        liveCut.current?.set(cutLiveNode(cutPath.current));
      },
      onPanResponderRelease: () => latestCut.current(cutPoints.current),
      onPanResponderTerminate: () => latestCut.current(cutPoints.current),
    }),
  ).current;

  const [cropping, setCropping] = useState(false);

  // --- Effets (lenses) façon Snap : carrousel dans le déclencheur ---
  const isPremium = useIsPremium();
  const lensPrefs = useLensPrefs();
  const [lensCategory, setLensCategory] = useState<LensCategoryId>("forYou");
  const [carouselIdx, setCarouselIdx] = useState(0);
  const [explorerOpen, setExplorerOpen] = useState(false);
  const [lockedLens, setLockedLens] = useState<VimoxLens | null>(null);
  // Vraies utilisations des lenses (Firebase) : affichées dans l'explorateur et utilisées pour « Tendance »
  const lensUsage = useLensUsage();
  const lensesLive = useMemo(
    () => ALL_LENSES.map((l) => ({ ...l, views: lensUsage[l.id] ?? 0 })),
    [lensUsage],
  );
  const carouselLenses = useMemo(() => {
    if (!FACE_EFFECTS) return [];
    const list = filterLenses(lensesLive, lensCategory, lensPrefs);
    if (lensCategory !== "forYou") return list;
    // Comme sur Snap : les lenses de la semaine en tête de « Pour toi »
    const featured = featuredThisWeek(lensesLive, 3);
    const ids = new Set(featured.map((l) => l.id));
    return [...featured, ...list.filter((l) => !ids.has(l.id))];
  }, [lensesLive, lensCategory, lensPrefs.favorites, lensPrefs.recents]);
  const activeLens: VimoxLens | null =
    carouselIdx > 0 ? (carouselLenses[carouselIdx - 1] ?? null) : null;
  const liveTint =
    activeLens && (!activeLens.premium || isPremium)
      ? (activeLens.demoTint ?? null)
      : null;
  // Effet visage actif (affiché par FaceLensView à la place de la caméra classique)
  const arLens: VimoxLens | null =
    activeLens?.arEffect && (!activeLens.premium || isPremium) ? activeLens : null;
  const faceRef = useRef<FaceLensHandle>(null);
  // Teinte de l'effet au moment de la photo : elle est fusionnée dans l'image finale
  const [photoLensTint, setPhotoLensTint] = useState<string | null>(null);
  // Vidéo qui vient d'être filmée (aperçu)
  const [videoUri, setVideoUri] = useState<string | null>(null);
  // Micro pendant les vidéos (on peut filmer sans le son)
  const [micOn, setMicOn] = useState(true);
  // Panneau « Réglages de la caméra »
  const [camSettingsOpen, setCamSettingsOpen] = useState(false);
  // Nom du lieu pour le filtre « Lieu »
  const [placeName, setPlaceName] = useState<string | null>(null);
  // Barre d'outils de l'éditeur : outils principaux, ou tous les outils
  const [toolsExpanded, setToolsExpanded] = useState(false);

  // Lecture du son : sur la photo (bouton lecture) et pendant qu'on filme
  useClipPlayer(
    soundClip
      ? {
          url: soundClip.sound.audioURL,
          startSec: soundClip.startSec,
          clipSec: soundClip.clipSec,
          volume: soundClip.musicVolume,
        }
      : null,
    !!soundClip &&
      !trimOpen &&
      ((!!photoUri && musicPlaying) || (isRecording && !photoUri && !videoUri)),
  );
  // Comme sur Snap : le son démarre tout seul quand la photo s'affiche
  useEffect(() => {
    setMusicPlaying(!!photoUri && !!soundClip);
  }, [photoUri]);
  // « Utiliser ce son » depuis une Story ou un Snap : la caméra récupère le son
  useEffect(() => {
    const apply = () => {
      const c = soundStore.take();
      if (c) {
        setSoundClip(c);
        showToast(`♪ ${soundLabel(c.sound)}`, 1800);
      }
    };
    apply();
    return soundStore.subscribe(apply);
  }, []);

  // Filtre « Lieu » : on récupère la ville une seule fois, quand il est affiché
  useEffect(() => {
    if (!photoUri || FILTERS[filterIdx]?.overlay !== "place" || placeName) return;
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          if (!cancelled) setPlaceName("Ma position");
          return;
        }
        const pos = await Location.getCurrentPositionAsync({});
        const [pl] = await Location.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        if (!cancelled)
          setPlaceName(pl?.city || pl?.region || pl?.country || "Ma position");
      } catch {
        if (!cancelled) setPlaceName("Ma position");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [photoUri, filterIdx, placeName]);

  const activeFilter = FILTERS[filterIdx];
  const selectedEl = elements.find((e) => e.id === selectedId) ?? null;

  function releaseSound() {
    try {
      soundRef.current?.remove();
    } catch {}
    soundRef.current = null;
  }

  useEffect(() => {
    return () => {
      releaseSound();
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  // 💡 Astuces : une par ouverture de la caméra, chacune affichée une seule fois
  const cameraEditing = !!photoUri || !!videoUri || burstUris.length > 0 || showMemories;
  const { tip: camTip, dismiss: dismissCamTip } = useNextTip(
    [
      { id: "cam_hold", text: "Maintiens le bouton rond pour filmer une vidéo." },
      { id: "cam_flip", text: "Tape deux fois sur l'écran pour retourner la caméra." },
      { id: "cam_zoom", text: "Pince l'écran avec deux doigts pour zoomer." },
      { id: "cam_scan", text: "Maintiens ton doigt sur l'écran pour scanner un code QR." },
      { id: "cam_lock", text: "En filmant, glisse vers la gauche pour bloquer la vidéo, vers le haut pour zoomer." },
    ],
    active && !cameraEditing && !isRecording, // seulement quand la caméra est vraiment à l'écran
    2500,
  );

  // Prévient le SwipePager qu'on édite une photo (bloque le swipe + cache la barre du bas)
  useEffect(() => {
    onEditingChange?.(
      !!photoUri || !!videoUri || burstUris.length > 0 || showMemories,
    );
  }, [photoUri, videoUri, burstUris.length, showMemories]);
  useEffect(() => {
    return () => onEditingChange?.(false);
  }, []);

  // La caméra est recréée quand on revient de l'édition : on attend qu'elle soit prête
  useEffect(() => {
    if (photoUri || videoUri || burstUris.length > 0 || showMemories)
      cameraReadyRef.current = false;
  }, [photoUri, videoUri, burstUris.length, showMemories]);

  // Caméra cachée : on arrête tout enregistrement et on attendra qu'elle soit prête au retour
  useEffect(() => {
    if (active) {
      cameraReadyRef.current = false;
    } else if (recordingRef.current) {
      stopRecording();
    }
  }, [active]);

  // Écoute des Souvenirs quand l'écran est ouvert
  useEffect(() => {
    if (!showMemories || !profile) return;
    setMemoriesError(null);
    const unsub = onSnapshot(
      query(collection(db, "memories"), where("userId", "==", profile.id)),
      (snap) => {
        const list: Memory[] = snap.docs.map((d) => ({
          id: d.id,
          imageURL: (d.data().imageURL as string) ?? "",
          createdAtMs: (d.data().createdAtMs as number) ?? 0,
        }));
        list.sort((a, b) => b.createdAtMs - a.createdAtMs);
        setMemories(list);
      },
      (err) => setMemoriesError(err.message),
    );
    return () => unsub();
  }, [showMemories, profile?.id]);

  // Écoute de « Mes stickers » quand le panneau des autocollants est ouvert
  useEffect(() => {
    if (!showStickerPicker || !profile) return;
    const unsub = onSnapshot(
      query(
        collection(db, "customStickers"),
        where("userId", "==", profile.id),
      ),
      (snap) => {
        const list: MySticker[] = snap.docs.map((d) => ({
          id: d.id,
          imageURL: (d.data().imageURL as string) ?? "",
          ratio: (d.data().ratio as number) ?? 1,
          createdAtMs: (d.data().createdAtMs as number) ?? 0,
        }));
        list.sort((a, b) => b.createdAtMs - a.createdAtMs);
        setMyStickers(list);
      },
      () => {},
    );
    return () => unsub();
  }, [showStickerPicker, profile?.id]);

  function commitElements(next: CanvasEl[]) {
    setElements(next);
    const h = historyRef.current.slice(0, historyIndexRef.current + 1);
    h.push(next);
    historyRef.current = h;
    historyIndexRef.current = h.length - 1;
    bump((n) => n + 1);
  }
  function undo() {
    if (historyIndexRef.current === 0) return;
    historyIndexRef.current -= 1;
    setElements(historyRef.current[historyIndexRef.current]);
    bump((n) => n + 1);
  }
  function redo() {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current += 1;
    setElements(historyRef.current[historyIndexRef.current]);
    bump((n) => n + 1);
  }
  function updateElement(id: string, patch: Partial<CanvasEl>) {
    setElements((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    );
  }
  function commitElementDrag(id: string, patch: Partial<CanvasEl>) {
    commitElements(elements.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }
  function addElement(el: CanvasEl) {
    commitElements([...elements, el]);
    setSelectedId(el.id);
  }
  function removeElement(id: string) {
    commitElements(elements.filter((e) => e.id !== id));
    if (selectedId === id) setSelectedId(null);
  }
  function duplicateElement(id: string) {
    const el = elements.find((e) => e.id === id);
    if (!el) return;
    const copy = {
      ...el,
      id: uid(),
      x: el.x + 20,
      y: el.y + 20,
      zIndex: Date.now(),
    };
    commitElements([...elements, copy]);
    setSelectedId(copy.id);
  }
  function bringToFront(id: string) {
    commitElements(
      elements.map((e) => (e.id === id ? { ...e, zIndex: Date.now() } : e)),
    );
  }
  function sendToBack(id: string) {
    const minZ = Math.min(...elements.map((e) => e.zIndex), 0);
    commitElements(
      elements.map((e) => (e.id === id ? { ...e, zIndex: minZ - 1 } : e)),
    );
  }
  function toggleLock(id: string) {
    commitElements(
      elements.map((e) => (e.id === id ? { ...e, locked: !e.locked } : e)),
    );
  }
  function toggleHidden(id: string) {
    commitElements(
      elements.map((e) => (e.id === id ? { ...e, hidden: !e.hidden } : e)),
    );
  }
  function toggleImageShape(id: string) {
    commitElements(
      elements.map((e) =>
        e.id === id && e.shape !== "free"
          ? { ...e, shape: e.shape === "circle" ? "rounded" : "circle" }
          : e,
      ),
    );
  }

  // --- Panneaux ---
  function closePanels() {
    setShowStickerPicker(false);
    setShowGifPicker(false);
    setShowLinkInput(false);
    setShowMentionInput(false);
    setShowDuration(false);
    setCropping(false);
    setShowLayers(false);
    setCutMode(false);
  }

  // --- Mode texte plein écran ---
  function openTextMode(el?: CanvasEl, tapY?: number) {
    closePanels();
    setDrawMode(false);
    if (el) {
      setDraft({
        text: el.text ?? "",
        color: el.color ?? "#ffffff",
        bold: !!el.bold,
        italic: !!el.italic,
        underline: !!el.underline,
        shadow: !!el.shadow,
        outline: !!el.outline,
        bgColor: el.bgColor ?? null,
        align: el.align ?? "center",
        bar: !!el.bar,
        fontSize: el.fontSize ?? 26,
      });
      setTextMode({ id: el.id });
    } else {
      setDraft(DEFAULT_DRAFT);
      setTextMode({ id: null, y: tapY });
    }
  }
  function closeTextMode(save: boolean) {
    if (!textMode) return;
    const id = textMode.id;
    if (save) {
      const t = draft.text.trim();
      if (!t) {
        if (id) removeElement(id);
      } else if (id) {
        const wasBar = !!elements.find((e) => e.id === id)?.bar;
        commitElementDrag(id, {
          ...draft,
          text: t,
          // Passage en barre de légende : pleine largeur, droite ; et inversement on recentre
          ...(draft.bar
            ? { x: 0, rotation: 0, scale: 1 }
            : wasBar
              ? { autoCenter: true }
              : {}),
        });
      } else {
        // Comme sur Snap : le texte apparaît là où on a tapé
        const y =
          textMode.y != null
            ? Math.max(90, Math.min(SCREEN_H - 260, textMode.y - 22))
            : SCREEN_H * 0.35;
        addElement(makeText({ ...draft, text: t, y }));
      }
    }
    setTextMode(null);
    Keyboard.dismiss();
  }

  // --- Ciseaux ---
  function startCutMode() {
    closePanels();
    setDrawMode(false);
    setSelectedId(null);
    setCutMode(true);
  }
  function finishCut(rawPoints: { x: number; y: number }[]) {
    liveCut.current?.set(null);
    setCutMode(false);
    cutPath.current = "";
    cutPoints.current = [];
    if (!photoUri) return;
    if (rawPoints.length < 8) {
      if (rawPoints.length > 0) {
        Alert.alert(
          "Découpe",
          "Entoure l'objet avec ton doigt en faisant une boucle, puis relâche.",
        );
      }
      return;
    }

    // 1) on nettoie le tracé, 2) on le lisse en courbe douce
    const simple = simplifyPoints(rawPoints, 4);
    if (simple.length < 4) {
      Alert.alert(
        "Découpe",
        "Le tracé est trop court, entoure un objet plus grand.",
      );
      return;
    }
    const pts = smoothClosed(simple, 2);

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const x = Math.max(0, minX);
    const y = Math.max(0, minY);
    const w = Math.min(viewSize.w, maxX) - x;
    const h = Math.min(viewSize.h, maxY) - y;
    if (w < 30 || h < 30) {
      Alert.alert(
        "Découpe",
        "La zone est trop petite, entoure un objet plus grand.",
      );
      return;
    }

    const d =
      "M" +
      pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L") +
      " Z";
    // L'autocollant apparaît exactement là où se trouvait l'objet (comme sur Snap)
    addElement({
      id: uid(),
      kind: "cutout",
      x: x - CUT_PAD,
      y: y - CUT_PAD,
      rotation: 0,
      scale: 1,
      zIndex: Date.now(),
      cutPath: d,
      cutBox: { x, y, w, h },
      cutSrc: photoUri,
      cutView: { w: viewSize.w, h: viewSize.h },
    });
    if (soundsOn)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => {},
      );
    showToast(
      "Sticker créé · déplace-le, ou touche le marque-page pour l'enregistrer",
    );
  }

  // Enregistre la découpe en PNG transparent dans « Mes stickers »
  async function saveCutoutSticker(el: CanvasEl) {
    if (!profile) return;
    if (savingStickerRef.current) return;
    const node = cutoutRefs.current[el.id];
    if (!node) {
      Alert.alert("Sticker", "Impossible de retrouver cette découpe.");
      return;
    }
    savingStickerRef.current = true;
    showToast("Enregistrement du sticker…");
    try {
      const png = await captureRef(node as any, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });
      const size = await new Promise<{ width: number; height: number }>(
        (resolve, reject) =>
          Image.getSize(
            png,
            (width, height) => resolve({ width, height }),
            reject,
          ),
      );
      const url = await uploadSnapImage(png);
      await addDoc(collection(db, "customStickers"), {
        userId: profile.id,
        imageURL: url,
        ratio: size.width / Math.max(1, size.height),
        createdAtMs: Date.now(),
        createdAt: serverTimestamp(),
      });
      showToast("Sticker enregistré · retrouve-le dans 😀 → Mes stickers");
    } catch (e: any) {
      setToast(null);
      Alert.alert(
        "Erreur",
        `Impossible d'enregistrer le sticker : ${e?.message ?? e}`,
      );
    } finally {
      savingStickerRef.current = false;
    }
  }

  function addMySticker(s: MySticker) {
    const maxSide = 190;
    const ratio = s.ratio || 1;
    const w = ratio >= 1 ? maxSide : Math.round(maxSide * ratio);
    const h = ratio >= 1 ? Math.round(maxSide / ratio) : maxSide;
    addElement({
      id: uid(),
      kind: "image",
      x: (SCREEN_W - w) / 2,
      y: SCREEN_H * 0.3,
      rotation: 0,
      scale: 1,
      zIndex: Date.now(),
      imageUri: s.imageURL,
      imgW: w,
      imgH: h,
      shape: "free",
    });
    setShowStickerPicker(false);
  }

  function confirmDeleteMySticker(s: MySticker) {
    Alert.alert(
      "Supprimer ce sticker ?",
      "Il disparaîtra de « Mes stickers ».",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, "customStickers", s.id));
            } catch (e: any) {
              Alert.alert(
                "Erreur",
                `Impossible de supprimer : ${e?.message ?? e}`,
              );
            }
          },
        },
      ],
    );
  }

  function distanceBetween(touches: readonly any[]) {
    const [a, b] = touches;
    return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
  }

  // --- Caméra en direct : pincer = zoom, double tap = retourner, tap = fermer le menu ---
  const camGesture = useRef({
    pinching: false,
    moved: false,
    t0: 0,
    lastTap: 0,
    longTimer: null as ReturnType<typeof setTimeout> | null,
    longFired: false,
  });
  const camActions = useRef<{ flip: () => void; closeMenu: () => void; scan: () => void }>({
    flip: () => {},
    closeMenu: () => {},
    scan: () => {},
  });
  // « Scanner un code QR » demandé depuis un autre écran (Ajouter des amis)
  useEffect(
    () =>
      scanBus.subscribe(() => {
        scanBus.consume();
        setTimeout(() => camActions.current.scan(), 450);
      }),
    [],
  );
  const cameraResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => true,
      onPanResponderGrant: (e) => {
        const g = camGesture.current;
        g.moved = false;
        g.pinching = false;
        g.t0 = Date.now();
        // Doigt maintenu sans bouger = Scan (comme Snap)
        if (g.longTimer) clearTimeout(g.longTimer);
        g.longFired = false;
        if (e.nativeEvent.touches.length <= 1) {
          g.longTimer = setTimeout(() => {
            g.longTimer = null;
            if (!g.moved && !g.pinching) {
              g.longFired = true;
              camActions.current.scan();
            }
          }, 600);
        }
        if (e.nativeEvent.touches.length === 2) {
          g.pinching = true;
          pinchStartDist.current = distanceBetween(e.nativeEvent.touches);
          pinchStartZoom.current = zoomRef.current;
        }
      },
      onPanResponderMove: (e, gs) => {
        const g = camGesture.current;
        if (Math.abs(gs.dx) > 8 || Math.abs(gs.dy) > 8) g.moved = true;
        const touches = e.nativeEvent.touches;
        if ((g.moved || touches.length > 1) && g.longTimer) {
          clearTimeout(g.longTimer);
          g.longTimer = null;
        }
        if (touches.length === 2) {
          g.moved = true;
          if (!g.pinching) {
            g.pinching = true;
            pinchStartDist.current = distanceBetween(touches);
            pinchStartZoom.current = zoomRef.current;
            return;
          }
          if (pinchStartDist.current === 0) return;
          const dist = distanceBetween(touches);
          const delta = (dist - pinchStartDist.current) / 200;
          setZoom(
            Math.min(
              MAX_ZOOM,
              Math.max(MIN_ZOOM, pinchStartZoom.current + delta),
            ),
          );
        }
      },
      onPanResponderRelease: () => {
        const g = camGesture.current;
        if (g.longTimer) {
          clearTimeout(g.longTimer);
          g.longTimer = null;
        }
        if (g.longFired) {
          g.longFired = false;
          g.pinching = false;
          pinchStartDist.current = 0;
          return;
        }
        const wasTap = !g.moved && !g.pinching && Date.now() - g.t0 < 300;
        g.pinching = false;
        pinchStartDist.current = 0;
        if (!wasTap) return;
        const now = Date.now();
        if (now - g.lastTap < 350) {
          g.lastTap = 0;
          camActions.current.flip();
        } else {
          g.lastTap = now;
          camActions.current.closeMenu();
        }
      },
      onPanResponderTerminate: () => {
        camGesture.current.pinching = false;
        pinchStartDist.current = 0;
      },
    }),
  ).current;

  // --- Éditeur : taper sur la photo = texte, glisser à gauche/droite = changer de filtre ---
  const bgGesture = useRef({ t0: 0 });
  const editActions = useRef<{
    tap: (y?: number) => void;
    swipe: (dir: 1 | -1) => void;
  }>(
    {
      tap: () => {},
      swipe: () => {},
    },
  );
  const bgResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => true,
      onPanResponderGrant: () => {
        bgGesture.current.t0 = Date.now();
      },
      onPanResponderRelease: (_, gs) => {
        const dt = Date.now() - bgGesture.current.t0;
        if (Math.abs(gs.dx) < 10 && Math.abs(gs.dy) < 10 && dt < 350) {
          editActions.current.tap(gs.y0);
        } else if (
          Math.abs(gs.dx) > 60 &&
          Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5
        ) {
          editActions.current.swipe(gs.dx < 0 ? 1 : -1);
        }
      },
    }),
  ).current;

  if (!permission) return <View style={styles.root} />;

  if (!permission.granted) {
    return (
      <View style={[styles.root, styles.centerAll]}>
        <Text style={styles.permTitle}>Accès caméra requis</Text>
        <Text style={styles.permSub}>
          VimoX a besoin de la caméra pour prendre des photos et vidéos.
        </Text>
        <Pressable
          style={({ pressed }) => [styles.permBtn, pressed && { opacity: 0.8 }]}
          onPress={requestPermission}
        >
          <Text style={styles.permBtnTxt}>Autoriser la caméra</Text>
        </Pressable>
      </View>
    );
  }

  // Considère la caméra « prête » après un court délai (changement d'objectif ou de mode)
  function bumpCameraReady(ms: number) {
    cameraReadyRef.current = false;
    setTimeout(() => {
      cameraReadyRef.current = true;
    }, ms);
  }
  async function waitCameraReady(maxMs: number) {
    const start = Date.now();
    while (!cameraReadyRef.current && Date.now() - start < maxMs) {
      await sleep(80);
    }
  }

  // Changer d'objectif (0,5 / 1 / 5) : on repart toujours d'un vrai zoom 1x de cet objectif
  function selectLens(next: string) {
    if (next === lens && zoomRef.current === 0) return;
    setLens(next);
    setZoom(0);
    zoomRef.current = 0;
    bumpCameraReady(700);
    Haptics.selectionAsync().catch(() => {});
  }

  function flipCamera() {
    if (recordingRef.current) return;
    setFacing((f) => (f === "back" ? "front" : "back"));
    setLens(LENS_WIDE);
    setZoom(0);
    zoomRef.current = 0;
    bumpCameraReady(900);
    Haptics.selectionAsync().catch(() => {});
  }
  // ── Scan : profils VimoX (QR de « Partager mon profil »), liens, textes ──
  function startScan() {
    setShowMenu(false);
    scannedRef.current = false;
    setScanning(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (scanTimer.current) clearTimeout(scanTimer.current);
    scanTimer.current = setTimeout(() => {
      setScanning(false);
      if (!scannedRef.current) showToast("Aucun code trouvé", 1500);
    }, 8000);
  }
  function stopScan() {
    if (scanTimer.current) clearTimeout(scanTimer.current);
    scanTimer.current = null;
    setScanning(false);
  }
  function handleCode(res: any) {
    if (scannedRef.current) return;
    const data = String(res?.data ?? "").trim();
    if (!data) return;
    scannedRef.current = true;
    stopScan();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const prof = data.match(/profile\/([A-Za-z0-9_-]{6,128})/);
    if (prof) {
      if (prof[1] === profile?.id) {
        showToast("C'est ton propre code VimoX 😉", 1600);
        return;
      }
      (navigation as any).navigate("UserProfile", { userId: prof[1] });
      return;
    }
    if (/^https?:\/\//i.test(data)) {
      Alert.alert("Lien trouvé", data.slice(0, 300), [
        { text: "Annuler", style: "cancel" },
        { text: "Ouvrir", onPress: () => Linking.openURL(data).catch(() => {}) },
      ]);
      return;
    }
    Alert.alert("Code trouvé", data.slice(0, 300));
  }

  camActions.current = {
    flip: flipCamera,
    closeMenu: () => setShowMenu(false),
    scan: startScan,
  };

  // Filtre suivant / précédent, avec son nom affiché (comme le glissement sur Snap)
  function stepFilter(dir: 1 | -1) {
    const next = (filterIdxRef.current + dir + FILTERS.length) % FILTERS.length;
    filterIdxRef.current = next;
    setFilterIdx(next);
    showToast(FILTERS[next].label, 900);
    Haptics.selectionAsync().catch(() => {});
  }

  // Tap sur la photo : ferme un panneau ouvert, sinon désélectionne, sinon ouvre le texte
  function onBackgroundTap(y?: number) {
    const panelOpen =
      showStickerPicker ||
      showGifPicker ||
      showLinkInput ||
      showMentionInput ||
      showDuration ||
      cropping ||
      showLayers;
    if (panelOpen) {
      closePanels();
      Keyboard.dismiss();
      return;
    }
    if (selectedId) {
      setSelectedId(null);
      return;
    }
    openTextMode(undefined, y);
  }
  editActions.current = { tap: onBackgroundTap, swipe: stepFilter };

  async function finalizePhoto(uri: string): Promise<string> {
    if (facing === "front" && mirrorPhoto) {
      try {
        const flipped = await ImageManipulator.manipulateAsync(
          uri,
          [{ flip: ImageManipulator.FlipType.Horizontal }],
          { compress: 1 },
        );
        return flipped.uri;
      } catch {}
    }
    return uri;
  }

  // Prend UNE photo en qualité maximale : attend que la caméra soit prête, réessaie sinon
  // Glisser le doigt sur le déclencheur pendant une vidéo :
  // vers le HAUT = zoom ; vers la GAUCHE = verrou (tu peux lâcher, ça continue de filmer)
  function onShutterTouchStart(e: any) {
    const t = e.nativeEvent;
    shutterTouch.current = { x: t.pageX, y: t.pageY, zoom: zoomRef.current };
  }
  function onShutterTouchMove(e: any) {
    const start = shutterTouch.current;
    if (!start || !recordingRef.current) return;
    const t = e.nativeEvent;
    const dy = start.y - t.pageY;
    const dx = t.pageX - start.x;
    if (!arLens && dy > 12) {
      const z = Math.max(0, Math.min(1, start.zoom + (dy - 12) / 420));
      zoomRef.current = z;
      setZoom(z);
      setZoomBadge(`${(1 + z * 9).toFixed(1).replace(".", ",")}×`);
      if (zoomBadgeTimer.current) clearTimeout(zoomBadgeTimer.current);
      zoomBadgeTimer.current = setTimeout(() => setZoomBadge(null), 900);
    }
    if (!handsFree && !recLockedRef.current && dx < -80 && Math.abs(dy) < 90) {
      recLockedRef.current = true;
      setRecLocked(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }

  // Selfie avec flash : l'écran s'allume en blanc chaud le temps de la photo (comme le flash avant de Snap)
  async function withScreenFlash<T>(fn: () => Promise<T>): Promise<T> {
    const useIt = facing === "front" && flash !== "off";
    if (!useIt) return fn();
    setScreenFlash(true);
    await sleep(320);
    try {
      return await fn();
    } finally {
      setScreenFlash(false);
    }
  }

  async function takeShot(): Promise<{ uri: string } | undefined> {
    await waitCameraReady(2500);
    for (let i = 0; i < 3; i++) {
      try {
        return await cameraRef.current?.takePictureAsync({
          quality: 1,
          shutterSound: soundsOn,
        });
      } catch (e: any) {
        if (!/not ready/i.test(String(e?.message ?? e))) throw e;
        await sleep(400);
      }
    }
    return undefined;
  }

  async function capture() {
    if (capturingRef.current) return;
    await withScreenFlash(captureNow);
  }

  async function captureNow() {
    if (capturingRef.current) return; // une seule capture à la fois
    capturingRef.current = true;
    setPhotoLensTint(liveTint);
    if (activeLens && (!activeLens.premium || isPremium)) incrementLensUse(activeLens.id);

    // Effet visage : la photo vient de la WebView, l'effet est déjà incrusté
    if (arLens) {
      try {
        if (soundsOn)
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        const uri = await faceRef.current?.takePhoto();
        if (uri) setPhotoUri(uri);
        else
          Alert.alert(
            "Caméra",
            "L'effet n'est pas encore prêt, réessaie dans un instant.",
          );
      } catch (e: any) {
        Alert.alert("Caméra", `Impossible de prendre la photo : ${e?.message ?? e}`);
      } finally {
        capturingRef.current = false;
      }
      return;
    }
    try {
      if (soundsOn)
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      if (burst) {
        const shots: string[] = [];
        for (let i = 0; i < 3; i++) {
          try {
            const p = await takeShot();
            if (p) shots.push(p.uri);
          } catch {}
          if (i < 2) await sleep(350);
        }
        if (shots.length > 0) setBurstUris(shots);
        return;
      }

      const photo = await takeShot();
      if (!photo) return;
      setPhotoUri(await finalizePhoto(photo.uri));
    } catch (e: any) {
      Alert.alert(
        "Caméra",
        `Impossible de prendre la photo : ${e?.message ?? e}`,
      );
    } finally {
      capturingRef.current = false;
    }
  }

  function takePhotoWithTimer() {
    if (timerSeconds === 0) {
      capture();
      return;
    }
    let remaining = timerSeconds;
    setCountdown(remaining);
    const interval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(interval);
        setCountdown(null);
        capture();
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  }

  // 🌫️ Outil Flouter : prépare la version floue de la photo la première fois
  async function startBlurTool() {
    setDrawTool("blur");
    if (blurUri || !photoUri) return;
    try {
      const r = await ImageManipulator.manipulateAsync(photoUri, [{ resize: { width: 36 } }], {
        compress: 0.9,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      setBlurUri(r.uri);
    } catch {
      showToast("Flou indisponible pour cette photo", 1800);
    }
  }

  // 📷 Pellicule : une photo ou une vidéo du téléphone s'ouvre dans l'éditeur, comme une prise de vue
  async function pickFromGallery() {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"] as any,
        quality: 0.92,
        videoMaxDuration: 60,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      setShowMemories(false);
      if (a.type === "video") setVideoUri(a.uri);
      else setPhotoUri(a.uri);
    } catch {
      Alert.alert("Pellicule indisponible", "Autorise l'accès à tes photos dans les réglages du téléphone.");
    }
  }

  // Après une vidéo : aperçu en boucle (enregistrer / partager), comme sur Snap
  async function handleRecordedVideo(uri: string) {
    setVideoUri(uri);
  }

  // Publie la vidéo en Story (avec la musique choisie, comme pour les photos)
  async function postVideoStory(uri: string) {
    if (!profile || posting) return;
    setPosting(true);
    try {
      // Le son n'est pas réenvoyé : on garde son adresse en ligne + le passage choisi
      const musicURL = soundClip?.sound.audioURL ?? null;
      await createVideoStory(
        profile.id,
        profile.name,
        profile.profilePhotoURL,
        uri,
        musicURL,
        soundClip ? metaFromClip(soundClip) : null,
      );
      if (soundClip) incrementSoundUse(soundClip.sound.id);
      setVideoUri(null);
      removeMusic();
      showToast("Story publiée ✅", 1600);
    } catch (e: any) {
      Alert.alert("Erreur", `Impossible de publier : ${e?.message ?? e}`);
    } finally {
      setPosting(false);
      setUploadingMusic(false);
    }
  }

  // Chat aléatoire : la photo (ou la vidéo, via son aperçu) devient un message de la conversation
  async function sendToRoom(roomId: string, imageURL: string) {
    if (!profile) return;
    await addDoc(collection(db, "rooms", roomId, "messages"), {
      text: "",
      imageURL,
      senderId: profile.id,
      isAbusive: false,
      readBy: [profile.id],
      createdAt: serverTimestamp(),
      sentAt: serverTimestamp(),
    });
  }

  // Envoie la vidéo à un ami, comme un Snap photo (écran « Envoyer à » ou ami choisi)
  async function sendVideoToFriend(uri: string) {
    if (!profile || posting) return;
    setPosting(true);
    try {
      const { posterURL } = await uploadSnapVideo(uri);
      if (directSendToRoom) {
        await sendToRoom(directSendToRoom.roomId, posterURL);
        setVideoUri(null);
        removeMusic();
        navigation.goBack();
        return;
      }
      if (soundClip) {
        registerSnapMusic(posterURL, soundClip.sound.audioURL, metaFromClip(soundClip));
        incrementSoundUse(soundClip.sound.id);
      }
      if (directSendTo) {
        await sendSnapToFriend(
          profile.id,
          directSendTo.friendId,
          posterURL,
          DURATIONS[durationIdx],
        );
        setVideoUri(null);
        navigation.goBack();
      } else {
        navigation.navigate("SendTo", {
          imageURL: posterURL,
          duration: DURATIONS[durationIdx],
        });
        setVideoUri(null);
      }
    } catch (e: any) {
      Alert.alert("Erreur", `Impossible d'envoyer : ${e?.message ?? e}`);
    } finally {
      setPosting(false);
    }
  }

  async function saveVideoToGallery(uri: string) {
    try {
      if (!mediaPermission?.granted) {
        const res = await requestMediaPermission();
        if (!res.granted) {
          Alert.alert(
            "Vidéo",
            "Autorise l'accès à la galerie pour enregistrer tes vidéos.",
          );
          return;
        }
      }
      await Asset.create(uri);
      Alert.alert("✅ Enregistrée", "La vidéo est dans ta galerie.");
    } catch (e: any) {
      Alert.alert(
        "Vidéo",
        `Impossible d'enregistrer la vidéo : ${e?.message ?? e}`,
      );
    }
  }

  // Filmer demande le mode « video » : on bascule juste le temps de filmer, puis on revient en photo
  async function startRecording() {
    if (recordingRef.current) return;
    if (activeLens && (!activeLens.premium || isPremium)) incrementLensUse(activeLens.id);
    // Effet visage : la vidéo est filmée par la WebView (15 s max), effet incrusté
    if (arLens) {
      recordingRef.current = true;
      recordIntentRef.current = true;
      setIsRecording(true);
      try {
        await faceRef.current?.startRecording({ audio: !soundClip });
      } catch (e: any) {
        recordingRef.current = false;
        recordIntentRef.current = false;
        setIsRecording(false);
        Alert.alert("Vidéo", `Impossible de filmer avec cet effet : ${e?.message ?? e}`);
        return;
      }
      if (!recordIntentRef.current) stopRecording();
      return;
    }
    recordingRef.current = true;
    recordIntentRef.current = true;
    setIsRecording(true);
    let video: { uri: string } | undefined;
    try {
      setCamMode("video");
      bumpCameraReady(900);
      await waitCameraReady(1200);
      if (!recordIntentRef.current) return; // doigt relâché pendant le changement de mode
      const pending = cameraRef.current?.recordAsync({ maxDuration: 60 });
      // Sécurité : si le doigt a été relâché juste à ce moment, on arrête
      setTimeout(() => {
        if (!recordIntentRef.current) cameraRef.current?.stopRecording();
      }, 300);
      video = await pending;
    } catch {
    } finally {
      recordIntentRef.current = false;
      recordingRef.current = false;
      setIsRecording(false);
      setCamMode("picture");
      bumpCameraReady(900);
    }
    if (video?.uri) await handleRecordedVideo(video.uri);
  }
  function stopRecording() {
    recordIntentRef.current = false;
    if (arLens && recordingRef.current) {
      const face = faceRef.current;
      if (!face) {
        recordingRef.current = false;
        setIsRecording(false);
        return;
      }
      face
        .stopRecording()
        .then((uri) => {
          if (uri) setVideoUri(uri);
        })
        .catch(() => {})
        .finally(() => {
          recordingRef.current = false;
          setIsRecording(false);
        });
      return;
    }
    cameraRef.current?.stopRecording();
  }

  // Tap court = photo, appui long = vidéo (une seule action par geste)
  function onCapturePress() {
    if (!handsFree) return;
    if (isRecording) stopRecording();
    else startRecording();
  }
  function onCapturePressIn() {
    if (handsFree) return;
    // Vidéo verrouillée : un nouveau tap l'arrêtera au relâchement
    if (recLockedRef.current) {
      lockStopRef.current = true;
      return;
    }
    holdFired.current = false;
    holdTimer.current = setTimeout(() => {
      holdFired.current = true;
      startRecording();
    }, 300);
  }
  function onCapturePressOut() {
    if (handsFree) return;
    if (recLockedRef.current) {
      if (lockStopRef.current) {
        lockStopRef.current = false;
        recLockedRef.current = false;
        setRecLocked(false);
        stopRecording();
      } else {
        holdFired.current = false; // on lâche après avoir verrouillé : la vidéo continue
      }
      return;
    }
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (holdFired.current) {
      holdFired.current = false;
      stopRecording();
    } else {
      takePhotoWithTimer();
    }
  }

  async function applyCrop(ratio: number) {
    if (!photoUri) return;
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        photoUri,
        [{ resize: { width: 1080 } }],
        { compress: 0.95 },
      );
      // Recadrage centré (et non plus sur le haut de la photo)
      const targetHeight = Math.min(
        Math.round(1080 / ratio),
        manipulated.height,
      );
      const originY = Math.max(
        0,
        Math.round((manipulated.height - targetHeight) / 2),
      );
      const cropped = await ImageManipulator.manipulateAsync(
        manipulated.uri,
        [{ crop: { originX: 0, originY, width: 1080, height: targetHeight } }],
        { compress: 0.95 },
      );
      setPhotoUri(cropped.uri);
    } catch {
      Alert.alert("Erreur", "Impossible de rogner cette image.");
    }
  }

  function toggleMusicPreview() {
    setMusicPlaying((p) => !p);
  }
  function removeMusic() {
    setSoundClip(null);
    setMusicPlaying(false);
    setMixerOpen(false);
    setTrimOpen(false);
  }

  // Fusionne photo + filtre + dessin + texte + stickers en UNE image
  async function flatten(): Promise<string> {
    setSelectedId(null);
    await sleep(150);
    return await captureRef(shotRef as any, {
      format: "jpg",
      quality: 0.95,
      result: "tmpfile",
    });
  }

  async function saveToDevice() {
    if (!photoUri) return;
    try {
      if (!mediaPermission?.granted) {
        const res = await requestMediaPermission();
        if (!res.granted) {
          Alert.alert(
            "Permission refusée",
            "Impossible d'enregistrer sans accès à la galerie.",
          );
          return;
        }
      }
      const flat = await flatten();
      await Asset.create(flat);
      Alert.alert("✅ Enregistré", "Vim sauvegardé dans ta galerie.");
    } catch (e: any) {
      Alert.alert("Erreur", `Impossible d'enregistrer : ${e?.message ?? e}`);
    }
  }

  async function saveToMemories() {
    if (!photoUri || !profile) return;
    try {
      const flat = await flatten();
      const url = await uploadSnapImage(flat);
      await addDoc(collection(db, "memories"), {
        userId: profile.id,
        imageURL: url,
        createdAtMs: Date.now(),
        createdAt: serverTimestamp(),
      });
      Alert.alert(
        "✅ Ajouté aux Souvenirs",
        "Retrouve-le avec le bouton Souvenirs de la caméra.",
      );
    } catch (e: any) {
      Alert.alert(
        "Erreur",
        `Impossible d'ajouter aux Souvenirs : ${e?.message ?? e}`,
      );
    }
  }

  function openSaveMenu() {
    Alert.alert("Enregistrer", "Où veux-tu l'enregistrer ?", [
      { text: "Souvenirs VimoX", onPress: saveToMemories },
      { text: "Galerie du téléphone", onPress: saveToDevice },
      { text: "Annuler", style: "cancel" },
    ]);
  }

  function openMemory(m: Memory) {
    Alert.alert("Souvenir", "", [
      {
        text: "Modifier / envoyer",
        onPress: () => {
          setShowMemories(false);
          setPhotoUri(m.imageURL);
        },
      },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "memories", m.id));
          } catch (e: any) {
            Alert.alert(
              "Erreur",
              `Impossible de supprimer : ${e?.message ?? e}`,
            );
          }
        },
      },
      { text: "Annuler", style: "cancel" },
    ]);
  }

  async function postStory() {
    if (!photoUri || !profile) return;
    setPosting(true);
    try {
      const musicURL = soundClip?.sound.audioURL ?? null;
      setMusicPlaying(false);
      const flat = await flatten();
      // Le texte est déjà dans l'image : on n'envoie plus de texte séparé
      await createPhotoStory(
        profile.id,
        profile.name,
        profile.profilePhotoURL,
        flat,
        "",
        undefined,
        undefined,
        musicURL,
        soundClip ? metaFromClip(soundClip) : null,
      );
      if (soundClip) incrementSoundUse(soundClip.sound.id);
      resetAfterPost();
    } catch (e: any) {
      Alert.alert("Erreur", `Impossible de publier : ${e?.message ?? e}`);
    } finally {
      setPosting(false);
      setUploadingMusic(false);
    }
  }

  async function sendToFriend() {
    if (!photoUri || !profile) return;
    setPosting(true);
    try {
      const flat = await flatten();
      const url = await uploadSnapImage(flat);
      if (directSendToRoom) {
        await sendToRoom(directSendToRoom.roomId, url);
        resetAfterPost();
        navigation.goBack();
        return;
      }
      if (soundClip) {
        registerSnapMusic(url, soundClip.sound.audioURL, metaFromClip(soundClip));
        incrementSoundUse(soundClip.sound.id);
      }
      if (directSendTo) {
        await sendSnapToFriend(
          profile.id,
          directSendTo.friendId,
          url,
          DURATIONS[durationIdx],
        );
        resetAfterPost();
        navigation.goBack();
      } else {
        navigation.navigate("SendTo", {
          imageURL: url,
          duration: DURATIONS[durationIdx],
        });
        resetAfterPost();
      }
    } catch (e: any) {
      Alert.alert("Erreur", `Impossible d'envoyer : ${e?.message ?? e}`);
    } finally {
      setPosting(false);
    }
  }

  function resetAfterPost() {
    setPhotoUri(null);
    setElements([]);
    historyRef.current = [[]];
    historyIndexRef.current = 0;
    setSelectedId(null);
    setDurationIdx(1);
    setDrawPaths([]);
    setDrawRedo([]);
    setDrawMode(false);
    setDrawTool("pen");
    setTextMode(null);
    setDragging(false);
    cutoutRefs.current = {};
    closePanels();
    removeMusic();
    setFilterIdx(0);
    filterIdxRef.current = 0;
    setPhotoLensTint(null);
    setToolsExpanded(false);
    setPlaceName(null);
  }

  // Croix en haut à gauche : on jette la photo et tout ce qui a été ajouté dessus
  function discardEdit() {
    resetAfterPost();
  }

  // --- Carrousel d'effets ---
  function applyCarouselIndex(list: VimoxLens[], i: number) {
    setCarouselIdx(i);
    const l = i > 0 ? list[i - 1] : null;
    if (!l) return;
    if (l.premium && !isPremium) {
      setLockedLens(l);
      return;
    }
    lensPrefs.pushRecent(l.id);
    // Comme sur Snap : un effet visage passe automatiquement en caméra selfie
    if (l.arEffect && facing !== "front") setFacing("front");
  }
  function onCarouselIndex(i: number) {
    applyCarouselIndex(carouselLenses, i);
  }
  function changeLensCategory(c: LensCategoryId) {
    setLensCategory(c);
    setCarouselIdx(0);
  }
  function selectLensFromExplorer(l: VimoxLens) {
    const cat =
      l.categories.find((c) => QUICK_CATEGORIES.includes(c)) ??
      l.categories[0] ??
      "forYou";
    let list = filterLenses(lensesLive, cat, lensPrefs);
    if (cat === "forYou") {
      const featured = featuredThisWeek(lensesLive, 3);
      const ids = new Set(featured.map((x) => x.id));
      list = [...featured, ...list.filter((x) => !ids.has(x.id))];
    }
    const pos = list.findIndex((x) => x.id === l.id);
    setLensCategory(cat);
    applyCarouselIndex(list, pos + 1);
  }

  function addTimeSticker() {
    const now = new Date();
    addElement(
      makeText({
        text: now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        bgColor: "rgba(0,0,0,0.4)",
        y: SCREEN_H * 0.2,
      }),
    );
  }
  function addDateSticker() {
    const now = new Date();
    addElement(
      makeText({
        text: now.toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "long",
        }),
        bgColor: "rgba(0,0,0,0.4)",
        y: SCREEN_H * 0.26,
      }),
    );
  }
  async function addLocationSticker() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission refusée",
          "Active la localisation pour ajouter ce sticker.",
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      const [place] = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      const label =
        place?.city || place?.region || place?.country || "Ma position";
      addElement(
        makeText({
          text: `📍 ${label}`,
          bgColor: "rgba(0,0,0,0.4)",
          y: SCREEN_H * 0.32,
        }),
      );
    } catch {
      Alert.alert("Erreur", "Impossible de récupérer ta position.");
    }
  }
  async function searchGifs(q: string) {
    const key = process.env.EXPO_PUBLIC_GIPHY_API_KEY;
    if (!key) {
      Alert.alert(
        "Clé Giphy manquante",
        "Ajoute EXPO_PUBLIC_GIPHY_API_KEY dans ton .env",
      );
      return;
    }
    setGifLoading(true);
    try {
      const res = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${key}&q=${encodeURIComponent(q)}&limit=20&rating=pg-13`,
      );
      const data = await res.json();
      setGifResults(
        (data.data ?? []).map((g: any) => ({
          id: g.id,
          url: g.images.fixed_width.url,
        })),
      );
    } catch {
      Alert.alert("Erreur", "Recherche GIF impossible.");
    } finally {
      setGifLoading(false);
    }
  }
  function addGif(url: string) {
    addElement({
      id: uid(),
      kind: "gif",
      x: (SCREEN_W - 120) / 2,
      y: SCREEN_H * 0.3,
      rotation: 0,
      scale: 1,
      zIndex: Date.now(),
      gifUrl: url,
    });
    setShowGifPicker(false);
  }

  // Sticker créé à partir d'une photo de la galerie
  async function pickImageSticker() {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"] as any,
        quality: 0.9,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      const maxSide = 180;
      const ratio = a.width && a.height ? a.width / a.height : 1;
      const w = ratio >= 1 ? maxSide : Math.round(maxSide * ratio);
      const h = ratio >= 1 ? Math.round(maxSide / ratio) : maxSide;
      addElement({
        id: uid(),
        kind: "image",
        x: (SCREEN_W - w) / 2,
        y: SCREEN_H * 0.3,
        rotation: 0,
        scale: 1,
        zIndex: Date.now(),
        imageUri: a.uri,
        imgW: w,
        imgH: h,
        shape: "rounded",
      });
      setShowStickerPicker(false);
    } catch (e: any) {
      Alert.alert(
        "Erreur",
        `Impossible d'ajouter cette image : ${e?.message ?? e}`,
      );
    }
  }

  function addMention() {
    if (mentionDraft.trim()) {
      const handle = mentionDraft.trim().startsWith("@")
        ? mentionDraft.trim()
        : `@${mentionDraft.trim()}`;
      addElement(
        makeText({
          text: handle,
          color: "#00A8FF",
          bgColor: "rgba(0,0,0,0.4)",
        }),
      );
    }
    setMentionDraft("");
    setShowMentionInput(false);
  }

  function addLink() {
    if (linkDraft.trim()) {
      addElement(
        makeText({
          text: `🔗 ${linkDraft.trim()}`,
          bgColor: "rgba(0,0,0,0.5)",
        }),
      );
    }
    setLinkDraft("");
    setShowLinkInput(false);
  }

  // Réglages du son (volume, passage) et choix du passage : partagés par la caméra et l'éditeur photo
  const soundModals = (
    <>
      <VolumeMixer
        visible={mixerOpen}
        clip={soundClip}
        hasVideo={false}
        onChange={setSoundClip}
        onTrim={() => {
          setMixerOpen(false);
          setTimeout(() => setTrimOpen(true), 350);
        }}
        onRemove={removeMusic}
        onClose={() => setMixerOpen(false)}
      />
      <SoundTrimmer
        visible={trimOpen}
        sound={soundClip?.sound ?? null}
        initialStart={soundClip?.startSec}
        initialClip={soundClip?.clipSec}
        onCancel={() => setTrimOpen(false)}
        onDone={(startSec, clipSec) => {
          setTrimOpen(false);
          setSoundClip((c) => (c ? { ...c, startSec, clipSec } : c));
        }}
      />
    </>
  );

  // ---------- Aperçu après une vidéo ----------
  if (videoUri) {
    return (
      <VideoPreview
        uri={videoUri}
        clip={soundClip}
        onClipChange={setSoundClip}
        onRemoveSound={removeMusic}
        posting={posting}
        postingLabel={uploadingMusic ? "Musique…" : "Envoi…"}
        onClose={() => setVideoUri(null)}
        onSave={() => saveVideoToGallery(videoUri)}
        onStory={() => postVideoStory(videoUri)}
        onSend={() => sendVideoToFriend(videoUri)}
        sendLabel={
          directSendToRoom
            ? directSendToRoom.partnerName
            : directSendTo
              ? directSendTo.friendName
              : "Envoyer à"
        }
      />
    );
  }

  // ---------- Choix de la photo après une rafale ----------
  if (burstUris.length > 0 && !photoUri) {
    return (
      <View style={styles.root}>
        <View style={styles.burstWrap}>
          <Text style={styles.burstTitle}>Choisis ta photo</Text>
          <View style={styles.burstRow}>
            {burstUris.map((u) => (
              <Pressable
                key={u}
                onPress={async () => {
                  const f = await finalizePhoto(u);
                  setBurstUris([]);
                  setPhotoUri(f);
                }}
                style={styles.burstItem}
              >
                <Image source={{ uri: u }} style={styles.burstImg} />
              </Pressable>
            ))}
          </View>
          <Pressable
            onPress={() => setBurstUris([])}
            style={styles.burstCancel}
          >
            <Text style={styles.burstCancelTxt}>Annuler</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ---------- Édition après capture ----------
  if (photoUri) {
    const sortedEls = [...elements].sort((a, b) => a.zIndex - b.zIndex);
    const toolBtn = (active?: boolean) =>
      ({ pressed }: { pressed: boolean }) => [
        styles.toolBtn,
        active && styles.toolBtnActive,
        pressed && styles.toolBtnPressed,
      ];
    return (
      <View style={styles.root}>
        {/* Tout ce qui est DANS cette vue est fusionné dans l'image finale */}
        <View
          ref={shotRef}
          collapsable={false}
          style={StyleSheet.absoluteFill}
          {...bgResponder.panHandlers}
          onLayout={(e) =>
            setViewSize({
              w: e.nativeEvent.layout.width,
              h: e.nativeEvent.layout.height,
            })
          }
        >
          <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} />
          {photoLensTint && (
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: photoLensTint },
              ]}
            />
          )}
          {activeFilter.color && (
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: activeFilter.color },
              ]}
            />
          )}
          {activeFilter.overlay && (
            <InfoFilterOverlay kind={activeFilter.overlay} place={placeName} />
          )}
          <DrawingLayer
            ref={drawingLayer}
            ops={drawPaths}
            w={viewSize.w}
            h={viewSize.h}
            blurUri={blurUri}
          />
          {sortedEls
            .filter((e) => !e.hidden)
            .map((el) => (
              <CanvasElementView
                key={el.id}
                el={el}
                selected={selectedId === el.id}
                trashHot={trashHot}
                onSelect={() => setSelectedId(el.id)}
                onCommit={(patch) => commitElementDrag(el.id, patch)}
                onAutoCenter={(w) =>
                  updateElement(el.id, {
                    x: (SCREEN_W - w) / 2,
                    autoCenter: false,
                  })
                }
                onDragState={setDragging}
                onDelete={() => removeElement(el.id)}
                onTap={() => {
                  if (el.kind === "text") openTextMode(el);
                }}
                registerCutout={(id, node) => {
                  cutoutRefs.current[id] = node;
                }}
              />
            ))}
        </View>

        {/* Zone tactile du dessin (stylo ou gomme) */}
        {drawMode && (
          <View
            style={StyleSheet.absoluteFill}
            {...drawResponder.panHandlers}
          />
        )}

        {/* Zone tactile des ciseaux + contour en direct */}
        {cutMode && (
          <>
            <View
              style={StyleSheet.absoluteFill}
              {...cutResponder.panHandlers}
            />
            <LiveSvg ref={liveCut} />
          </>
        )}

        {/* Haut, comme sur Snap : ✕ à gauche, et ↩️ seulement quand il y a quelque chose à annuler */}
        <View style={styles.editTop} pointerEvents="box-none">
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              style={({ pressed }) => [styles.roundBtn, pressed && styles.roundBtnPressed]}
              onPress={discardEdit}
              accessibilityRole="button"
              accessibilityLabel="Fermer sans enregistrer"
            >
              <Icon name="close" size={24} />
            </Pressable>
            {(drawMode || drawPaths.length > 0 || elements.length > 0) && (
              <Pressable
                style={({ pressed }) => [styles.roundBtn, pressed && styles.roundBtnPressed]}
                onPress={drawMode ? undoStroke : undo}
                accessibilityRole="button"
                accessibilityLabel="Annuler"
              >
                <Icon name="arrow-undo" size={20} />
              </Pressable>
            )}
          </View>
        </View>

        {musicName && (
          <Pressable style={styles.musicBadge} onPress={toggleMusicPreview}>
            <Icon name={musicPlaying ? "pause" : "play"} size={14} />
            <Text style={styles.musicName} numberOfLines={1}>
              {musicName}
            </Text>
            <Pressable onPress={() => setMixerOpen(true)} hitSlop={8}>
              <Icon name="options-outline" size={17} />
            </Pressable>
            <Pressable onPress={removeMusic} hitSlop={8}>
              <Icon name="close" size={16} />
            </Pressable>
          </Pressable>
        )}

        {drawMode && (
          <View style={styles.drawHint} pointerEvents="none">
            <Text style={styles.drawHintTxt}>
              {drawTool === "eraser"
                ? "Frotte pour effacer"
                : drawTool === "blur"
                  ? "Frotte sur une zone pour la flouter"
                  : "Dessine avec le doigt"}
            </Text>
          </View>
        )}

        {cutMode && (
          <View style={styles.drawHint} pointerEvents="none">
            <Text style={styles.drawHintTxt}>
              Entoure l'objet avec ton doigt, puis relâche
            </Text>
          </View>
        )}

        {toast && (
          <View style={styles.toast} pointerEvents="none">
            <Text style={styles.toastTxt}>{toast}</Text>
          </View>
        )}

        {/* Barre d'outils façon Snap : les outils principaux, puis « plus » pour le reste */}
        <ScrollView
          style={styles.editToolbar}
          contentContainerStyle={{
            gap: 12,
            alignItems: "center",
            paddingVertical: 4,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Pressable style={toolBtn(!!textMode)} onPress={() => openTextMode()}>
            <Icon name="text" size={22} />
          </Pressable>
          <Pressable
            style={toolBtn(drawMode && drawTool === "pen")}
            onPress={() => {
              if (drawMode && drawTool === "pen") {
                setDrawMode(false);
              } else {
                closePanels();
                setDrawMode(true);
                setDrawTool("pen");
              }
            }}
          >
            <Icon name="pencil" size={20} />
          </Pressable>
          <Pressable
            style={toolBtn(showStickerPicker)}
            onPress={() => {
              closePanels();
              setDrawMode(false);
              setShowStickerPicker(true);
            }}
          >
            <Icon name="happy-outline" size={22} />
          </Pressable>
          <Pressable
            style={toolBtn(cutMode)}
            onPress={() => (cutMode ? setCutMode(false) : startCutMode())}
          >
            <Icon name="cut-outline" size={22} />
          </Pressable>
          <MusicPickerPressable
            style={toolBtn(!!musicName)}
            onPicked={(clip) => {
            setSoundClip(clip);
            setMusicPlaying(!!photoUri);
          }}
          >
            <Icon name="musical-notes" size={20} />
          </MusicPickerPressable>
          <Pressable
            style={toolBtn(showLinkInput)}
            onPress={() => {
              closePanels();
              setDrawMode(false);
              setShowLinkInput(true);
            }}
          >
            <Icon name="link" size={20} />
          </Pressable>
          <Pressable
            style={toolBtn(showDuration)}
            onPress={() => {
              closePanels();
              setDrawMode(false);
              setShowDuration(true);
            }}
          >
            <Text style={styles.toolTxt}>{DURATIONS[durationIdx]}s</Text>
          </Pressable>

          {toolsExpanded && (
            <>
              <Pressable
                style={toolBtn(cropping)}
                accessibilityRole="button"
                accessibilityLabel="Recadrer"
                onPress={() => {
                  closePanels();
                  setDrawMode(false);
                  setCropping(true);
                }}
              >
                <Icon name="crop" size={21} />
              </Pressable>
              <Pressable
                style={toolBtn(showMentionInput)}
                accessibilityRole="button"
                accessibilityLabel="Mentionner un ami"
                onPress={() => {
                  closePanels();
                  setDrawMode(false);
                  setShowMentionInput(true);
                }}
              >
                <Icon name="at" size={20} />
              </Pressable>
              <Pressable
                style={toolBtn(showLayers)}
                accessibilityRole="button"
                accessibilityLabel="Calques"
                onPress={() => {
                  closePanels();
                  setShowLayers(true);
                }}
              >
                <Icon name="layers-outline" size={20} />
              </Pressable>
            </>
          )}

          <Pressable
            style={toolBtn()}
            onPress={() => setToolsExpanded((v) => !v)}
          >
            <Icon name={toolsExpanded ? "chevron-up" : "chevron-down"} size={22} />
          </Pressable>
        </ScrollView>

        {/* Palette de dessin façon Snap : couleurs, pinceau, taille (ou taille de la gomme) */}
        {drawMode && !textMode && !cutMode && (
          <View style={styles.drawBar}>
            {/* Outils du dessin, comme sur Snap */}
            <View style={styles.drawTools}>
              {([
                ["pen", "pencil", "Stylo"],
                ["eraser", "eraser", "Gomme"],
                ...(photoUri ? [["blur", "blur", "Flouter"]] : []),
              ] as [("pen" | "eraser" | "blur"), string, string][]).map(([t, icon, label]) => {
                const on = drawTool === t;
                return (
                  <Pressable
                    key={t}
                    onPress={() => (t === "blur" ? startBlurTool() : setDrawTool(t))}
                    style={[styles.drawToolBtn, on && styles.drawToolBtnOn]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                  >
                    {t === "pen" ? (
                      <Icon name="pencil" size={16} color={on ? "#000" : "#fff"} />
                    ) : (
                      <McIcon name={icon as any} size={17} color={on ? "#000" : "#fff"} />
                    )}
                    <Text style={[styles.drawToolTxt, on && { color: "#000" }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {drawTool === "blur" ? (
              <Text style={styles.drawBlurHint}>Frotte sur ce que tu veux cacher : visage, plaque, nom…</Text>
            ) : drawTool === "pen" ? (
              <>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.drawBarRow}
                >
                  {PEN_COLORS.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => setPenColor(c)}
                      style={[
                        styles.colorDot,
                        { backgroundColor: c },
                        penColor === c && styles.colorDotActive,
                      ]}
                    />
                  ))}
                </ScrollView>
                <View style={styles.drawBarRow}>
                  {PEN_STYLES.map((s) => (
                    <Pressable
                      key={s.key}
                      onPress={() => setPenStyle(s.key)}
                      style={[
                        styles.durationChip,
                        penStyle === s.key && styles.durationChipActive,
                      ]}
                    >
                      <Text style={styles.durationChipTxt}>{s.label}</Text>
                    </Pressable>
                  ))}
                  <View style={{ flex: 1 }} />
                  {PEN_SIZES.map((sz) => (
                    <Pressable
                      key={sz}
                      onPress={() => setPenSize(sz)}
                      style={[
                        styles.sizeBtn,
                        penSize === sz && styles.sizeBtnActive,
                      ]}
                    >
                      <View
                        style={{
                          width: sz + 4,
                          height: sz + 4,
                          borderRadius: (sz + 4) / 2,
                          backgroundColor: penColor,
                        }}
                      />
                    </Pressable>
                  ))}
                </View>
              </>
            ) : (
              <View style={styles.drawBarRow}>
                <Text style={styles.durationLabel}>Taille de la gomme</Text>
                <View style={{ flex: 1 }} />
                {ERASER_SIZES.map((sz) => (
                  <Pressable
                    key={sz}
                    onPress={() => setEraserSize(sz)}
                    style={[
                      styles.sizeBtn,
                      eraserSize === sz && styles.sizeBtnActive,
                    ]}
                  >
                    <View
                      style={{
                        width: sz / 2 + 6,
                        height: sz / 2 + 6,
                        borderRadius: (sz / 2 + 6) / 2,
                        borderWidth: 2,
                        borderColor: "#fff",
                      }}
                    />
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Poubelle : apparaît quand on déplace un élément */}
        {dragging && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.trash,
              {
                transform: [
                  {
                    scale: trashHot.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.35],
                    }),
                  },
                ],
                backgroundColor: trashHot.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["rgba(0,0,0,0.55)", "rgba(255,46,77,0.92)"],
                }),
              },
            ]}
          >
            <Icon name="trash-outline" size={26} />
          </Animated.View>
        )}

        {selectedEl && !textMode && !cutMode && !dragging && !drawMode && (
          <View style={styles.contextBar}>
            <Pressable
              style={styles.ctxBtn}
              onPress={() => bringToFront(selectedEl.id)}
            >
              <Icon name="arrow-up" size={18} />
            </Pressable>
            <Pressable
              style={styles.ctxBtn}
              onPress={() => sendToBack(selectedEl.id)}
            >
              <Icon name="arrow-down" size={18} />
            </Pressable>
            <Pressable
              style={styles.ctxBtn}
              onPress={() => duplicateElement(selectedEl.id)}
            >
              <Icon name="copy-outline" size={18} />
            </Pressable>
            <Pressable
              style={styles.ctxBtn}
              onPress={() => toggleLock(selectedEl.id)}
            >
              <Icon
                name={
                  selectedEl.locked
                    ? "lock-closed-outline"
                    : "lock-open-outline"
                }
                size={18}
              />
            </Pressable>
            {selectedEl.kind === "text" && (
              <Pressable
                style={styles.ctxBtn}
                onPress={() => openTextMode(selectedEl)}
              >
                <Icon name="create-outline" size={19} />
              </Pressable>
            )}
            {selectedEl.kind === "image" && selectedEl.shape !== "free" && (
              <Pressable
                style={styles.ctxBtn}
                onPress={() => toggleImageShape(selectedEl.id)}
              >
                <Icon
                  name={
                    selectedEl.shape === "circle"
                      ? "square-outline"
                      : "ellipse-outline"
                  }
                  size={18}
                />
              </Pressable>
            )}
            {selectedEl.kind === "cutout" && (
              <Pressable
                style={styles.ctxBtn}
                onPress={() => saveCutoutSticker(selectedEl)}
              >
                <Icon name="bookmark-outline" size={19} />
              </Pressable>
            )}
            <Pressable
              style={styles.ctxBtn}
              onPress={() => removeElement(selectedEl.id)}
            >
              <Icon name="trash-outline" size={18} />
            </Pressable>
            <Pressable
              style={styles.ctxBtn}
              onPress={() => setSelectedId(null)}
            >
              <Icon name="close" size={18} />
            </Pressable>
          </View>
        )}

        {cropping && (
          <View style={styles.panel}>
            <Text style={styles.durationLabel}>Rogner</Text>
            <View style={styles.durationChips}>
              {CROP_OPTIONS.map((c) => (
                <Pressable
                  key={c.label}
                  onPress={() => {
                    applyCrop(c.ratio);
                    setCropping(false);
                  }}
                  style={styles.durationChip}
                >
                  <Text style={styles.durationChipTxt}>{c.label}</Text>
                </Pressable>
              ))}
              <Pressable
                onPress={() => setCropping(false)}
                style={styles.durationChip}
              >
                <Text style={styles.durationChipTxt}>Annuler</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Autocollants façon Snap : emojis, stickers animés, GIF, mes stickers, infos */}
        <StickerSheet
          visible={showStickerPicker}
          onClose={() => setShowStickerPicker(false)}
          onEmoji={(e) =>
            addElement({
              id: uid(),
              kind: "sticker",
              x: (SCREEN_W - 56) / 2,
              y: SCREEN_H * 0.3,
              rotation: 0,
              scale: 1,
              zIndex: Date.now(),
              emoji: e,
            })
          }
          onGif={(url) => addGif(url)}
          myStickers={myStickers}
          onMySticker={addMySticker}
          onDeleteMySticker={confirmDeleteMySticker}
          onPickImage={() => {
            setShowStickerPicker(false);
            pickImageSticker();
          }}
          place={placeName}
          onLocation={addLocationSticker}
        />

        {showGifPicker && (
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <Text style={styles.durationLabel}>GIF</Text>
              <Pressable onPress={() => setShowGifPicker(false)} hitSlop={8}>
                <Icon name="close" size={18} />
              </Pressable>
            </View>
            <TextInput
              value={gifQuery}
              onChangeText={setGifQuery}
              placeholder="Rechercher un GIF..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              style={styles.gifSearchInput}
              onSubmitEditing={() => searchGifs(gifQuery)}
              returnKeyType="search"
            />
            {gifLoading ? (
              <Text style={styles.stickerHint}>Recherche...</Text>
            ) : (
              <FlatList
                data={gifResults}
                keyExtractor={(g) => g.id}
                numColumns={3}
                style={{ maxHeight: 200 }}
                renderItem={({ item }) => (
                  <Pressable
                    onPress={() => addGif(item.url)}
                    style={styles.gifThumbWrap}
                  >
                    <ExpoImage
                      source={{ uri: item.url }}
                      style={styles.gifThumb}
                      contentFit="cover"
                    />
                  </Pressable>
                )}
              />
            )}
          </View>
        )}

        {showLinkInput && (
          <View style={styles.textInputOverlay}>
            <TextInput
              value={linkDraft}
              onChangeText={setLinkDraft}
              placeholder="https://..."
              placeholderTextColor="rgba(255,255,255,0.5)"
              style={styles.textInputField}
              autoFocus
              autoCapitalize="none"
              keyboardType="url"
              onSubmitEditing={addLink}
            />
            <Pressable onPress={addLink} style={styles.textDoneBtn}>
              <Text style={styles.textDoneTxt}>OK</Text>
            </Pressable>
          </View>
        )}

        {showMentionInput && (
          <View style={styles.textInputOverlay}>
            <TextInput
              value={mentionDraft}
              onChangeText={setMentionDraft}
              placeholder="@pseudo"
              placeholderTextColor="rgba(255,255,255,0.5)"
              style={styles.textInputField}
              autoFocus
              autoCapitalize="none"
              onSubmitEditing={addMention}
            />
            <Pressable onPress={addMention} style={styles.textDoneBtn}>
              <Text style={styles.textDoneTxt}>OK</Text>
            </Pressable>
          </View>
        )}

        {showDuration && (
          <View style={styles.panel}>
            <Text style={styles.durationLabel}>Durée du Vim</Text>
            <View style={styles.durationChips}>
              {DURATIONS.map((d, i) => (
                <Pressable
                  key={d}
                  onPress={() => {
                    setDurationIdx(i);
                    setShowDuration(false);
                  }}
                  style={({ pressed }) => [
                    styles.durationChip,
                    i === durationIdx && styles.durationChipActive,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <Text
                    style={[
                      styles.durationChipTxt,
                      i === durationIdx && styles.durationChipTxtActive,
                    ]}
                  >
                    {d}s
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {showLayers && (
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <Text style={styles.durationLabel}>
                Calques ({elements.length})
              </Text>
              <Pressable onPress={() => setShowLayers(false)} hitSlop={8}>
                <Icon name="close" size={18} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 220 }}>
              {[...elements]
                .sort((a, b) => b.zIndex - a.zIndex)
                .map((el) => (
                  <View key={el.id} style={styles.layerRow}>
                    <Text style={styles.layerLabel} numberOfLines={1}>
                      {el.kind === "text"
                        ? `Aa ${el.text}`
                        : el.kind === "gif"
                          ? "GIF"
                          : el.kind === "image"
                            ? "Photo"
                            : el.kind === "cutout"
                              ? "Découpe"
                              : el.emoji}
                    </Text>
                    <Pressable onPress={() => toggleHidden(el.id)} hitSlop={6}>
                      <Icon
                        name={el.hidden ? "eye-off-outline" : "eye-outline"}
                        size={18}
                      />
                    </Pressable>
                    <Pressable onPress={() => toggleLock(el.id)} hitSlop={6}>
                      <Icon
                        name={
                          el.locked
                            ? "lock-closed-outline"
                            : "lock-open-outline"
                        }
                        size={18}
                      />
                    </Pressable>
                    <Pressable
                      onPress={() => duplicateElement(el.id)}
                      hitSlop={6}
                    >
                      <Icon name="copy-outline" size={18} />
                    </Pressable>
                    <Pressable onPress={() => removeElement(el.id)} hitSlop={6}>
                      <Icon name="trash-outline" size={18} />
                    </Pressable>
                  </View>
                ))}
              {elements.length === 0 && (
                <Text style={styles.stickerHint}>
                  Aucun calque pour l'instant
                </Text>
              )}
            </ScrollView>
          </View>
        )}

        {/* Barre du bas façon Snap : enregistrer | Story | Envoyer à */}
        <View style={styles.previewBottom}>
          <Pressable
            style={({ pressed }) => [
              styles.saveCircle,
              pressed && { opacity: 0.7 },
            ]}
            onPress={openSaveMenu}
            disabled={posting}
          >
            <Icon name="download-outline" size={22} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.storyPill,
              posting && { opacity: 0.6 },
              pressed && !posting && { opacity: 0.8 },
            ]}
            onPress={postStory}
            disabled={posting}
          >
            <Icon name="add-circle-outline" size={18} />
            <Text style={styles.storyPillTxt}>
              {posting ? (uploadingMusic ? "Musique…" : "Envoi…") : "Story"}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.sendPill,
              posting && { opacity: 0.6 },
              pressed && !posting && { opacity: 0.85 },
            ]}
            onPress={sendToFriend}
            disabled={posting}
          >
            <Text style={styles.sendPillTxt} numberOfLines={1}>
              {directSendToRoom
                ? directSendToRoom.partnerName
                : directSendTo
                  ? directSendTo.friendName
                  : "Envoyer à"}
            </Text>
            <Icon name="send" size={16} />
          </Pressable>
        </View>

        {soundModals}

        {/* Mode texte plein écran (façon Snap) : toujours en dernier pour passer au-dessus */}
        {textMode && (
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.textModeWrap}
          >
            <View style={styles.textModeTop}>
              <Pressable onPress={() => closeTextMode(false)} hitSlop={10}>
                <Text style={styles.textModeCancel}>Annuler</Text>
              </Pressable>
              <Pressable
                onPress={() => closeTextMode(true)}
                hitSlop={10}
                style={styles.textModeOk}
              >
                <Text style={styles.textModeOkTxt}>OK</Text>
              </Pressable>
            </View>

            <View style={styles.textModeCenter}>
              <TextInput
                value={draft.text}
                onChangeText={(t) => setDraft((d) => ({ ...d, text: t }))}
                autoFocus
                multiline
                placeholder="Écris quelque chose..."
                placeholderTextColor="rgba(255,255,255,0.4)"
                style={[
                  styles.textModeInput,
                  {
                    color: draft.color,
                    fontSize: draft.fontSize,
                    fontWeight: draft.bold ? "900" : "500",
                    fontStyle: draft.italic ? "italic" : "normal",
                    textDecorationLine: draft.underline ? "underline" : "none",
                    textAlign: draft.bar ? "center" : draft.align,
                    backgroundColor: draft.bar
                      ? CAPTION_BAR_BG
                      : (draft.bgColor ?? "transparent"),
                  },
                  draft.bar && styles.textModeInputBar,
                ]}
              />
            </View>

            <View style={styles.textModeTools}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.textModeRow}
              >
                {TEXT_COLORS.map((c) => (
                  <Pressable
                    key={c}
                    style={[
                      styles.colorDot,
                      { backgroundColor: c },
                      draft.color === c && styles.colorDotActive,
                    ]}
                    onPress={() => setDraft((d) => ({ ...d, color: c }))}
                  />
                ))}
              </ScrollView>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.textModeRow}
              >
                {TEXT_STYLE_PRESETS.map((preset) => {
                  const active =
                    draft.bold === preset.bold &&
                    draft.italic === preset.italic &&
                    draft.underline === preset.underline &&
                    draft.bar === preset.bar &&
                    draft.fontSize === preset.size;
                  return (
                    <Pressable
                      key={preset.label}
                      style={[
                        styles.durationChip,
                        active && styles.durationChipActive,
                      ]}
                      onPress={() =>
                        setDraft((d) => ({
                          ...d,
                          bold: preset.bold,
                          italic: preset.italic,
                          underline: preset.underline,
                          bar: preset.bar,
                          fontSize: preset.size,
                          ...(preset.bar
                            ? { shadow: false, bgColor: null, outline: false }
                            : {}),
                        }))
                      }
                    >
                      <Text
                        style={[
                          styles.durationChipTxt,
                          preset.bold && { fontWeight: "900" },
                          preset.italic && { fontStyle: "italic" },
                          preset.underline && {
                            textDecorationLine: "underline",
                          },
                        ]}
                      >
                        {preset.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {!draft.bar && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.textModeRow}
                >
                  <Pressable
                    style={[
                      styles.durationChip,
                      draft.shadow && styles.durationChipActive,
                    ]}
                    onPress={() =>
                      setDraft((d) => ({ ...d, shadow: !d.shadow }))
                    }
                  >
                    <Text style={styles.durationChipTxt}>Ombre</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.durationChip,
                      draft.outline && styles.durationChipActive,
                    ]}
                    onPress={() =>
                      setDraft((d) => ({ ...d, outline: !d.outline }))
                    }
                  >
                    <Text style={styles.durationChipTxt}>Contour</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.durationChip,
                      !!draft.bgColor && styles.durationChipActive,
                    ]}
                    onPress={() =>
                      setDraft((d) => ({
                        ...d,
                        bgColor: d.bgColor ? null : "rgba(0,0,0,0.55)",
                      }))
                    }
                  >
                    <Text style={styles.durationChipTxt}>Fond</Text>
                  </Pressable>
                  {(["left", "center", "right"] as const).map((a) => (
                    <Pressable
                      key={a}
                      style={[
                        styles.durationChip,
                        draft.align === a && styles.durationChipActive,
                      ]}
                      onPress={() => setDraft((d) => ({ ...d, align: a }))}
                    >
                      <Text style={styles.durationChipTxt}>
                        {a === "left"
                          ? "Gauche"
                          : a === "center"
                            ? "Centre"
                            : "Droite"}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </View>
          </KeyboardAvoidingView>
        )}
      </View>
    );
  }

  // ---------- Caméra en direct ----------
  // Boutons de zoom façon Snap (0,5 / 1 / 5) : ils choisissent le vrai objectif de l'iPhone.
  // Si l'iPhone ne renvoie pas sa liste d'objectifs, on les affiche quand même sur iOS.
  const hasList = lenses.length > 0;
  const hasUltra = hasList
    ? lenses.some((l) => /ultrawide/i.test(l))
    : Platform.OS === "ios";
  const hasTele = hasList
    ? lenses.some((l) => /telephoto/i.test(l))
    : Platform.OS === "ios";
  // On utilise l'identifiant exact renvoyé par le téléphone quand il existe (indispensable avec le SDK 58)
  const lensId = (re: RegExp, fallback: string) => lenses.find((l) => re.test(l)) ?? fallback;
  const zoomChips: { label: string; lens: string }[] =
    facing === "back"
      ? [
          ...(hasUltra ? [{ label: "0,5", lens: lensId(/ultrawide/i, LENS_ULTRA) }] : []),
          { label: "1", lens: lensId(/wideangle/i, LENS_WIDE) },
          ...(hasTele ? [{ label: TELE_LABEL, lens: lensId(/telephoto/i, LENS_TELE) }] : []),
        ]
      : [];

  return (
    <View style={styles.root} {...cameraResponder.panHandlers}>
      {active && arLens?.arEffect ? (
        <FaceLensView
          ref={faceRef}
          effect={arLens.arEffect}
          facing={facing === "front" ? "front" : "back"}
        />
      ) : active ? (
      <View style={[StyleSheet.absoluteFill, { overflow: "hidden" }]}>
      <CameraView
        ref={cameraRef}
        style={cameraFillStyle()}
        {...SNAP_CAMERA_PROPS}
        facing={facing}
        flash={flash}
        zoom={zoom}
        mode={camMode}
        // Avec un son choisi, la vidéo est filmée sans micro (comme sur Snap)
        mute={!!soundClip || !micOn}
        mirror={facing === "front" && mirrorSelfie}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={scanning ? handleCode : undefined}
        onCameraReady={() => {
          cameraReadyRef.current = true;
          try {
            cameraRef.current
              ?.getAvailableLensesAsync()
              // SDK 57 : liste de noms · SDK 58 : objets { deviceType } → on garde l'identifiant dans les deux cas
              .then((l: any[]) => setLenses(l.map((x) => (typeof x === "string" ? x : String(x?.deviceType ?? "")))))
              .catch(() => {});
          } catch {}
        }}
        {...({
          selectedLens: lens,
          videoQuality: hd ? "2160p" : "1080p",
          videoStabilizationMode: stabilization ? "auto" : "off",
          onAvailableLensesChanged: (e: any) => setLenses(e?.lenses ?? []),
          onMountError: (e: any) => {
            Alert.alert("Caméra", String(e?.message ?? "Erreur de caméra"));
            setLens(LENS_WIDE);
          },
        } as any)}
      />
      </View>
      ) : (
        <View style={StyleSheet.absoluteFill} />
      )}
      {liveTint && (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: liveTint }]}
        />
      )}
      {showGrid && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <View style={[styles.gridLineV, { left: "33.33%" }]} />
          <View style={[styles.gridLineV, { left: "66.66%" }]} />
          <View style={[styles.gridLineH, { top: "33.33%" }]} />
          <View style={[styles.gridLineH, { top: "66.66%" }]} />
        </View>
      )}
      {countdown !== null && (
        <View style={styles.countdownWrap} pointerEvents="none">
          <Text style={styles.countdownTxt}>{countdown}</Text>
        </View>
      )}
      {isRecording && (
        <View style={styles.recBadge}>
          <View style={styles.recDot} />
          <Text style={styles.recTxt}>
            {Math.floor(recSec / 60)}:{String(recSec % 60).padStart(2, "0")}
            {recLocked ? "  🔒" : ""}
          </Text>
        </View>
      )}
      {isRecording && !handsFree && (
        <View style={styles.lockHint} pointerEvents="none">
          <Text style={styles.lockHintTxt}>
            {recLocked
              ? "🔒 Vidéo bloquée · touche le bouton pour arrêter"
              : `‹ 🔒 glisse à gauche pour bloquer${arLens ? "" : " · ↑ glisse vers le haut pour zoomer"}`}
          </Text>
        </View>
      )}
      {zoomBadge && (
        <View style={styles.zoomBadge} pointerEvents="none">
          <Text style={styles.zoomBadgeTxt}>{zoomBadge}</Text>
        </View>
      )}
      {camTip && active && !scanning && !isRecording && (
        <TipBubble text={camTip.text} onDismiss={dismissCamTip} bottom={215} />
      )}
      {scanning && (
        <View style={styles.scanWrap} pointerEvents="box-none">
          <View style={styles.scanFrame} pointerEvents="none" />
          <Text style={styles.scanTxt}>Vise un code QR… (profil VimoX, lien)</Text>
          <Pressable onPress={stopScan} style={styles.scanClose} accessibilityRole="button">
            <Text style={styles.scanCloseTxt}>Annuler</Text>
          </Pressable>
        </View>
      )}
      {screenFlash && <View style={styles.screenFlash} pointerEvents="none" />}
      {isRecording && facing === "front" && flash !== "off" && (
        <View style={styles.ringLight} pointerEvents="none" />
      )}

      {/* Musique choisie avant de filmer */}
      {musicName && !isRecording && (
        <Pressable
          style={styles.liveMusicChip}
          onPress={() => setTrimOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Son : ${musicName}. Toucher pour choisir le passage`}
        >
          <Icon name="musical-note" size={14} />
          <Text style={styles.liveMusicTxt} numberOfLines={1}>
            {musicName}
          </Text>
          <Pressable onPress={() => setMixerOpen(true)} hitSlop={8}>
            <Icon name="options-outline" size={16} />
          </Pressable>
          <Pressable onPress={removeMusic} hitSlop={10}>
            <Icon name="close" size={16} />
          </Pressable>
        </Pressable>
      )}

      {/* Rail d'outils façon Snap : une seule colonne ; déplié, chaque icône affiche son nom à gauche */}
      <View style={styles.rail} pointerEvents="box-none">
        <RailItem icon="camera-reverse-outline" label="Retourner" expanded={showMenu} onPress={flipCamera} />
        <RailItem
          icon={flash === "off" ? "flash-off-outline" : flash === "on" ? "flash" : "flash-outline"}
          label={flash === "off" ? "Flash" : flash === "on" ? "Flash activé" : "Flash auto"}
          active={flash !== "off"}
          expanded={showMenu}
          onPress={() => setFlash((f) => (f === "off" ? "on" : f === "on" ? "auto" : "off"))}
        />
        <MusicPickerPressable
          style={({ pressed }) => [styles.railRow, pressed && { opacity: 0.7 }]}
          onPicked={(clip) => {
            setSoundClip(clip);
            setMusicPlaying(!!photoUri);
          }}
        >
          {showMenu && <Text style={styles.railLabel}>Musique</Text>}
          <View style={[styles.railIcon, !!musicName && styles.railIconOn]}>
            <Icon name="musical-notes-outline" size={23} color={musicName ? colors.gold : "#fff"} />
          </View>
        </MusicPickerPressable>
        <RailItem
          icon="timer-outline"
          text={timerSeconds > 0 ? `${timerSeconds}s` : undefined}
          label={timerSeconds > 0 ? `Retardateur ${timerSeconds} s` : "Retardateur"}
          active={timerSeconds > 0}
          expanded={showMenu}
          onPress={() => {
            const idx = TIMER_OPTIONS.indexOf(timerSeconds);
            const next = TIMER_OPTIONS[(idx + 1) % TIMER_OPTIONS.length];
            setTimerSeconds(next);
            showToast(next === 0 ? "Retardateur désactivé" : `Retardateur : ${next} s`, 1000);
          }}
        />
        {showMenu && (
          <>
            <RailItem icon="hand-left-outline" label="Mains libres" active={handsFree} expanded onPress={() => setHandsFree((v) => !v)} />
            <RailItem icon="albums-outline" label="Rafale" active={burst} expanded onPress={() => setBurst((v) => !v)} />
            <RailItem icon="grid-outline" label="Repères" active={showGrid} expanded onPress={() => setShowGrid((v) => !v)} />
            <RailItem
              icon="qr-code-outline"
              label="Scanner"
              expanded
              onPress={() => {
                setShowMenu(false);
                startScan();
              }}
            />
            <RailItem
              icon="settings-outline"
              label="Réglages"
              expanded
              onPress={() => {
                setShowMenu(false);
                setCamSettingsOpen(true);
              }}
            />
          </>
        )}
        <RailItem
          icon={showMenu ? "chevron-up" : "chevron-down"}
          label=""
          expanded={false}
          onPress={() => setShowMenu((v) => !v)}
          accessibilityLabel={showMenu ? "Moins d'outils" : "Plus d'outils"}
        />
      </View>

      {toast && (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastTxt}>{toast}</Text>
        </View>
      )}

      {/* Nom de l'effet actif, au-dessus du déclencheur */}
      {activeLens && !isRecording && (
        <View style={styles.liveLensNameWrap} pointerEvents="none">
          <Text style={styles.liveLensName} numberOfLines={1}>
            {activeLens.name}
          </Text>
        </View>
      )}

      {zoomChips.length > 0 && !isRecording && !arLens && !showMenu && (
        <View style={styles.zoomRow}>
          {zoomChips.map((c) => {
            const active = lens === c.lens && zoom < 0.02;
            return (
              <Pressable
                key={c.label}
                onPress={() => selectLens(c.lens)}
                style={({ pressed }) => [
                  styles.zoomChip,
                  active && styles.zoomChipActive,
                  pressed && { opacity: 0.8 },
                ]}
              >
                <Text
                  style={[
                    styles.zoomChipTxt,
                    active && styles.zoomChipTxtActive,
                  ]}
                >
                  {active ? `${c.label}x` : c.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Déclencheur + effets qui défilent dedans, comme sur Snap */}
      <ShutterCarousel
        lenses={carouselLenses}
        index={carouselIdx}
        onIndexChange={onCarouselIndex}
        isPremium={isPremium}
        isRecording={isRecording}
        recProgress={Math.min(1, recSec / (arLens ? 15 : 60))}
        onShutterTouchStart={onShutterTouchStart}
        onShutterTouchMove={onShutterTouchMove}
        onPress={onCapturePress}
        onPressIn={onCapturePressIn}
        onPressOut={onCapturePressOut}
        onLongPressLens={(l) => {
          const added = lensPrefs.toggleFavorite(l.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          showToast(added ? `❤️ ${l.name} ajoutée aux favoris` : `${l.name} retirée des favoris`, 1500);
        }}
        leftSlot={
          <Pressable
            style={({ pressed }) => [
              styles.memoriesBtn,
              pressed && styles.roundBtnPressed,
            ]}
            onPress={() => setShowMemories(true)}
            onLongPress={pickFromGallery}
            accessibilityRole="button"
            accessibilityLabel="Souvenirs (appui long : pellicule)"
          >
            <Icon name="albums-outline" size={22} />
          </Pressable>
        }
      />

      {/* Catégories d'effets + explorateur */}
      {FACE_EFFECTS && !isRecording && (
        <View style={styles.lensCatRow}>
          <Pressable
            style={styles.lensCatIcon}
            onPress={() => changeLensCategory("games")}
            hitSlop={8}
          >
            <Icon name="game-controller-outline" size={24} />
          </Pressable>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.lensCatScroll}
          >
            {QUICK_CATEGORIES.map((id) => {
              const cat = EXPLORER_CATEGORIES.find((c) => c.id === id);
              const on = id === lensCategory;
              return (
                <Pressable
                  key={id}
                  onPress={() => changeLensCategory(id)}
                  style={[styles.lensCatPill, on && styles.lensCatPillActive]}
                >
                  <Text style={[styles.lensCatTxt, on && styles.lensCatTxtActive]}>
                    {cat?.label ?? id}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Pressable
            style={styles.lensCatIcon}
            onPress={() => setExplorerOpen(true)}
            hitSlop={8}
          >
            <Icon name="happy-outline" size={26} />
          </Pressable>
        </View>
      )}

      {/* Réglages de la caméra : les options rarement changées, avec de vrais interrupteurs */}
      <Modal visible={camSettingsOpen} transparent animationType="slide" onRequestClose={() => setCamSettingsOpen(false)}>
        <View style={styles.camSheetBack}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setCamSettingsOpen(false)} accessibilityLabel="Fermer" />
          <View style={styles.camSheet}>
            <View style={styles.camSheetHandle} />
            <Text style={styles.camSheetTitle}>Réglages de la caméra</Text>
            {(
              [
                ["volume-high-outline", "Sons de l'appareil", "Bruit du déclencheur et des boutons", soundsOn, setSoundsOn],
                ["mic-outline", "Micro des vidéos", "Désactive-le pour filmer sans le son", micOn, setMicOn],
                ["swap-horizontal-outline", "Selfie en miroir", "L'aperçu de la caméra avant est inversé, comme un miroir", mirrorSelfie, setMirrorSelfie],
                ["person-circle-outline", "Photo selfie en miroir", "La photo prise est enregistrée telle que tu la vois", mirrorPhoto, setMirrorPhoto],
                ["film-outline", "Vidéo haute qualité (4K)", "Plus net, mais des fichiers plus lourds", hd, setHd],
                ["phone-portrait-outline", "Stabilisation vidéo", "Réduit les tremblements quand tu filmes", stabilization, setStabilization],
              ] as [string, string, string, boolean, (f: (v: boolean) => boolean) => void][]
            ).map(([icon, label, sub, value, set]) => (
              <Pressable key={label} style={styles.camSetRow} onPress={() => set((v) => !v)} accessibilityRole="switch" accessibilityState={{ checked: value }}>
                <View style={styles.camSetIcon}>
                  <Icon name={icon} size={18} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.camSetLabel}>{label}</Text>
                  <Text style={styles.camSetSub}>{sub}</Text>
                </View>
                <Switch
                  value={value}
                  onValueChange={() => set((v) => !v)}
                  trackColor={{ false: "#3A3A44", true: colors.neonRed }}
                  thumbColor="#fff"
                />
              </Pressable>
            ))}
            <Text style={styles.camSetHint}>Astuce : maintiens ton doigt sur l'écran de la caméra pour scanner un code QR.</Text>
          </View>
        </View>
      </Modal>

      {/* Écran Souvenirs */}
      {showMemories && (
        <View style={styles.memoriesWrap}>
          <View style={styles.memoriesHeader}>
            <Text style={styles.memoriesTitle}>Souvenirs</Text>
            <Pressable onPress={pickFromGallery} style={styles.galleryBtn} accessibilityRole="button">
              <Icon name="images-outline" size={18} />
              <Text style={styles.galleryTxt}>Pellicule</Text>
            </Pressable>
            <Pressable onPress={() => setShowMemories(false)} hitSlop={10}>
              <Icon name="close" size={26} />
            </Pressable>
          </View>
          {memoriesError ? (
            <Text style={styles.memoriesEmpty}>⚠ {memoriesError}</Text>
          ) : memories.length === 0 ? (
            <Text style={styles.memoriesEmpty}>
              Aucun souvenir pour l'instant. Dans l'aperçu d'une photo, touche
              le bouton ⬇ en bas à gauche, puis « Souvenirs VimoX ». Tu peux aussi
              envoyer une photo ou une vidéo de ta pellicule (bouton en haut).
            </Text>
          ) : (
            <FlatList
              data={memories}
              keyExtractor={(m) => m.id}
              numColumns={3}
              contentContainerStyle={{ padding: 6 }}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.memoryCell}
                  onPress={() => openMemory(item)}
                >
                  <Image
                    source={{ uri: item.imageURL }}
                    style={styles.memoryImg}
                  />
                </Pressable>
              )}
            />
          )}
        </View>
      )}

      {soundModals}

      <LensExplorerSheet
        visible={explorerOpen}
        onClose={() => setExplorerOpen(false)}
        lenses={lensesLive}
        favorites={lensPrefs.favorites}
        recents={lensPrefs.recents}
        activeLensId={activeLens?.id ?? null}
        isPremiumUser={isPremium}
        initialCategory={lensCategory}
        onSelect={(l) => {
          setExplorerOpen(false);
          selectLensFromExplorer(l);
        }}
        onToggleFavorite={(l) => {
          const added = lensPrefs.toggleFavorite(l.id);
          showToast(added ? `${l.name} ajouté aux favoris` : `${l.name} retiré des favoris`, 1400);
        }}
      />

      <PremiumLensPrompt
        lens={lockedLens}
        onClose={() => setLockedLens(null)}
        onDiscover={() => {
          setLockedLens(null);
          navigation.navigate("Premium");
        }}
      />
    </View>
  );
}

// Une icône du rail façon Snap : icône blanche sur un rond discret ; nom affiché à gauche quand le rail est déplié
function RailItem({
  icon,
  label,
  onPress,
  active,
  expanded,
  text,
  accessibilityLabel,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  active?: boolean;
  expanded?: boolean;
  text?: string;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.railRow, pressed && { opacity: 0.7 }]}
      onPress={onPress}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={active !== undefined ? { selected: active } : undefined}
    >
      {expanded && !!label && <Text style={styles.railLabel}>{label}</Text>}
      <View style={[styles.railIcon, active && styles.railIconOn]}>
        {text ? (
          <Text style={[styles.railIconTxt, active && { color: colors.gold }]}>{text}</Text>
        ) : (
          <Icon name={icon} size={23} color={active ? colors.gold : "#fff"} />
        )}
      </View>
    </Pressable>
  );
}

// Carrousel d'effets façon Snap : les effets défilent et passent DANS le déclencheur.
// L'effet au centre est celui qui est appliqué ; la case 0 = aucun effet.
const LENS_ITEM = 76;
const LENS_THUMB = 58;
function ShutterCarousel({
  lenses,
  index,
  onIndexChange,
  isPremium,
  isRecording,
  onPress,
  onPressIn,
  onPressOut,
  recProgress = 0,
  onShutterTouchStart,
  onShutterTouchMove,
  leftSlot,
  onLongPressLens,
}: {
  lenses: VimoxLens[];
  index: number;
  onIndexChange: (i: number) => void;
  isPremium: boolean;
  isRecording: boolean;
  onPress: () => void;
  onPressIn: () => void;
  onPressOut: () => void;
  recProgress?: number;
  onShutterTouchStart?: (e: any) => void;
  onShutterTouchMove?: (e: any) => void;
  leftSlot?: ReactNode;
  onLongPressLens?: (lens: VimoxLens) => void;
}) {
  const listRef = useRef<FlatList<VimoxLens | null>>(null);
  const data: (VimoxLens | null)[] = [null, ...lenses];
  const pad = (SCREEN_W - LENS_ITEM) / 2;
  const lastIdx = useRef(index);

  // Recentre quand l'index change de l'extérieur (catégorie, explorateur)
  useEffect(() => {
    if (lastIdx.current === index) return;
    lastIdx.current = index;
    listRef.current?.scrollToOffset({ offset: index * LENS_ITEM, animated: true });
  }, [index]);

  const settle = (x: number) => {
    const i = Math.max(0, Math.min(data.length - 1, Math.round(x / LENS_ITEM)));
    if (i !== lastIdx.current) {
      lastIdx.current = i;
      Haptics.selectionAsync().catch(() => {});
      onIndexChange(i);
    }
  };

  return (
    <View style={styles.carouselWrap} pointerEvents="box-none">
      <FlatList
        ref={listRef}
        horizontal
        data={data}
        keyExtractor={(l, i) => (l ? l.id : `none-${i}`)}
        showsHorizontalScrollIndicator={false}
        snapToInterval={LENS_ITEM}
        decelerationRate="fast"
        scrollEnabled={!isRecording}
        style={{ opacity: isRecording ? 0 : 1 }}
        contentContainerStyle={{ paddingHorizontal: pad, alignItems: "center" }}
        getItemLayout={(_, i) => ({ length: LENS_ITEM, offset: LENS_ITEM * i, index: i })}
        onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.x)}
        onScrollEndDrag={(e) => {
          const v = e.nativeEvent.velocity?.x ?? 0;
          if (Math.abs(v) < 0.05) settle(e.nativeEvent.contentOffset.x);
        }}
        renderItem={({ item, index: i }) => (
          <Pressable
            style={styles.carouselItem}
            onPress={() => {
              lastIdx.current = -1;
              onIndexChange(i);
            }}
            onLongPress={item && onLongPressLens ? () => onLongPressLens(item) : undefined}
            delayLongPress={350}
          >
            {item ? (
              <View>
                <LensThumb lens={item} size={LENS_THUMB} />
                {item.premium && (
                  <View style={styles.carouselBadge}>
                    <PremiumBadge locked={!isPremium} small />
                  </View>
                )}
              </View>
            ) : null}
          </Pressable>
        )}
      />

      {index === 0 && !isRecording && leftSlot ? (
        <View style={[styles.carouselLeft, { left: pad / 2 - 21 }]}>{leftSlot}</View>
      ) : null}

      {/* Le déclencheur reste fixe au centre ; l'effet choisi apparaît à l'intérieur */}
      <View style={styles.shutterHolder} pointerEvents="box-none">
        <View onTouchStart={onShutterTouchStart} onTouchMove={onShutterTouchMove}>
        {/* Anneau rouge qui se remplit pendant la vidéo, comme sur Snap */}
        {isRecording && (
          <Svg width={104} height={104} style={styles.recRing} pointerEvents="none">
            <SvgCircle cx={52} cy={52} r={48} stroke="rgba(255,255,255,0.25)" strokeWidth={5} fill="none" />
            <SvgCircle
              cx={52}
              cy={52}
              r={48}
              stroke={colors.neonRed}
              strokeWidth={5}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 48}`}
              strokeDashoffset={2 * Math.PI * 48 * (1 - recProgress)}
              transform="rotate(-90 52 52)"
            />
          </Svg>
        )}
        <Pressable
          style={[styles.captureOuter, isRecording && styles.captureOuterRec]}
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          // Le doigt peut glisser loin (zoom, verrou) sans arrêter la vidéo
          pressRetentionOffset={{ top: 1000, bottom: 400, left: 1000, right: 1000 }}
        >
          <View
            style={[
              styles.captureInner,
              index > 0 && styles.captureInnerLens,
              isRecording && styles.captureInnerRec,
            ]}
          />
        </Pressable>
        </View>
      </View>
    </View>
  );
}

// Aperçu après une vidéo : lecture en boucle, enregistrer, partager
function VideoPreview({
  uri,
  clip,
  onClipChange,
  onRemoveSound,
  posting,
  postingLabel,
  onClose,
  onSave,
  onStory,
  onSend,
  sendLabel,
}: {
  uri: string;
  clip: SoundClip | null;
  onClipChange: (c: SoundClip) => void;
  onRemoveSound: () => void;
  posting: boolean;
  postingLabel: string;
  onClose: () => void;
  onSave: () => void;
  onStory: () => void;
  onSend: () => void;
  sendLabel: string;
}) {
  const [muted, setMuted] = useState(false);
  const [mixerOpen, setMixerOpen] = useState(false);
  const [trimOpen, setTrimOpen] = useState(false);
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });
  useEffect(() => {
    player.muted = muted;
    player.volume = clip ? clip.videoVolume : 1;
  }, [muted, player, clip?.videoVolume]);
  // Le son choisi est joué avec la vidéo, avec son volume
  useClipPlayer(
    clip
      ? {
          url: clip.sound.audioURL,
          startSec: clip.startSec,
          clipSec: clip.clipSec,
          volume: muted ? 0 : clip.musicVolume,
        }
      : null,
    !!clip && !trimOpen,
  );

  const share = async () => {
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "video/mp4" });
      }
    } catch (e: any) {
      Alert.alert("Vidéo", `Partage impossible : ${e?.message ?? e}`);
    }
  };

  return (
    <View style={styles.root}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
      />
      <View style={styles.editTop}>
        <Pressable
          style={({ pressed }) => [styles.roundBtn, pressed && styles.roundBtnPressed]}
          onPress={onClose}
        >
          <Icon name="close" size={24} />
        </Pressable>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable
            style={({ pressed }) => [styles.roundBtn, pressed && styles.roundBtnPressed]}
            onPress={share}
          >
            <Icon name="share-outline" size={20} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.roundBtn, pressed && styles.roundBtnPressed]}
            onPress={() => setMuted((m) => !m)}
          >
            <Icon name={muted ? "volume-mute" : "volume-high"} size={20} />
          </Pressable>
        </View>
      </View>
      {clip && (
        <Pressable style={styles.musicBadge} onPress={() => setMixerOpen(true)}>
          <Icon name="musical-note" size={14} />
          <Text style={styles.musicName} numberOfLines={1}>
            {soundLabel(clip.sound)}
          </Text>
          <Icon name="options-outline" size={17} />
        </Pressable>
      )}
      <VolumeMixer
        visible={mixerOpen}
        clip={clip}
        hasVideo
        onChange={onClipChange}
        onTrim={() => {
          setMixerOpen(false);
          setTimeout(() => setTrimOpen(true), 350);
        }}
        onRemove={() => {
          setMixerOpen(false);
          onRemoveSound();
        }}
        onClose={() => setMixerOpen(false)}
      />
      <SoundTrimmer
        visible={trimOpen}
        sound={clip?.sound ?? null}
        initialStart={clip?.startSec}
        initialClip={clip?.clipSec}
        onCancel={() => setTrimOpen(false)}
        onDone={(startSec, clipSec) => {
          setTrimOpen(false);
          if (clip) onClipChange({ ...clip, startSec, clipSec });
        }}
      />
      <View style={styles.previewBottom}>
        <Pressable
          style={({ pressed }) => [styles.saveCircle, pressed && { opacity: 0.7 }]}
          onPress={onSave}
          disabled={posting}
        >
          <Icon name="download-outline" size={22} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.storyPill,
            posting && { opacity: 0.6 },
            pressed && !posting && { opacity: 0.8 },
          ]}
          onPress={onStory}
          disabled={posting}
        >
          <Icon name="add-circle-outline" size={18} />
          <Text style={styles.storyPillTxt}>{posting ? postingLabel : "Story"}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.sendPill,
            posting && { opacity: 0.6 },
            pressed && !posting && { opacity: 0.85 },
          ]}
          onPress={onSend}
          disabled={posting}
        >
          <Text style={styles.sendPillTxt} numberOfLines={1}>
            {sendLabel}
          </Text>
          <Icon name="send" size={16} />
        </Pressable>
      </View>
    </View>
  );
}

// Filtres « infos » quand on glisse sur la photo (heure, date, lieu), comme sur Snap
function InfoFilterOverlay({
  kind,
  place,
}: {
  kind: "time" | "date" | "place";
  place: string | null;
}) {
  const now = new Date();
  return (
    <View pointerEvents="none" style={styles.infoWrap}>
      {kind === "time" && (
        <Text style={styles.infoTime}>
          {now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </Text>
      )}
      {kind === "date" && (
        <>
          <Text style={styles.infoDay}>
            {now.toLocaleDateString("fr-FR", { weekday: "long" })}
          </Text>
          <Text style={styles.infoDate}>
            {now.toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
          </Text>
        </>
      )}
      {kind === "place" && (
        <Text style={styles.infoPlace}>{place ? `📍 ${place}` : "📍 …"}</Text>
      )}
    </View>
  );
}

// Élément posé sur la photo, manipulé façon Snap :
// 1 doigt = déplacer, 2 doigts = agrandir + tourner en même temps, glisser vers la poubelle = supprimer,
// tap sur un texte déjà sélectionné = le modifier.
// La barre de légende (style « Snap ») ne bouge que de haut en bas, comme sur Snapchat.
// Les valeurs sont animées (Animated) : pendant le geste, seul cet élément est redessiné.
function CanvasElementView({
  el,
  selected,
  trashHot,
  onSelect,
  onCommit,
  onAutoCenter,
  onDragState,
  onDelete,
  onTap,
  registerCutout,
}: {
  el: CanvasEl;
  selected: boolean;
  trashHot: Animated.Value;
  onSelect: () => void;
  onCommit: (patch: {
    x: number;
    y: number;
    rotation: number;
    scale: number;
  }) => void;
  onAutoCenter: (width: number) => void;
  onDragState: (active: boolean) => void;
  onDelete: () => void;
  onTap: () => void;
  registerCutout: (id: string, node: any) => void;
}) {
  // Toujours la dernière version des valeurs/fonctions (évite les valeurs figées dans les gestes)
  const latest = useRef({
    el,
    selected,
    trashHot,
    onSelect,
    onCommit,
    onAutoCenter,
    onDragState,
    onDelete,
    onTap,
  });
  latest.current = {
    el,
    selected,
    trashHot,
    onSelect,
    onCommit,
    onAutoCenter,
    onDragState,
    onDelete,
    onTap,
  };

  const pos = useRef(new Animated.ValueXY({ x: el.x, y: el.y })).current;
  const scaleV = useRef(new Animated.Value(el.scale)).current;
  const rotV = useRef(new Animated.Value(el.rotation)).current;
  const cur = useRef({ x: el.x, y: el.y, scale: el.scale, rot: el.rotation });
  const gesturing = useRef(false);
  const gst = useRef({
    startX: 0,
    startY: 0,
    startScale: 1,
    startRot: 0,
    baseDist: 1,
    baseAngle: 0,
    pinching: false,
    moved: false,
    dragActive: false,
    snapped: false,
    inTrash: false,
    t0: 0,
    wasSelected: false,
  });

  // Resynchronise quand l'état change (annuler / rétablir, centrage automatique...)
  useEffect(() => {
    if (gesturing.current) return;
    cur.current = { x: el.x, y: el.y, scale: el.scale, rot: el.rotation };
    pos.setValue({ x: el.x, y: el.y });
    scaleV.setValue(el.scale);
    rotV.setValue(el.rotation);
  }, [el.x, el.y, el.scale, el.rotation]);

  // Petit effet de ressort à l'apparition
  useEffect(() => {
    scaleV.setValue(el.scale * 0.8);
    Animated.spring(scaleV, {
      toValue: el.scale,
      friction: 5,
      tension: 140,
      useNativeDriver: false,
    }).start();
  }, []);

  const finish = (cancelled: boolean) => {
    const s = gst.current;
    gesturing.current = false;
    if (s.dragActive) {
      s.dragActive = false;
      latest.current.onDragState(false);
    }
    latest.current.trashHot.setValue(0);
    if (s.inTrash && !cancelled) {
      s.inTrash = false;
      latest.current.onDelete();
      return;
    }
    s.inTrash = false;
    const isTap = !s.moved && Date.now() - s.t0 < 300;
    if (isTap) {
      // Un tap sur un élément déjà sélectionné l'ouvre (texte : édition)
      if (s.wasSelected && !cancelled) latest.current.onTap();
      return;
    }
    if (latest.current.el.locked) return;
    latest.current.onCommit({
      x: cur.current.x,
      y: cur.current.y,
      rotation: cur.current.rot,
      scale: cur.current.scale,
    });
  };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const s = gst.current;
        s.startX = cur.current.x;
        s.startY = cur.current.y;
        s.startScale = cur.current.scale;
        s.startRot = cur.current.rot;
        s.pinching = false;
        s.moved = false;
        s.dragActive = false;
        s.snapped = false;
        s.inTrash = false;
        s.t0 = Date.now();
        s.wasSelected = latest.current.selected;
        gesturing.current = true;
        latest.current.onSelect();
      },
      onPanResponderMove: (evt, gs) => {
        const s = gst.current;
        if (latest.current.el.locked) return;
        const isBar = latest.current.el.kind === "text" && !!latest.current.el.bar;
        const touches = evt.nativeEvent.touches;
        if (
          !s.moved &&
          (Math.abs(gs.dx) > 4 || Math.abs(gs.dy) > 4 || touches.length >= 2)
        ) {
          s.moved = true;
        }
        if (!s.moved) return;
        if (!s.dragActive) {
          s.dragActive = true;
          latest.current.onDragState(true);
        }

        // Position : suit le centre des doigts (la barre de légende ne bouge que verticalement)
        const x = isBar ? s.startX : s.startX + gs.dx;
        const y = s.startY + gs.dy;
        cur.current.x = x;
        cur.current.y = y;
        pos.setValue({ x, y });

        if (touches.length >= 2 && !isBar) {
          const a = touches[0];
          const b = touches[1];
          const dist = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
          const angle =
            (Math.atan2(b.pageY - a.pageY, b.pageX - a.pageX) * 180) / Math.PI;
          if (!s.pinching) {
            s.pinching = true;
            s.baseDist = Math.max(dist, 1);
            s.baseAngle = angle;
            s.startScale = cur.current.scale;
            s.startRot = cur.current.rot;
          } else {
            const scale = Math.min(
              6,
              Math.max(0.3, s.startScale * (dist / s.baseDist)),
            );
            let delta = angle - s.baseAngle;
            while (delta > 180) delta -= 360;
            while (delta < -180) delta += 360;
            let rot = s.startRot + delta;
            // Aimant : la rotation « droite » (0, 90, 180, 270°) accroche, avec une vibration légère
            const nearest = Math.round(rot / 90) * 90;
            if (Math.abs(rot - nearest) < 4) {
              rot = nearest;
              if (!s.snapped) {
                s.snapped = true;
                Haptics.selectionAsync().catch(() => {});
              }
            } else {
              s.snapped = false;
            }
            cur.current.scale = scale;
            cur.current.rot = rot;
            scaleV.setValue(scale);
            rotV.setValue(rot);
          }
        } else if (s.pinching) {
          // On repasse à un seul doigt : on garde la taille et l'angle actuels
          s.pinching = false;
          s.startScale = cur.current.scale;
          s.startRot = cur.current.rot;
        }

        // Poubelle
        const hot =
          gs.moveY > TRASH_TOP && Math.abs(gs.moveX - SCREEN_W / 2) < 80;
        if (hot !== s.inTrash) {
          s.inTrash = hot;
          latest.current.trashHot.setValue(hot ? 1 : 0);
          if (hot)
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
              () => {},
            );
        }
      },
      onPanResponderRelease: () => finish(false),
      onPanResponderTerminate: () => finish(true),
    }),
  ).current;

  const imgW = el.imgW ?? 150;
  const imgH = el.imgH ?? 150;
  const side = Math.min(imgW, imgH);
  const boxW = el.shape === "circle" ? side : imgW;
  const boxH = el.shape === "circle" ? side : imgH;

  const rotate = rotV.interpolate({
    inputRange: [0, 360],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Animated.View
      {...responder.panHandlers}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        transform: [
          { translateX: pos.x },
          { translateY: pos.y },
          { rotate },
          { scale: scaleV },
        ],
      }}
      onLayout={(e) => {
        if (latest.current.el.autoCenter) {
          latest.current.onAutoCenter(e.nativeEvent.layout.width);
        }
      }}
    >
      <View>
        {el.kind === "text" && <TextLayer el={el} />}
        {el.kind === "sticker" &&
          ((el.emoji ?? "").includes(" ") ? (
            // Autocollant « info » (heure, date, lieu, petit mot) : pastille lisible, comme sur Snap
            <Text style={styles.infoSticker}>{el.emoji}</Text>
          ) : (
            <Text style={{ fontSize: 56 }}>{el.emoji}</Text>
          ))}
        {el.kind === "gif" && (
          <ExpoImage
            source={{ uri: el.gifUrl }}
            style={{ width: 120, height: 120, borderRadius: 8 }}
            contentFit="cover"
          />
        )}
        {el.kind === "image" &&
          (el.shape === "free" ? (
            <ExpoImage
              source={{ uri: el.imageUri }}
              style={{ width: imgW, height: imgH }}
              contentFit="contain"
            />
          ) : (
            <ExpoImage
              source={{ uri: el.imageUri }}
              style={{
                width: boxW,
                height: boxH,
                borderRadius: el.shape === "circle" ? side / 2 : 16,
                borderWidth: 4,
                borderColor: "#fff",
              }}
              contentFit="cover"
            />
          ))}
        {el.kind === "cutout" &&
          el.cutBox &&
          el.cutSrc &&
          el.cutView &&
          el.cutPath && (
            <View
              ref={(n) => registerCutout(el.id, n)}
              collapsable={false}
              style={{
                width: el.cutBox.w + 2 * CUT_PAD,
                height: el.cutBox.h + 2 * CUT_PAD,
                overflow: "hidden",
              }}
            >
              <Svg
                width={el.cutView.w}
                height={el.cutView.h}
                style={{
                  position: "absolute",
                  left: CUT_PAD - el.cutBox.x,
                  top: CUT_PAD - el.cutBox.y,
                }}
              >
                <Defs>
                  <ClipPath id={`clip-${el.id}`}>
                    <Path d={el.cutPath} />
                  </ClipPath>
                </Defs>
                {/* Silhouette blanche dessinée AVANT l'image : seule sa bordure extérieure reste visible, ça fait le contour du sticker */}
                <Path
                  d={el.cutPath}
                  fill="#fff"
                  stroke="#fff"
                  strokeWidth={CUT_PAD * 1.4}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                <SvgImage
                  href={{ uri: el.cutSrc }}
                  x={0}
                  y={0}
                  width={el.cutView.w}
                  height={el.cutView.h}
                  preserveAspectRatio="xMidYMid slice"
                  clipPath={`url(#clip-${el.id})`}
                />
              </Svg>
            </View>
          )}
      </View>
      {selected && !(el.kind === "text" && el.bar) && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: -6,
            left: -6,
            right: -6,
            bottom: -6,
            borderWidth: 1.5,
            borderColor: "rgba(255,255,255,0.75)",
            borderStyle: "dashed",
            borderRadius: 8,
          }}
        />
      )}
    </Animated.View>
  );
}

function TextLayer({ el }: { el: CanvasEl }) {
  const base = {
    color: el.color ?? "#fff",
    fontSize: el.fontSize ?? 26,
    fontWeight: el.bold ? ("900" as const) : ("500" as const),
    fontStyle: el.italic ? ("italic" as const) : ("normal" as const),
    textDecorationLine: el.underline
      ? ("underline" as const)
      : ("none" as const),
    textAlign: el.align ?? "center",
  };

  // Barre de légende façon Snap : bandeau noir translucide sur toute la largeur
  if (el.bar) {
    return (
      <View style={styles.captionBar}>
        <Text style={[base, { textAlign: "center" }]}>{el.text}</Text>
      </View>
    );
  }

  const pad = el.bgColor ? { paddingHorizontal: 12, paddingVertical: 6 } : null;
  const content = (
    <Text
      style={[
        base,
        el.shadow && {
          textShadowColor: "rgba(0,0,0,0.6)",
          textShadowOffset: { width: 1, height: 1 },
          textShadowRadius: 4,
        },
      ]}
    >
      {el.text}
    </Text>
  );

  const wrapper = el.bgColor ? (
    <View
      style={{
        backgroundColor: el.bgColor,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
      }}
    >
      {content}
    </View>
  ) : (
    content
  );

  if (!el.outline) {
    return <View style={{ maxWidth: SCREEN_W - 40 }}>{wrapper}</View>;
  }

  // Contour : 8 copies noires décalées, avec le MÊME espacement que le texte final
  const copies: [number, number][] = [
    [-1.5, 0],
    [1.5, 0],
    [0, -1.5],
    [0, 1.5],
    [-1, -1],
    [1, 1],
    [-1, 1],
    [1, -1],
  ];
  return (
    <View style={{ maxWidth: SCREEN_W - 40 }}>
      {copies.map(([dx, dy], i) => (
        <View
          key={i}
          pointerEvents="none"
          style={[{ position: "absolute", left: dx, top: dy }, pad]}
        >
          <Text style={[base, { color: "#000" }]}>{el.text}</Text>
        </View>
      ))}
      {wrapper}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  centerAll: {
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
    gap: 12,
  },
  permTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  permSub: { color: colors.muted, fontSize: 13, textAlign: "center" },
  permBtn: {
    backgroundColor: colors.neonRed,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  permBtnTxt: { color: "#fff", fontWeight: "800" },
  roundBtn: {
    minWidth: 42,
    height: 42,
    paddingHorizontal: 8,
    borderRadius: 21,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  roundBtnActive: { backgroundColor: "rgba(255,46,77,0.6)" },
  roundBtnPressed: { transform: [{ scale: 0.88 }], opacity: 0.7 },
  recBadge: {
    position: "absolute",
    top: 54,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.neonRed,
  },
  recTxt: { color: "#fff", fontSize: 11, fontWeight: "900" },
  lockHint: {
    position: "absolute",
    bottom: 200,
    left: 20,
    right: 20,
    alignItems: "center",
  },
  lockHintTxt: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    overflow: "hidden",
  },
  zoomBadge: {
    position: "absolute",
    top: "42%",
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  zoomBadgeTxt: { color: "#fff", fontSize: 18, fontWeight: "900" },
  screenFlash: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFF4E0",
    zIndex: 999,
  },
  ringLight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 26,
    borderColor: "rgba(255,244,224,0.92)",
    borderRadius: 34,
  },
  recRing: { position: "absolute", top: -10, left: -10 },
  infoSticker: {
    fontSize: 26,
    fontWeight: "900",
    color: "#fff",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    overflow: "hidden",
    textTransform: "capitalize",
  },
  galleryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginLeft: "auto",
    marginRight: 12,
  },
  galleryTxt: { color: "#fff", fontSize: 13, fontWeight: "800" },
  scanWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
  },
  scanFrame: {
    width: 230,
    height: 230,
    borderRadius: 28,
    borderWidth: 4,
    borderColor: "#FFD60A",
    backgroundColor: "rgba(255,214,10,0.06)",
  },
  scanTxt: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 14,
    overflow: "hidden",
  },
  scanClose: { backgroundColor: "rgba(0,0,0,0.55)", paddingHorizontal: 22, paddingVertical: 10, borderRadius: 18 },
  scanCloseTxt: { color: "#fff", fontWeight: "800" },

  // --- Caméra en direct façon Snap ---
  rail: {
    position: "absolute",
    top: 54,
    right: 10,
    alignItems: "flex-end",
    gap: 6,
  },
  railRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  railLabel: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    textShadowColor: "rgba(0,0,0,0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  railIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  railIconOn: { backgroundColor: "rgba(255,194,75,0.22)" },
  railIconTxt: { color: "#fff", fontSize: 13, fontWeight: "900" },
  camSheetBack: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  camSheet: {
    backgroundColor: "#15151B",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 34,
    gap: 4,
  },
  camSheetHandle: { alignSelf: "center", width: 38, height: 4, borderRadius: 2, backgroundColor: "#33333F", marginBottom: 10 },
  camSheetTitle: { color: "#fff", fontSize: 19, fontWeight: "900", marginBottom: 8 },
  camSetRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  camSetIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  camSetLabel: { color: "#fff", fontSize: 15, fontWeight: "800" },
  camSetSub: { color: "#9B9BAA", fontSize: 12, marginTop: 2 },
  camSetHint: { color: "#9B9BAA", fontSize: 12, textAlign: "center", marginTop: 10 },
  sideCol: {
    position: "absolute",
    top: 54,
    right: 14,
    gap: 14,
    alignItems: "center",
  },
  sideBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  sideBtnActive: { backgroundColor: "rgba(255,46,77,0.75)" },
  sideBtnTxt: { color: "#fff", fontSize: 12, fontWeight: "900" },
  liveMusicChip: {
    position: "absolute",
    top: 58,
    alignSelf: "center",
    maxWidth: SCREEN_W - 150,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  liveMusicTxt: { color: "#fff", fontSize: 12, fontWeight: "700", flexShrink: 1 },
  liveLensNameWrap: {
    position: "absolute",
    bottom: 182,
    left: 40,
    right: 40,
    alignItems: "center",
  },
  liveLensName: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowRadius: 6,
  },
  carouselWrap: {
    position: "absolute",
    bottom: 78,
    left: 0,
    right: 0,
    height: 96,
    justifyContent: "center",
  },
  carouselItem: {
    width: LENS_ITEM,
    height: 96,
    alignItems: "center",
    justifyContent: "center",
  },
  carouselBadge: { position: "absolute", top: -4, left: -4 },
  carouselLeft: { position: "absolute", top: 27 },
  shutterHolder: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
  },
  lensCatRow: {
    position: "absolute",
    bottom: 26,
    left: 12,
    right: 12,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
  },
  lensCatIcon: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  lensCatScroll: { alignItems: "center", gap: 4, paddingHorizontal: 6 },
  lensCatPill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  lensCatPillActive: {
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.85)",
  },
  lensCatTxt: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 16,
    fontWeight: "800",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 4,
  },
  lensCatTxtActive: { color: "#fff" },

  zoomRow: {
    position: "absolute",
    bottom: 212,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  zoomChip: {
    minWidth: 38,
    height: 38,
    paddingHorizontal: 6,
    borderRadius: 19,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  zoomChipActive: { backgroundColor: "rgba(255,194,75,0.9)" },
  zoomChipTxt: { color: "#fff", fontSize: 12, fontWeight: "800" },
  zoomChipTxtActive: { color: "#000" },
  memoriesBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  captureOuter: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 5,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  captureOuterRec: { borderColor: colors.neonRed, transform: [{ scale: 1.1 }] },
  captureInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.92)",
  },
  captureInnerLens: { backgroundColor: "transparent" },
  captureInnerRec: { width: 30, height: 30, borderRadius: 8, backgroundColor: colors.neonRed },
  gridLineV: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  gridLineH: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  countdownWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  countdownTxt: {
    color: "#fff",
    fontSize: 96,
    fontWeight: "900",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 10,
  },
  dropMenu: {
    position: "absolute",
    top: 54,
    right: 68,
    width: 280,
    maxHeight: SCREEN_H - 330,
  },
  dropMenuContent: { alignItems: "flex-end", gap: 6, paddingBottom: 4 },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  menuLabel: {
    maxWidth: 230,
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.85)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: "hidden",
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  menuIconWrapActive: { backgroundColor: "rgba(255,46,77,0.85)" },
  menuHd: { color: "#fff", fontSize: 11, fontWeight: "900" },
  memoriesWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#0c0b0a",
    zIndex: 40,
  },
  memoriesHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 58,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  memoriesTitle: { color: "#fff", fontSize: 22, fontWeight: "800" },
  memoriesEmpty: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 14,
    textAlign: "center",
    marginTop: 60,
    paddingHorizontal: 30,
    lineHeight: 20,
  },
  memoryCell: { flex: 1 / 3, aspectRatio: 0.6, padding: 3 },
  memoryImg: { flex: 1, borderRadius: 8 },
  burstWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
    padding: 20,
  },
  burstTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  burstRow: { flexDirection: "row", gap: 10 },
  burstItem: {
    width: (SCREEN_W - 40 - 20) / 3,
    aspectRatio: 0.6,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
  },
  burstImg: { width: "100%", height: "100%" },
  burstCancel: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  burstCancelTxt: { color: "#fff", fontWeight: "700" },
  editTop: {
    position: "absolute",
    top: 54,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  editToolbar: {
    position: "absolute",
    top: 54,
    bottom: 104,
    right: 12,
    width: 42,
  },
  toolBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  toolBtnActive: { backgroundColor: "rgba(255,46,77,0.75)" },
  toolBtnPressed: { transform: [{ scale: 0.88 }], opacity: 0.7 },
  toolTxt: { fontSize: 12, color: "#fff", fontWeight: "900" },
  drawHint: {
    position: "absolute",
    top: 108,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  drawHintTxt: { color: "#fff", fontSize: 12, fontWeight: "600" },
  drawTools: { flexDirection: "row", gap: 8, paddingHorizontal: 12 },
  drawToolBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  drawToolBtnOn: { backgroundColor: "#fff" },
  drawToolTxt: { color: "#fff", fontSize: 13, fontWeight: "800" },
  drawBlurHint: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "700", paddingHorizontal: 14, paddingBottom: 4 },
  drawBar: {
    position: "absolute",
    bottom: 100,
    left: 16,
    right: 64,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 16,
    paddingVertical: 10,
    gap: 10,
  },
  drawBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
  },
  sizeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  sizeBtnActive: { backgroundColor: "rgba(255,46,77,0.6)" },
  trash: {
    position: "absolute",
    bottom: 112,
    alignSelf: "center",
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
  },
  toast: {
    position: "absolute",
    top: 150,
    alignSelf: "center",
    maxWidth: SCREEN_W - 100,
    backgroundColor: "rgba(0,0,0,0.78)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  toastTxt: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  contextBar: {
    position: "absolute",
    bottom: 100,
    left: 16,
    right: 64,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  ctxBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  panel: {
    position: "absolute",
    bottom: 160,
    left: 16,
    right: 64,
    backgroundColor: "rgba(0,0,0,0.78)",
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  panelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  textInputOverlay: {
    position: "absolute",
    top: "40%",
    left: 20,
    right: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  textInputField: {
    flex: 1,
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  textDoneBtn: {
    backgroundColor: colors.neonRed,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
  },
  textDoneTxt: { color: "#fff", fontWeight: "900" },
  durationLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "700",
  },
  durationChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  durationChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  durationChipActive: {
    backgroundColor: "rgba(255,46,77,0.5)",
    borderColor: colors.neonRed,
  },
  durationChipTxt: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontWeight: "700",
  },
  durationChipTxtActive: { color: "#fff" },
  stickerAddBtn: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: "rgba(255,46,77,0.45)",
    borderWidth: 1,
    borderColor: colors.neonRed,
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  stickerAddTxt: { color: "#fff", fontWeight: "800", fontSize: 13 },
  myStickerCell: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: 4,
  },
  myStickerImg: { flex: 1 },
  stickerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stickerOption: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  stickerOptionTxt: { fontSize: 24 },
  stickerHint: { color: "rgba(255,255,255,0.5)", fontSize: 11, lineHeight: 15 },
  gifSearchInput: {
    color: "#fff",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
  },
  gifThumbWrap: { flex: 1 / 3, aspectRatio: 1, padding: 3 },
  gifThumb: { flex: 1, borderRadius: 6 },
  colorDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.25)",
  },
  colorDotActive: { borderColor: "#fff", borderWidth: 3 },
  layerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  layerLabel: { flex: 1, color: "#fff", fontSize: 13 },
  musicBadge: {
    position: "absolute",
    top: 108,
    left: 16,
    right: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  musicName: { flex: 1, color: "#fff", fontSize: 12, fontWeight: "700" },
  previewBottom: {
    position: "absolute",
    bottom: 34,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  saveCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  storyPill: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  storyPillTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
  sendPill: {
    flex: 1.2,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.neonRed,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  sendPillTxt: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 14,
    flexShrink: 1,
  },
  textModeWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "space-between",
    zIndex: 50,
  },
  textModeTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 58,
    paddingHorizontal: 20,
  },
  textModeCancel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 16,
    fontWeight: "600",
  },
  textModeOk: {
    backgroundColor: "#fff",
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  textModeOkTxt: { color: "#000", fontSize: 15, fontWeight: "900" },
  textModeCenter: { flex: 1, justifyContent: "center", paddingHorizontal: 20 },
  textModeInput: {
    fontSize: 26,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    maxHeight: 260,
  },
  textModeInputBar: { marginHorizontal: -20, borderRadius: 0 },
  textModeTools: { gap: 12, paddingBottom: 12 },
  textModeRow: { gap: 10, paddingHorizontal: 20, alignItems: "center" },

  // Barre de légende façon Snap
  captionBar: {
    width: SCREEN_W,
    backgroundColor: CAPTION_BAR_BG,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },

  // Filtres « infos » (heure, date, lieu)
  infoWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: SCREEN_H * 0.16,
    alignItems: "center",
  },
  infoTime: {
    color: "#fff",
    fontSize: 84,
    fontWeight: "900",
    letterSpacing: -2,
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowRadius: 12,
  },
  infoDay: {
    color: "#fff",
    fontSize: 44,
    fontWeight: "900",
    textTransform: "capitalize",
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowRadius: 10,
  },
  infoDate: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 2,
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowRadius: 8,
  },
  infoPlace: {
    color: "#fff",
    fontSize: 38,
    fontWeight: "900",
    textAlign: "center",
    paddingHorizontal: 24,
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowRadius: 10,
  },
});
