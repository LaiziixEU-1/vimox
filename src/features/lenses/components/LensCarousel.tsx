import React, { memo } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VX } from '../projectBindings';
import { STR } from '../strings';
import type { VimoxLens } from '../types';

const SIZE = 58;

type Props = {
  lenses: VimoxLens[];
  activeLensId?: string | null;
  isPremiumUser: boolean;
  onSelect: (lens: VimoxLens) => void;
  onClear: () => void;
  onLongPress?: (lens: VimoxLens) => void;
};

export function LensThumb({ lens, size = SIZE }: { lens: VimoxLens; size?: number }) {
  if (lens.iconUrl) {
    return <Image source={{ uri: lens.iconUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: lens.accent ?? VX.surfaceHigh,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: size * 0.48 }}>{lens.emoji ?? '✨'}</Text>
    </View>
  );
}

export function PremiumBadge({ locked, small }: { locked: boolean; small?: boolean }) {
  const s = small ? 18 : 22;
  return (
    <View style={[styles.badge, { width: s, height: s, borderRadius: s / 2 }]}>
      <Ionicons name={locked ? 'lock-closed' : 'diamond'} size={s * 0.55} color="#fff" />
    </View>
  );
}

const Item = memo(function Item({
  lens,
  active,
  locked,
  onPress,
  onLongPress,
}: {
  lens: VimoxLens;
  active: boolean;
  locked: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.item, active && styles.itemActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${lens.name}${lens.premium ? ', Vim+' : ''}`}
    >
      <LensThumb lens={lens} />
      {lens.premium ? (
        <View style={styles.badgePos}>
          <PremiumBadge locked={locked} small />
        </View>
      ) : null}
    </Pressable>
  );
});

export default function LensCarousel({ lenses, activeLensId, isPremiumUser, onSelect, onClear, onLongPress }: Props) {
  return (
    <FlatList
      horizontal
      data={lenses}
      keyExtractor={(l) => l.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <Pressable
          onPress={onClear}
          style={[styles.item, !activeLensId && styles.itemActive]}
          accessibilityRole="button"
          accessibilityLabel={STR.noLens}
        >
          <View style={styles.none}>
            <Ionicons name="ban-outline" size={26} color="#fff" />
          </View>
        </Pressable>
      }
      renderItem={({ item }) => (
        <Item
          lens={item}
          active={item.id === activeLensId}
          locked={item.premium && !isPremiumUser}
          onPress={() => onSelect(item)}
          onLongPress={onLongPress ? () => onLongPress(item) : undefined}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { alignItems: 'center', paddingHorizontal: 6 },
  item: {
    width: SIZE + 8,
    height: SIZE + 8,
    borderRadius: (SIZE + 8) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  itemActive: { borderColor: VX.red },
  none: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: VX.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgePos: { position: 'absolute', top: -2, left: -2 },
  badge: {
    backgroundColor: VX.red,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: VX.black,
  },
});
