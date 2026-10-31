import { useEffect, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { colors } from "../theme/colors";
import { ScreenHeader } from "../components/ScreenHeader";
import { RootStackParamList } from "../models/types";
import { useAuth } from "../services/AuthContext";
import { db } from "../config/firebase";
import { uploadProfilePhoto } from "../services/storageService";
import { guardText } from "../services/moderationGuard";
import {
  HandleError,
  checkHandleAvailable,
  claimUsername,
  handleProblemText,
  normalizeHandle,
  releaseUsername,
  validateHandle,
} from "../services/usernameService";

type Props = NativeStackScreenProps<RootStackParamList, "EditProfile">;
const COUNTRIES = [
  "France",
  "Belgique",
  "Suisse",
  "Canada",
  "Maroc",
  "Tunisie",
  "Algérie",
  "Autres",
];

export function EditProfileScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const [name, setName] = useState(profile?.name ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [country, setCountry] = useState(profile?.country ?? "France");
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Pseudo : « idle » (inchangé), « checking », « ok » (libre), « mine », ou un message d'erreur
  const [handle, setHandle] = useState(profile?.username ?? "");
  const [handleState, setHandleState] = useState<{ kind: "idle" | "checking" | "ok" | "bad"; text?: string }>({ kind: "idle" });
  const wantedHandle = normalizeHandle(handle);
  const currentHandle = profile?.username ?? "";
  const handleChanged = wantedHandle !== currentHandle;
  // Vérifie le pseudo après une courte pause de frappe (format, puis disponibilité)
  useEffect(() => {
    if (!profile || !handleChanged || wantedHandle === "") {
      setHandleState({ kind: "idle" });
      return;
    }
    const v = validateHandle(wantedHandle);
    if (!v.ok) {
      setHandleState({ kind: "bad", text: handleProblemText(v.problem) });
      return;
    }
    setHandleState({ kind: "checking" });
    let alive = true;
    const timer = setTimeout(async () => {
      try {
        const a = await checkHandleAvailable(v.handle, profile.id);
        if (!alive) return;
        setHandleState(a === "taken" ? { kind: "bad", text: handleProblemText("taken") } : { kind: "ok", text: "Disponible" });
      } catch {
        if (alive) setHandleState({ kind: "idle" });
      }
    }, 450);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [wantedHandle, profile?.id]);
  // Des modifications non enregistrées existent-elles ?
  const dirty =
    name.trim() !== (profile?.name ?? "") ||
    bio.trim() !== (profile?.bio ?? "") ||
    country !== (profile?.country ?? "France") ||
    handleChanged ||
    !!photoUri;

  function handleBack() {
    if (!dirty || loading) {
      navigation.goBack();
      return;
    }
    Alert.alert(
      "Abandonner les modifications ?",
      "Ce que tu as modifié ne sera pas enregistré.",
      [
        { text: "Continuer à modifier", style: "cancel" },
        {
          text: "Abandonner",
          style: "destructive",
          onPress: () => navigation.goBack(),
        },
      ],
    );
  }

  // Photo de profil : prendre une photo (caméra avant) ou choisir dans la galerie
  function choosePhoto() {
    Alert.alert("Photo de profil", undefined, [
      { text: "📸 Prendre une photo", onPress: takePhoto },
      { text: "🖼️ Choisir dans la galerie", onPress: pickPhoto },
      { text: "Annuler", style: "cancel" },
    ]);
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission refusée", "Autorise la caméra dans les réglages de ton téléphone.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"] as any,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
      cameraType: ImagePicker.CameraType.front,
    });
    if (!res.canceled && res.assets[0]) setPhotoUri(res.assets[0].uri);
  }

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission refusée");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"] as any,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!res.canceled && res.assets[0]) setPhotoUri(res.assets[0].uri);
  }

  async function handleSave() {
    if (!profile) return;
    if (!name.trim()) {
      Alert.alert("Erreur", "Le prénom est obligatoire.");
      return;
    }
    const verdict = await guardText(`${name} ${bio}`, {
      userId: profile.id,
      where: "profile",
    });
    if (!verdict.ok) {
      Alert.alert("Profil non enregistré", verdict.message);
      return;
    }
    // Pseudo : contrôle du format avant tout enregistrement
    if (handleChanged && wantedHandle !== "") {
      const v = validateHandle(wantedHandle);
      if (!v.ok) {
        Alert.alert("Pseudo non valide", handleProblemText(v.problem));
        return;
      }
    }
    setLoading(true);
    try {
      if (handleChanged) {
        try {
          if (wantedHandle === "") await releaseUsername(profile.id, currentHandle);
          else await claimUsername(profile.id, wantedHandle, currentHandle || null);
        } catch (e: any) {
          setLoading(false);
          Alert.alert(
            "Pseudo non enregistré",
            e instanceof HandleError
              ? `${handleProblemText(e.problem)} Rien n'a été modifié.`
              : "Impossible d'enregistrer le pseudo. Vérifie ta connexion. Rien n'a été modifié.",
          );
          return;
        }
      }
      const updates: Record<string, any> = {
        name: name.trim(),
        bio: bio.trim(),
        country,
        updatedAt: serverTimestamp(),
      };
      if (photoUri) {
        try {
          updates.profilePhotoURL = await uploadProfilePhoto(profile.id, photoUri);
        } catch (e: any) {
          // On ne prétend pas que tout a marché si la photo n'est pas partie
          setLoading(false);
          Alert.alert(
            "Photo non envoyée",
            `Ta photo n'a pas pu être envoyée (${e?.message ?? "erreur réseau"}). Rien n'a été modifié.`,
          );
          return;
        }
      }
      await updateDoc(doc(db, "users", profile.id), updates);
      Alert.alert("✅ Profil mis à jour !", " ", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert("Erreur", "Impossible de sauvegarder.");
    } finally {
      setLoading(false);
    }
  }

  const currentPhoto = photoUri ?? profile?.profilePhotoURL;
  const initials =
    profile?.name
      ?.split(" ")
      .map((n: string) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ?? "?";

  return (
    <SafeAreaView style={s.root}>
      <ScreenHeader
        safeArea={false}
        title="Modifier le profil"
        onBack={handleBack}
        right={
          <Pressable
            onPress={handleSave}
            disabled={loading || !dirty}
            style={[s.saveBtn, !dirty && { opacity: 0.45 }]}
          >
            <Text style={s.saveTxt}>{loading ? "..." : "Enregistrer"}</Text>
          </Pressable>
        }
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.photoSection}>
            <Pressable onPress={choosePhoto} style={s.avatarWrap} accessibilityRole="button" accessibilityLabel="Changer la photo de profil">
              {currentPhoto ? (
                <Image source={{ uri: currentPhoto }} style={s.avatar} />
              ) : (
                <View style={s.avatarPh}>
                  <Text style={s.initials}>{initials}</Text>
                </View>
              )}
              <View style={s.camBtn}>
                <Text style={s.camIcon}>📷</Text>
              </View>
            </Pressable>
          </View>
          <Text style={s.label}>PRÉNOM</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Ton prénom"
            maxLength={20}
            placeholderTextColor={colors.muted}
            style={s.input}
          />
          <Text style={s.label}>PSEUDO</Text>
          <View style={s.handleRow}>
            <Text style={s.handleAt}>@</Text>
            <TextInput
              value={handle}
              onChangeText={(v) => setHandle(v.replace(/^@+/, "").toLowerCase())}
              placeholder="choisis-un-pseudo"
              placeholderTextColor={colors.muted}
              maxLength={20}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Pseudo"
              style={s.handleInput}
            />
          </View>
          <Text
            style={[
              s.handleHelp,
              handleState.kind === "ok" && { color: "#28F7A1" },
              handleState.kind === "bad" && { color: "#ff7a7a" },
            ]}
          >
            {handleState.kind === "checking"
              ? "Vérification…"
              : handleState.kind === "ok"
                ? "✓ Disponible"
                : handleState.kind === "bad"
                  ? handleState.text
                  : "3 à 20 caractères : lettres minuscules, chiffres, « . » et « _ ». Les autres peuvent te trouver avec @pseudo si tu apparais dans la recherche."}
          </Text>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={s.label}>BIO</Text>
            <Text style={[s.label, { opacity: 0.7 }]}>{bio.length}/120</Text>
          </View>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="Quelques mots sur toi..."
            placeholderTextColor={colors.muted}
            multiline
            maxLength={120}
            style={[s.input, { height: 90, textAlignVertical: "top" }]}
          />
          <Text style={s.label}>PAYS</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -20 }}
            contentContainerStyle={{ paddingHorizontal: 20 }}
          >
            <View style={s.chips}>
              {COUNTRIES.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setCountry(c)}
                  style={[s.chip, c === country && s.chipOn]}
                >
                  <Text style={[s.chipTxt, c === country && s.chipTxtOn]}>
                    {c}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          <View style={s.readOnly}>
            <Text style={s.readOnlyLabel}>EMAIL (non modifiable)</Text>
            <Text style={s.readOnlyVal}>{profile?.email}</Text>
          </View>
          <Pressable
            onPress={handleSave}
            disabled={loading}
            style={[s.btn, loading && { opacity: 0.6 }]}
          >
            <Text style={s.btnTxt}>
              {loading ? "Enregistrement..." : "Enregistrer les modifications"}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  header: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  back: { color: colors.text, fontSize: 28, fontWeight: "300" },
  title: { flex: 1, color: colors.text, fontSize: 18, fontWeight: "900" },
  saveBtn: {
    backgroundColor: "rgba(255,46,77,0.15)",
    borderWidth: 1,
    borderColor: colors.neonRed,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  saveTxt: { color: colors.neonRed, fontSize: 13, fontWeight: "700" },
  scroll: { padding: 20, paddingBottom: 40 },
  photoSection: { alignItems: "center", marginBottom: 24 },
  handleRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  handleAt: { color: colors.gold, fontSize: 16, fontWeight: "800", marginRight: 4 },
  handleInput: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: 14 },
  handleHelp: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 6, marginBottom: 6 },
  avatarWrap: { position: "relative" },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: colors.neonRed,
  },
  avatarPh: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255,46,77,0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.neonRed,
  },
  initials: { color: colors.neonRed, fontSize: 36, fontWeight: "900" },
  camBtn: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.neonRed,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.black,
  },
  camIcon: { fontSize: 12 },
  label: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    color: colors.text,
    fontSize: 15,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chips: { flexDirection: "row", gap: 8, marginBottom: 16 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: {
    backgroundColor: "rgba(255,46,77,0.15)",
    borderColor: colors.neonRed,
  },
  chipTxt: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  chipTxtOn: { color: colors.neonRed },
  readOnly: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 16,
  },
  readOnlyLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  readOnlyVal: { color: "rgba(255,255,255,0.4)", fontSize: 14 },
  btn: {
    backgroundColor: colors.neonRed,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 20,
    shadowColor: colors.neonRed,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  btnTxt: { color: "#fff", fontSize: 14, fontWeight: "900", letterSpacing: 1 },
});
