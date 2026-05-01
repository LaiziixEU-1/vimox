import { useState } from "react";
import { ComponentProps } from "react";
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { GlassPanel } from "../components/GlassPanel";
import { NeonButton } from "../components/NeonButton";
import { VimoXLogo } from "../components/VimoXLogo";
import { Gender } from "../models/types";
import { registerUser } from "../services/authService";
import { colors } from "../theme/colors";

const genders: Exclude<Gender, "Tous">[] = ["Femme", "Homme", "Non-binaire", "Autre"];
const countries = ["France", "Suisse", "Belgique", "Canada", "Maroc", "Algérie", "Tunisie"];

export function RegistrationScreen() {
  const [name, setName] = useState("");
  const [age, setAge] = useState("16");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [gender, setGender] = useState<Exclude<Gender, "Tous">>("Autre");
  const [country, setCountry] = useState("France");
  const [imageUri, setImageUri] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function pickImage(camera = false) {
    const permission = camera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert("Permission requise", "Autorise l'accès pour ajouter ta photo.");

    const result = camera
      ? await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true, aspect: [1, 1] })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsEditing: true, aspect: [1, 1] });

    if (!result.canceled) setImageUri(result.assets[0].uri);
  }

  async function submit() {
    try {
      setLoading(true);
      await registerUser({
        name,
        age: Number(age),
        email,
        password,
        gender,
        country,
        imageUri
      });
    } catch (error) {
      Alert.alert("Inscription impossible", error instanceof Error ? error.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  return (
    <LinearGradient colors={[colors.black, "#111122", "#16080D"]} style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <VimoXLogo size={260} />

          <GlassPanel style={{ gap: 14 }}>
            <Pressable onPress={() => pickImage(false)} style={styles.avatar}>
              {imageUri ? <Image source={{ uri: imageUri }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>+</Text>}
            </Pressable>

            <View style={styles.row}>
              <Pressable onPress={() => pickImage(false)}><Text style={styles.link}>Galerie</Text></Pressable>
              <Pressable onPress={() => pickImage(true)}><Text style={styles.link}>Caméra</Text></Pressable>
            </View>

            <Input placeholder="Nom" value={name} onChangeText={setName} />
            <Input placeholder="Âge minimum 16" value={age} onChangeText={setAge} keyboardType="number-pad" />
            <Input placeholder="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <Input placeholder="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry />

            <ChoiceRow values={genders} value={gender} onChange={setGender} />
            <ChoiceRow values={countries} value={country} onChange={setCountry} />
          </GlassPanel>

          <NeonButton title={loading ? "Création..." : "Entrer dans VimoX"} disabled={loading} onPress={submit} />
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function Input(props: ComponentProps<typeof TextInput>) {
  return <TextInput placeholderTextColor={colors.muted} style={styles.input} {...props} />;
}

function ChoiceRow<T extends string>({ values, value, onChange }: { values: T[]; value: T; onChange: (value: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.choices}>
        {values.map((item) => (
          <Pressable key={item} onPress={() => onChange(item)} style={[styles.choice, value === item && styles.choiceActive]}>
            <Text style={styles.choiceText}>{item}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 22, paddingTop: 70, gap: 20 },
  avatar: { width: 116, height: 116, borderRadius: 58, alignSelf: "center", borderWidth: 2, borderColor: colors.neonBlue, alignItems: "center", justifyContent: "center", backgroundColor: colors.panelStrong },
  avatarImage: { width: "100%", height: "100%", borderRadius: 58 },
  avatarText: { color: colors.neonBlue, fontSize: 48, fontWeight: "300" },
  row: { flexDirection: "row", gap: 24, justifyContent: "center" },
  link: { color: colors.neonBlue, fontWeight: "800" },
  input: { minHeight: 52, borderRadius: 14, backgroundColor: colors.panelStrong, color: colors.text, paddingHorizontal: 14, fontSize: 16 },
  choices: { flexDirection: "row", gap: 8 },
  choice: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.panelStrong },
  choiceActive: { backgroundColor: colors.neonRed },
  choiceText: { color: colors.text, fontWeight: "700" }
});
