import { Image, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

type Props = {
  size?: number;
  showWordmark?: boolean;
  compact?: boolean;
};

export function VimoXLogo({
  size = 210,
  showWordmark = true,
  compact = false,
}: Props) {
  const imgSize = compact ? size : Math.round(size * 0.85);

  return (
    <View style={styles.wrap}>
      <Image
        source={require("../../assets/icon.png")}
        style={{ width: imgSize, height: imgSize, resizeMode: "contain" }}
      />
      {showWordmark && (
        <>
          <Text
            style={[
              styles.word,
              { fontSize: Math.max(28, Math.round(size * 0.22)) },
            ]}
          >
            VIMO<Text style={styles.wordX}>X</Text>
          </Text>
          {!compact && (
            <Text style={styles.tagline}>TALK. CONNECT. ANYWHERE.</Text>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  word: {
    fontWeight: "900",
    letterSpacing: 4,
    color: colors.text,
    marginTop: -4,
  },
  wordX: { color: colors.neonRed },
  tagline: {
    color: colors.muted,
    marginTop: 4,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 3,
  },
});
