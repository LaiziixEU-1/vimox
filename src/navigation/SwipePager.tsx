import { useRef, useState } from "react";
import { Animated, View } from "react-native";
import PagerView from "react-native-pager-view";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../models/types";
import { FriendsScreen } from "../screens/FriendsScreen";
import { MatchingScreen } from "../screens/MatchingScreen";
import { CameraScreen } from "../screens/CameraScreen";
import { StoriesFeedScreen } from "../screens/StoriesFeedScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { BottomTabBar } from "../components/BottomTabBar";

type Props = NativeStackScreenProps<RootStackParamList, "Matching">;

const PAGES = [
  "Matching",
  "Friends",
  "Camera",
  "StoriesFeed",
  "Profile",
] as const;
type PageName = (typeof PAGES)[number];

function fakeRoute(name: PageName) {
  return { key: `${name}-page`, name, params: undefined } as any;
}

const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

export function SwipePager({ navigation }: Props) {
  const pagerRef = useRef<PagerView>(null);
  const [pageIndex, setPageIndex] = useState(2); // démarre sur Camera
  const scrollOffset = useRef(new Animated.Value(2)).current;

  function goToTab(name: PageName) {
    pagerRef.current?.setPage(PAGES.indexOf(name));
  }

  function handlePageScroll(e: any) {
    const { position, offset } = e.nativeEvent;
    scrollOffset.setValue(position + offset);
  }

  return (
    <View style={{ flex: 1 }}>
      <AnimatedPagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={2}
        onPageSelected={(e) => setPageIndex(e.nativeEvent.position)}
        onPageScroll={handlePageScroll}
      >
        {PAGES.map((name, i) => {
          const scale = scrollOffset.interpolate({
            inputRange: [i - 1, i, i + 1],
            outputRange: [0.94, 1, 0.94],
            extrapolate: "clamp",
          });
          const opacity = scrollOffset.interpolate({
            inputRange: [i - 1, i, i + 1],
            outputRange: [0.6, 1, 0.6],
            extrapolate: "clamp",
          });
          return (
            <View key={name} style={{ flex: 1 }}>
              <Animated.View
                style={{ flex: 1, transform: [{ scale }], opacity }}
              >
                {name === "Matching" && (
                  <MatchingScreen
                    navigation={navigation as any}
                    route={fakeRoute(name)}
                  />
                )}
                {name === "Friends" && (
                  <FriendsScreen
                    navigation={navigation as any}
                    route={fakeRoute(name)}
                  />
                )}
                {name === "Camera" && <CameraScreen navigation={navigation} />}
                {name === "StoriesFeed" && (
                  <StoriesFeedScreen
                    navigation={navigation as any}
                    route={fakeRoute(name)}
                  />
                )}
                {name === "Profile" && (
                  <ProfileScreen
                    navigation={navigation as any}
                    route={fakeRoute(name)}
                  />
                )}
              </Animated.View>
            </View>
          );
        })}
      </AnimatedPagerView>

      <BottomTabBar active={PAGES[pageIndex]} onTabPress={goToTab} />
    </View>
  );
}
