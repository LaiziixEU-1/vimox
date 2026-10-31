import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, BackHandler, View } from "react-native";
import PagerView from "react-native-pager-view";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../models/types";
import { FriendsScreen } from "../screens/FriendsScreen";
import { MatchingScreen } from "../screens/MatchingScreen";
import { CameraScreen } from "../screens/CameraScreen";
import { StoriesFeedScreen } from "../screens/StoriesFeedScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { BottomTabBar } from "../components/BottomTabBar";
import { pagerBus } from "./pagerBus";
import { soundStore } from "../features/sounds/soundStore";
import { useAuth } from "../services/AuthContext";
import { canUseMatch } from "../services/ageGate";
import { CAMERA_PAGE_INDEX, PageName, pagesFor } from "./pages";

type Props = NativeStackScreenProps<RootStackParamList, "Matching">;

const CAMERA_PAGE = CAMERA_PAGE_INDEX;

function fakeRoute(name: PageName) {
  return { key: `${name}-page`, name, params: undefined } as any;
}

const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

export function SwipePager({ navigation }: Props) {
  const pagerRef = useRef<PagerView>(null);
  // « Match » (rencontres avec des inconnus) : seulement pour les adultes. Il est à droite des stories,
  // donc les autres pages gardent la même position même si l'âge arrive une fraction de seconde plus tard.
  const { profile } = useAuth();
  const showMatch = canUseMatch(profile);
  const pages = useMemo(() => pagesFor(showMatch), [showMatch]);
  const pagesRef = useRef(pages);
  pagesRef.current = pages;
  const [pageIndex, setPageIndex] = useState(CAMERA_PAGE);
  const pageIndexRef = useRef(CAMERA_PAGE);
  pageIndexRef.current = pageIndex;
  const [editing, setEditing] = useState(false);
  const editingRef = useRef(false);
  editingRef.current = editing;
  // La caméra ne tourne que lorsqu'elle est (au moins en partie) visible
  const [camVisible, setCamVisible] = useState(true);
  const camVisibleRef = useRef(true);
  const scrollOffset = useRef(new Animated.Value(CAMERA_PAGE)).current;

  function goToTab(name: PageName) {
    const i = pagesRef.current.indexOf(name);
    if (i >= 0) pagerRef.current?.setPage(i); // une page absente (Match pour un mineur) est ignorée
  }

  // Les autres écrans peuvent demander une page (ex. « Ma story + » → caméra)
  useEffect(() => pagerBus.subscribe((page) => goToTab(page)), []);

  // « Utiliser ce son » depuis une Story ou un Snap : on ouvre la caméra, comme sur Snap
  // (c'est la caméra elle-même qui récupère le son)
  useEffect(() => soundStore.subscribe(() => goToTab("Camera")), []);

  // Bouton retour Android : depuis une autre page, il ramène d'abord à la caméra (comme Snap)
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        if (editingRef.current) return false; // l'éditeur photo gère son propre retour
        if (pageIndexRef.current !== CAMERA_PAGE) {
          pagerRef.current?.setPage(CAMERA_PAGE);
          return true;
        }
        return false;
      });
      return () => sub.remove();
    }, []),
  );

  function handlePageScroll(e: any) {
    const { position, offset } = e.nativeEvent;
    const pos = position + offset;
    scrollOffset.setValue(pos);
    // Page de la caméra : visible dès qu'on commence à glisser vers elle
    const visible = pos > CAMERA_PAGE - 1 && pos < CAMERA_PAGE + 1;
    if (visible !== camVisibleRef.current) {
      camVisibleRef.current = visible;
      setCamVisible(visible);
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <AnimatedPagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={CAMERA_PAGE}
        scrollEnabled={!editing}
        onPageSelected={(e) => {
          setPageIndex(e.nativeEvent.position);
          const page = pagesRef.current[e.nativeEvent.position];
          if (page) pagerBus.setCurrent(page as any);
        }}
        onPageScroll={handlePageScroll}
      >
        {pages.map((name, i) => {
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
                    embedded
                  />
                )}
                {name === "Camera" && (
                  <CameraScreen
                    navigation={navigation}
                    onEditingChange={setEditing}
                    active={camVisible}
                  />
                )}
                {name === "StoriesFeed" && (
                  <StoriesFeedScreen
                    navigation={navigation as any}
                    route={fakeRoute(name)}
                    embedded
                  />
                )}
                {name === "Profile" && (
                  <ProfileScreen
                    navigation={navigation as any}
                    route={fakeRoute(name)}
                    embedded
                  />
                )}
              </Animated.View>
            </View>
          );
        })}
      </AnimatedPagerView>

      {!editing && (
        <BottomTabBar active={pages[pageIndex] ?? "Camera"} pages={pages} onTabPress={goToTab} />
      )}
    </View>
  );
}
