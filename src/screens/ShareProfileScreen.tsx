/*VIMOX-V17*/
import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";
import { colors } from "../theme/colors";
import { useAuth } from "../services/AuthContext";
import { RootStackParamList } from "../models/types";
import { NeonButton } from "../components/NeonButton";
import { ScreenHeader } from "../components/ScreenHeader";
import { profileLink as buildProfileLink } from "../utils/deepLink";

type Props = NativeStackScreenProps<RootStackParamList, "ShareProfile">;

export function ShareProfileScreen({ navigation }: Props) {
  const { profile } = useAuth();
  const [copied, setCopied] = useState(false);

  if (!profile) return null;

  // Lien que l'app sait ouvrir (vimox://). Il fonctionne chez les personnes qui ont VimoX installé.
  const profileLink = buildProfileLink(profile.id);
  const shareText = `Ajoute-moi sur VimoX ! 🔥\nOuvre ce lien avec l'application VimoX installée :\n${profileLink}`;

  async function handleShare() {
    try {
      await Share.share({
        message: shareText,
        url: profileLink,
        title: `Profil de ${profile!.name} sur VimoX`,
      });
    } catch (e) {
      Alert.alert("Erreur", "Impossible de partager.");
    }
  }

  async function handleCopy() {
    await Clipboard.setStringAsync(profileLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Partager mon profil"
        onBack={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.qrContainer}>
          <View style={styles.qrCard}>
            <View style={styles.qrWrapper}>
              <QRCode
                value={profileLink}
                size={200}
                color={colors.text}
                backgroundColor="transparent"
                logo={require("../../assets/icon.png")}
                logoSize={40}
                logoBackgroundColor="transparent"
              />
            </View>
            <Text style={styles.qrName}>{profile.name}</Text>
            <Text style={styles.qrInfo}>
              {profile.country}
            </Text>
            {profile.isPremium && (
              <Text style={styles.qrPremium}>✦ Vim+</Text>
            )}
          </View>
        </View>

        <View style={styles.linkCard}>
          <Text style={styles.linkLabel}>Lien de profil</Text>
          <Text style={styles.linkText} numberOfLines={1}>
            {profileLink}
          </Text>
          <Pressable onPress={handleCopy} style={styles.copyBtn}>
            <Text style={styles.copyText}>
              {copied ? "✓ Copié !" : "Copier"}
            </Text>
          </Pressable>
        </View>

        <NeonButton title="📤 Partager" onPress={handleShare} />

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            💡 Partage ce QR code ou ce lien avec tes amis pour qu'ils
            rejoignent VimoX !
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  content: { padding: 20, paddingTop: 20, paddingBottom: 40, gap: 20 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  back: { color: colors.text, fontSize: 28, fontWeight: "300" },
  title: { color: colors.text, fontSize: 18, fontWeight: "800" },
  qrContainer: { alignItems: "center" },
  qrCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    width: "100%",
  },
  qrWrapper: {
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,46,77,0.3)",
  },
  qrName: { color: colors.text, fontSize: 20, fontWeight: "900" },
  qrInfo: { color: colors.muted, fontSize: 14 },
  qrPremium: { color: colors.neonRed, fontWeight: "700" },
  linkCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  linkLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  linkText: { color: colors.text, fontSize: 13, fontWeight: "600" },
  copyBtn: {
    backgroundColor: colors.neonRedBg,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.neonRed,
  },
  copyText: { color: colors.neonRedText, fontWeight: "800", fontSize: 14 },
  infoCard: {
    backgroundColor: "rgba(255,46,77,0.05)",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,46,77,0.15)",
  },
  infoText: { color: colors.muted, fontSize: 13, lineHeight: 20 },
});
