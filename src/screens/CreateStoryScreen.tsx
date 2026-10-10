import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  ScrollView,
  Dimensions,
} from "react-native";
import { Image } from "react-native";
import {
  CameraView,
  CameraType,
  FlashMode,
  useCameraPermissions,
} from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../services/AuthContext";
import { createPhotoStory, createTextStory } from "../services/storyService";

const { width } = Dimensions.get("window");
const PREVIEW_H = width * 1.4;

const FILTERS = [
  { id: "none", label: "Normal", color: "transparent", opacity: 0 },
  { id: "warm", label: "Chaud", color: "#FF6600", opacity: 0.22 },
  { id: "cool", label: "Froid", color: "#0055FF", opacity: 0.2 },
  { id: "rose", label: "Rose", color: "#FF0066", opacity: 0.2 },
  { id: "neon", label: "Néon", color: "#7700FF", opacity: 0.22 },
  { id: "gold", label: "Doré", color: "#FFD700", opacity: 0.2 },
  { id: "dark", label: "Sombre", color: "#000000", opacity: 0.4 },
  { id: "nature", label: "Nature", color: "#00AA44", opacity: 0.18 },
];

const BG_COLORS = [
  "#E8000A",
  "#1a1a2e",
  "#0d3b66",
  "#1b4332",
  "#3d0066",
  "#FF6B35",
  "#2d2d2d",
  "#000000",
];
const TEXT_COLORS = [
  "#ffffff",
  "#FFD700",
  "#28F7A1",
  "#FF6B6B",
  "#74B9FF",
  "#FF69B4",
];

interface Props {
  onClose: () => void;
}

