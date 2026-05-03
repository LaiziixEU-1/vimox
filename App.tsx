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
import { useNavigationContainerRef } from "@react-navigation/native";
import { useAuth } from "./src/services/AuthContext";

function AppInner() {
  const navigationRef = useNavigationContainerRef();
  const [consentGiven, setConsentGiven] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(CONSENT_KEY).then((val) => {
      setConsentGiven(val === "true");
    });
  }, []);

  if (consentGiven === null) return null;

  if (!consentGiven) {
    return <ConsentScreen onAccept={() => setConsentGiven(true)} />;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <StatusBar style="auto" />
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
