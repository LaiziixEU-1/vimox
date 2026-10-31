import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { auth, db } from '../lenses/projectBindings';

/**
 * Musique : catalogue Audius (API publique et gratuite, des millions de titres
 * d'artistes indépendants, légal à diffuser dans une app à condition de créditer l'artiste).
 * Sons créés par les utilisateurs : hébergés sur ton Cloudinary (pas besoin de Firebase Blaze).
 */
export interface VimoxSound {
  id: string;
  title: string;
  artist: string;
  durationSec: number;
  audioURL: string;
  coverURL?: string;
  playCount?: number;
  source: 'audius' | 'vimox';
  /** Lien vers la page de l'artiste (crédit). */
  externalURL?: string;
}

export interface SoundPlaylist {
  id: string;
  label: string;
  genre: string; // genre Audius
  color: string;
  emoji: string;
}

/** "Playlists" de l'onglet À la une : chaque tuile ouvre les tendances d'un genre. */
export const SOUND_PLAYLISTS: SoundPlaylist[] = [
  { id: 'rap', label: 'Rap', genre: 'Hip-Hop/Rap', color: '#5A0012', emoji: '🎤' },
  { id: 'pop', label: 'Pop', genre: 'Pop', color: '#4A0A3A', emoji: '✨' },
  { id: 'electro', label: 'Électro', genre: 'Electronic', color: '#0A2A4A', emoji: '⚡' },
  { id: 'rnb', label: 'R&B', genre: 'R&B/Soul', color: '#3A1A4A', emoji: '💜' },
  { id: 'latin', label: 'Latino', genre: 'Latin', color: '#4A2A00', emoji: '🔥' },
  { id: 'lofi', label: 'Chill', genre: 'Lo-Fi', color: '#1A2A1A', emoji: '🌙' },
  { id: 'house', label: 'House', genre: 'House', color: '#2A0A4A', emoji: '🪩' },
  { id: 'trap', label: 'Trap', genre: 'Trap', color: '#3A0A0A', emoji: '💎' },
  { id: 'techno', label: 'Techno', genre: 'Techno', color: '#0A0A2A', emoji: '🎛️' },
  { id: 'dancehall', label: 'Dancehall', genre: 'Dancehall', color: '#0A3A1A', emoji: '🌴' },
  { id: 'rock', label: 'Rock', genre: 'Rock', color: '#2A1A0A', emoji: '🎸' },
  { id: 'jazz', label: 'Jazz', genre: 'Jazz', color: '#3A2A0A', emoji: '🎷' },
  { id: 'classical', label: 'Classique', genre: 'Classical', color: '#1A1A2A', emoji: '🎻' },
  { id: 'reggae', label: 'Reggae', genre: 'Reggae', color: '#1A3A0A', emoji: '🟢' },
  { id: 'dnb', label: 'Drum & Bass', genre: 'Drum & Bass', color: '#0A2A3A', emoji: '🥁' },
  { id: 'ambient', label: 'Ambiance', genre: 'Ambient', color: '#1A2A3A', emoji: '🌌' },
];

/** Ambiances (comme sur Snap) : chaque carte lance une recherche dans le catalogue. */
export interface SoundMood {
  id: string;
  label: string;
  query: string;
  emoji: string;
  colors: [string, string];
}
export const SOUND_MOODS: SoundMood[] = [
  { id: 'chill', label: 'Chill', query: 'chill', emoji: '🌙', colors: ['#2B5876', '#4E4376'] },
  { id: 'party', label: 'Fête', query: 'party', emoji: '🎉', colors: ['#FF2E4D', '#FF8A3D'] },
  { id: 'love', label: 'Love', query: 'love', emoji: '💕', colors: ['#FF5F9E', '#B23A7A'] },
  { id: 'workout', label: 'Sport', query: 'workout', emoji: '💪', colors: ['#11998E', '#38EF7D'] },
  { id: 'summer', label: 'Été', query: 'summer', emoji: '☀️', colors: ['#F7971E', '#FFD200'] },
  { id: 'motivation', label: 'Motivation', query: 'motivation', emoji: '🔥', colors: ['#E52D27', '#B31217'] },
  { id: 'sad', label: 'Triste', query: 'sad', emoji: '🌧️', colors: ['#3A6073', '#16222A'] },
  { id: 'gaming', label: 'Gaming', query: 'gaming', emoji: '🎮', colors: ['#7F00FF', '#E100FF'] },
  { id: 'travel', label: 'Voyage', query: 'travel', emoji: '✈️', colors: ['#00B4DB', '#0083B0'] },
  { id: 'night', label: 'Soirée', query: 'night drive', emoji: '🌃', colors: ['#141E30', '#243B55'] },
  { id: 'funny', label: 'Drôle', query: 'funny', emoji: '😂', colors: ['#FDC830', '#F37335'] },
  { id: 'dance', label: 'Danse', query: 'dance', emoji: '💃', colors: ['#DA22FF', '#9733EE'] },
];

