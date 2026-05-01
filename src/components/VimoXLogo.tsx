import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, G, LinearGradient, Path, Stop } from "react-native-svg";
import { colors } from "../theme/colors";

type Props = {
  size?: number;
  showWordmark?: boolean;
  compact?: boolean;
};

export function VimoXLogo({ size = 210, showWordmark = true, compact = false }: Props) {
  const markSize = compact ? size : Math.round(size * 0.72);

  return (
    <View style={styles.wrap}>
      <View style={[styles.glow, { width: markSize, height: markSize }]}>
        <Svg width={markSize} height={markSize} viewBox="0 0 240 240">
          <Defs>
            <LinearGradient id="ring" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.neonRed} />
              <Stop offset="0.48" stopColor={colors.neonRed} />
              <Stop offset="0.52" stopColor={colors.neonBlue} />
              <Stop offset="1" stopColor={colors.neonBlue} />
            </LinearGradient>
            <LinearGradient id="vLeft" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FF6B6B" />
              <Stop offset="1" stopColor={colors.neonRed} />
            </LinearGradient>
            <LinearGradient id="vRight" x1="0" y1="1" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.neonBlue} />
              <Stop offset="1" stopColor="#7CE7FF" />
            </LinearGradient>
          </Defs>

          <G opacity={0.22}>
            <Circle cx="118" cy="102" r="79" stroke={colors.neonRed} strokeWidth="14" fill="none" />
            <Circle cx="122" cy="102" r="79" stroke={colors.neonBlue} strokeWidth="14" fill="none" />
          </G>

          <Path
            d="M43 177 L23 207 L66 190 C85 201 107 207 131 204 C180 199 218 164 222 116 C227 58 182 18 125 19 C70 19 28 56 25 108 C24 134 34 157 52 173 Z"
            fill="#05050A"
            stroke="url(#ring)"
            strokeWidth="8"
            strokeLinejoin="round"
          />

          <Path
            d="M70 62 L104 82 L122 163 L105 150 Z"
            fill="url(#vLeft)"
            stroke="#FFB3B3"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <Path
            d="M170 64 L134 84 L113 164 L133 147 Z"
            fill="url(#vRight)"
            stroke="#A7ECFF"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <Path d="M116 129 L128 151 L120 172 L107 151 Z" fill="#05050A" stroke={colors.neonBlue} strokeWidth="2" />
        </Svg>
      </View>

      {showWordmark && (
        <>
          <Text style={[styles.word, { fontSize: Math.max(34, Math.round(size * 0.24)) }]}>
            <Text style={styles.wordBlue}>Vimo</Text>
            <Text style={styles.wordRed}>X</Text>
          </Text>
          {!compact && <Text style={styles.tagline}>TALK. CONNECT. ANYWHERE.</Text>}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center"
  },
  glow: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.neonBlue,
    shadowOpacity: 0.95,
    shadowRadius: 24
  },
  word: {
    marginTop: -8,
    fontWeight: "900",
    letterSpacing: 1,
    textShadowColor: colors.neonBlue,
    textShadowRadius: 13
  },
  wordBlue: {
    color: "#CDEEFF"
  },
  wordRed: {
    color: colors.neonRed,
    textShadowColor: colors.neonRed,
    textShadowRadius: 16
  },
  tagline: {
    color: colors.neonBlue,
    marginTop: 2,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 4,
    textShadowColor: colors.neonBlue,
    textShadowRadius: 8
  }
});

