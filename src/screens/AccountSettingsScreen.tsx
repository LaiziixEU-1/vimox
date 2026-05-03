import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { GlassPanel } from "../components/GlassPanel";
import { NeonButton } from "../components/NeonButton";
import { colors } from "../theme/colors";
import { useAuth } from "../services/AuthContext";
import { deleteAccount } from "../services/authService";
import {
  updateEmail,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { auth } from "../config/firebase";

export function AccountSettingsScreen() {
  const { firebaseUser } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function reauthenticate() {
    if (!firebaseUser?.email) throw new Error("Aucun utilisateur connecté");
    if (!currentPassword) throw new Error("Entre ton mot de passe actuel");
    const credential = EmailAuthProvider.credential(
      firebaseUser.email,
      currentPassword,
    );
    await reauthenticateWithCredential(firebaseUser, credential);
  }

  async function handleChangeEmail() {
    if (!newEmail) return Alert.alert("Erreur", "Entre un nouvel email");
    try {
      setLoading(true);
      await reauthenticate();
      await updateEmail(firebaseUser!, newEmail);
      Alert.alert("Email modifié ✅", "Un email de vérification a été envoyé.");
      setNewEmail("");
      setCurrentPassword("");
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  async function handleChangePassword() {
    if (!newPassword)
      return Alert.alert("Erreur", "Entre un nouveau mot de passe");
    if (newPassword.length < 6)
      return Alert.alert("Erreur", "Minimum 6 caractères");
    try {
      setLoading(true);
      await reauthenticate();
      await updatePassword(firebaseUser!, newPassword);
      Alert.alert("Mot de passe modifié ✅");
      setNewPassword("");
      setCurrentPassword("");
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteAccount() {
    Alert.alert(
      "Supprimer le compte",
      "Cette action est irréversible. Ton compte et toutes tes données seront supprimés.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);
              await deleteAccount(currentPassword);
            } catch (e) {
              Alert.alert(
                "Erreur",
                e instanceof Error ? e.message : "Erreur inconnue",
              );
              setLoading(false);
            }
          },
        },
      ],
    );
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
          <Text style={styles.title}>Paramètres du compte</Text>

          <Text style={styles.subtitle}>
            Mot de passe actuel (requis pour toute modification)
          </Text>
          <GlassPanel>
            <TextInput
              style={styles.input}
              placeholder="Mot de passe actuel"
              placeholderTextColor={colors.muted}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              secureTextEntry
            />
          </GlassPanel>

          <Text style={styles.subtitle}>Modifier l'email</Text>
          <GlassPanel style={{ gap: 10 }}>
            <TextInput
              style={styles.input}
              placeholder="Nouvel email"
              placeholderTextColor={colors.muted}
              value={newEmail}
              onChangeText={setNewEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <NeonButton
              title={loading ? "..." : "Changer l'email"}
              onPress={handleChangeEmail}
              disabled={loading}
            />
          </GlassPanel>

          <Text style={styles.subtitle}>Modifier le mot de passe</Text>
          <GlassPanel style={{ gap: 10 }}>
            <TextInput
              style={styles.input}
              placeholder="Nouveau mot de passe"
              placeholderTextColor={colors.muted}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />
            <NeonButton
              title={loading ? "..." : "Changer le mot de passe"}
              onPress={handleChangePassword}
              disabled={loading}
            />
          </GlassPanel>

          <View style={styles.danger}>
            <Text style={styles.dangerTitle}>Zone dangereuse</Text>
            <NeonButton
              title="Supprimer mon compte"
              onPress={handleDeleteAccount}
              disabled={loading}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 22, paddingTop: 60, gap: 16 },
  title: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 8,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
  },
  input: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: colors.panelStrong,
    color: colors.text,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  danger: {
    marginTop: 16,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.neonRed,
    gap: 12,
  },
  dangerTitle: { color: colors.neonRed, fontWeight: "800", fontSize: 16 },
});
