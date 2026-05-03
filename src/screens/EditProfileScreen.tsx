import { useState } from "react";
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
import { LinearGradient } from "expo-linear-gradient";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { GlassPanel } from "../components/GlassPanel";
import { NeonButton } from "../components/NeonButton";
import { colors } from "../theme/colors";
import { useAuth } from "../services/AuthContext";
import { db } from "../config/firebase";
import {
  pickProfileImage,
  takeProfilePhoto,
  uploadProfilePhoto,
} from "../services/storageService";
import { RootStackParamList, Gender } from "../models/types";

type Props = NativeStackScreenProps<RootStackParamList, "EditProfile">;

const countries = [
  "France",
  "Suisse",
  "Belgique",
  "Canada",
  "Maroc",
  "Algérie",
  "Tunisie",
];
const genders: Exclude<Gender, "Tous">[] = [
  "Femme",
  "Homme",
  "Non-binaire",
  "Autre",
];

export function EditProfileScreen({ navigation }: Props) {
  const { profile, firebaseUser } = useAuth();
  const [name, setName] = useState(profile?.name ?? "");
  const [age, setAge] = useState(String(profile?.age ?? "16"));
  const [country, setCountry] = useState(profile?.country ?? "France");
  const [gender, setGender] = useState<Exclude<Gender, "Tous">>(
    profile?.gender ?? "Autre",
  );
  const [imageUri, setImageUri] = useState<string>();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [loading, setLoading] = useState(false);

  async function handlePickImage() {
    try {
      const uri = await pickProfileImage();
      if (uri) setImageUri(uri);
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue");
    }
  }

  async function handleTakePhoto() {
    try {
      const uri = await takeProfilePhoto();
      if (uri) setImageUri(uri);
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue");
    }
  }

  async function save() {
    if (!profile || !firebaseUser) return;
    const parsedAge = Number(age);
    if (isNaN(parsedAge) || parsedAge < 16) {
      return Alert.alert("Erreur", "L'âge minimum est 16 ans");
    }
    try {
      setLoading(true);
      let photoURL = profile.profilePhotoURL;
      if (imageUri) {
        photoURL = await uploadProfilePhoto(
          firebaseUser.uid,
          imageUri,
          ({ progress }) => setUploadProgress(progress),
        );
      }
      await updateDoc(doc(db, "users", firebaseUser.uid), {
        name,
        age: parsedAge,
        country,
        gender,
        profilePhotoURL: photoURL,
        updatedAt: serverTimestamp(),
      });
      Alert.alert("Profil mis à jour ✅");
      navigation.goBack();
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  }

  const photoSource = imageUri
    ? { uri: imageUri }
    : profile?.profilePhotoURL
      ? { uri: profile.profilePhotoURL }
      : null;

  return (
    <LinearGradient
      colors={[colors.black, "#111122", "#16080D"]}
      style={styles.root}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Modifier mon profil</Text>
          <GlassPanel style={{ gap: 14 }}>
            <Pressable onPress={handlePickImage} style={styles.avatar}>
              {photoSource ? (
                <Image source={photoSource} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>+</Text>
              )}
            </Pressable>
            {uploadProgress > 0 && uploadProgress < 100 && (
              <Text style={styles.progress}>Upload : {uploadProgress}%</Text>
            )}
            <View style={styles.row}>
              <Pressable onPress={handlePickImage}>
                <Text style={styles.link}>Galerie</Text>
              </Pressable>
              <Pressable onPress={handleTakePhoto}>
                <Text style={styles.link}>Caméra</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Nom"
              placeholderTextColor={colors.muted}
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={styles.input}
              placeholder="Âge"
              placeholderTextColor={colors.muted}
              value={age}
              onChangeText={setAge}
              keyboardType="number-pad"
            />
            <Text style={styles.label}>Genre</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.choices}>
                {genders.map((g) => (
                  <Pressable
                    key={g}
                    onPress={() => setGender(g)}
                    style={[styles.choice, gender === g && styles.choiceActive]}
                  >
                    <Text style={styles.choiceText}>{g}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
            <Text style={styles.label}>Pays</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.choices}>
                {countries.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setCountry(c)}
                    style={[
                      styles.choice,
                      country === c && styles.choiceActive,
                    ]}
                  >
                    <Text style={styles.choiceText}>{c}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </GlassPanel>
          <NeonButton
            title={
              loading
                ? `Sauvegarde... ${uploadProgress > 0 ? uploadProgress + "%" : ""}`
                : "Sauvegarder"
            }
            onPress={save}
            disabled={loading}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 22, paddingTop: 60, gap: 16 },
  title: { color: colors.text, fontSize: 24, fontWeight: "800" },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignSelf: "center",
    borderWidth: 2,
    borderColor: colors.neonBlue,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panelStrong,
  },
  avatarImage: { width: "100%", height: "100%", borderRadius: 55 },
  avatarText: { color: colors.neonBlue, fontSize: 48, fontWeight: "300" },
  progress: { color: colors.neonBlue, textAlign: "center", fontWeight: "700" },
  row: { flexDirection: "row", gap: 24, justifyContent: "center" },
  link: { color: colors.neonBlue, fontWeight: "800" },
  input: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: colors.panelStrong,
    color: colors.text,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  label: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  choices: { flexDirection: "row", gap: 8 },
  choice: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: colors.panelStrong,
  },
  choiceActive: { backgroundColor: colors.neonRed },
  choiceText: { color: colors.text, fontWeight: "700" },
});
