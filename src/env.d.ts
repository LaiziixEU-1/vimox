declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_FIREBASE_API_KEY?: string;
    EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN?: string;
    EXPO_PUBLIC_FIREBASE_PROJECT_ID?: string;
    EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET?: string;
    EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?: string;
    EXPO_PUBLIC_FIREBASE_APP_ID?: string;
    EXPO_PUBLIC_ADMOB_IOS_APP_ID?: string;
    EXPO_PUBLIC_ADMOB_IOS_BANNER_ID?: string;
    EXPO_PUBLIC_VIMOX_EXPO_GO_TEST?: string;
  }
}

declare const process: {
  env: NodeJS.ProcessEnv;
};
