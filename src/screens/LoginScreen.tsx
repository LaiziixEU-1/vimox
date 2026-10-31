import { useRef, useState } from "react";
import {
  Alert,
  Animated,
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
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors } from "../theme/colors";
import { RootStackParamList } from "../models/types";
import {
  signInUser,
  forgotPassword,
  loginErrorMessage,
} from "../services/authService";
import { VimoXLogo } from "../components/VimoXLogo";
import { LinearGradient } from "expo-linear-gradient";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const shakeX = useRef(new Animated.Value(0)).current;

  function shake() {
    Animated.sequence([
      Animated.timing(shakeX, {
        toValue: -10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeX, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeX, {
        toValue: -8,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeX, {
        toValue: 8,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeX, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  }

  async function handleLogin() {
    if (!email.trim() || !password) {
      shake();
      return;
    }
    setLoading(true);
    try {
      await signInUser(email.trim(), password);
    } catch (e: any) {
      shake();
      Alert.alert("Connexion impossible", loginErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  function handleForgot() {
    if (!email.trim()) {
      Alert.alert("Email requis", "Saisis d'abord ton email.");
      return;
    }
    Alert.alert("Mot de passe oublié", `Envoyer un lien à ${email.trim()} ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Envoyer",
        onPress: async () => {
          try {
            await forgotPassword(email.trim());
            Alert.alert("Email envoyé ✅", "Vérifie ta boîte mail.");
          } catch {
            Alert.alert("Erreur", "Impossible d'envoyer l'email.");
          }
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={s.root}>
      {/* Halo de couleur VimoX en haut de l'écran */}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(255,46,77,0.28)", "rgba(255,107,61,0.10)", "rgba(9,9,12,0)"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 360 }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.logoWrap}>
            <VimoXLogo size={72} />
            <Text style={s.tagline}>Partage. Joue. Reste en contact.</Text>
          </View>
          <Animated.View
            style={[s.form, { transform: [{ translateX: shakeX }] }]}
          >
            <Text style={s.title}>Connexion</Text>
            <View style={s.field}>
              <Text style={s.label}>EMAIL</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="ton@email.com"
                placeholderTextColor={colors.muted}
                keyboardType="email-address"
                autoCapitalize="none"
                style={s.input}
              />
            </View>
            <View style={s.field}>
              <Text style={s.label}>MOT DE PASSE</Text>
              <View style={s.pwdWrap}>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor={colors.muted}
                  secureTextEntry={!showPwd}
                  autoCapitalize="none"
                  style={[s.input, { flex: 1 }]}
                  onSubmitEditing={handleLogin}
                />
                <Pressable
                  onPress={() => setShowPwd((v) => !v)}
                  style={s.eyeBtn}
                >
                  <Text>{showPwd ? "🙈" : "👁"}</Text>
                </Pressable>
              </View>
            </View>
            <Pressable onPress={handleForgot} style={s.forgotBtn}>
              <Text style={s.forgotTxt}>Mot de passe oublié ?</Text>
            </Pressable>
            <Pressable
              onPress={handleLogin}
              disabled={loading}
              style={[s.btn, loading && { opacity: 0.7 }]}
            >
              <Text style={s.btnTxt}>
                {loading ? "Connexion..." : "Se connecter"}
              </Text>
            </Pressable>
            <View style={s.divider}>
              <View style={s.divLine} />
              <Text style={s.divTxt}>ou</Text>
              <View style={s.divLine} />
            </View>
            <Pressable
              onPress={() => navigation.navigate("Register")}
              style={s.registerBtn}
            >
              <Text style={s.registerTxt}>Créer un compte gratuit</Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 24, gap: 28 },
  logoWrap: { alignItems: "center", gap: 10 },
  tagline: { color: colors.muted, fontSize: 14, fontWeight: "700", letterSpacing: 0.3 },
  form: { gap: 14 },
  title: { color: colors.text, fontSize: 24, fontWeight: "900" },
  field: { gap: 6 },
  label: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  input: {
    color: colors.text,
    fontSize: 15,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pwdWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingRight: 8,
  },
  eyeBtn: { padding: 8 },
  forgotBtn: { alignSelf: "flex-end" },
  forgotTxt: { color: colors.neonRed, fontSize: 12, fontWeight: "600" },
  btn: {
    backgroundColor: colors.neonRed,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    shadowColor: colors.neonRed,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  btnTxt: { color: "#fff", fontSize: 14, fontWeight: "900", letterSpacing: 1 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12 },
  divLine: { flex: 1, height: 1, backgroundColor: colors.border },
  divTxt: { color: colors.muted, fontSize: 12 },
  registerBtn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.neonRed,
  },
  registerTxt: { color: colors.neonRed, fontSize: 14, fontWeight: "900" },
});