const AUDIUS_API = 'https://api.audius.co/v1';
const APP_NAME = 'VimoX';
const CACHE_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; data: VimoxSound[] }>();

function qs(params: Record<string, string | undefined>): string {
  return Object.entries({ app_name: APP_NAME, ...params })
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
    .join('&');
}

function fromAudius(t: any): VimoxSound {
  return {
    id: `audius_${t.id}`,
    title: t.title ?? '',
    artist: t.user?.name ?? '',
    durationSec: Number(t.duration) || 0,
    audioURL: `${AUDIUS_API}/tracks/${t.id}/stream?${qs({})}`,
    coverURL: t.artwork?.['480x480'] ?? t.artwork?.['150x150'] ?? undefined,
    playCount: Number(t.play_count) || 0,
    source: 'audius',
    externalURL: t.permalink ? `https://audius.co${t.permalink}` : undefined,
  };
}

async function audiusTracks(path: string, params: Record<string, string | undefined>): Promise<VimoxSound[]> {
  const key = `${path}?${qs(params)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const res = await fetch(`${AUDIUS_API}${key}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Audius ${res.status}`);
  const json = await res.json();
  const data: VimoxSound[] = (Array.isArray(json?.data) ? json.data : [])
    .filter((t: any) => t && t.id && t.is_streamable !== false && !t.is_delete)
    .map(fromAudius);

  cache.set(key, { at: Date.now(), data });
  return data;
}

/** Populaires cette semaine (onglet À la une). */
export const fetchPopularSounds = () => audiusTracks('/tracks/trending', { time: 'week' });

/** Tendances du mois (onglet Tendance). */
export const fetchTrendingSounds = () => audiusTracks('/tracks/trending', { time: 'month' });

/** Tendances d'un genre (tuiles Playlists). */
export const fetchPlaylistSounds = (p: SoundPlaylist) => audiusTracks('/tracks/trending', { time: 'week', genre: p.genre });

/** Recherche dans tout le catalogue. */
export const searchSounds = (text: string) => audiusTracks('/tracks/search', { query: text.trim() });

// ---------------------------------------------------------------------------
// Sons enregistrés (Firestore users/{uid}/savedSounds) : on garde une copie
// complète du son pour pouvoir l'afficher sans rappeler l'API.
// ---------------------------------------------------------------------------
export function subscribeSavedSounds(onChange: (sounds: VimoxSound[]) => void): () => void {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    onChange([]);
    return () => {};
  }
  return onSnapshot(
    query(collection(db, 'users', uid, 'savedSounds'), orderBy('savedAt', 'desc')),
    (snap) =>
      onChange(
        snap.docs
          .map((d) => d.data() as any)
          .filter((s) => s?.audioURL)
          .map((s) => ({ ...s, savedAt: undefined }) as VimoxSound),
      ),
    () => onChange([]),
  );
}

export async function toggleSavedSound(sound: VimoxSound, isSaved: boolean): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  const r = doc(db, 'users', uid, 'savedSounds', sound.id);
  if (isSaved) {
    await deleteDoc(r);
    return;
  }
  const clean: Record<string, unknown> = {};
  Object.entries(sound).forEach(([k, v]) => {
    if (v !== undefined) clean[k] = v; // Firestore refuse les undefined
  });
  await setDoc(r, { ...clean, savedAt: serverTimestamp() });
}

// ---------------------------------------------------------------------------
// "Créer un son" : upload sur Cloudinary (variables déjà présentes dans ton .env)
// ---------------------------------------------------------------------------
const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '';
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? '';

export async function createSound(localUri: string, durationMs: number, title: string, artist: string): Promise<VimoxSound> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Non connecté');
  if (!CLOUD_NAME || !UPLOAD_PRESET) throw new Error('Cloudinary non configuré');

  const form = new FormData();
  form.append('file', { uri: localUri, name: `son_${Date.now()}.m4a`, type: 'audio/mp4' } as any);
  form.append('upload_preset', UPLOAD_PRESET);
  form.append('folder', `vimox/sounds/${uid}`);

  // Cloudinary range l'audio dans la catégorie "video"
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`, { method: 'POST', body: form });
  const json = await res.json();
  if (!res.ok || !json.secure_url) throw new Error(json?.error?.message ?? 'Upload impossible');

  const sound: VimoxSound = {
    id: `vimox_${uid}_${Date.now()}`,
    title: title.trim().slice(0, 60) || 'Son original',
    artist: artist.slice(0, 40),
    durationSec: Math.round(durationMs / 1000),
    audioURL: json.secure_url,
    source: 'vimox',
  };
  await toggleSavedSound(sound, false); // apparaît direct dans "Enregistrés"
  return sound;
}

