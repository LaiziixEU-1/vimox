import "dotenv/config";
import { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
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
    backgroundColor: "#0A0A0F",
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.vimox.app",
    infoPlist: {
      NSCameraUsageDescription:
        "VimoX utilise la caméra pour le chat vidéo et la photo de profil.",
      NSMicrophoneUsageDescription:
        "VimoX utilise le micro pour le chat vidéo.",
      NSPhotoLibraryUsageDescription:
        "VimoX utilise la galerie pour choisir une photo de profil.",
    },
  },
  android: {
    package: "com.vimox.app",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0A0A0F",
    },
    permissions: ["CAMERA", "RECORD_AUDIO", "READ_MEDIA_IMAGES"],
  },
  plugins: ["expo-camera", "expo-image-picker"],
  extra: {
    eas: {
      projectId: "237e6aa7-1c54-438c-8781-a4e404f23ecf",
    },
  },
};

export default config;
