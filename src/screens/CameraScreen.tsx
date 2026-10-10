import { useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  Image,
  ScrollView,
  TextInput,
  PanResponder,
  Animated,
  Alert,
  FlatList,
} from "react-native";
import {
  CameraView,
  CameraType,
  FlashMode,
  useCameraPermissions,
} from "expo-camera";
import * as MediaLibrary from "expo-media-library";
import * as DocumentPicker from "expo-document-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { Image as ExpoImage } from "expo-image";
import { Audio } from "expo-av";
import Svg, { Path } from "react-native-svg";
import { colors } from "../theme/colors";
import { useAuth } from "../services/AuthContext";
import { createPhotoStory, uploadStoryMusic } from "../services/storyService";
import { uploadSnapImage, sendSnapToFriend } from "../services/snapService";

const FILTERS = [
  { key: "none", label: "Normal", color: null as string | null },
  { key: "warm", label: "Chaud", color: "rgba(255,140,0,0.18)" },
  { key: "cool", label: "Froid", color: "rgba(0,140,255,0.18)" },
  { key: "bw", label: "N&B", color: "rgba(120,120,120,0.35)" },
  { key: "vivid", label: "Vif", color: "rgba(232,0,10,0.15)" },
  { key: "vintage", label: "Vintage", color: "rgba(180,140,80,0.28)" },
  { key: "vignette", label: "Vignette", color: "rgba(0,0,0,0.2)" },
];

const ZOOM_PRESETS = [
  { label: ".5", value: 0 },
  { label: "1x", value: 0.15 },
  { label: "2", value: 0.35 },
];
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
  "#E8000A",
  "#FFD700",
  "#28F7A1",
  "#00A8FF",
];
const STICKER_EMOJIS = [
  "😎",
  "🐶",
  "🐱",
  "👑",
  "❤️",
  "🔥",
  "🌈",
  "🎉",
  "😂",
  "🕶️",
  "🎩",
  "⭐",
];

const TEXT_STYLE_PRESETS: {
  label: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}[] = [
  { label: "Classique", bold: false, italic: false, underline: false },
  { label: "Gras", bold: true, italic: false, underline: false },
  { label: "Élégant", bold: false, italic: true, underline: false },
  { label: "Souligné", bold: true, italic: false, underline: true },
];

function soon(feature: string) {
  Alert.alert(feature, "Bientôt disponible sur VimoX 🚧");
}
function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

type ElKind = "text" | "sticker" | "gif";
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
  text?: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  outline?: boolean;
  shadow?: boolean;
  bgColor?: string | null;
  align?: "left" | "center" | "right";
  emoji?: string;
  gifUrl?: string;
}

function makeText(partial?: Partial<CanvasEl>): CanvasEl {
  return {
    id: uid(),
    kind: "text",
    x: 100,
    y: 250,
    rotation: 0,
    scale: 1,
    zIndex: Date.now(),
    text: "Texte",
    color: "#ffffff",
    bold: true,
    italic: false,
    underline: false,
    outline: false,
    shadow: true,
    bgColor: null,
    align: "left",
    ...partial,
  };
}

interface DrawPath {
  d: string;
  points: { x: number; y: number }[];
}

