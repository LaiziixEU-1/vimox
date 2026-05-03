import { ActivityIndicator, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { colors } from "../theme/colors";
import { RootStackParamList } from "../models/types";
import { useAuth } from "../services/AuthContext";
import { LoginScreen } from "../screens/LoginScreen";
import { RegistrationScreen } from "../screens/RegistrationScreen";
import { MatchingScreen } from "../screens/MatchingScreen";
import { ChatRoomScreen } from "../screens/ChatRoomScreen";
import { VideoCallScreen } from "../screens/VideoCallScreen";
import { AccountSettingsScreen } from "../screens/AccountSettingsScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { EditProfileScreen } from "../screens/EditProfileScreen";
import { LegalScreen } from "../screens/LegalScreen";
import { PremiumScreen } from "../screens/PremiumScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.black,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ActivityIndicator color={colors.neonBlue} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.black },
        animation: "slide_from_right",
        animationDuration: 250,
      }}
    >
      {!profile ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen
            name="Register"
            component={RegistrationScreen}
            options={{ animation: "slide_from_bottom" }}
          />
          <Stack.Screen
            name="Legal"
            component={LegalScreen}
            options={{ animation: "slide_from_bottom" }}
          />
        </>
      ) : (
        <>
          <Stack.Screen name="Matching" component={MatchingScreen} />
          <Stack.Screen
            name="ChatRoom"
            component={ChatRoomScreen}
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="VideoCall"
            component={VideoCallScreen}
            options={{ animation: "fade" }}
          />
          <Stack.Screen
            name="AccountSettings"
            component={AccountSettingsScreen}
            options={{ animation: "slide_from_bottom" }}
          />
          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{ animation: "slide_from_bottom" }}
          />
          <Stack.Screen
            name="EditProfile"
            component={EditProfileScreen}
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="Legal"
            component={LegalScreen}
            options={{ animation: "slide_from_bottom" }}
          />
          <Stack.Screen
            name="Premium"
            component={PremiumScreen}
            options={{ animation: "slide_from_bottom" }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
