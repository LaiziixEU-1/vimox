import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  Text,
  Pressable,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { NeonButton } from "../components/NeonButton";
import { GlassPanel } from "../components/GlassPanel";
import { VimoXLogo } from "../components/VimoXLogo";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../config/firebase";
import { colors } from "../theme/colors";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../models/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<Nav>();

  async function submit() {
    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      Alert.alert(
        "Connexion impossible",
        error instanceof Error ? error.message : "Erreur inconnue",
      );
    } finally {
      setLoading(false);
    }
  }

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
          <VimoXLogo size={260} />
          <GlassPanel style={{ gap: 14 }}>
            <TextInput
              placeholderTextColor={colors.muted}
              style={styles.input}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              placeholderTextColor={colors.muted}
              style={styles.input}
              placeholder="Mot de passe"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </GlassPanel>
          <NeonButton
            title={loading ? "Connexion..." : "Se connecter"}
            onPress={submit}
            disabled={loading}
          />
          <Pressable onPress={() => navigation.navigate("Register")}>
            <Text style={styles.link}>Pas encore de compte ? S'inscrire</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 22, paddingTop: 70, gap: 20 },
  input: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: colors.panelStrong,
    color: colors.text,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  link: { color: colors.neonBlue, textAlign: "center", fontWeight: "700" },
});
