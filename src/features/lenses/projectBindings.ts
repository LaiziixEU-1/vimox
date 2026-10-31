/**
 * SEUL fichier à adapter : il relie le module Lenses/Sons à ton projet VimoX.
 * Corrige les chemins ci-dessous selon ton arborescence.
 */
export { db, auth, storage } from '../../config/firebase';
export type { RootStackParamList } from '../../models/types';
export { default as VoiceRecorderButton } from '../sounds/VoiceRecorderButton';

/** Couleurs VimoX */
export const VX = {
  red: '#FF2E4D',
  black: '#09090C',
  surface: '#15151B',
  surfaceHigh: '#1D1D25',
  text: '#F7F7FA',
  textMuted: '#9B9BAA',
  overlay: 'rgba(0,0,0,0.45)',
} as const;
