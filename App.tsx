import "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { AuthProvider } from "./src/services/AuthContext";
import { isFirebaseConfigured } from "./src/config/env";
import { SetupRequiredScreen } from "./src/screens/SetupRequiredScreen";
import { ExpoGoTestScreen } from "./src/screens/ExpoGoTestScreen";

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
    <AuthProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
