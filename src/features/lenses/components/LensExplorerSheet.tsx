import React, { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { EXPLORER_CATEGORIES, filterLenses, formatViews } from '../lensCatalog';
import { VX } from '../projectBindings';
import { STR } from '../strings';
import type { LensCategoryId, VimoxLens } from '../types';
import { PremiumBadge } from './LensCarousel';

const COLUMNS = 3;
const GAP = 8;
const TILE_W = (Dimensions.get('window').width - GAP * (COLUMNS + 1)) / COLUMNS;

type Props = {
  visible: boolean;
  onClose: () => void;
  lenses: VimoxLens[];
  favorites: string[];
  recents: string[];
  activeLensId?: string | null;
  isPremiumUser: boolean;
  initialCategory?: LensCategoryId;
  onSelect: (lens: VimoxLens) => void;
  onToggleFavorite: (lens: VimoxLens) => void;
};

export default function LensExplorerSheet({
  visible,
  onClose,
  lenses,
  favorites,
  recents,
  activeLensId,
  isPremiumUser,
  initialCategory = 'forYou',
  onSelect,
  onToggleFavorite,
}: Props) {
  const [category, setCategory] = useState<LensCategoryId>(initialCategory);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (visible) setCategory(initialCategory);
    else {
      setSearching(false);
      setQuery('');
    }
  }, [visible, initialCategory]);

  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (searching && q) return lenses.filter((l) => l.name.toLowerCase().includes(q));
    return filterLenses(lenses, category, { favorites, recents });
  }, [lenses, category, favorites, recents, searching, query]);

  const emptyText =
    searching && query.trim()
      ? STR.emptySearch
      : category === 'favorites'
        ? STR.emptyFavorites
        : category === 'recents'
          ? STR.emptyRecents
          : '';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fermer">
              <Ionicons name="chevron-down" size={28} color={VX.text} />
            </Pressable>

            {searching ? (
              <View style={styles.searchBox}>
                <Ionicons name="search" size={18} color={VX.textMuted} />
                <TextInput
                  autoFocus
                  value={query}
                  onChangeText={setQuery}
                  placeholder={STR.searchLenses}
                  placeholderTextColor={VX.textMuted}
                  style={styles.searchInput}
                  returnKeyType="search"
                />
                <Pressable
                  onPress={() => {
                    setSearching(false);
                    setQuery('');
                  }}
                  hitSlop={8}
                >
                  <Ionicons name="close-circle" size={18} color={VX.textMuted} />
                </Pressable>
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
                {EXPLORER_CATEGORIES.map((c) => {
                  const active = c.id === category;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => setCategory(c.id)}
                      style={styles.tab}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                    >
                      <Ionicons name={c.icon} size={20} color={active ? VX.text : VX.textMuted} />
                      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{c.label}</Text>
                      <View style={[styles.tabBar, active && styles.tabBarActive]} />
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}

            {!searching && (
              <Pressable onPress={() => setSearching(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel={STR.searchLenses}>
                <Ionicons name="search" size={24} color={VX.text} />
              </Pressable>
            )}
          </View>

          <FlatList
            data={data}
            keyExtractor={(l) => l.id}
            numColumns={COLUMNS}
            columnWrapperStyle={{ gap: GAP, paddingHorizontal: GAP }}
            contentContainerStyle={{ gap: GAP, paddingBottom: 40, paddingTop: 4 }}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={emptyText ? <Text style={styles.empty}>{emptyText}</Text> : undefined}
            renderItem={({ item }) => (
              <LensTile
                lens={item}
                active={item.id === activeLensId}
                favorite={favorites.includes(item.id)}
                locked={item.premium && !isPremiumUser}
                onPress={() => onSelect(item)}
                onLongPress={() => onToggleFavorite(item)}
              />
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

function LensTile({
  lens,
  active,
  favorite,
  locked,
  onPress,
  onLongPress,
}: {
  lens: VimoxLens;
  active: boolean;
  favorite: boolean;
  locked: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const image = lens.previewUrl ?? lens.iconUrl;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.tile, active && styles.tileActive]}
      accessibilityRole="button"
      accessibilityLabel={`${lens.name}${lens.premium ? ', Vim+' : ''}`}
      accessibilityHint="Appui long pour ajouter aux favoris"
    >
      {image ? (
        <Image source={{ uri: image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.tileFallback, { backgroundColor: lens.accent ?? VX.surfaceHigh }]}>
          <Text style={styles.tileEmoji}>{lens.emoji ?? '✨'}</Text>
        </View>
      )}

      {lens.premium && (
        <View style={styles.tileBadge}>
          <PremiumBadge locked={locked} small />
        </View>
      )}
      {favorite && (
        <View style={styles.tileFav}>
          <Ionicons name="heart" size={16} color={VX.red} />
        </View>
      )}

      <View style={styles.tileFooter}>
        <Text style={styles.tileName} numberOfLines={1}>
          {lens.name}
        </Text>
        {lens.views > 0 && (
          <View style={styles.views}>
            <Ionicons name="eye-outline" size={12} color="#fff" />
            <Text style={styles.viewsText}>{formatViews(lens.views)}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: {
    height: '90%',
    backgroundColor: VX.black,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: '#444', marginTop: 8 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  tabs: { paddingHorizontal: 4, gap: 4 },
  tab: { alignItems: 'center', paddingHorizontal: 10, paddingTop: 4 },
  tabLabel: { color: VX.textMuted, fontSize: 13, marginTop: 2, fontWeight: '600' },
  tabLabelActive: { color: VX.text },
  tabBar: { height: 3, width: '100%', borderRadius: 2, marginTop: 6, backgroundColor: 'transparent' },
  tabBarActive: { backgroundColor: VX.red },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: VX.surfaceHigh,
    borderRadius: 20,
    paddingHorizontal: 12,
    height: 40,
    gap: 8,
  },
  searchInput: { flex: 1, color: VX.text, fontSize: 15 },
  empty: { color: VX.textMuted, textAlign: 'center', marginTop: 60, paddingHorizontal: 40, lineHeight: 20 },
  tile: {
    width: TILE_W,
    height: TILE_W * 1.4,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: VX.surface,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tileActive: { borderColor: VX.red },
  tileFallback: { alignItems: 'center', justifyContent: 'center' },
  tileEmoji: { fontSize: 46 },
  tileBadge: { position: 'absolute', top: 6, left: 6 },
  tileFav: { position: 'absolute', top: 6, right: 6 },
  tileFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  tileName: { color: '#fff', fontSize: 12, fontWeight: '700' },
  views: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  viewsText: { color: '#fff', fontSize: 11 },
});
