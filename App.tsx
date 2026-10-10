import "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { AuthProvider } from "./src/services/AuthContext";
import { isFirebaseConfigured } from "./src/config/env";
import { SetupRequiredScreen } from "./src/screens/SetupRequiredScreen";
import { ExpoGoTestScreen } from "./src/screens/ExpoGoTestScreen";
import { ThemeProvider } from "./src/theme/ThemeContext";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ConsentScreen, CONSENT_KEY } from "./src/screens/ConsentScreen";
import { OnboardingScreen, ONBOARDING_KEY } from "./src/screens/OnboardingScreen";
import { useNavigationContainerRef } from "@react-navigation/native";
import { View, ActivityIndicator } from "react-native";

function AppInner() {
  const navigationRef = useNavigationContainerRef();
  const [consentGiven, setConsentGiven] = useState<boolean | null>(null);
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);

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
        <ActivityIndicator color="#E8000A" size="large" />
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
      <RootNavigator />
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
    <ThemeProvider>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </ThemeProvider>
  );
}