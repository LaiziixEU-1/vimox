import "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { OfflineBanner } from "./src/components/OfflineBanner";
import { InAppBanner } from "./src/components/InAppBanner";
import { AuthProvider } from "./src/services/AuthContext";
import { isFirebaseConfigured } from "./src/config/env";
import { SetupRequiredScreen } from "./src/screens/SetupRequiredScreen";
import { ExpoGoTestScreen } from "./src/screens/ExpoGoTestScreen";
import { ThemeProvider } from "./src/theme/ThemeContext";
import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ConsentScreen, CONSENT_KEY } from "./src/screens/ConsentScreen";
import { OnboardingScreen, ONBOARDING_KEY } from "./src/screens/OnboardingScreen";
import { useNavigationContainerRef } from "@react-navigation/native";
import { View, ActivityIndicator, Linking } from "react-native";
import { useAuth } from "./src/services/AuthContext";
import { parseProfileLink } from "./src/utils/deepLink";
import {
  routeFromNotification,
  subscribeNotificationTaps,
} from "./src/services/notificationService";

function AppInner() {
  const navigationRef = useNavigationContainerRef();
  const [consentGiven, setConsentGiven] = useState<boolean | null>(null);
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const { profile } = useAuth();
  // Écran à ouvrir (lien de profil ou notification touchée). S'il arrive avant la connexion
  // ou avant que la navigation soit prête, il est gardé en attente.
  const pendingTarget = useRef<{ name: string; params?: any } | null>(null);

  function goTo(target: { name: string; params?: any } | null) {
    if (!target) return;
    if (profile && navigationRef.isReady()) {
      (navigationRef as any).navigate(target.name, target.params);
    } else {
      pendingTarget.current = target;
    }
  }

  function openProfileLink(url: string | null) {
    const id = parseProfileLink(url);
    if (id) goTo({ name: "UserProfile", params: { userId: id } });
  }

  useEffect(() => {
    Linking.getInitialURL().then((u) => openProfileLink(u ?? null)).catch(() => {});
    const sub = Linking.addEventListener("url", (e) => openProfileLink(e.url));
    return () => sub.remove();
  }, [profile?.id]);

  // Toucher une notification ouvre la bonne conversation
  useEffect(() => {
    return subscribeNotificationTaps((data) => goTo(routeFromNotification(data)));
  }, [profile?.id]);

  useEffect(() => {
    if (profile && pendingTarget.current && navigationRef.isReady()) {
      const target = pendingTarget.current;
      pendingTarget.current = null;
      (navigationRef as any).navigate(target.name, target.params);
    }
  }, [profile?.id, consentGiven, onboardingDone]);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(CONSENT_KEY),
      AsyncStorage.getItem(ONBOARDING_KEY),
    ]).then(([consent, onboarding]) => {
      setConsentGiven(consent === "true");
      setOnboardingDone(onboarding === "true");
    });
  }, []);

  // ✅ Fix écran blanc — spinner pendant le chargement
  if (consentGiven === null || onboardingDone === null) {
    return (
      <View style={{ flex: 1, backgroundColor: "#030303",
        alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color="#FF2E4D" size="large" />
      </View>
    );
  }

  // ✅ Fix ordre — onboarding avant consent
  if (!onboardingDone) {
    return <OnboardingScreen onDone={() => setOnboardingDone(true)} />;
  }

  if (!consentGiven) {
    return <ConsentScreen onAccept={() => setConsentGiven(true)} />;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar style="light" />
      <ErrorBoundary>
        <RootNavigator />
      </ErrorBoundary>
      <OfflineBanner />
      {profile && <InAppBanner navigationRef={navigationRef} />}
    </NavigationContainer>
  );
}

export default function App() {
  if (process.env.EXPO_PUBLIC_VIMOX_EXPO_GO_TEST === "1") {
    return (
      <>
        <StatusBar style="light" />
        <ExpoGoTestScreen />
      </>
    );
  }

  if (!isFirebaseConfigured()) {
    return (
      <>
        <StatusBar style="light" />
        <SetupRequiredScreen />
      </>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppInner />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}