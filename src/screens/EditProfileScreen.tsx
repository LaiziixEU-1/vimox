import { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { colors } from "../theme/colors";
import { RootStackParamList } from "../models/types";
import { useAuth } from "../services/AuthContext";
import { db } from "../config/firebase";
import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from "../config/env";

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

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission refusée");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
    setLoading(true);
    try {
      const updates: Record<string, any> = {
        name: name.trim(),
        bio: bio.trim(),
        country,
        updatedAt: serverTimestamp(),
      };
      if (photoUri) {
        const formData = new FormData();
        formData.append("file", {
          uri: photoUri,
          type: "image/jpeg",
          name: "profile.jpg",
        } as any);
        formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
        formData.append("folder", "profiles");
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
          { method: "POST", body: formData },
        );
        const data = await res.json();
        if (data.secure_url) updates.profilePhotoURL = data.secure_url;
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
      <View style={s.header}>
        <Pressable onPress={() => navigation.goBack()} style={s.backBtn}>
          <Text style={s.back}>‹</Text>
        </Pressable>
        <Text style={s.title}>Modifier le profil</Text>
        <Pressable onPress={handleSave} disabled={loading} style={s.saveBtn}>
          <Text style={s.saveTxt}>{loading ? "..." : "Enregistrer"}</Text>
        </Pressable>
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.photoSection}>
            <Pressable onPress={pickPhoto} style={s.avatarWrap}>
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
            placeholderTextColor={colors.muted}
            style={s.input}
          />
          <Text style={s.label}>BIO</Text>
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
    backgroundColor: "rgba(232,0,10,0.15)",
    borderWidth: 1,
    borderColor: colors.neonRed,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  saveTxt: { color: colors.neonRed, fontSize: 13, fontWeight: "700" },
  scroll: { padding: 20, paddingBottom: 40 },
  photoSection: { alignItems: "center", marginBottom: 24 },
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
    backgroundColor: "rgba(232,0,10,0.12)",
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
    backgroundColor: "rgba(232,0,10,0.15)",
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
