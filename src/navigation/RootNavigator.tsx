/*VIMOX-V29*/
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LensCameraScreen from "../features/lenses/LensCameraScreen";
import { colors } from "../theme/colors";
import { RootStackParamList } from "../models/types";
import { useAuth } from "../services/AuthContext";
import { LoginScreen } from "../screens/LoginScreen";
import { RegistrationScreen } from "../screens/RegistrationScreen";
import { ChatRoomScreen } from "../screens/ChatRoomScreen";
import { VideoCallScreen } from "../screens/VideoCallScreen";
import { AccountSettingsScreen } from "../screens/AccountSettingsScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { EditProfileScreen } from "../screens/EditProfileScreen";
import { LegalScreen } from "../screens/LegalScreen";
import { PremiumScreen } from "../screens/PremiumScreen";
import { FriendsScreen } from "../screens/FriendsScreen";
import { AddFriendsScreen } from "../screens/AddFriendsScreen";
import { NewChatScreen } from "../screens/NewChatScreen";
import { NewShortcutScreen } from "../screens/NewShortcutScreen";
import { ManageChatsScreen } from "../screens/ManageChatsScreen";
import { ManageFriendsScreen } from "../screens/ManageFriendsScreen";
import { BestFriendEmojisScreen } from "../screens/BestFriendEmojisScreen";
import { FriendChatScreen } from "../screens/FriendChatScreen";
import { GroupChatScreen } from "../screens/GroupChatScreen";
import { RecentMatchesScreen } from "../screens/RecentMatchesScreen";
import { NewGroupScreen } from "../screens/NewGroupScreen";
import { ShareProfileScreen } from "../screens/ShareProfileScreen";
import { UserProfileScreen } from "../screens/UserProfileScreen";
import { GameScreen } from "../games/GameScreen";
import { StoriesFeedScreen } from "../screens/StoriesFeedScreen";
import { StoryViewerScreen } from "../screens/StoryViewerScreen";
import { CreateStoryScreen } from "../screens/CreateStoryScreen";
import { SendToScreen } from "../screens/SendToScreen";
import { SnapViewerScreen } from "../screens/SnapViewerScreen";
import { CameraScreen } from "../screens/CameraScreen";
import { SwipePager } from "./SwipePager";
import { SuspendedScreen } from "../screens/SuspendedScreen";
import { isSuspended, suspendedUntilMs } from "../services/suspension";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { profile, loading } = useAuth();

  // La suspension se lève toute seule : on réévalue l'écran à l'heure de fin
  const [, tick] = useState(0);
  const suspendedUntil = suspendedUntilMs(profile);
  useEffect(() => {
    const wait = suspendedUntil - Date.now();
    if (wait <= 0) return;
    const id = setTimeout(() => tick((n) => n + 1), Math.min(wait + 500, 2147483000));
    return () => clearTimeout(id);
  }, [suspendedUntil]);

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
        <ActivityIndicator color={colors.neonRed} />
      </View>
    );
  }

  // Compte suspendu (signalements répétés) : écran bloquant, aucun accès au reste de l'application
  if (profile && isSuspended(profile)) {
    return <SuspendedScreen />;
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
          <Stack.Screen name="Matching" component={SwipePager} />
          <Stack.Screen
            name="StoriesFeed"
            component={StoriesFeedScreen}
            options={{ animation: "fade" }}
          />
          <Stack.Screen
            name="StoryViewer"
            component={StoryViewerScreen}
            options={{ animation: "fade", presentation: "fullScreenModal" }}
          />
          <Stack.Screen
            name="SnapViewer"
            component={SnapViewerScreen}
            options={{ animation: "fade", presentation: "fullScreenModal" }}
          />
          <Stack.Screen
            name="SendTo"
            component={SendToScreen}
            options={{ animation: "slide_from_bottom" }}
          />
          <Stack.Screen
            name="CreateStory"
            options={{ animation: "slide_from_bottom" }}
          >
            {({ navigation }) => (
              <CreateStoryScreen onClose={() => navigation.goBack()} />
            )}
          </Stack.Screen>
          <Stack.Screen
            name="CameraDirect"
            options={{ animation: "slide_from_bottom" }}
          >
            {({ navigation, route }) => (
              <CameraScreen navigation={navigation} route={route} />
            )}
          </Stack.Screen>
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
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="Profile"
            component={ProfileScreen}
            options={{ animation: "fade" }}
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
          <Stack.Screen
            name="Friends"
            component={FriendsScreen}
            options={{ animation: "fade" }}
          />
          <Stack.Screen
            name="AddFriends"
            component={AddFriendsScreen}
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen name="LensCamera" component={LensCameraScreen} options={{ headerShown: false, animation: "slide_from_bottom" }} />
          <Stack.Screen name="NewChat" component={NewChatScreen} options={{ animation: "slide_from_bottom" }} />
          <Stack.Screen name="NewShortcut" component={NewShortcutScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="ManageChats" component={ManageChatsScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="ManageFriends" component={ManageFriendsScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="BestFriendEmojis" component={BestFriendEmojisScreen} options={{ animation: "slide_from_right" }} />
          <Stack.Screen
            name="FriendChat"
            component={FriendChatScreen}
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="GroupChat"
            component={GroupChatScreen}
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="RecentMatches"
            component={RecentMatchesScreen}
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="NewGroup"
            component={NewGroupScreen}
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="ShareProfile"
            component={ShareProfileScreen}
            options={{ animation: "slide_from_bottom" }}
          />
          <Stack.Screen
            name="UserProfile"
            component={UserProfileScreen}
            options={{ animation: "slide_from_bottom" }}
          />
          <Stack.Screen
            name="GameScreen"
            component={GameScreen}
            options={{ animation: "slide_from_bottom" }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
