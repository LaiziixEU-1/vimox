import { Component } from "react";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

// Sans cela, une erreur dans un écran donne un écran blanc sans issue.
// Ici : un message clair et un bouton pour réessayer.
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error("[VimoX] erreur d'affichage :", error, info?.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={s.root}>
        <Text style={s.title}>Oups, un problème est survenu</Text>
        <Text style={s.sub}>
          L'application a rencontré une erreur inattendue. Tes données sont intactes.
        </Text>
        <Pressable onPress={this.reset} style={({ pressed }) => [s.btn, pressed && { opacity: 0.8 }]}>
          <Text style={s.btnTxt}>Réessayer</Text>
        </Pressable>
        {__DEV__ && <Text style={s.dev}>{String(this.state.error.message)}</Text>}
      </View>
    );
  }
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black, alignItems: "center", justifyContent: "center", padding: 32, gap: 14 },
  title: { color: colors.text, fontSize: 20, fontWeight: "900", textAlign: "center" },
  sub: { color: colors.muted, fontSize: 14, textAlign: "center", lineHeight: 20 },
  btn: { backgroundColor: colors.neonRed, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 13, marginTop: 6 },
  btnTxt: { color: "#fff", fontWeight: "800", fontSize: 15 },
  dev: { color: colors.mutedDark, fontSize: 11, textAlign: "center", marginTop: 10 },
});
