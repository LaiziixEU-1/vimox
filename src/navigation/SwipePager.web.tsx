// Version WEB du pager : utilisée uniquement dans un navigateur, jamais sur iPhone ni Android
// (Metro choisit automatiquement ce fichier .web.tsx pour le web).
// Le glissement entre pages n'existe pas sur le web : on change de page avec la barre du bas.
// Sert à tester à deux avec un seul téléphone : l'iPhone d'un côté, le navigateur du PC de l'autre.
import { useState } from "react";
import { View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../models/types";
import { FriendsScreen } from "../screens/FriendsScreen";
import { MatchingScreen } from "../screens/MatchingScreen";
import { CameraScreen } from "../screens/CameraScreen";
import { StoriesFeedScreen } from "../screens/StoriesFeedScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { BottomTabBar } from "../components/BottomTabBar";
import { useAuth } from "../services/AuthContext";
import { canUseMatch } from "../services/ageGate";
import { PageName, pagesFor } from "./pages";

type Props = NativeStackScreenProps<RootStackParamList, "Matching">;

function fakeRoute(name: PageName) {
  return { key: `${name}-page`, name, params: undefined } as any;
}

export function SwipePager({ navigation }: Props) {
  const { profile } = useAuth();
  const showMatch = canUseMatch(profile);
  const pages = pagesFor(showMatch);
  // Pour ces tests, on démarre sur « Match » (adultes) ou sur les messages : la caméra d'un navigateur n'est pas utile
  const [picked, setPicked] = useState<PageName | null>(null);
  const page: PageName = picked && pages.includes(picked) ? picked : showMatch ? "Matching" : "Friends";
  const [editing, setEditing] = useState(false);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {page === "Matching" && (
          <MatchingScreen
            navigation={navigation as any}
            route={fakeRoute(page)}
          />
        )}
        {page === "Friends" && (
          <FriendsScreen
            navigation={navigation as any}
            route={fakeRoute(page)}
            embedded
          />
        )}
        {page === "Camera" && (
          <CameraScreen
            navigation={navigation}
            onEditingChange={setEditing}
            active
          />
        )}
        {page === "StoriesFeed" && (
          <StoriesFeedScreen
            navigation={navigation as any}
            route={fakeRoute(page)}
            embedded
          />
        )}
        {page === "Profile" && (
          <ProfileScreen
            navigation={navigation as any}
            route={fakeRoute(page)}
            embedded
          />
        )}
      </View>

      {!editing && <BottomTabBar active={page} pages={pages} onTabPress={setPicked} />}
    </View>
  );
}