export function CameraScreen({
  navigation,
  route,
}: {
  navigation: any;
  route?: any;
}) {
  const directSendTo = route?.params?.directSendTo as
    | { friendId: string; friendName: string }
    | undefined;
  const { profile } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [mediaPermission, requestMediaPermission] =
    MediaLibrary.usePermissions();
  const cameraRef = useRef<CameraView>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const [facing, setFacing] = useState<CameraType>("back");
  const [flash, setFlash] = useState<FlashMode>("off");
  const [zoom, setZoom] = useState(0.15);
  const pinchStartZoom = useRef(0.15);
  const pinchStartDist = useRef(0);
  const [hd, setHd] = useState(false);
  const [nightMode, setNightMode] = useState(false);
  const [filterIdx, setFilterIdx] = useState(0);
  const [durationIdx, setDurationIdx] = useState(1);
  const [showDuration, setShowDuration] = useState(false);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");
  const [showMentionInput, setShowMentionInput] = useState(false);
  const [mentionDraft, setMentionDraft] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [hapticFeedback, setHapticFeedback] = useState(true);
  const [handsFree, setHandsFree] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [showGrid, setShowGrid] = useState(false);
  const [mirrorSelfie, setMirrorSelfie] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [elements, setElements] = useState<CanvasEl[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const historyRef = useRef<CanvasEl[][]>([[]]);
  const historyIndexRef = useRef(0);
  const [, bump] = useState(0);
  const [showLayers, setShowLayers] = useState(false);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [gifQuery, setGifQuery] = useState("");
  const [gifResults, setGifResults] = useState<{ id: string; url: string }[]>(
    [],
  );
  const [gifLoading, setGifLoading] = useState(false);

  const [musicUri, setMusicUri] = useState<string | null>(null);
  const [musicName, setMusicName] = useState<string | null>(null);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [uploadingMusic, setUploadingMusic] = useState(false);

  // --- Dessin (crayon + gomme) ---
  const [drawMode, setDrawMode] = useState(false);
  const [drawTool, setDrawTool] = useState<"pen" | "eraser">("pen");
  const [drawPaths, setDrawPaths] = useState<DrawPath[]>([]);
  const currentPath = useRef("");
  const currentPoints = useRef<{ x: number; y: number }[]>([]);
  const [, forceRedraw] = useState(0);

  function distToSegment(
    p: { x: number; y: number },
    pts: { x: number; y: number }[],
  ) {
    let min = Infinity;
    for (const pt of pts) {
      const d = Math.hypot(pt.x - p.x, pt.y - p.y);
      if (d < min) min = d;
    }
    return min;
  }

  const drawResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => drawMode,
      onMoveShouldSetPanResponder: () => drawMode,
      onPanResponderGrant: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        if (drawTool === "eraser") {
          setDrawPaths((prev) =>
            prev.filter(
              (p) =>
                distToSegment({ x: locationX, y: locationY }, p.points) > 22,
            ),
          );
          return;
        }
        currentPath.current = `M${locationX},${locationY}`;
        currentPoints.current = [{ x: locationX, y: locationY }];
        forceRedraw((n) => n + 1);
      },
      onPanResponderMove: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        if (drawTool === "eraser") {
          setDrawPaths((prev) =>
            prev.filter(
              (p) =>
                distToSegment({ x: locationX, y: locationY }, p.points) > 22,
            ),
          );
          return;
        }
        currentPath.current += ` L${locationX},${locationY}`;
        currentPoints.current.push({ x: locationX, y: locationY });
        forceRedraw((n) => n + 1);
      },
      onPanResponderRelease: () => {
        if (drawTool === "eraser") return;
        if (currentPath.current) {
          setDrawPaths((prev) => [
            ...prev,
            { d: currentPath.current, points: currentPoints.current },
          ]);
        }
        currentPath.current = "";
        currentPoints.current = [];
      },
    }),
  ).current;

  const [cropping, setCropping] = useState(false);

  const activeFilter = FILTERS[filterIdx];
  const selectedEl = elements.find((e) => e.id === selectedId) ?? null;

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

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

  function distanceBetween(touches: any[]) {
    const [a, b] = touches;
    return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
  }
  const pinchResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (e) => e.nativeEvent.touches.length === 2,
      onMoveShouldSetPanResponder: (e) => e.nativeEvent.touches.length === 2,
      onPanResponderGrant: (e) => {
        if (e.nativeEvent.touches.length === 2) {
          pinchStartDist.current = distanceBetween(e.nativeEvent.touches);
          pinchStartZoom.current = zoom;
        }
      },
      onPanResponderMove: (e) => {
        if (e.nativeEvent.touches.length !== 2 || pinchStartDist.current === 0)
          return;
        const dist = distanceBetween(e.nativeEvent.touches);
        const delta = (dist - pinchStartDist.current) / 200;
        const next = Math.min(
          MAX_ZOOM,
          Math.max(MIN_ZOOM, pinchStartZoom.current + delta),
        );
        setZoom(next);
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

  async function capture() {
    if (!cameraRef.current) return;
    if (hapticFeedback)
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const photo = await cameraRef.current.takePictureAsync({
      quality: hd ? 1 : 0.85,
    });
    if (!photo) return;
    setPhotoUri(photo.uri);
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

  async function startRecording() {
    if (!cameraRef.current) return;
    setIsRecording(true);
    try {
      const video = await cameraRef.current.recordAsync();
      if (video) setPhotoUri(video.uri);
    } catch {
    } finally {
      setIsRecording(false);
    }
  }
  function stopRecording() {
    cameraRef.current?.stopRecording();
  }
  function onCapturePress() {
    if (handsFree) {
      isRecording ? stopRecording() : startRecording();
      return;
    }
    takePhotoWithTimer();
  }
  function onCapturePressIn() {
    if (handsFree) return;
    holdTimer.current = setTimeout(() => startRecording(), 300);
  }
  function onCapturePressOut() {
    if (handsFree) return;
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    isRecording ? stopRecording() : takePhotoWithTimer();
  }

  async function applyCrop(ratio: number) {
    if (!photoUri) return;
    try {
      const manipulated = await ImageManipulator.manipulateAsync(
        photoUri,
        [{ resize: { width: 1080 } }],
        { compress: 0.9 },
      );
      const targetHeight = Math.round(1080 / ratio);
      const cropped = await ImageManipulator.manipulateAsync(
        manipulated.uri,
        [
          {
            crop: {
              originX: 0,
              originY: 0,
              width: 1080,
              height: Math.min(targetHeight, 1920),
            },
          },
        ],
        { compress: 0.9 },
      );
      setPhotoUri(cropped.uri);
    } catch {
      Alert.alert("Erreur", "Impossible de rogner cette image.");
    }
  }

  async function pickMusic() {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      setMusicUri(asset.uri);
      setMusicName(asset.name ?? "Musique");
      await soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
    } catch {
      Alert.alert("Erreur", "Impossible de sélectionner ce fichier audio.");
    }
  }

  async function toggleMusicPreview() {
    if (!musicUri) return;
    try {
      if (!soundRef.current) {
        const { sound } = await Audio.Sound.createAsync(
          { uri: musicUri },
          { shouldPlay: true, isLooping: true },
        );
        soundRef.current = sound;
        setMusicPlaying(true);
        return;
      }
      if (musicPlaying) {
        await soundRef.current.pauseAsync();
        setMusicPlaying(false);
      } else {
        await soundRef.current.playAsync();
        setMusicPlaying(true);
      }
    } catch {
      Alert.alert("Erreur", "Impossible de lire cet audio.");
    }
  }
  async function removeMusic() {
    await soundRef.current?.unloadAsync().catch(() => {});
    soundRef.current = null;
    setMusicUri(null);
    setMusicName(null);
    setMusicPlaying(false);
  }

  async function saveToDevice() {
    if (!photoUri) return;
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
    try {
      await MediaLibrary.saveToLibraryAsync(photoUri!);
      Alert.alert("✅ Enregistré", "Snap sauvegardé dans ta galerie.");
    } catch {
      Alert.alert("Erreur", "Impossible d'enregistrer ce Snap.");
    }
  }

  function overlaysAsText() {
    return elements
      .filter((e) => e.kind === "text" && !e.hidden)
      .map((e) => e.text)
      .filter(Boolean)
      .join(" · ");
  }

  async function postStory() {
    if (!photoUri || !profile) return;
    setPosting(true);
    try {
      let musicURL: string | null = null;
      if (musicUri) {
        setUploadingMusic(true);
        musicURL = await uploadStoryMusic(musicUri);
        setUploadingMusic(false);
      }
      await createPhotoStory(
        profile.id,
        profile.name,
        profile.profilePhotoURL,
        photoUri,
        overlaysAsText(),
        undefined,
        undefined,
        musicURL,
      );
      resetAfterPost();
    } catch {
      Alert.alert("Erreur", "Impossible de publier ce Snap.");
    } finally {
      setPosting(false);
      setUploadingMusic(false);
    }
  }

  async function sendToFriend() {
    if (!photoUri || !profile) return;
    setPosting(true);
    try {
      const url = await uploadSnapImage(photoUri);
      if (directSendTo) {
        await sendSnapToFriend(profile.id, directSendTo.friendId, url);
        await resetAfterPost();
        navigation.goBack();
      } else {
        navigation.navigate("SendTo", { imageURL: url });
        resetAfterPost();
      }
    } catch {
      Alert.alert("Erreur", "Impossible d'envoyer ce Snap.");
    } finally {
      setPosting(false);
    }
  }

  async function resetAfterPost() {
    setPhotoUri(null);
    setElements([]);
    historyRef.current = [[]];
    historyIndexRef.current = 0;
    setSelectedId(null);
    setDurationIdx(1);
    setDrawPaths([]);
    setDrawMode(false);
    setDrawTool("pen");
    await removeMusic();
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
        x: 60,
        y: 120,
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
        x: 60,
        y: 170,
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
          x: 60,
          y: 220,
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
      x: 80,
      y: 300,
      rotation: 0,
      scale: 1,
      zIndex: Date.now(),
      gifUrl: url,
    });
    setShowGifPicker(false);
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

  if (photoUri) {
    const sortedEls = [...elements].sort((a, b) => a.zIndex - b.zIndex);
    return (
      <View style={styles.root}>
        <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} />
        {activeFilter.color && (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: activeFilter.color },
            ]}
          />
        )}

        {sortedEls
          .filter((e) => !e.hidden)
          .map((el) => (
            <CanvasElementView
              key={el.id}
              el={el}
              selected={selectedId === el.id}
              onSelect={() => setSelectedId(el.id)}
              onMove={(x, y) => updateElement(el.id, { x, y })}
              onMoveEnd={(x, y) => commitElementDrag(el.id, { x, y })}
              onTransform={(rotation, scale) =>
                updateElement(el.id, { rotation, scale })
              }
              onTransformEnd={(rotation, scale) =>
                commitElementDrag(el.id, { rotation, scale })
              }
            />
          ))}

        <View style={styles.editTop}>
          <Pressable
            style={({ pressed }) => [
              styles.roundBtn,
              pressed && styles.roundBtnPressed,
            ]}
            onPress={() => setPhotoUri(null)}
          >
            <Text style={styles.roundBtnTxt}>✕</Text>
          </Pressable>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              style={({ pressed }) => [
                styles.roundBtn,
                pressed && styles.roundBtnPressed,
              ]}
              onPress={undo}
            >
              <Text style={styles.roundBtnTxt}>↶</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.roundBtn,
                pressed && styles.roundBtnPressed,
              ]}
              onPress={redo}
            >
              <Text style={styles.roundBtnTxt}>↷</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.roundBtn,
                pressed && styles.roundBtnPressed,
              ]}
              onPress={() => setShowLayers(true)}
            >
              <Text style={styles.roundBtnTxt}>☰</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.roundBtn,
                pressed && styles.roundBtnPressed,
              ]}
              onPress={saveToDevice}
            >
              <Text style={styles.roundBtnTxt}>⬇️</Text>
            </Pressable>
          </View>
        </View>

        {musicName && (
          <Pressable style={styles.musicBadge} onPress={toggleMusicPreview}>
            <Text style={styles.musicIcon}>{musicPlaying ? "⏸️" : "▶️"}</Text>
            <Text style={styles.musicName} numberOfLines={1}>
              {musicName}
            </Text>
            <Pressable onPress={removeMusic} hitSlop={8}>
              <Text style={styles.musicRemove}>✕</Text>
            </Pressable>
          </Pressable>
        )}

        {selectedEl && (
          <View style={styles.contextBar}>
            <Pressable
              style={styles.ctxBtn}
              onPress={() => bringToFront(selectedEl.id)}
            >
              <Text style={styles.ctxTxt}>⬆️</Text>
            </Pressable>
            <Pressable
              style={styles.ctxBtn}
              onPress={() => sendToBack(selectedEl.id)}
            >
              <Text style={styles.ctxTxt}>⬇️</Text>
            </Pressable>
            <Pressable
              style={styles.ctxBtn}
              onPress={() => duplicateElement(selectedEl.id)}
            >
              <Text style={styles.ctxTxt}>⧉</Text>
            </Pressable>
            <Pressable
              style={styles.ctxBtn}
              onPress={() => toggleLock(selectedEl.id)}
            >
              <Text style={styles.ctxTxt}>
                {selectedEl.locked ? "🔒" : "🔓"}
              </Text>
            </Pressable>
            {selectedEl.kind === "text" && (
              <Pressable
                style={styles.ctxBtn}
                onPress={() => setShowTextEditor(true)}
              >
                <Text style={styles.ctxTxt}>🎨</Text>
              </Pressable>
            )}
            <Pressable
              style={styles.ctxBtn}
              onPress={() => removeElement(selectedEl.id)}
            >
              <Text style={styles.ctxTxt}>🗑️</Text>
            </Pressable>
            <Pressable
              style={styles.ctxBtn}
              onPress={() => setSelectedId(null)}
            >
              <Text style={styles.ctxTxt}>✕</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.editToolbar}>
          <Pressable
            style={({ pressed }) => [
              styles.toolBtn,
              pressed && styles.toolBtnPressed,
            ]}
            onPress={() => addElement(makeText())}
          >
            <Text style={styles.toolTxt}>Aa</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.toolBtn,
              drawMode && drawTool === "pen" && styles.toolBtnActive,
              pressed && styles.toolBtnPressed,
            ]}
            onPress={() => {
              if (drawMode && drawTool === "pen") {
                setDrawMode(false);
              } else {
                setDrawMode(true);
                setDrawTool("pen");
              }
            }}
          >
            <Text style={styles.toolTxt}>✏️</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.toolBtn,
              drawMode && drawTool === "eraser" && styles.toolBtnActive,
              pressed && styles.toolBtnPressed,
            ]}
            onPress={() => {
              if (drawMode && drawTool === "eraser") {
                setDrawMode(false);
              } else {
                setDrawMode(true);
                setDrawTool("eraser");
              }
            }}
          >
            <Text style={styles.toolTxt}>🧹</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.toolBtn,
              pressed && styles.toolBtnPressed,
            ]}
            onPress={() => setShowStickerPicker(true)}
          >
            <Text style={styles.toolTxt}>😀</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.toolBtn,
              pressed && styles.toolBtnPressed,
            ]}
            onPress={() => setShowGifPicker(true)}
          >
            <Text style={styles.toolTxt}>GIF</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.toolBtn,
              pressed && styles.toolBtnPressed,
            ]}
            onPress={() => soon("Découpe en autocollant")}
          >
            <Text style={styles.toolTxt}>✂️</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.toolBtn,
              musicName && styles.toolBtnActive,
              pressed && styles.toolBtnPressed,
            ]}
            onPress={pickMusic}
          >
            <Text style={styles.toolTxt}>🎵</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.toolBtn,
              pressed && styles.toolBtnPressed,
            ]}
            onPress={() => soon("Filtres visage / Lenses")}
          >
            <Text style={styles.toolTxt}>🙂</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.toolBtn,
              pressed && styles.toolBtnPressed,
            ]}
            onPress={() => setFilterIdx((i) => (i + 1) % FILTERS.length)}
          >
            <Text style={styles.toolTxt}>✨</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.toolBtn,
              pressed && styles.toolBtnPressed,
            ]}
            onPress={() => setShowLinkInput(true)}
          >
            <Text style={styles.toolTxt}>🔗</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.toolBtn,
              pressed && styles.toolBtnPressed,
            ]}
            onPress={() => setShowMentionInput(true)}
          >
            <Text style={styles.toolTxt}>@</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.toolBtn,
              pressed && styles.toolBtnPressed,
            ]}
            onPress={addTimeSticker}
          >
            <Text style={styles.toolTxt}>🕐</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.toolBtn,
              pressed && styles.toolBtnPressed,
            ]}
            onPress={addDateSticker}
          >
            <Text style={styles.toolTxt}>📅</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.toolBtn,
              pressed && styles.toolBtnPressed,
            ]}
            onPress={addLocationSticker}
          >
            <Text style={styles.toolTxt}>📍</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.toolBtn,
              pressed && styles.toolBtnPressed,
            ]}
            onPress={() => setCropping((v) => !v)}
          >
            <Text style={styles.toolTxt}>⬛</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.toolBtn,
              pressed && styles.toolBtnPressed,
            ]}
            onPress={() => setShowDuration((v) => !v)}
          >
            <Text style={styles.toolTxt}>⏱️</Text>
          </Pressable>
        </View>

        {drawMode && (
          <View style={styles.drawHint}>
            <Text style={styles.drawHintTxt}>
              {drawTool === "eraser"
                ? "🧹 Touche un trait pour l'effacer"
                : "✏️ Dessine avec le doigt"}
            </Text>
          </View>
        )}

        <View
          style={StyleSheet.absoluteFill}
          {...(drawMode ? drawResponder.panHandlers : {})}
          pointerEvents={drawMode ? "auto" : "none"}
        >
          <Svg style={StyleSheet.absoluteFill}>
            {drawPaths.map((p, i) => (
              <Path
                key={i}
                d={p.d}
                stroke="#fff"
                strokeWidth={5}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {currentPath.current && drawTool === "pen" ? (
              <Path
                d={currentPath.current}
                stroke="#fff"
                strokeWidth={5}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
          </Svg>
        </View>

        {cropping && (
          <View style={styles.cropPopup}>
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

        {showStickerPicker && (
          <View style={styles.stickerPicker}>
            <View style={styles.stickerPickerHeader}>
              <Text style={styles.durationLabel}>Autocollants</Text>
              <Pressable
                onPress={() => setShowStickerPicker(false)}
                hitSlop={8}
              >
                <Text style={styles.musicRemove}>✕</Text>
              </Pressable>
            </View>
            <View style={styles.stickerGrid}>
              {STICKER_EMOJIS.map((e) => (
                <Pressable
                  key={e}
                  style={styles.stickerOption}
                  onPress={() => {
                    addElement({
                      id: uid(),
                      kind: "sticker",
                      x: 140,
                      y: 260,
                      rotation: 0,
                      scale: 1,
                      zIndex: Date.now(),
                      emoji: e,
                    });
                    setShowStickerPicker(false);
                  }}
                >
                  <Text style={styles.stickerOptionTxt}>{e}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {showGifPicker && (
          <View style={styles.gifPicker}>
            <View style={styles.stickerPickerHeader}>
              <Text style={styles.durationLabel}>GIF</Text>
              <Pressable onPress={() => setShowGifPicker(false)} hitSlop={8}>
                <Text style={styles.musicRemove}>✕</Text>
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
                style={{ maxHeight: 220 }}
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

        {showTextEditor && selectedEl?.kind === "text" && (
          <View style={styles.textEditorPanel}>
            <TextInput
              value={selectedEl.text}
              onChangeText={(t) => updateElement(selectedEl.id, { text: t })}
              onEndEditing={() => commitElementDrag(selectedEl.id, {})}
              style={styles.textEditorInput}
              placeholder="Ton texte..."
              placeholderTextColor="rgba(255,255,255,0.5)"
            />
            <View style={styles.textColorRow}>
              {TEXT_COLORS.map((c) => (
                <Pressable
                  key={c}
                  style={[
                    styles.colorDot,
                    { backgroundColor: c },
                    selectedEl.color === c && styles.colorDotActive,
                  ]}
                  onPress={() => commitElementDrag(selectedEl.id, { color: c })}
                />
              ))}
            </View>

            <Text style={styles.durationLabel}>Changer de style</Text>
            <View style={styles.durationChips}>
              {TEXT_STYLE_PRESETS.map((preset) => {
                const active =
                  selectedEl.bold === preset.bold &&
                  selectedEl.italic === preset.italic &&
                  selectedEl.underline === preset.underline;
                return (
                  <Pressable
                    key={preset.label}
                    style={[
                      styles.durationChip,
                      active && styles.durationChipActive,
                    ]}
                    onPress={() =>
                      commitElementDrag(selectedEl.id, {
                        bold: preset.bold,
                        italic: preset.italic,
                        underline: preset.underline,
                      })
                    }
                  >
                    <Text
                      style={[
                        styles.durationChipTxt,
                        preset.bold && { fontWeight: "900" },
                        preset.italic && { fontStyle: "italic" },
                        preset.underline && { textDecorationLine: "underline" },
                      ]}
                    >
                      {preset.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.durationChips}>
              <Pressable
                style={[
                  styles.durationChip,
                  selectedEl.shadow && styles.durationChipActive,
                ]}
                onPress={() =>
                  commitElementDrag(selectedEl.id, {
                    shadow: !selectedEl.shadow,
                  })
                }
              >
                <Text style={styles.durationChipTxt}>Ombre</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.durationChip,
                  selectedEl.outline && styles.durationChipActive,
                ]}
                onPress={() =>
                  commitElementDrag(selectedEl.id, {
                    outline: !selectedEl.outline,
                  })
                }
              >
                <Text style={styles.durationChipTxt}>Contour</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.durationChip,
                  !!selectedEl.bgColor && styles.durationChipActive,
                ]}
                onPress={() =>
                  commitElementDrag(selectedEl.id, {
                    bgColor: selectedEl.bgColor ? null : "rgba(0,0,0,0.5)",
                  })
                }
              >
                <Text style={styles.durationChipTxt}>Fond</Text>
              </Pressable>
              {(["left", "center", "right"] as const).map((a) => (
                <Pressable
                  key={a}
                  style={[
                    styles.durationChip,
                    selectedEl.align === a && styles.durationChipActive,
                  ]}
                  onPress={() => commitElementDrag(selectedEl.id, { align: a })}
                >
                  <Text style={styles.durationChipTxt}>
                    {a === "left" ? "⬅" : a === "center" ? "⬌" : "➡"}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={() => setShowTextEditor(false)}
              style={styles.textDoneBtn}
            >
              <Text style={styles.textDoneTxt}>Terminé</Text>
            </Pressable>
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
              onSubmitEditing={() => {
                if (linkDraft.trim())
                  addElement(
                    makeText({
                      text: `🔗 ${linkDraft.trim()}`,
                      bgColor: "rgba(0,0,0,0.5)",
                    }),
                  );
                setLinkDraft("");
                setShowLinkInput(false);
              }}
            />
            <Pressable
              onPress={() => {
                if (linkDraft.trim())
                  addElement(
                    makeText({
                      text: `🔗 ${linkDraft.trim()}`,
                      bgColor: "rgba(0,0,0,0.5)",
                    }),
                  );
                setLinkDraft("");
                setShowLinkInput(false);
              }}
              style={styles.textDoneBtn}
            >
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
          <View style={styles.durationPopup}>
            <Text style={styles.durationLabel}>Durée du Snap</Text>
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
          <View style={styles.layersPanel}>
            <View style={styles.stickerPickerHeader}>
              <Text style={styles.durationLabel}>
                Calques ({elements.length})
              </Text>
              <Pressable onPress={() => setShowLayers(false)} hitSlop={8}>
                <Text style={styles.musicRemove}>✕</Text>
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 260 }}>
              {[...elements]
                .sort((a, b) => b.zIndex - a.zIndex)
                .map((el) => (
                  <View key={el.id} style={styles.layerRow}>
                    <Text style={styles.layerLabel} numberOfLines={1}>
                      {el.kind === "text"
                        ? `Aa ${el.text}`
                        : el.kind === "gif"
                          ? "GIF"
                          : el.emoji}
                    </Text>
                    <Pressable onPress={() => toggleHidden(el.id)} hitSlop={6}>
                      <Text style={styles.layerIcon}>
                        {el.hidden ? "🚫" : "👁️"}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => toggleLock(el.id)} hitSlop={6}>
                      <Text style={styles.layerIcon}>
                        {el.locked ? "🔒" : "🔓"}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => duplicateElement(el.id)}
                      hitSlop={6}
                    >
                      <Text style={styles.layerIcon}>⧉</Text>
                    </Pressable>
                    <Pressable onPress={() => removeElement(el.id)} hitSlop={6}>
                      <Text style={styles.layerIcon}>🗑️</Text>
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

        <View style={styles.previewBottom}>
          <Pressable
            style={({ pressed }) => [
              styles.sendToBtn,
              posting && { opacity: 0.6 },
              pressed && !posting && { opacity: 0.8 },
            ]}
            onPress={sendToFriend}
            disabled={posting}
          >
            <Text style={styles.sendToTxt}>
              {directSendTo
                ? `➤ Envoyer à ${directSendTo.friendName}`
                : "➤ Envoyer à un ami"}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.postBtn,
              posting && { opacity: 0.6 },
              pressed && !posting && { opacity: 0.85 },
            ]}
            onPress={postStory}
            disabled={posting}
          >
            <Text style={styles.postBtnTxt}>
              {posting
                ? uploadingMusic
                  ? "Envoi de la musique..."
                  : "Envoi..."
                : "✓ Ajouter à ma story"}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root} {...pinchResponder.panHandlers}>
      <CameraView
        ref={cameraRef}
        style={[
          StyleSheet.absoluteFill,
          facing === "front" && mirrorSelfie
            ? { transform: [{ scaleX: -1 }] }
            : null,
        ]}
        facing={facing}
        flash={flash}
        zoom={zoom}
        mode="video"
      />
      {activeFilter.color && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: activeFilter.color },
          ]}
        />
      )}
      {nightMode && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: "rgba(20,0,60,0.28)" },
          ]}
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
          <Text style={styles.recTxt}>REC</Text>
        </View>
      )}

      <View style={styles.topBar}>
        <Pressable
          style={({ pressed }) => [
            styles.roundBtn,
            pressed && styles.roundBtnPressed,
          ]}
          onPress={() =>
            setFlash((f) => (f === "off" ? "on" : f === "on" ? "auto" : "off"))
          }
        >
          <Text style={styles.roundBtnTxt}>
            {flash === "off" ? "⚡️" : flash === "on" ? "🔆" : "🔅"}
          </Text>
        </Pressable>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            style={({ pressed }) => [
              styles.roundBtn,
              pressed && styles.roundBtnPressed,
            ]}
            onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))}
          >
            <Text style={styles.roundBtnTxt}>🔄</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.roundBtn,
              showMenu && styles.roundBtnActive,
              pressed && styles.roundBtnPressed,
            ]}
            onPress={() => setShowMenu((v) => !v)}
          >
            <Text style={styles.roundBtnTxt}>{showMenu ? "︿" : "﹀"}</Text>
          </Pressable>
        </View>
      </View>

      {showMenu && (
        <View style={styles.dropMenu}>
          <MenuRow
            icon="⚡️"
            label={`Flash : ${flash === "off" ? "Off" : flash === "on" ? "On" : "Auto"}`}
            onPress={() =>
              setFlash((f) =>
                f === "off" ? "on" : f === "on" ? "auto" : "off",
              )
            }
          />
          <MenuRow
            icon="🔊"
            label={`Sons (vibration) : ${hapticFeedback ? "On" : "Off"}`}
            onPress={() => setHapticFeedback((v) => !v)}
          />
          <MenuRow
            icon="✋"
            label={`Mains libres : ${handsFree ? "On" : "Off"}`}
            onPress={() => setHandsFree((v) => !v)}
          />
          <MenuRow
            icon="HD"
            label={`Mode HD : ${hd ? "On" : "Off"}`}
            onPress={() => setHd((v) => !v)}
          />
          <MenuRow
            icon="🤳"
            label="Réglages des selfies"
            onPress={() =>
              Alert.alert("Réglages des selfies", "", [
                {
                  text: `Miroir selfie : ${mirrorSelfie ? "Désactiver" : "Activer"}`,
                  onPress: () => setMirrorSelfie((v) => !v),
                },
                {
                  text: `Mode nuit : ${nightMode ? "Désactiver" : "Activer"}`,
                  onPress: () => setNightMode((v) => !v),
                },
                { text: "Fermer", style: "cancel" },
              ])
            }
          />
          <MenuRow
            icon="⏱️"
            label={`Retardateur : ${timerSeconds === 0 ? "Off" : `${timerSeconds}s`}`}
            onPress={() => {
              const idx = TIMER_OPTIONS.indexOf(timerSeconds);
              setTimerSeconds(TIMER_OPTIONS[(idx + 1) % TIMER_OPTIONS.length]);
            }}
          />
          <MenuRow
            icon="🎛️"
            label={`Repères (grille) : ${showGrid ? "On" : "Off"}`}
            onPress={() => setShowGrid((v) => !v)}
          />
          <MenuRow
            icon="🔍"
            label="Pince pour zoomer (2 doigts)"
            onPress={() =>
              Alert.alert(
                "Astuce",
                "Pince avec 2 doigts sur l'écran pour zoomer/dézoomer.",
              )
            }
          />
          <MenuRow
            icon="📱"
            label="Multi Snap"
            onPress={() => soon("Multi Snap")}
          />
          <MenuRow
            icon="📷"
            label="Double caméra"
            onPress={() => soon("Double caméra")}
          />
          <MenuRow
            icon="⚡"
            label="Vitesse (ralenti/accéléré)"
            onPress={() => soon("Vitesse")}
          />
          <MenuRow
            icon="📳"
            label="Stabilisation"
            onPress={() => soon("Stabilisation")}
          />
          <MenuRow
            icon="🟩"
            label="Écran vert"
            onPress={() => soon("Écran vert")}
          />
        </View>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
      >
        {FILTERS.map((f, i) => (
          <Pressable
            key={f.key}
            onPress={() => setFilterIdx(i)}
            style={({ pressed }) => [
              styles.filterChip,
              i === filterIdx && styles.filterChipActive,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text
              style={[
                styles.filterTxt,
                i === filterIdx && styles.filterTxtActive,
              ]}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.zoomRow}>
        {ZOOM_PRESETS.map((z) => (
          <Pressable
            key={z.label}
            onPress={() => setZoom(z.value)}
            style={({ pressed }) => [
              styles.zoomChip,
              Math.abs(zoom - z.value) < 0.02 && styles.zoomChipActive,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text
              style={[
                styles.zoomChipTxt,
                Math.abs(zoom - z.value) < 0.02 && styles.zoomChipTxtActive,
              ]}
            >
              {z.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.captureBar}>
        <Pressable
          style={({ pressed }) => [
            styles.memoriesBtn,
            pressed && styles.roundBtnPressed,
          ]}
          onPress={() => soon("Souvenirs")}
        >
          <Text style={styles.memoriesTxt}>🗂️</Text>
        </Pressable>
        <Pressable
          style={[styles.captureOuter, isRecording && styles.captureOuterRec]}
          onPress={onCapturePress}
          onPressIn={onCapturePressIn}
          onPressOut={onCapturePressOut}
        >
          <View
            style={[styles.captureInner, isRecording && styles.captureInnerRec]}
          />
        </Pressable>
        <View style={{ width: 42 }} />
      </View>
    </View>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.7 }]}
      onPress={onPress}
    >
      <Text style={styles.menuIcon}>{icon}</Text>
      <Text style={styles.menuLabel}>{label}</Text>
    </Pressable>
  );
}

function CanvasElementView({
  el,
  selected,
  onSelect,
  onMove,
  onMoveEnd,
  onTransform,
  onTransformEnd,
}: {
  el: CanvasEl;
  selected: boolean;
  onSelect: () => void;
  onMove: (x: number, y: number) => void;
  onMoveEnd: (x: number, y: number) => void;
  onTransform: (rotation: number, scale: number) => void;
  onTransformEnd: (rotation: number, scale: number) => void;
}) {
  const startPos = useRef({ x: el.x, y: el.y });
  const startTransform = useRef({ rotation: el.rotation, scale: el.scale });

  const dragResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !el.locked,
      onMoveShouldSetPanResponder: () => !el.locked,
      onPanResponderGrant: () => {
        onSelect();
        startPos.current = { x: el.x, y: el.y };
      },
      onPanResponderMove: (_, g) => {
        onMove(startPos.current.x + g.dx, startPos.current.y + g.dy);
      },
      onPanResponderRelease: (_, g) => {
        onMoveEnd(startPos.current.x + g.dx, startPos.current.y + g.dy);
      },
    }),
  ).current;

  const resizeResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !el.locked,
      onMoveShouldSetPanResponder: () => !el.locked,
      onPanResponderGrant: () => {
        startTransform.current = { rotation: el.rotation, scale: el.scale };
      },
      onPanResponderMove: (_, g) => {
        const nextScale = Math.min(
          4,
          Math.max(0.3, startTransform.current.scale + -g.dy / 100),
        );
        onTransform(startTransform.current.rotation, nextScale);
      },
      onPanResponderRelease: (_, g) => {
        const nextScale = Math.min(
          4,
          Math.max(0.3, startTransform.current.scale + -g.dy / 100),
        );
        onTransformEnd(startTransform.current.rotation, nextScale);
      },
    }),
  ).current;

  const rotateResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !el.locked,
      onMoveShouldSetPanResponder: () => !el.locked,
      onPanResponderGrant: () => {
        startTransform.current = { rotation: el.rotation, scale: el.scale };
      },
      onPanResponderMove: (_, g) => {
        const nextRotation = startTransform.current.rotation + g.dx / 2;
        onTransform(nextRotation, startTransform.current.scale);
      },
      onPanResponderRelease: (_, g) => {
        const nextRotation = startTransform.current.rotation + g.dx / 2;
        onTransformEnd(nextRotation, startTransform.current.scale);
      },
    }),
  ).current;

  const wrapStyle = {
    position: "absolute" as const,
    left: el.x,
    top: el.y,
    transform: [{ rotate: `${el.rotation}deg` }, { scale: el.scale }],
  };

  return (
    <View style={wrapStyle}>
      <View {...dragResponder.panHandlers}>
        {el.kind === "text" && <TextLayer el={el} />}
        {el.kind === "sticker" && (
          <Text style={{ fontSize: 56 }}>{el.emoji}</Text>
        )}
        {el.kind === "gif" && (
          <ExpoImage
            source={{ uri: el.gifUrl }}
            style={{ width: 120, height: 120, borderRadius: 8 }}
            contentFit="cover"
          />
        )}
      </View>
      {selected && !el.locked && (
        <>
          <View style={elStyles.resizeHandle} {...resizeResponder.panHandlers}>
            <Text style={elStyles.handleTxt}>⤡</Text>
          </View>
          <View style={elStyles.rotateHandle} {...rotateResponder.panHandlers}>
            <Text style={elStyles.handleTxt}>↻</Text>
          </View>
        </>
      )}
    </View>
  );
}

