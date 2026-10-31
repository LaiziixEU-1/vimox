import { useState } from "react";
import {
  Alert,
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
import { LinearGradient } from "expo-linear-gradient";
import { RootStackParamList } from "../models/types";
import { guardText } from "../services/moderationGuard";
import {
  registerUser,
  registrationErrorMessage,
} from "../services/authService";

type Props = NativeStackScreenProps<RootStackParamList, "Register">;
const COUNTRIES = [
  "France",
  "Belgique",
  "Suisse",
  "Canada",
  "Maroc",
  "Tunisie",
  "Algérie",
  "Sénégal",
  "Autres",
];
const GENDERS: Array<"Homme" | "Femme" | "Non-binaire" | "Autre"> = [
  "Homme",
  "Femme",
  "Non-binaire",
  "Autre",
];

export function RegistrationScreen({ navigation }: Props) {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [gender, setGender] = useState<
    "Homme" | "Femme" | "Non-binaire" | "Autre"
  >("Homme");
  const [country, setCountry] = useState("France");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  async function handleRegister() {
    if (name.trim().length < 2) {
      Alert.alert("Erreur", "Prénom trop court.");
      return;
    }
    const verdict = await guardText(name, {
      userId: "inscription",
      where: "register",
    });
    if (!verdict.ok) {
      Alert.alert("Prénom refusé", verdict.message);
      return;
    }
    const a = parseInt(age);
    if (isNaN(a) || a < 16) {
      Alert.alert("Erreur", "Âge minimum : 16 ans.");
      return;
    }
    if (!email.includes("@")) {
      Alert.alert("Erreur", "Email invalide.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Erreur", "Mot de passe trop court (min. 6 caractères).");
      return;
    }
    if (password !== confirm) {
      Alert.alert("Erreur", "Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      await registerUser({
        name: name.trim(),
        age: a,
        email: email.trim().toLowerCase(),
        password,
        gender,
        country,
      });
    } catch (e: any) {
      Alert.alert("Inscription impossible", registrationErrorMessage(e));
    } finally {
      setLoading(false);
    }
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
        <View style={s.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={() => navigation.goBack()} style={s.backBtn}>
            <Text style={s.back}>‹</Text>
          </Pressable>
          <Text style={s.title}>Créer un compte</Text>
        </View>
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Input
            label="PRÉNOM"
            value={name}
            onChange={setName}
            placeholder="Ton prénom"
            autoFocus
          />
          <Input
            label="ÂGE"
            value={age}
            onChange={setAge}
            placeholder="ex. 22"
            keyboardType="numeric"
          />
          <Input
            label="EMAIL"
            value={email}
            onChange={setEmail}
            placeholder="ton@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Input
            label="MOT DE PASSE"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            secureTextEntry={!showPwd}
            autoCapitalize="none"
          />
          {password.length > 0 && (() => {
            // Solidité du mot de passe : longueur, majuscules, chiffres, symboles
            let score = 0;
            if (password.length >= 8) score++;
            if (password.length >= 12) score++;
            if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
            if (/\d/.test(password)) score++;
            if (/[^A-Za-z0-9]/.test(password)) score++;
            const lvl = password.length < 6 ? 0 : Math.min(4, Math.max(1, score));
            const LABELS = ["Trop court", "Faible", "Moyen", "Bon", "Très solide"];
            const COLORS = ["#E5484D", "#E5484D", "#FFB020", "#4ADE80", "#2ECC71"];
            return (
              <View style={s.pwdWrap}>
                <View style={s.pwdBars}>
                  {[1, 2, 3, 4].map((i) => (
                    <View key={i} style={[s.pwdBar, { backgroundColor: i <= lvl ? COLORS[lvl] : "rgba(255,255,255,0.12)" }]} />
                  ))}
                </View>
                <Text style={[s.pwdTxt, { color: COLORS[lvl] }]}>
                  {LABELS[lvl]}
                  {lvl > 0 && lvl < 3 ? " · ajoute des chiffres, des majuscules ou un symbole" : ""}
                </Text>
              </View>
            );
          })()}
          <Input
            label="CONFIRMER"
            value={confirm}
            onChange={setConfirm}
            placeholder="••••••••"
            secureTextEntry={!showPwd}
            autoCapitalize="none"
          />
          {confirm.length > 0 && (
            <Text style={[s.pwdTxt, { color: confirm === password ? "#2ECC71" : "#E5484D", marginTop: -4 }]}>
              {confirm === password ? "✓ Les mots de passe sont identiques" : "✗ Les mots de passe sont différents"}
            </Text>
          )}
          <Pressable onPress={() => setShowPwd((v) => !v)} style={s.showPwd}>
            <Text style={s.showPwdTxt}>
              {showPwd ? "Cacher" : "Afficher"} le mot de passe
            </Text>
          </Pressable>
          <Text style={s.sectionLabel}>GENRE</Text>
          <View style={s.chips}>
            {GENDERS.map((g) => (
              <Pressable
                key={g}
                onPress={() => setGender(g)}
                style={[s.chip, g === gender && s.chipOn]}
              >
                <Text style={[s.chipTxt, g === gender && s.chipTxtOn]}>
                  {g}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={s.sectionLabel}>PAYS</Text>
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
          <Pressable
            onPress={handleRegister}
            disabled={loading}
            style={[s.btn, loading && { opacity: 0.7 }]}
          >
            <Text style={s.btnTxt}>
              {loading ? "Création..." : "Créer mon compte 🚀"}
            </Text>
          </Pressable>
          <Pressable onPress={() => navigation.goBack()} style={s.loginBtn}>
            <Text style={s.loginBtnTxt}>Déjà un compte ? Se connecter</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  autoCapitalize,
  secureTextEntry,
  autoFocus,
}: any) {
  return (
    <View style={inp.wrap}>
      <Text style={inp.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={autoCapitalize ?? "words"}
        secureTextEntry={secureTextEntry}
        autoFocus={autoFocus}
        style={inp.input}
      />
    </View>
  );
}
const inp = StyleSheet.create({
  wrap: { marginBottom: 12 },
  label: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 6,
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
});
const s = StyleSheet.create({
  pwdWrap: { gap: 6, marginTop: -4 },
  pwdBars: { flexDirection: "row", gap: 6 },
  pwdBar: { flex: 1, height: 4, borderRadius: 2 },
  pwdTxt: { fontSize: 12, fontWeight: "700" },
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
  title: { color: colors.text, fontSize: 18, fontWeight: "900" },
  scroll: { padding: 20, paddingBottom: 40 },
  showPwd: { alignSelf: "flex-end", marginBottom: 12 },
  showPwdTxt: { color: colors.neonRed, fontSize: 12, fontWeight: "600" },
  sectionLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 4,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 },
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
  btn: {
    backgroundColor: colors.neonRed,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
    shadowColor: colors.neonRed,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  btnTxt: { color: "#fff", fontSize: 15, fontWeight: "900", letterSpacing: 1 },
  loginBtn: { alignItems: "center", paddingVertical: 14 },
  loginBtnTxt: { color: colors.muted, fontSize: 13 },
});
