import React from 'react';
import { Image, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/** Étiquette du son affichée sur une Story ou un Snap (on la touche pour voir le son). */
export default function SoundTag({
  title,
  artist,
  coverURL,
  onPress,
  style,
}: {
  title: string;
  artist?: string | null;
  coverURL?: string | null;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tag, style]}
      accessibilityRole="button"
      accessibilityLabel={`Son : ${title}${artist ? `, ${artist}` : ''}`}
    >
      {coverURL ? (
        <Image source={{ uri: coverURL }} style={styles.cover} />
      ) : (
        <View style={[styles.cover, styles.coverFallback]}>
          <Ionicons name="musical-note" size={14} color="#fff" />
        </View>
      )}
      <View style={{ flexShrink: 1 }}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {!!artist && <Text style={styles.artist} numberOfLines={1}>{artist}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.8)" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    maxWidth: '78%',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    paddingLeft: 5,
    paddingRight: 10,
    paddingVertical: 5,
  },
  cover: { width: 32, height: 32, borderRadius: 6 },
  coverFallback: { backgroundColor: '#FF2E4D', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 13, fontWeight: '800' },
  artist: { color: 'rgba(255,255,255,0.75)', fontSize: 11, marginTop: 1 },
});