export function CreateStoryScreen({ onClose }: Props) {
  const { profile } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();

  const [mode, setMode] = useState<"choose" | "camera" | "edit" | "text">(
    "choose",
  );
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [filter, setFilter] = useState(FILTERS[0]);
  const [overlayText, setOverlayText] = useState("");
  const [textColor, setTextColor] = useState(TEXT_COLORS[0]);
  const [bgColor, setBgColor] = useState(BG_COLORS[0]);
  const [storyText, setStoryText] = useState("");
  const [facing, setFacing] = useState<CameraType>("back");
  const [flash, setFlash] = useState<"off" | "on" | "auto">("off");
  const [loading, setLoading] = useState(false);

  const camRef = useRef<CameraView>(null);

  function req() {
    if (!profile?.id) {
      Alert.alert("Erreur", "Reconnecte-toi.");
      return false;
    }
    return true;
  }

  async function openCamera() {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert(
          "Permission refusée",
          "Autorise la caméra dans les réglages.",
        );
        return;
      }
    }
    setMode("camera");
  }

  async function snap() {
    if (!camRef.current) return;
    try {
      const photo = await camRef.current.takePictureAsync({ quality: 0.85 });
      if (photo?.uri) {
        setCapturedUri(photo.uri);
        setMode("edit");
      }
    } catch {
      Alert.alert("Erreur", "Impossible de prendre la photo.");
    }
  }

  async function pickGallery() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission refusée");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setCapturedUri(result.assets[0].uri);
      setMode("edit");
    }
  }

  async function publishPhoto() {
    if (!req() || !capturedUri) return;
    try {
      setLoading(true);
      await createPhotoStory(
        profile!.id,
        profile!.name,
        profile!.profilePhotoURL,
        capturedUri,
        overlayText,
        filter.id !== "none" ? filter.color : undefined,
        filter.id !== "none" ? filter.opacity : undefined,
      );
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      Alert.alert(
        "Erreur",
        msg.includes("Unsigned") || msg.includes("Cloudinary")
          ? "Va sur console.cloudinary.com → Settings → Upload Presets → Signing Mode = Unsigned"
          : msg,
      );
    } finally {
      setLoading(false);
    }
  }

  async function publishText() {
    if (!req()) return;
    if (!storyText.trim()) {
      Alert.alert("Erreur", "Écris quelque chose !");
      return;
    }
    try {
      setLoading(true);
      await createTextStory(
        profile!.id,
        profile!.name,
        profile!.profilePhotoURL,
        storyText,
        bgColor,
        textColor,
      );
      onClose();
    } catch (e) {
      Alert.alert(
        "Erreur",
        e instanceof Error ? e.message : "Impossible de publier.",
      );
    } finally {
      setLoading(false);
    }
  }

  // ── CHOOSE ─────────────────────────────────────────────────────────────────
  if (mode === "choose")
    return (
      <View style={s.root}>
        <View style={s.hdr}>
          <Pressable onPress={onClose} style={s.xBtn}>
            <Text style={s.xTxt}>✕</Text>
          </Pressable>
          <Text style={s.hdrTitle}>Nouvelle story</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.choices}>
          <Pressable
            style={[s.choice, { borderColor: "#E8000A44" }]}
            onPress={openCamera}
          >
            <Text style={s.choiceIco}>📸</Text>
            <Text style={s.choiceLbl}>Caméra</Text>
            <Text style={s.choiceSub}>Filtres & effets Snap</Text>
          </Pressable>
          <Pressable style={s.choice} onPress={pickGallery}>
            <Text style={s.choiceIco}>🖼️</Text>
            <Text style={s.choiceLbl}>Galerie</Text>
            <Text style={s.choiceSub}>Depuis ton téléphone</Text>
          </Pressable>
          <Pressable style={s.choice} onPress={() => setMode("text")}>
            <Text style={s.choiceIco}>✍️</Text>
            <Text style={s.choiceLbl}>Texte</Text>
            <Text style={s.choiceSub}>Fond coloré + texte</Text>
          </Pressable>
        </View>
      </View>
    );

  // ── CAMERA ─────────────────────────────────────────────────────────────────
  if (mode === "camera")
    return (
      <View style={s.root}>
        <CameraView ref={camRef} style={s.cam} facing={facing} flash={flash}>
          {/* Filter color overlay */}
          {filter.id !== "none" && (
            <View
              style={[
                s.filterOverlay,
                { backgroundColor: filter.color, opacity: filter.opacity },
              ]}
            />
          )}

          {/* Top controls */}
          <View style={s.camTop}>
            <Pressable onPress={() => setMode("choose")} style={s.camCtrl}>
              <Text style={s.camCtrlTxt}>✕</Text>
            </Pressable>
            <Pressable
              onPress={() => setFlash((f) => (f === "off" ? "on" : "off"))}
              style={s.camCtrl}
            >
              <Text style={s.camCtrlTxt}>{flash === "on" ? "⚡" : "🔦"}</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                setFacing((f) => (f === "back" ? "front" : "back"))
              }
              style={s.camCtrl}
            >
              <Text style={s.camCtrlTxt}>🔄</Text>
            </Pressable>
          </View>

          {/* Filter pills */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.filterScroll}
            contentContainerStyle={s.filterScrollContent}
          >
            {FILTERS.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => setFilter(f)}
                style={[s.filterPill, filter.id === f.id && s.filterPillOn]}
              >
                <View
                  style={[
                    s.filterDot,
                    { backgroundColor: f.id === "none" ? "#555" : f.color },
                  ]}
                />
                <Text
                  style={[
                    s.filterName,
                    filter.id === f.id && { color: "#fff" },
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Shutter */}
          <View style={s.shutter}>
            <Pressable style={s.shutterOuter} onPress={snap}>
              <View style={s.shutterInner} />
            </Pressable>
          </View>
        </CameraView>
      </View>
    );

  // ── EDIT PHOTO ─────────────────────────────────────────────────────────────
  if (mode === "edit" && capturedUri)
    return (
      <View style={s.root}>
        <View style={s.hdr}>
          <Pressable
            onPress={() => {
              setCapturedUri(null);
              setMode("choose");
            }}
            style={s.xBtn}
          >
            <Text style={s.xTxt}>‹</Text>
          </Pressable>
          <Text style={s.hdrTitle}>Modifier</Text>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 40 }}>
          {/* Preview */}
          <View style={[s.photoWrap, { height: PREVIEW_H }]}>
            <Image
              source={{ uri: capturedUri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
            {filter.id !== "none" && (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: filter.color, opacity: filter.opacity },
                ]}
              />
            )}
            {overlayText.trim() != "" && (
              <View style={s.overlayBox}>
                <Text style={[s.overlayTxt, { color: textColor }]}>
                  {overlayText}
                </Text>
              </View>
            )}
          </View>

          {/* Text overlay */}
          <TextInput
            style={s.overlayInput}
            placeholder="✏️  Ajoute du texte..."
            placeholderTextColor="#555"
            value={overlayText}
            onChangeText={setOverlayText}
            maxLength={80}
          />

          {/* Text colors */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.colorRow}
          >
            {TEXT_COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setTextColor(c)}
                style={[
                  s.colorDot,
                  {
                    backgroundColor: c,
                    borderWidth: textColor === c ? 3 : 0,
                    borderColor: "#fff",
                  },
                ]}
              />
            ))}
          </ScrollView>

          {/* Filters */}
          <Text style={s.sectionLbl}>Filtre</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.filterScrollContent}
          >
            {FILTERS.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => setFilter(f)}
                style={[s.filterPill, filter.id === f.id && s.filterPillOn]}
              >
                <View
                  style={[
                    s.filterDot,
                    { backgroundColor: f.id === "none" ? "#555" : f.color },
                  ]}
                />
                <Text
                  style={[
                    s.filterName,
                    filter.id === f.id && { color: "#fff" },
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable
            style={[s.pubBtn, loading && { opacity: 0.6 }]}
            onPress={publishPhoto}
            disabled={loading}
          >
            <Text style={s.pubTxt}>
              {loading ? "Publication..." : "🚀 Publier la story"}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    );

  // ── TEXT ───────────────────────────────────────────────────────────────────
  return (
    <View style={s.root}>
      <View style={s.hdr}>
        <Pressable onPress={() => setMode("choose")} style={s.xBtn}>
          <Text style={s.xTxt}>‹</Text>
        </Pressable>
        <Text style={s.hdrTitle}>Story texte</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={[s.textPrev, { backgroundColor: bgColor }]}>
          <Text style={[s.textPrevTxt, { color: textColor }]}>
            {storyText || "Ton texte ici..."}
          </Text>
        </View>
        <TextInput
          style={s.textInput}
          placeholder="Écris ta story..."
          placeholderTextColor="#555"
          value={storyText}
          onChangeText={(t) => {
            if (t.length <= 200) setStoryText(t);
          }}
          multiline
          maxLength={200}
        />
        <Text style={s.charCount}>{storyText.length}/200</Text>
        <Text style={s.sectionLbl}>Fond</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.colorRow}
        >
          {BG_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setBgColor(c)}
              style={[
                s.colorDot,
                {
                  backgroundColor: c,
                  borderWidth: bgColor === c ? 3 : 0,
                  borderColor: "#fff",
                },
              ]}
            />
          ))}
        </ScrollView>
        <Text style={s.sectionLbl}>Couleur texte</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.colorRow}
        >
          {TEXT_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setTextColor(c)}
              style={[
                s.colorDot,
                {
                  backgroundColor: c,
                  borderWidth: textColor === c ? 3 : 0,
                  borderColor: "#fff",
                },
              ]}
            />
          ))}
        </ScrollView>
        <Pressable
          style={[s.pubBtn, loading && { opacity: 0.6 }]}
          onPress={publishText}
          disabled={loading}
        >
          <Text style={s.pubTxt}>
            {loading ? "Publication..." : "🚀 Publier la story"}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#030303" },
  hdr: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    paddingTop: 54,
  },
  xBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
  },
  xTxt: { color: "#E8000A", fontSize: 18, fontWeight: "700" },
  hdrTitle: { color: "#fff", fontSize: 17, fontWeight: "800" },

  choices: { flex: 1, padding: 20, gap: 14, justifyContent: "center" },
  choice: {
    backgroundColor: "#0a0a0a",
    borderWidth: 1,
    borderColor: "#1a1a1a",
    borderRadius: 20,
    padding: 26,
    alignItems: "center",
    gap: 8,
  },
  choiceIco: { fontSize: 42 },
  choiceLbl: { color: "#fff", fontSize: 18, fontWeight: "800" },
  choiceSub: { color: "#444", fontSize: 12 },

  cam: { flex: 1 },
  filterOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  camTop: {
    position: "absolute",
    top: 54,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    zIndex: 10,
  },
  camCtrl: {
    width: 46,
    height: 46,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  camCtrlTxt: { fontSize: 20 },
  filterScroll: {
    position: "absolute",
    bottom: 130,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  filterScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  filterPill: {
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  filterPillOn: { backgroundColor: "rgba(232,0,10,0.85)" },
  filterDot: { width: 26, height: 26, borderRadius: 13 },
  filterName: { color: "#aaa", fontSize: 9, fontWeight: "700" },
  shutter: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  shutterOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "#fff",
  },

  photoWrap: { marginHorizontal: 16, borderRadius: 20, overflow: "hidden" },
  overlayBox: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  overlayTxt: {
    fontSize: 22,
    fontWeight: "900",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 5,
  },
  overlayInput: {
    marginHorizontal: 16,
    backgroundColor: "#111",
    borderRadius: 12,
    padding: 14,
    color: "#fff",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#222",
  },
  colorRow: { paddingHorizontal: 16, gap: 10, flexDirection: "row" },
  colorDot: { width: 36, height: 36, borderRadius: 18 },
  sectionLbl: {
    color: "#444",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: 16,
  },
  textPrev: {
    marginHorizontal: 4,
    height: 200,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  textPrevTxt: { fontSize: 22, fontWeight: "800", textAlign: "center" },
  textInput: {
    backgroundColor: "#0a0a0a",
    borderWidth: 1,
    borderColor: "#1a1a1a",
    borderRadius: 14,
    padding: 16,
    color: "#fff",
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: "top",
  },
  charCount: { color: "#333", fontSize: 11, textAlign: "right" },
  pubBtn: {
    backgroundColor: "#E8000A",
    borderRadius: 16,
    padding: 17,
    alignItems: "center",
    marginHorizontal: 4,
  },
  pubTxt: { color: "#fff", fontSize: 15, fontWeight: "900" },
});
