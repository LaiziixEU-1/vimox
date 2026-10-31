import type { Lens as CameraKitLens } from '@snap/camera-kit-react-native';
import { STR } from './strings';
import type { LensCategory, LensCategoryId, SeasonId, VimoxLens } from './types';

/** Saison du moment : la catégorie « Saison » change toute seule selon la date, comme sur Snap. */
export function currentSeason(d = new Date()): { id: SeasonId | null; label: string } {
  const m = d.getMonth() + 1, day = d.getDate();
  const md = m * 100 + day;
  if (md >= 1001 && md <= 1105) return { id: 'halloween', label: 'Halloween' };
  if (md >= 1120 && md <= 1231) return { id: 'christmas', label: 'Noël' };
  if (md >= 101 && md <= 110) return { id: 'newyear', label: 'Nouvel an' };
  if (md >= 201 && md <= 215) return { id: 'valentine', label: 'Saint-Valentin' };
  if (md >= 615 && md <= 831) return { id: 'summer', label: 'Été' };
  return { id: null, label: 'Saisons' };
}
export const SEASON = currentSeason();


/** Onglets de l'explorateur, dans l'ordre d'affichage. */
export const EXPLORER_CATEGORIES: LensCategory[] = [
  { id: 'recents', label: STR.recents, icon: 'time-outline' },
  { id: 'favorites', label: STR.favorites, icon: 'heart-outline' },
  { id: 'forYou', label: STR.forYou, icon: 'sparkles-outline' },
  { id: 'seasonal', label: SEASON.label, icon: SEASON.id === 'christmas' ? 'snow-outline' : SEASON.id === 'summer' ? 'sunny-outline' : SEASON.id === 'valentine' ? 'heart-circle-outline' : 'moon-outline' },
  { id: 'games', label: STR.games, icon: 'game-controller-outline' },
  { id: 'funny', label: STR.funny, icon: 'happy-outline' },
  { id: 'premium', label: STR.premium, icon: 'diamond-outline' },
  { id: 'new', label: STR.new, icon: 'star-outline' },
  { id: 'trending', label: STR.trending, icon: 'trending-up-outline' },
  { id: 'beauty', label: STR.beauty, icon: 'color-palette-outline' },
  { id: 'backgrounds', label: STR.backgrounds, icon: 'image-outline' },
];

/** Raccourcis affichés sous le bouton de capture. */
export const QUICK_CATEGORIES: LensCategoryId[] = ['favorites', 'forYou', 'seasonal', 'backgrounds', 'games', 'premium'];

export const ALL_CATEGORY_IDS = EXPLORER_CATEGORIES.map((c) => c.id);

/**
 * Lenses de démonstration pour Expo Go. Ce sont de simples filtres de couleur
 * (pas de suivi du visage), destinés à tester l'interface.
 */
export const DEMO_LENSES: VimoxLens[] = [
  { id: 'demo-rouge', name: 'Rouge VimoX', emoji: '🔴', accent: '#5A0004', demoTint: 'rgba(255,46,77,0.28)', categories: ['forYou', 'trending', 'beauty'], premium: false, views: 994_000_000, source: 'demo' },
  { id: 'demo-noir', name: 'Noir absolu', emoji: '🖤', accent: '#1A1A1A', demoTint: 'rgba(0,0,0,0.45)', categories: ['forYou', 'beauty'], premium: false, views: 16_000_000, source: 'demo' },
  { id: 'demo-citrouille', name: 'Lueur citrouille', emoji: '🎃', accent: '#5C2A00', demoTint: 'rgba(255,120,0,0.25)', categories: ['seasonal', 'forYou'], premium: false, views: 309_000_000, source: 'demo' },
  { id: 'demo-fantome', name: 'Fantôme', emoji: '👻', accent: '#2B2F3A', demoTint: 'rgba(200,220,255,0.30)', categories: ['seasonal', 'funny'], premium: false, views: 45_000_000, source: 'demo' },
  { id: 'demo-sorciere', name: 'Nuit de sorcière', emoji: '🧙', accent: '#2A0F3D', demoTint: 'rgba(110,0,180,0.30)', categories: ['seasonal'], premium: true, views: 2_200_000, source: 'demo' },
  { id: 'demo-neon', name: 'Néon', emoji: '💜', accent: '#30005A', demoTint: 'rgba(170,0,255,0.25)', categories: ['trending', 'new'], premium: true, views: 2_500_000_000, source: 'demo' },
  { id: 'demo-glace', name: 'Glacial', emoji: '🧊', accent: '#003A52', demoTint: 'rgba(0,170,255,0.22)', categories: ['new', 'beauty'], premium: false, views: 11_000_000, source: 'demo' },
  { id: 'demo-sunset', name: 'Golden hour', emoji: '🌅', accent: '#5A2A00', demoTint: 'rgba(255,170,60,0.22)', categories: ['beauty', 'forYou'], premium: true, views: 166_000_000, source: 'demo' },
  { id: 'demo-vintage', name: 'Pellicule 98', emoji: '📼', accent: '#3D3020', demoTint: 'rgba(180,140,80,0.28)', categories: ['trending'], premium: false, views: 278_000_000, source: 'demo' },
  { id: 'demo-matrix', name: 'Code vert', emoji: '🟩', accent: '#003D12', demoTint: 'rgba(0,255,80,0.20)', categories: ['funny', 'new'], premium: false, views: 250_000_000, source: 'demo' },
  { id: 'demo-cible', name: 'Tir aux cibles', emoji: '🎯', accent: '#4A0A0A', categories: ['games', 'trending'], premium: false, views: 291_000_000, source: 'demo' },
  { id: 'demo-ballon', name: 'Ballon volant', emoji: '🎈', accent: '#0A2A4A', categories: ['games'], premium: false, views: 14_000_000, source: 'demo' },
  { id: 'demo-quiz', name: 'Qui me ressemble ?', emoji: '❓', accent: '#2A2A00', categories: ['games', 'funny'], premium: true, views: 538_000_000, source: 'demo' },
  { id: 'demo-couronne', name: 'Couronne royale', emoji: '👑', accent: '#4A3A00', demoTint: 'rgba(255,210,0,0.18)', categories: ['premium', 'beauty'], premium: true, views: 549_000_000, source: 'demo' },
  { id: 'demo-diamant', name: 'Éclat diamant', emoji: '💎', accent: '#00304A', demoTint: 'rgba(120,220,255,0.20)', categories: ['premium', 'new'], premium: true, views: 763_000, source: 'demo' },
  { id: 'demo-mdr', name: 'Fou rire', emoji: '😂', accent: '#4A3A00', categories: ['funny', 'trending'], premium: false, views: 6_700_000, source: 'demo' },
];

