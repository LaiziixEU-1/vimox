import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../models/types";
import { markSnapViewed } from "../services/snapService";
import { useAuth } from "../services/AuthContext";

type Props = NativeStackScreenProps<RootStackParamList, "SnapViewer">;
const DURATION = 6000;

export function SnapViewerScreen({ route, navigation }: Props) {
  const { imageURL, chatId, messageId, senderName, senderUid } = route.params;
  const { profile } = useAuth();
  const progress = useRef(new Animated.Value(0)).current;
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: DURATION,
      useNativeDriver: false,
    });
    anim.start(({ finished }) => {
      if (finished) close();
    });

    // Ne marque comme vu que si c'est le destinataire qui regarde (pas l'expéditeur)
    if (profile && profile.id !== senderUid) {
      markSnapViewed(chatId, messageId).catch(() => {});
    }

    return () => anim.stop();
  }, []);

  function close() {
    if (closing) return;
    setClosing(true);
    navigation.goBack();
  }

  return (
    <SafeAreaView style={s.root}>
      <Pressable style={StyleSheet.absoluteFill} onPress={close}>
        <Image
          source={{ uri: imageURL }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      </Pressable>
      <View style={s.bar}>
        <Animated.View
          style={[
            s.barFill,
            {
              width: progress.interpolate({
                inputRange: [0, 1],
                outputRange: ["0%", "100%"],
              }),
            },
          ]}
        />
      </View>
      <View style={s.header}>
        <Text style={s.senderName}>{senderName}</Text>
        <Pressable onPress={close} style={s.closeBtn}>
          <Text style={s.closeTxt}>✕</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  bar: {
    marginHorizontal: 10,
    marginTop: 8,
    height: 3,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.3)",
    overflow: "hidden",
  },
  barFill: { height: "100%", backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  senderName: { color: "#fff", fontWeight: "800", fontSize: 14 },
  closeBtn: { padding: 6 },
  closeTxt: { color: "#fff", fontSize: 20, fontWeight: "300" },
});
