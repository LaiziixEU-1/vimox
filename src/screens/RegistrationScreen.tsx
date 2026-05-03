import { useState } from "react";
import { ComponentProps } from "react";
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
import { NeonButton } from "../components/NeonButton";
import { VimoXLogo } from "../components/VimoXLogo";
import { Gender } from "../models/types";
import { registerUser } from "../services/authService";
import { colors } from "../theme/colors";

const genders: Exclude<Gender, "Tous">[] = [
  "Femme",
  "Homme",
  "Non-binaire",
  "Autre",
];
const countries = [
  "France",
  "Suisse",
  "Belgique",
  "Canada",
  "Maroc",
  "Algérie",
  "Tunisie",
];

export function RegistrationScreen() {
  const [name, setName] = useState("");
  const [age, setAge] = useState("16");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [gender, setGender] = useState<Exclude<Gender, "Tous">>("Autre");
  const [country, setCountry] = useState("France");
  const [loading, setLoading] = useState(false);

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
      });
    } catch (error) {
      Alert.alert(
        "Inscription impossible",
        error instanceof Error ? error.message : "Erreur inconnue",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.logoContainer}>
            <VimoXLogo size={120} showWordmark={false} />
            <Text style={styles.brand}>
              VIMO<Text style={styles.brandX}>X</Text>
            </Text>
            <Text style={styles.subtitle}>Créer un compte</Text>
            <Text style={styles.subtitleSub}>Rejoins la communauté VimoX</Text>
          </View>

          <View style={styles.form}>
            <Input
              placeholder="Nom complet"
              value={name}
              onChangeText={setName}
              icon="👤"
            />
            <Input
              placeholder="Âge"
              value={age}
              onChangeText={setAge}
              keyboardType="number-pad"
              icon="🎂"
            />
            <Input
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              icon="✉"
            />
            <Input
              placeholder="Mot de passe"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              icon="🔒"
            />

            <Text style={styles.label}>Genre</Text>
            <View style={styles.choices}>
              {genders.map((g) => (
                <Pressable
                  key={g}
                  onPress={() => setGender(g)}
                  style={[styles.choice, gender === g && styles.choiceActive]}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      gender === g && styles.choiceTextActive,
                    ]}
                  >
                    {g}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>Pays</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.choicesRow}>
                {countries.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setCountry(c)}
                    style={[
                      styles.choice,
                      country === c && styles.choiceActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        country === c && styles.choiceTextActive,
                      ]}
                    >
                      {c}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>

          <NeonButton
            title={loading ? "Création..." : "S'inscrire"}
            onPress={submit}
            disabled={loading}
          />

          <Text style={styles.note}>
            Tu pourras ajouter ta photo depuis ton profil.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function Input({
  icon,
  ...props
}: ComponentProps<typeof TextInput> & { icon?: string }) {
  return (
    <View style={styles.inputWrapper}>
      {icon && <Text style={styles.inputIcon}>{icon}</Text>}
      <TextInput
        placeholderTextColor={colors.muted}
        style={styles.input}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  content: { padding: 24, paddingTop: 60, gap: 20 },
  logoContainer: { alignItems: "center", gap: 6 },
  brand: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: 4,
  },
  brandX: { color: colors.neonRed },
  subtitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    marginTop: 8,
  },
  subtitleSub: { color: colors.muted, fontSize: 14 },
  form: { gap: 12 },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
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
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choicesRow: { flexDirection: "row", gap: 8 },
  choice: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  choiceActive: {
    borderColor: colors.neonRed,
    backgroundColor: "rgba(232,0,10,0.1)",
  },
  choiceText: { color: colors.muted, fontWeight: "600", fontSize: 13 },
  choiceTextActive: { color: colors.neonRed },
  note: { color: colors.muted, textAlign: "center", fontSize: 12 },
});