/**
 * Convertit une lens Camera Kit en VimoxLens.
 * Les métadonnées viennent du champ "Vendor Data" que tu remplis pour chaque lens
 * dans le portail Camera Kit :
 *   categories = "forYou,games"   premium = "true"   views = "1200000"
 *   createdAt  = "2026-10-01"     facing  = "front"
 */
export function fromCameraKitLens(lens: CameraKitLens): VimoxLens {
  const vd = lens.vendorData ?? {};
  const categories = (vd.categories ?? 'forYou')
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is LensCategoryId => (ALL_CATEGORY_IDS as string[]).includes(s));

  const premium = vd.premium === 'true';
  if (premium && !categories.includes('premium')) categories.push('premium');

  const createdAt = vd.createdAt ? Date.parse(vd.createdAt) : undefined;
  const facingFromVendor = vd.facing === 'front' || vd.facing === 'back' ? vd.facing : undefined;

  return {
    id: lens.id,
    name: lens.name,
    iconUrl: lens.icons?.[0]?.imageUrl,
    previewUrl: lens.previews?.[0]?.imageUrl,
    categories: categories.length ? categories : ['forYou'],
    premium,
    views: Number(vd.views) || 0,
    createdAt: Number.isFinite(createdAt) ? createdAt : undefined,
    facing: facingFromVendor ?? (lens.facingPreference === 'BACK' ? 'back' : lens.facingPreference === 'FRONT' ? 'front' : undefined),
    source: 'camerakit',
  };
}

export function filterLenses(
  lenses: VimoxLens[],
  category: LensCategoryId,
  prefs: { favorites: string[]; recents: string[] },
): VimoxLens[] {
  const byId = new Map(lenses.map((l) => [l.id, l]));
  switch (category) {
    case 'recents':
      return prefs.recents.map((id) => byId.get(id)).filter((l): l is VimoxLens => !!l);
    case 'favorites':
      return prefs.favorites.map((id) => byId.get(id)).filter((l): l is VimoxLens => !!l);
    case 'trending': {
      // Vraie tendance : les lenses les plus utilisées ; complétée par la sélection « tendance »
      const used = lenses.filter((l) => l.views > 0).sort((a, b) => b.views - a.views).slice(0, 30);
      const ids = new Set(used.map((l) => l.id));
      return [...used, ...lenses.filter((l) => l.categories.includes('trending') && !ids.has(l.id))];
    }
    case 'new':
      return lenses
        .filter((l) => l.categories.includes('new'))
        .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
    case 'premium':
      return lenses.filter((l) => l.premium);
    case 'seasonal':
      // Hors saison, on montre tout ; en saison, seulement les lenses de la saison du moment
      return lenses.filter(
        (l) => l.categories.includes('seasonal') && (!SEASON.id || !l.season || l.season === SEASON.id),
      );
    default:
      return lenses.filter((l) => l.categories.includes(category));
  }
}

/** 994000000 → "994 M", 2300000000 → "2,3 Md", 667000 → "667 K" */
export function formatViews(n: number): string {
  const fmt = (v: number, unit: string) =>
    `${v >= 100 ? Math.round(v) : Number(v.toFixed(1)).toString().replace('.', ',')} ${unit}`;
  if (n >= 1e9) return fmt(n / 1e9, 'Md');
  if (n >= 1e6) return fmt(n / 1e6, 'M');
  if (n >= 1e3) return fmt(n / 1e3, 'K');
  return String(n);
}

/** Lenses mises en avant cette semaine (changent chaque lundi, identiques pour tout le monde). */
export function featuredThisWeek(lenses: VimoxLens[], n = 3): VimoxLens[] {
  const pool = lenses.filter((l) => !l.premium && l.categories.some((c) => c !== 'premium'));
  if (pool.length === 0) return [];
  const week = Math.floor((Date.now() / 86400000 + 3) / 7); // semaines commençant le lundi
  const out: VimoxLens[] = [];
  for (let i = 0; out.length < Math.min(n, pool.length) && i < pool.length * 3; i++) {
    const idx = Math.abs(Math.floor(Math.sin(week * 97 + i * 31) * 10000)) % pool.length;
    if (!out.includes(pool[idx])) out.push(pool[idx]);
  }
  return out;
}
