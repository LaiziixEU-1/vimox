import { useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";

export const REPORT_REASONS = [
  "Contenu sexuel ou nudité",
  "Harcèlement ou menaces",
  "Haine ou discrimination",
  "Spam ou arnaque",
  "Personne mineure ou en danger",
  "Autre",
];

type Props = {
  visible: boolean;
  title: string; // nom de la personne
  subject?: string; // ex. « cette story »
  onClose: () => void;
  onReport: (reason: string) => Promise<void> | void;
  onBlock?: () => Promise<void> | void;
};

type Step = "menu" | "reasons" | "done" | "error";

// Feuille « Signaler / Bloquer », commune au chat d'amis, aux stories et aux profils
export function SafetySheet({
  visible,
  title,
  subject = "cette personne",
  onClose,
  onReport,
  onBlock,
}: Props) {
  const [step, setStep] = useState<Step>("menu");
  const [busy, setBusy] = useState(false);

  function close() {
    setStep("menu");
    setBusy(false);
    onClose();
  }

  async function send(reason: string) {
    if (busy) return;
    setBusy(true);
    try {
      await onReport(reason);
      setStep("done");
    } catch {
      setStep("error");
    } finally {
      setBusy(false);
    }
  }

  function confirmBlock() {
    if (!onBlock) return;
    Alert.alert(
      `Bloquer ${title} ?`,
      "Vous ne pourrez plus vous voir ni vous écrire. Tu peux débloquer depuis Paramètres.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Bloquer",
          style: "destructive",
          onPress: async () => {
            close();
            await onBlock();
          },
        },
      ],
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={s.backdrop} onPress={close}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <View style={s.handle} />
          {step === "menu" && (
            <>
              <Text style={s.title}>{title}</Text>
              <Pressable style={s.row} onPress={() => setStep("reasons")} accessibilityRole="button">
                <Ionicons name="flag-outline" size={20} color={colors.neonRedText} />
                <Text style={s.rowTxt}>Signaler {subject}</Text>
              </Pressable>
              {onBlock && (
                <Pressable style={s.row} onPress={confirmBlock} accessibilityRole="button">
                  <Ionicons name="ban-outline" size={20} color={colors.neonRedText} />
                  <Text style={s.rowTxt}>Bloquer {title}</Text>
                </Pressable>
              )}
              <Pressable style={[s.row, s.cancel]} onPress={close} accessibilityRole="button">
                <Text style={s.cancelTxt}>Annuler</Text>
              </Pressable>
            </>
          )}
          {step === "reasons" && (
            <>
              <Text style={s.title}>Pourquoi signaler ?</Text>
              {REPORT_REASONS.map((r) => (
                <Pressable
                  key={r}
                  style={[s.row, busy && { opacity: 0.5 }]}
                  onPress={() => send(r)}
                  disabled={busy}
                  accessibilityRole="button"
                >
                  <Text style={s.rowTxt}>{r}</Text>
                </Pressable>
              ))}
              <Pressable style={[s.row, s.cancel]} onPress={close} accessibilityRole="button">
                <Text style={s.cancelTxt}>Annuler</Text>
              </Pressable>
            </>
          )}
          {step === "done" && (
            <View style={s.center}>
              <Ionicons name="checkmark-circle" size={44} color="#4ADE80" />
              <Text style={s.title}>Merci</Text>
              <Text style={s.info}>
                Ton signalement a été transmis à l'équipe de modération. Nous l'examinons
                et agissons si les règles ne sont pas respectées.
              </Text>
              {onBlock && (
                <Pressable style={s.row} onPress={confirmBlock} accessibilityRole="button">
                  <Ionicons name="ban-outline" size={20} color={colors.neonRedText} />
                  <Text style={s.rowTxt}>Bloquer {title} aussi</Text>
                </Pressable>
              )}
              <Pressable style={[s.row, s.cancel]} onPress={close} accessibilityRole="button">
                <Text style={s.cancelTxt}>Fermer</Text>
              </Pressable>
            </View>
          )}
          {step === "error" && (
            <View style={s.center}>
              <Ionicons name="alert-circle" size={44} color={colors.neonRedText} />
              <Text style={s.title}>Signalement non envoyé</Text>
              <Text style={s.info}>Vérifie ta connexion et réessaie.</Text>
              <Pressable style={s.row} onPress={() => setStep("reasons")} accessibilityRole="button">
                <Text style={s.rowTxt}>Réessayer</Text>
              </Pressable>
              <Pressable style={[s.row, s.cancel]} onPress={close} accessibilityRole="button">
                <Text style={s.cancelTxt}>Fermer</Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  handle: {
    alignSelf: "center",
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderLight,
    marginBottom: 8,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: "800", textAlign: "center", marginBottom: 6 },
  info: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: "center", marginBottom: 6 },
  center: { alignItems: "center", gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    alignSelf: "stretch",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.cardLight,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowTxt: { color: colors.text, fontSize: 15, fontWeight: "600" },
  cancel: { justifyContent: "center", backgroundColor: "transparent", marginTop: 4 },
  cancelTxt: { color: colors.muted, fontSize: 15, fontWeight: "700" },
});
