import React, { useState } from 'react';
import { Pressable, type PressableProps } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import SoundPickerSheet from '../sounds/SoundPickerSheet';
import SoundTrimmer from '../sounds/SoundTrimmer';
import { makeClip, type SoundClip, type VimoxSound } from '../sounds/soundService';

/**
 * Ouvre l'ancien écran de lenses (gardé pour compatibilité).
 */
export function OpenLensesPressable(props: Omit<PressableProps, 'onPress'>) {
  const navigation = useNavigation<any>();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ouvrir les lenses"
      {...props}
      onPress={() => navigation.navigate('LensCamera')}
    />
  );
}

/**
 * Bouton musique, comme sur Snap : catalogue de sons → choix du passage → son prêt.
 */
export function MusicPickerPressable({
  onPicked,
  children,
  ...props
}: Omit<PressableProps, 'onPress' | 'children'> & {
  onPicked: (clip: SoundClip) => void;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [trimSound, setTrimSound] = useState<VimoxSound | null>(null);

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choisir un son"
        {...props}
        onPress={() => setOpen(true)}
      >
        {children}
      </Pressable>
      <SoundPickerSheet
        visible={open}
        onClose={() => setOpen(false)}
        onSelect={(s) => {
          if (s) setTimeout(() => setTrimSound(s), 350);
        }}
      />
      <SoundTrimmer
        visible={!!trimSound}
        sound={trimSound}
        onCancel={() => setTrimSound(null)}
        onDone={(start, clipSec) => {
          if (trimSound) onPicked(makeClip(trimSound, start, clipSec));
          setTrimSound(null);
        }}
      />
    </>
  );
}
