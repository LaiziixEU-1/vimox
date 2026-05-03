import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { colors } from "../theme/colors";
import { RootStackParamList } from "../models/types";

type Props = NativeStackScreenProps<RootStackParamList, "Legal">;

export function LegalScreen({ route, navigation }: Props) {
  const { type } = route.params;
  const isCGU = type === "cgu";

  return (
    <LinearGradient
      colors={[colors.black, "#111122", "#16080D"]}
      style={styles.root}
    >
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ Retour</Text>
        </Pressable>
        <Text style={styles.title}>
          {isCGU ? "Conditions d'utilisation" : "Politique de confidentialité"}
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {isCGU ? <CGUContent /> : <PrivacyContent />}
      </ScrollView>
    </LinearGradient>
  );
}

function CGUContent() {
  return (
    <View style={styles.body}>
      <Text style={styles.updated}>Dernière mise à jour : mai 2025</Text>
      <Text style={styles.h2}>1. Acceptation des conditions</Text>
      <Text style={styles.p}>
        En utilisant VimoX, vous acceptez les présentes conditions. Si vous
        n'acceptez pas, veuillez ne pas utiliser l'application.
      </Text>
      <Text style={styles.h2}>2. Description du service</Text>
      <Text style={styles.p}>
        VimoX est une application de rencontres anonymes permettant de se
        connecter via chat et appel vidéo.
      </Text>
      <Text style={styles.h2}>3. Âge minimum</Text>
      <Text style={styles.p}>
        L'utilisation est réservée aux personnes de 16 ans et plus.
      </Text>
      <Text style={styles.h2}>4. Comportement des utilisateurs</Text>
      <Text style={styles.p}>
        {
          "Il est interdit de :\n• Partager du contenu illégal ou offensant\n• Harceler d'autres utilisateurs\n• Usurper une identité"
        }
      </Text>
      <Text style={styles.h2}>5. Modération</Text>
      <Text style={styles.p}>
        VimoX dispose d'un système de modération. Tout abus peut entraîner la
        suspension du compte.
      </Text>
      <Text style={styles.h2}>6. Limitation de responsabilité</Text>
      <Text style={styles.p}>
        VimoX n'est pas responsable des interactions entre utilisateurs.
      </Text>
      <Text style={styles.h2}>7. Contact</Text>
      <Text style={styles.p}>support@vimox.app</Text>
    </View>
  );
}

function PrivacyContent() {
  return (
    <View style={styles.body}>
      <Text style={styles.updated}>Dernière mise à jour : mai 2025</Text>
      <Text style={styles.h2}>1. Données collectées</Text>
      <Text style={styles.p}>
        {
          "Nous collectons :\n• Nom, âge, genre, pays\n• Email\n• Photo de profil (optionnelle)\n• Token de notification"
        }
      </Text>
      <Text style={styles.h2}>2. Utilisation des données</Text>
      <Text style={styles.p}>
        {
          "Vos données servent à :\n• Faire fonctionner le matching\n• Envoyer des notifications\n• Assurer la modération"
        }
      </Text>
      <Text style={styles.h2}>3. Conservation</Text>
      <Text style={styles.p}>
        Données supprimées dans les 30 jours suivant la suppression du compte.
      </Text>
      <Text style={styles.h2}>4. Partage</Text>
      <Text style={styles.p}>
        {
          "Nous ne vendons pas vos données. Elles sont partagées avec :\n• Firebase (Google)\n• Expo (notifications)"
        }
      </Text>
      <Text style={styles.h2}>5. Vos droits (RGPD)</Text>
      <Text style={styles.p}>
        {
          "Vous avez le droit d'accéder, rectifier, supprimer et porter vos données."
        }
      </Text>
      <Text style={styles.h2}>6. Contact</Text>
      <Text style={styles.p}>privacy@vimox.app</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingTop: 54,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.panelStrong,
  },
  back: { color: colors.neonBlue, fontWeight: "700", marginBottom: 8 },
  title: { color: colors.text, fontSize: 20, fontWeight: "900" },
  content: { padding: 20 },
  body: { gap: 12 },
  updated: { color: colors.muted, fontSize: 12, marginBottom: 8 },
  h2: { color: colors.neonBlue, fontSize: 15, fontWeight: "800", marginTop: 8 },
  p: { color: colors.muted, fontSize: 14, lineHeight: 22 },
});
