export const env = {
  firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  firebaseMessagingSenderId:
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export function isFirebaseConfigured() {
  return Boolean(
    env.firebaseApiKey &&
    env.firebaseProjectId &&
    env.firebaseAppId &&
    !env.firebaseApiKey.includes("ta_cle") &&
    !env.firebaseProjectId.includes("ton-projet") &&
    !env.firebaseAppId.includes("abcdef"),
  );
}

// Cloudinary
export const CLOUDINARY_CLOUD_NAME = "dsy6m6lvo";
export const CLOUDINARY_UPLOAD_PRESET = "Racine";