// ---------------------------------------------------------------------------
// Extrait choisi (comme sur Snap) : quel passage du morceau, combien de temps,
// et les volumes (musique / son original de la vidéo).
// ---------------------------------------------------------------------------
export interface SoundClip {
  sound: VimoxSound;
  startSec: number;
  clipSec: number;
  musicVolume: number; // 0 à 1
  videoVolume: number; // 0 à 1
}

/** Infos du son enregistrées avec une Story ou un Snap (pour l'étiquette et « Utiliser ce son »). */
export interface MusicMeta {
  soundId: string;
  title: string;
  artist: string;
  coverURL: string | null;
  durationSec: number;
  startSec: number;
  clipSec: number;
  musicVolume: number;
  videoVolume: number;
  externalURL: string | null;
}

export const CLIP_LENGTHS = [10, 15, 30, 60];
export const DEFAULT_CLIP_SEC = 15;

export function makeClip(sound: VimoxSound, startSec = 0, clipSec = DEFAULT_CLIP_SEC): SoundClip {
  return { sound, startSec, clipSec, musicVolume: 1, videoVolume: 1 };
}

export function metaFromClip(c: SoundClip): MusicMeta {
  return {
    soundId: c.sound.id,
    title: c.sound.title,
    artist: c.sound.artist,
    coverURL: c.sound.coverURL ?? null,
    durationSec: c.sound.durationSec,
    startSec: Math.round(c.startSec * 10) / 10,
    clipSec: c.clipSec,
    musicVolume: c.musicVolume,
    videoVolume: c.videoVolume,
    externalURL: c.sound.externalURL ?? null,
  };
}

export function clipFromMeta(musicURL: string, m: Partial<MusicMeta>): SoundClip {
  return {
    sound: {
      id: m.soundId ?? `url_${musicURL.length}_${musicURL.slice(-24)}`,
      title: m.title ?? 'Son original',
      artist: m.artist ?? '',
      durationSec: m.durationSec ?? 0,
      audioURL: musicURL,
      coverURL: m.coverURL ?? undefined,
      source: m.soundId?.startsWith('audius_') ? 'audius' : 'vimox',
      externalURL: m.externalURL ?? undefined,
    },
    startSec: m.startSec ?? 0,
    clipSec: m.clipSec ?? DEFAULT_CLIP_SEC,
    musicVolume: m.musicVolume ?? 1,
    videoVolume: m.videoVolume ?? 1,
  };
}

export function soundLabel(s: { title: string; artist?: string }): string {
  return s.artist ? `${s.title} · ${s.artist}` : s.title;
}

// ---------------------------------------------------------------------------
// Nombre de Snaps / Stories qui utilisent un son (affiché sur la fiche du son)
// Firestore : soundUsage/{soundId} = { count }
// ---------------------------------------------------------------------------
export async function incrementSoundUse(soundId: string): Promise<void> {
  try {
    await setDoc(doc(db, 'soundUsage', soundId), { count: increment(1) }, { merge: true });
  } catch {
    // règles Firestore pas encore ajoutées : on ignore
  }
}

export async function getSoundUses(soundId: string): Promise<number> {
  try {
    const snap = await getDoc(doc(db, 'soundUsage', soundId));
    return Number(snap.data()?.count) || 0;
  } catch {
    return 0;
  }
}
