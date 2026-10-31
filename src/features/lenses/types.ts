import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';

export type IoniconName = ComponentProps<typeof Ionicons>['name'];

export type LensCategoryId =
  | 'recents'
  | 'favorites'
  | 'forYou'
  | 'seasonal'
  | 'games'
  | 'funny'
  | 'premium'
  | 'new'
  | 'trending'
  | 'beauty'
  | 'backgrounds';

export interface LensCategory {
  id: LensCategoryId;
  label: string;
  icon: IoniconName;
}

export interface VimoxLens {
  /** Pour Camera Kit : l'ID de la lens dans le portail. */
  id: string;
  name: string;
  iconUrl?: string;
  previewUrl?: string;
  categories: LensCategoryId[];
  premium: boolean;
  views: number;
  createdAt?: number;
  /** Caméra préférée : la caméra bascule automatiquement à l'application de la lens. */
  facing?: 'front' | 'back';
  source: 'camerakit' | 'demo';
  /** Saison de la lens (halloween, christmas…) : visible dans « Saison » seulement à cette période */
  season?: SeasonId;
  /** Effet visage gratuit (MediaPipe dans une WebView) : dog, glasses, crown… */
  arEffect?: string;

  // --- Mode démo (Expo Go) uniquement ---
  emoji?: string;
  accent?: string;
  /** Teinte superposée à l'aperçu (simple filtre couleur, sans suivi du visage). */
  demoTint?: string;
}

export type SeasonId = 'halloween' | 'christmas' | 'newyear' | 'valentine' | 'summer';