function TextLayer({ el }: { el: CanvasEl }) {
  const base = {
    color: el.color ?? "#fff",
    fontSize: 22,
    fontWeight: el.bold ? ("900" as const) : ("500" as const),
    fontStyle: el.italic ? ("italic" as const) : ("normal" as const),
    textDecorationLine: el.underline
      ? ("underline" as const)
      : ("none" as const),
    textAlign: el.align ?? "left",
  };
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
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
      }}
    >
      {content}
    </View>
  ) : (
    content
  );

  if (!el.outline) return wrapper;

  return (
    <View>
      <View style={{ position: "absolute", top: -1, left: 0 }}>
        <Text style={[base, { color: "#000" }]}>{el.text}</Text>
      </View>
      <View style={{ position: "absolute", top: 1, left: 0 }}>
        <Text style={[base, { color: "#000" }]}>{el.text}</Text>
      </View>
      <View style={{ position: "absolute", top: 0, left: -1 }}>
        <Text style={[base, { color: "#000" }]}>{el.text}</Text>
      </View>
      <View style={{ position: "absolute", top: 0, left: 1 }}>
        <Text style={[base, { color: "#000" }]}>{el.text}</Text>
      </View>
      {wrapper}
    </View>
  );
}

const elStyles = StyleSheet.create({
  resizeHandle: {
    position: "absolute",
    bottom: -18,
    right: -18,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  rotateHandle: {
    position: "absolute",
    top: -18,
    right: -18,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  handleTxt: { color: "#fff", fontSize: 14 },
});

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
  topBar: {
    position: "absolute",
    top: 54,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  roundBtn: {
    minWidth: 42,
    height: 42,
    paddingHorizontal: 8,
    borderRadius: 21,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  roundBtnActive: { backgroundColor: "rgba(139,38,53,0.6)" },
  roundBtnPressed: { transform: [{ scale: 0.88 }], opacity: 0.7 },
  roundBtnTxt: { fontSize: 15, color: "#fff", fontWeight: "800" },
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
  filterBar: { position: "absolute", bottom: 172, left: 0, right: 0 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  filterChipActive: {
    backgroundColor: "rgba(139,38,53,0.4)",
    borderColor: colors.neonRed,
  },
  filterTxt: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "700",
  },
  filterTxtActive: { color: "#fff" },
  zoomRow: {
    position: "absolute",
    bottom: 130,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  zoomChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  zoomChipActive: { backgroundColor: "rgba(201,185,140,0.85)" },
  zoomChipTxt: { color: "#fff", fontSize: 12, fontWeight: "800" },
  zoomChipTxtActive: { color: "#000" },
  captureBar: {
    position: "absolute",
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 40,
  },
  memoriesBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },
  memoriesTxt: { fontSize: 18 },
  captureOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  captureOuterRec: { borderColor: colors.neonRed },
  captureInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "#fff",
  },
  captureInnerRec: { borderRadius: 12, backgroundColor: colors.neonRed },
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
    top: 100,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 16,
    paddingVertical: 8,
    minWidth: 230,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  menuIcon: { fontSize: 14, width: 24, textAlign: "center", color: "#fff" },
  menuLabel: { color: "#fff", fontSize: 12, fontWeight: "600" },
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
    top: 100,
    right: 14,
    gap: 12,
    alignItems: "center",
  },
  toolBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  toolBtnActive: { backgroundColor: "rgba(139,38,53,0.6)" },
  toolBtnPressed: { transform: [{ scale: 0.85 }], opacity: 0.7 },
  toolTxt: { fontSize: 15, color: "#fff", fontWeight: "700" },
  drawHint: {
    position: "absolute",
    top: 60,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  drawHintTxt: { color: "#fff", fontSize: 12, fontWeight: "600" },
  contextBar: {
    position: "absolute",
    bottom: 130,
    left: 20,
    right: 20,
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
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
  ctxTxt: { fontSize: 16 },
  textInputOverlay: {
    position: "absolute",
    top: "40%",
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  textInputField: {
    flex: 1,
    color: "#fff",
    fontSize: 18,
    fontWeight: "800",
    backgroundColor: "rgba(0,0,0,0.4)",
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
  durationPopup: {
    position: "absolute",
    bottom: 150,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  cropPopup: {
    position: "absolute",
    bottom: 150,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
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
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  durationChipActive: {
    backgroundColor: "rgba(139,38,53,0.4)",
    borderColor: colors.neonRed,
  },
  durationChipTxt: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    fontWeight: "700",
  },
  durationChipTxtActive: { color: "#fff" },
  stickerPicker: {
    position: "absolute",
    bottom: 150,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  stickerPickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
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
  gifPicker: {
    position: "absolute",
    bottom: 150,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
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
  textEditorPanel: {
    position: "absolute",
    bottom: 150,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  textEditorInput: {
    color: "#fff",
    fontSize: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  textColorRow: { flexDirection: "row", gap: 8 },
  colorDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorDotActive: { borderColor: "#fff" },
  layersPanel: {
    position: "absolute",
    bottom: 150,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  layerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  layerLabel: { flex: 1, color: "#fff", fontSize: 13 },
  layerIcon: { fontSize: 15 },
  musicBadge: {
    position: "absolute",
    top: 108,
    left: 16,
    right: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  musicIcon: { fontSize: 14 },
  musicName: { flex: 1, color: "#fff", fontSize: 12, fontWeight: "700" },
  musicRemove: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
    paddingHorizontal: 4,
  },
  previewBottom: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    gap: 10,
  },
  sendToBtn: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  sendToTxt: { color: "#fff", fontWeight: "800", fontSize: 14 },
  postBtn: {
    backgroundColor: colors.neonRed,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  postBtnTxt: { color: "#fff", fontWeight: "900", fontSize: 15 },
});
