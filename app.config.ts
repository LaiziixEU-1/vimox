import "dotenv/config";
import { ExpoConfig } from "expo/config";

// Icônes de l'app au choix (avantage Vim+) : le module n'est ajouté que s'il est installé
// (« npx expo install expo-alternate-app-icons »), sinon la configuration reste inchangée.
const ICON_VARIANTS = [
  ["Gold", "#000000"],
  ["Neon", "#000000"],
  ["Glacier", "#000000"],
  ["Rose", "#000000"],
  ["Mint", "#000000"],
  ["Silver", "#000000"],
  ["Snow", "#F6F6F9"],
] as const;
function alternateIconsPlugin(): any[] {
  try {
    require.resolve("expo-alternate-app-icons");
  } catch {
    return [];
  }
  return [
    [
      "expo-alternate-app-icons",
      ICON_VARIANTS.map(([name, bg]) => ({
        name,
        ios: `./assets/app-icons/${name.toLowerCase()}.png`,
        android: { foregroundImage: `./assets/app-icons/${name.toLowerCase()}-android.png`, backgroundColor: bg },
      })),
    ],
  ];
}

// Publicités Google AdMob : le module n'est ajouté que s'il est installé
// (« npx expo install react-native-google-mobile-ads »). Sans identifiants d'app dans .env, on met les
// identifiants de TEST officiels de Google (sinon l'app planterait au démarrage).
function adMobPlugin(): any[] {
  try {
    require.resolve("react-native-google-mobile-ads");
  } catch {
    return [];
  }
  return [
    [
      "react-native-google-mobile-ads",
      {
        androidAppId: process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID || "ca-app-pub-3940256099942544~3347511713",
        iosAppId: process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID || "ca-app-pub-3940256099942544~1458002511",
        userTrackingUsageDescription:
          "Ton accord permet d'afficher des publicités plus adaptées. Sans lui, tu verras des publicités non personnalisées.",
      },
    ],
  ];
}

// Identifiant du projet EAS : lu dans « eas-project.json », fichier créé par « scripts\link-eas.ps1 ».
// Il est volontairement HORS du code : installer un pack ne l'écrase jamais (voir BUILD-EAS.md, section 2).
function easProjectId(): string | undefined {
  try {
    const id = require("./eas-project.json")?.projectId;
    return typeof id === "string" && id.length > 0 ? id : undefined;
  } catch {
    return undefined;
  }
}

const config: ExpoConfig & { splash?: unknown } = {
  name: "VimoX",
  slug: "vimox",
  version: "1.0.0",
  orientation: "portrait",
  scheme: "vimox",
  userInterfaceStyle: "dark",
  icon: "./assets/icon.png",
  splash: {
    image: "./assets/splash.png",
    resizeMode: "contain",
    backgroundColor: "#09090C",
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.vimox.app",
    buildNumber: "1",
    infoPlist: {
      // L'app n'utilise que le chiffrement standard (HTTPS) : évite la question de conformité à chaque envoi.
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription:
        "VimoX utilise la caméra pour prendre des photos et des vidéos (Vims, stories, profil) et pour les appels vidéo.",
      NSMicrophoneUsageDescription:
        "VimoX utilise le micro pour les messages vocaux, les vidéos et les appels.",
      NSPhotoLibraryUsageDescription:
        "VimoX utilise la galerie pour choisir une photo de profil, une photo à envoyer ou un autocollant.",
      NSPhotoLibraryAddUsageDescription:
        "VimoX a besoin d'enregistrer tes Vims dans ta galerie.",
    },
  },
  android: {
    package: "com.vimox.app",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#09090C",
    },
    permissions: ["CAMERA", "RECORD_AUDIO", "READ_MEDIA_IMAGES"],
  },
  plugins: [
    ...alternateIconsPlugin(),
    ...adMobPlugin(),
    "expo-camera",
    "expo-image-picker",
    // Sans ces plugins, une version publiée plante quand on demande la position ou les contacts,
    // et les notifications push n'obtiennent pas leur autorisation (tout marche pourtant dans Expo Go).
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "VimoX utilise ta position pour l'ajouter à une photo ou la partager dans une conversation.",
      },
    ],
    [
      "expo-contacts",
      {
        contactsPermission:
          "VimoX accède à tes contacts uniquement pour partager un contact dans une conversation.",
      },
    ],
    [
      "expo-audio",
      {
        microphonePermission:
          "VimoX utilise le micro pour les messages vocaux, les vidéos et les appels.",
      },
    ],
    "expo-notifications",
    [
      "expo-media-library",
      {
        photosPermission:
          "VimoX a besoin d'accéder à tes photos pour enregistrer tes Vims.",
        savePhotosPermission:
          "VimoX a besoin d'enregistrer tes Vims dans ta galerie.",
      },
    ],
  ],
  extra: {
    eas: {
      projectId: easProjectId(),
    },
  },
};

export default config;
