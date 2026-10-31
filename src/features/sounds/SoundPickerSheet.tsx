import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { auth, VoiceRecorderButton, VX } from '../lenses/projectBindings';
import { STR } from '../lenses/strings';
import {
  createSound,
  fetchPlaylistSounds,
  fetchPopularSounds,
  fetchTrendingSounds,
  searchSounds,
  SOUND_MOODS,
  SOUND_PLAYLISTS,
  subscribeSavedSounds,
  toggleSavedSound,
  type VimoxSound,
} from './soundService';

// ───────────────────────── Sons, façon Snap ─────────────────────────
// Recherche · Pour toi (ambiances, genres, populaires) · Tendances (classement) · Favoris · Récents · Mes sons
// Écoute d'un extrait sur la pochette, barre « en écoute » en bas avec « Utiliser ».

type Tab = 'foryou' | 'trending' | 'saved' | 'recent' | 'mine';
type Collection = { title: string; load: () => Promise<VimoxSound[]> } | null;

type Props = {
  visible: boolean;
  onClose: () => void;
  selectedSoundId?: string | null;
  onSelect: (sound: VimoxSound | null) => void;
};

const RECENTS_KEY = 'vimox.soundRecents';
const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')}`;
const TABS: [Tab, string][] = [
  ['foryou', 'Pour toi'],
  ['trending', 'Tendances'],
  ['saved', 'Favoris'],
  ['recent', 'Récents'],
  ['mine', 'Mes sons'],
];

