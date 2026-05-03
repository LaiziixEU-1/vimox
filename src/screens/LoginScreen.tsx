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
  View,
  ImageBackground,
} from "react-native";
import { NeonButton } from "../components/NeonButton";
import { VimoXLogo } from "../components/VimoXLogo";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../config/firebase";
import { colors } from "../theme/colors";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../models/types";
import { forgotPassword } from "../services/authService";

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

  async function handleForgotPassword() {
    if (!email)
      return Alert.alert(
        "Email requis",
        "Entre ton email puis appuie sur 'Mot de passe oublié'.",
      );
    try {
      await forgotPassword(email);
      Alert.alert("Email envoyé ✅", "Vérifie ta boîte mail.");
    } catch (error) {
      Alert.alert(
        "Erreur",
        error instanceof Error ? error.message : "Erreur inconnue",
      );
    }
  }

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <VimoXLogo size={180} showWordmark={false} />
            <Text style={styles.brand}>
              VIMO<Text style={styles.brandX}>X</Text>
            </Text>
            <Text style={styles.slogan}>TALK. CONNECT. ANYWHERE.</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>✉</Text>
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor={colors.muted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.inputIcon}>🔒</Text>
              <TextInput
                style={styles.input}
                placeholder="Mot de passe"
                placeholderTextColor={colors.muted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            <Pressable onPress={handleForgotPassword} style={styles.forgotBtn}>
              <Text style={styles.forgot}>Mot de passe oublié ?</Text>
            </Pressable>
          </View>

          <NeonButton
            title={loading ? "Connexion..." : "Se connecter"}
            onPress={submit}
            disabled={loading}
          />

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>OU</Text>
            <View style={styles.line} />
          </View>

          <Pressable
            onPress={() => navigation.navigate("Register")}
            style={styles.registerBtn}
          >
            <Text style={styles.registerText}>
              Pas encore de compte ?{" "}
              <Text style={styles.registerLink}>S'inscrire</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  content: { padding: 24, paddingTop: 80, gap: 24 },
  logoContainer: { alignItems: "center", gap: 8 },
  brand: {
    color: colors.text,
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: 4,
  },
  brandX: { color: colors.neonRed },
  slogan: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: "600",
  },
  form: { gap: 14 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  inputIcon: { fontSize: 16, marginRight: 10, opacity: 0.5 },
  input: { flex: 1, color: colors.text, fontSize: 15 },
  forgotBtn: { alignSelf: "flex-end" },
  forgot: { color: colors.neonRed, fontSize: 13, fontWeight: "600" },
  divider: { flexDirection: "row", alignItems: "center", gap: 12 },
  line: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  registerBtn: { alignItems: "center" },
  registerText: { color: colors.muted, fontSize: 14 },
  registerLink: { color: colors.neonRed, fontWeight: "700" },
});
