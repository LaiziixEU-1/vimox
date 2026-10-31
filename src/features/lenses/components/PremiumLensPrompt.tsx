import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { VX } from '../projectBindings';
import { STR } from '../strings';
import type { VimoxLens } from '../types';
import { LensThumb, PremiumBadge } from './LensCarousel';

type Props = {
  lens: VimoxLens | null;
  onClose: () => void;
  onDiscover: () => void;
};

export default function PremiumLensPrompt({ lens, onClose, onDiscover }: Props) {
  return (
    <Modal visible={!!lens} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          {lens && (
            <View style={styles.thumb}>
              <LensThumb lens={lens} size={84} />
              <View style={styles.badge}>
                <PremiumBadge locked={false} />
              </View>
            </View>
          )}
          <Text style={styles.title}>{lens?.name}</Text>
          <Text style={styles.kicker}>{STR.premiumLensTitle}</Text>
          <Text style={styles.body}>{STR.premiumLensBody}</Text>

          <Pressable style={styles.primary} onPress={onDiscover} accessibilityRole="button">
            <Text style={styles.primaryText}>{STR.discoverPremium}</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={onClose} accessibilityRole="button">
            <Text style={styles.secondaryText}>{STR.notNow}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  card: {
    backgroundColor: VX.black,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
    alignItems: 'center',
    borderTopWidth: 2,
    borderColor: VX.red,
  },
  thumb: { marginBottom: 14 },
  badge: { position: 'absolute', top: -4, left: -4 },
  title: { color: VX.text, fontSize: 22, fontWeight: '800' },
  kicker: { color: VX.red, fontSize: 14, fontWeight: '700', marginTop: 4 },
  body: { color: VX.textMuted, fontSize: 15, textAlign: 'center', marginTop: 10, lineHeight: 21 },
  primary: {
    backgroundColor: VX.red,
    borderRadius: 26,
    height: 52,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  secondary: { height: 46, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  secondaryText: { color: VX.textMuted, fontSize: 15, fontWeight: '600' },
});