async function loadRecents(): Promise<VimoxSound[]> {
  try {
    const v = JSON.parse((await AsyncStorage.getItem(RECENTS_KEY)) ?? '[]');
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
async function pushRecent(s: VimoxSound) {
  const list = (await loadRecents()).filter((x) => x.id !== s.id);
  await AsyncStorage.setItem(RECENTS_KEY, JSON.stringify([s, ...list].slice(0, 30))).catch(() => {});
}

export default function SoundPickerSheet({ visible, onClose, selectedSoundId, onSelect }: Props) {
  const [tab, setTab] = useState<Tab>('foryou');
  const [collection, setCollection] = useState<Collection>(null);
  const [query, setQuery] = useState('');
  const [list, setList] = useState<VimoxSound[]>([]);
  const [saved, setSaved] = useState<VimoxSound[]>([]);
  const [recents, setRecents] = useState<VimoxSound[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [preview, setPreview] = useState<VimoxSound | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    if (!visible) {
      try {
        player.pause();
      } catch {}
      setPreview(null);
      setCreating(false);
      setCollection(null);
      setQuery('');
      return;
    }
    loadRecents().then(setRecents);
    return subscribeSavedSounds(setSaved);
  }, [visible]);

  const searching = query.trim().length >= 2;
  const remote = searching || collection !== null || tab === 'foryou' || tab === 'trending';

  // Liste en ligne : recherche, collection (ambiance / genre), populaires, tendances
  useEffect(() => {
    if (!visible || !remote) return;
    let cancelled = false;
    const q = query.trim();
    const load = () =>
      q.length >= 2 ? searchSounds(q) : collection ? collection.load() : tab === 'trending' ? fetchTrendingSounds() : fetchPopularSounds();
    setLoading(true);
    setError(false);
    const timer = setTimeout(
      () => {
        load()
          .then((d) => !cancelled && setList(d))
          .catch(() => !cancelled && setError(true))
          .finally(() => !cancelled && setLoading(false));
      },
      q ? 350 : 0,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [visible, tab, collection, query, reloadKey]);

  useEffect(() => {
    if (status.didJustFinish) setPreview(null);
  }, [status.didJustFinish]);

  const savedIds = useMemo(() => new Set(saved.map((s) => s.id)), [saved]);
  const mine = useMemo(() => saved.filter((s) => s.source === 'vimox'), [saved]);

  const localData = tab === 'saved' ? saved : tab === 'recent' ? recents : tab === 'mine' ? mine : [];
  const data = remote
    ? list
    : query.trim()
      ? localData.filter((s) => `${s.title} ${s.artist}`.toLowerCase().includes(query.trim().toLowerCase()))
      : localData;
  const ranked = tab === 'trending' && !searching && !collection;

  function togglePreview(s: VimoxSound) {
    try {
      if (preview?.id === s.id && status.playing) {
        player.pause();
        setPreview(null);
        return;
      }
      player.replace({ uri: s.audioURL });
      player.play();
      setPreview(s);
    } catch {}
  }

  function choose(s: VimoxSound) {
    try {
      player.pause();
    } catch {}
    setPreview(null);
    pushRecent(s);
    onSelect(s);
    onClose();
  }

  async function onRecorded(uri: string, durationMs: number) {
    try {
      await createSound(uri, durationMs, newTitle, auth.currentUser?.displayName ?? '');
      setCreating(false);
      setNewTitle('');
      setTab('mine');
      Alert.alert(STR.soundCreated);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? "Le son n'a pas pu être publié.");
    }
  }

  const openTab = (t: Tab) => {
    setTab(t);
    setCollection(null);
  };

  const sectionTitle = searching
    ? `Résultats pour « ${query.trim()} »`
    : collection
      ? collection.title
      : tab === 'trending'
        ? 'Top du mois'
        : tab === 'foryou'
          ? 'Populaires cette semaine'
          : tab === 'saved'
            ? 'Tes favoris'
            : tab === 'recent'
              ? 'Utilisés récemment'
              : 'Tes sons';

  const header = (
    <View>
      {/* Pour toi : ambiances + genres */}
      {tab === 'foryou' && !searching && !collection && (
        <>
          <Text style={st.section}>Ambiances</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.moodRow}>
            {SOUND_MOODS.map((m) => (
              <Pressable
                key={m.id}
                onPress={() => setCollection({ title: `${m.emoji} ${m.label}`, load: () => searchSounds(m.query) })}
                accessibilityRole="button"
                style={({ pressed }) => [pressed && { transform: [{ scale: 0.96 }] }]}
              >
                <LinearGradient colors={m.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.mood}>
                  <Text style={st.moodEmoji}>{m.emoji}</Text>
                  <Text style={st.moodLabel}>{m.label}</Text>
                </LinearGradient>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={st.section}>Genres</Text>
          <View style={st.genreGrid}>
            {SOUND_PLAYLISTS.map((p) => (
              <Pressable
                key={p.id}
                style={({ pressed }) => [st.genre, { backgroundColor: p.color }, pressed && { opacity: 0.8 }]}
                onPress={() => setCollection({ title: `${p.emoji} ${p.label}`, load: () => fetchPlaylistSounds(p) })}
                accessibilityRole="button"
              >
                <Text style={st.genreEmoji}>{p.emoji}</Text>
                <Text style={st.genreLabel} numberOfLines={1}>{p.label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {/* Mes sons : créer un son avec sa voix */}
      {tab === 'mine' && !searching && (
        <View style={st.creator}>
          {creating ? (
            <>
              <TextInput
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder={STR.soundTitlePlaceholder}
                placeholderTextColor={VX.textMuted}
                style={st.creatorInput}
                maxLength={60}
              />
              <View style={st.creatorRow}>
                <Text style={st.creatorHint}>{STR.holdToRecordSound}</Text>
                <VoiceRecorderButton onRecorded={onRecorded} />
              </View>
              <Pressable onPress={() => setCreating(false)} style={{ alignSelf: 'flex-start' }}>
                <Text style={st.creatorCancel}>Annuler</Text>
              </Pressable>
            </>
          ) : (
            <Pressable style={st.createBig} onPress={() => setCreating(true)} accessibilityRole="button">
              <View style={st.createIcon}>
                <Ionicons name="mic" size={22} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={st.createTitle}>{STR.createSound}</Text>
                <Text style={st.createSub}>Enregistre ta voix ou un son, tes amis pourront l'utiliser</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={VX.textMuted} />
            </Pressable>
          )}
        </View>
      )}

      {selectedSoundId ? (
        <Pressable
          style={st.removeRow}
          onPress={() => {
            onSelect(null);
            onClose();
          }}
        >
          <Ionicons name="close-circle-outline" size={18} color={VX.red} />
          <Text style={st.removeText}>{STR.removeSound}</Text>
        </Pressable>
      ) : null}

      <View style={st.sectionRow}>
        {collection && !searching && (
          <Pressable onPress={() => setCollection(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Retour">
            <Ionicons name="chevron-back" size={22} color={VX.text} />
          </Pressable>
        )}
        <Text style={[st.section, { paddingHorizontal: 0, paddingTop: 0, flexShrink: 1 }]} numberOfLines={1}>
          {sectionTitle}
        </Text>
      </View>
    </View>
  );

  const playingNow = !!preview && status.playing;
  const prog = preview && status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={st.backdrop}>
        <View style={st.sheet}>
          <View style={st.handle} />
          <View style={st.topRow}>
            <Text style={st.title}>Sons</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fermer">
              <Ionicons name="close" size={26} color={VX.text} />
            </Pressable>
          </View>
          <View style={st.searchBox}>
            <Ionicons name="search" size={18} color={VX.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Chercher un son, un artiste, une ambiance…"
              placeholderTextColor={VX.textMuted}
              style={st.searchInput}
              returnKeyType="search"
              autoCorrect={false}
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={VX.textMuted} />
              </Pressable>
            ) : null}
          </View>

          {!searching && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.tabs} style={{ flexGrow: 0 }}>
              {TABS.map(([id, label]) => {
                const on = tab === id && !collection;
                return (
                  <Pressable
                    key={id}
                    onPress={() => openTab(id)}
                    style={[st.tab, on && st.tabOn]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[st.tabTxt, on && st.tabTxtOn]}>{label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <FlatList
            data={loading && remote ? [] : data}
            keyExtractor={(s) => s.id}
            contentContainerStyle={{ paddingBottom: preview ? 110 : 40 }}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={header}
            initialNumToRender={12}
            ListEmptyComponent={
              loading && remote ? (
                <ActivityIndicator color={VX.red} style={{ marginTop: 40 }} />
              ) : error && remote ? (
                <View style={st.errorBox}>
                  <Text style={st.empty}>Impossible de charger la musique. Vérifie ta connexion.</Text>
                  <Pressable style={st.retry} onPress={() => setReloadKey((k) => k + 1)}>
                    <Text style={st.retryText}>Réessayer</Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={st.empty}>
                  {tab === 'saved'
                    ? 'Touche 🔖 sur un son pour le retrouver ici.'
                    : tab === 'recent'
                      ? 'Les sons que tu utilises apparaîtront ici.'
                      : tab === 'mine'
                        ? 'Crée ton premier son avec le bouton au-dessus.'
                        : STR.emptySounds}
                </Text>
              )
            }
            renderItem={({ item, index }) => {
              const isSaved = savedIds.has(item.id);
              const isPreview = preview?.id === item.id;
              const playing = isPreview && status.playing;
              const buffering = isPreview && status.isBuffering && !status.playing;
              const selected = item.id === selectedSoundId;
              return (
                <Pressable style={[st.row, selected && st.rowSelected]} onPress={() => choose(item)}>
                  {ranked && <Text style={[st.rank, index < 3 && { color: '#FFC24B' }]}>{index + 1}</Text>}
                  <Pressable onPress={() => togglePreview(item)} accessibilityRole="button" accessibilityLabel={playing ? 'Pause' : 'Écouter un extrait'}>
                    {item.coverURL ? (
                      <Image source={{ uri: item.coverURL }} style={st.cover} />
                    ) : (
                      <LinearGradient colors={['#FF2E4D', '#FF6B3D']} style={[st.cover, st.coverFallback]}>
                        <Ionicons name="musical-notes" size={22} color="#fff" />
                      </LinearGradient>
                    )}
                    <View style={st.coverPlay}>
                      {buffering ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Ionicons name={playing ? 'pause' : 'play'} size={18} color="#fff" style={!playing && { marginLeft: 2 }} />
                      )}
                    </View>
                  </Pressable>
                  <View style={st.rowText}>
                    <Text style={st.rowTitle} numberOfLines={1}>{item.title}</Text>
                    <Pressable disabled={!item.externalURL} onPress={() => item.externalURL && Linking.openURL(item.externalURL)}>
                      <Text style={st.meta} numberOfLines={1}>
                        {item.artist ? `${item.artist} · ` : ''}
                        {fmt(item.durationSec)}
                        {item.playCount ? ` · ${item.playCount >= 1000 ? `${Math.round(item.playCount / 1000)}k` : item.playCount} écoutes` : ''}
                      </Text>
                    </Pressable>
                  </View>
                  <Pressable
                    hitSlop={8}
                    onPress={() => toggleSavedSound(item, isSaved).catch(() => {})}
                    accessibilityRole="button"
                    accessibilityLabel={isSaved ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                  >
                    <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={22} color={isSaved ? VX.red : VX.textMuted} />
                  </Pressable>
                </Pressable>
              );
            }}
            ListFooterComponent={remote && data.length > 0 ? <Text style={st.credit}>Musique : artistes indépendants via Audius</Text> : undefined}
          />

          {/* En écoute : comme la barre de Snap, avec « Utiliser » */}
          {preview && (
            <View style={st.nowBar}>
              <View style={[st.nowProgress, { width: `${prog * 100}%` }]} />
              {preview.coverURL ? (
                <Image source={{ uri: preview.coverURL }} style={st.nowCover} />
              ) : (
                <View style={[st.nowCover, st.coverFallback]}>
                  <Ionicons name="musical-notes" size={16} color="#fff" />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={st.nowTitle} numberOfLines={1}>{preview.title}</Text>
                <Text style={st.nowArtist} numberOfLines={1}>{preview.artist}</Text>
              </View>
              <Pressable onPress={() => togglePreview(preview)} hitSlop={8} accessibilityRole="button" accessibilityLabel={playingNow ? 'Pause' : 'Lecture'}>
                <Ionicons name={playingNow ? 'pause' : 'play'} size={24} color={VX.text} />
              </Pressable>
              <Pressable onPress={() => choose(preview)} style={st.useBtn} accessibilityRole="button">
                <Text style={st.useTxt}>Utiliser</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { height: '94%', backgroundColor: VX.black, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  handle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: '#33333F', marginTop: 8 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10 },
  title: { color: VX.text, fontSize: 22, fontWeight: '900' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: VX.surfaceHigh,
    borderRadius: 22,
    paddingHorizontal: 14,
    height: 44,
  },
  searchInput: { flex: 1, color: VX.text, fontSize: 15 },
  tabs: { gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  tab: { paddingHorizontal: 14, height: 34, borderRadius: 17, backgroundColor: VX.surface, justifyContent: 'center' },
  tabOn: { backgroundColor: VX.text },
  tabTxt: { color: VX.textMuted, fontSize: 14, fontWeight: '800' },
  tabTxtOn: { color: '#000' },
  section: { color: VX.text, fontSize: 17, fontWeight: '900', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  moodRow: { gap: 10, paddingHorizontal: 16 },
  mood: { width: 108, height: 72, borderRadius: 16, padding: 10, justifyContent: 'space-between' },
  moodEmoji: { fontSize: 22 },
  moodLabel: { color: '#fff', fontSize: 15, fontWeight: '900' },
  genreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16 },
  genre: { width: '48.6%', height: 52, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12 },
  genreEmoji: { fontSize: 20 },
  genreLabel: { color: '#fff', fontSize: 15, fontWeight: '800', flexShrink: 1 },
  creator: { marginHorizontal: 16, marginTop: 4, padding: 12, borderRadius: 16, backgroundColor: VX.surface, gap: 10 },
  createBig: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  createIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: VX.red, alignItems: 'center', justifyContent: 'center' },
  createTitle: { color: VX.text, fontSize: 15, fontWeight: '800' },
  createSub: { color: VX.textMuted, fontSize: 12, marginTop: 2 },
  creatorInput: { color: VX.text, fontSize: 15, borderBottomWidth: 1, borderColor: '#33333F', paddingVertical: 6 },
  creatorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  creatorHint: { color: VX.textMuted, flex: 1 },
  creatorCancel: { color: VX.textMuted, fontWeight: '700' },
  removeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingTop: 12 },
  removeText: { color: VX.red, fontWeight: '800' },
  empty: { color: VX.textMuted, textAlign: 'center', marginTop: 40, paddingHorizontal: 40, lineHeight: 20 },
  errorBox: { alignItems: 'center' },
  retry: { marginTop: 14, backgroundColor: VX.red, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: '#fff', fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  rowSelected: { backgroundColor: 'rgba(255,46,77,0.12)' },
  rank: { width: 22, color: VX.textMuted, fontSize: 16, fontWeight: '900', textAlign: 'center' },
  cover: { width: 56, height: 56, borderRadius: 10 },
  coverFallback: { alignItems: 'center', justifyContent: 'center' },
  coverPlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderRadius: 10,
  },
  rowText: { flex: 1 },
  rowTitle: { color: VX.text, fontSize: 15, fontWeight: '800' },
  meta: { color: VX.textMuted, fontSize: 12, marginTop: 3 },
  credit: { color: VX.textMuted, fontSize: 11, textAlign: 'center', marginTop: 16 },
  nowBar: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 18,
    backgroundColor: VX.surfaceHigh,
    borderWidth: 1,
    borderColor: '#33333F',
    overflow: 'hidden',
  },
  nowProgress: { position: 'absolute', left: 0, bottom: 0, height: 3, backgroundColor: VX.red },
  nowCover: { width: 42, height: 42, borderRadius: 8, backgroundColor: VX.red },
  nowTitle: { color: VX.text, fontSize: 14, fontWeight: '800' },
  nowArtist: { color: VX.textMuted, fontSize: 12, marginTop: 1 },
  useBtn: { backgroundColor: VX.red, borderRadius: 16, paddingHorizontal: 14, height: 32, alignItems: 'center', justifyContent: 'center' },
  useTxt: { color: '#fff', fontWeight: '900', fontSize: 13 },
});
