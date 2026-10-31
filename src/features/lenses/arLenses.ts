import type { VimoxLens } from './types';

/**
 * Effets visage gratuits (détection du visage MediaPipe, dessin dans FaceLensView).
 * Ils fonctionnent dans Expo Go et dans l'app installée.
 */
export const AR_LENSES: VimoxLens[] = [
  // Les incontournables
  { id: 'ar-rainbow', name: 'Arc-en-ciel', emoji: '🌈', accent: '#3A1A5A', arEffect: 'rainbow', categories: ['forYou', 'trending', 'funny'], premium: false, views: 0, source: 'demo' },
  { id: 'ar-dog', name: 'Toutou', emoji: '🐶', accent: '#5A3A1A', arEffect: 'dog', categories: ['forYou', 'funny', 'trending'], premium: false, views: 0, source: 'demo' },
  { id: 'ar-bigeyes', name: 'Gros yeux', emoji: '👀', accent: '#1A2A4A', arEffect: 'bigeyes', categories: ['forYou', 'funny', 'trending'], premium: false, views: 0, source: 'demo' },
  { id: 'ar-swap', name: 'Échange de visages', emoji: '🔄', accent: '#2A1A3A', arEffect: 'swap', categories: ['forYou', 'funny', 'trending'], premium: false, views: 0, source: 'demo' },
  { id: 'ar-flowers', name: 'Couronne de fleurs', emoji: '🌸', accent: '#5A1A3A', arEffect: 'flowers', categories: ['forYou', 'beauty'], premium: false, views: 0, source: 'demo' },
  { id: 'ar-glasses', name: 'Lunettes de star', emoji: '🕶️', accent: '#1A1A1A', arEffect: 'glasses', categories: ['forYou', 'trending'], premium: false, views: 0, source: 'demo' },
  { id: 'ar-hearts', name: 'Coup de foudre', emoji: '😍', accent: '#5A0018', arEffect: 'hearts', categories: ['forYou', 'beauty'], premium: false, views: 0, source: 'demo' },
  { id: 'ar-kiss', name: 'Bisous', emoji: '💋', accent: '#4A0A2A', arEffect: 'kiss', categories: ['forYou', 'funny'], premium: false, views: 0, source: 'demo' },
  // Déformations
  { id: 'ar-bighead', name: 'Grosse tête', emoji: '🤯', accent: '#3A2A1A', arEffect: 'bighead', categories: ['funny', 'new'], premium: false, views: 0, source: 'demo' },
  { id: 'ar-bigmouth', name: 'Grande bouche', emoji: '👄', accent: '#4A0A1A', arEffect: 'bigmouth', categories: ['funny', 'new'], premium: false, views: 0, source: 'demo' },
  // Beauté
  { id: 'ar-glow', name: 'Peau lisse', emoji: '✨', accent: '#4A3020', arEffect: 'glow', categories: ['beauty', 'forYou'], premium: false, views: 0, source: 'demo' },
  { id: 'ar-lips', name: 'Rouge à lèvres', emoji: '💄', accent: '#5A0020', arEffect: 'lips', categories: ['beauty', 'new'], premium: false, views: 0, source: 'demo' },
  { id: 'ar-freckles', name: 'Taches de rousseur', emoji: '🌞', accent: '#5A3A1A', arEffect: 'freckles', categories: ['beauty', 'new'], premium: false, views: 0, source: 'demo' },
  { id: 'ar-butterflies', name: 'Papillons', emoji: '🦋', accent: '#1A3A5A', arEffect: 'butterflies', categories: ['beauty', 'new'], premium: false, views: 0, source: 'demo' },
  // Animaux et déguisements
  { id: 'ar-cat', name: 'Chaton', emoji: '🐱', accent: '#2A2A2A', arEffect: 'cat', categories: ['funny', 'forYou'], premium: false, views: 0, source: 'demo' },
  { id: 'ar-bunny', name: 'Lapinou', emoji: '🐰', accent: '#4A2A3A', arEffect: 'bunny', categories: ['funny', 'new'], premium: false, views: 0, source: 'demo' },
  { id: 'ar-clown', name: 'Clown', emoji: '🤡', accent: '#4A0A0A', arEffect: 'clown', categories: ['funny'], premium: false, views: 0, source: 'demo' },
  { id: 'ar-mustache', name: 'Moustache', emoji: '🥸', accent: '#3A2A1A', arEffect: 'mustache', categories: ['funny', 'new'], premium: false, views: 0, source: 'demo' },
  { id: 'ar-neon', name: 'Néon', emoji: '💜', accent: '#30005A', arEffect: 'neon', categories: ['trending', 'new'], premium: false, views: 0, source: 'demo' },
  // Jeux
  { id: 'ar-game', name: 'Gobe-cœurs', emoji: '🎮', accent: '#0A2A4A', arEffect: 'game', categories: ['games', 'trending', 'forYou'], premium: false, views: 0, source: 'demo' },
  // Halloween
  { id: 'ar-devil', name: 'Diablotin', emoji: '😈', accent: '#4A0000', arEffect: 'devil', season: 'halloween', categories: ['seasonal', 'funny'], premium: false, views: 0, source: 'demo' },
  { id: 'ar-pumpkin', name: 'Tête de citrouille', emoji: '🎃', accent: '#5C2A00', arEffect: 'pumpkin', season: 'halloween', categories: ['seasonal'], premium: false, views: 0, source: 'demo' },
  // Fonds (écran vert) : la personne est détourée, le fond est remplacé
  { id: 'ar-bg-blur', name: 'Fond flou', emoji: '🌫️', accent: '#2A2A2A', arEffect: 'bgblur', categories: ['backgrounds', 'trending'], premium: false, views: 0, source: 'demo' },
  { id: 'ar-bg-beach', name: 'Plage', emoji: '🏖️', accent: '#0A3A5A', arEffect: 'bgbeach', categories: ['backgrounds', 'new'], premium: false, views: 0, source: 'demo' },
  { id: 'ar-bg-space', name: 'Espace', emoji: '🚀', accent: '#1A0A3A', arEffect: 'bgspace', categories: ['backgrounds', 'funny'], premium: false, views: 0, source: 'demo' },
  { id: 'ar-bg-studio', name: 'Studio VimoX', emoji: '🔴', accent: '#5A0004', arEffect: 'bgstudio', categories: ['backgrounds', 'premium'], premium: true, views: 0, source: 'demo' },
  // Premium
  { id: 'ar-crown', name: 'Couronne royale', emoji: '👑', accent: '#4A3A00', arEffect: 'crown', categories: ['premium', 'beauty'], premium: true, views: 0, source: 'demo' },
  { id: 'ar-halo', name: 'Ange', emoji: '😇', accent: '#4A4020', arEffect: 'halo', categories: ['premium', 'beauty', 'new'], premium: true, views: 0, source: 'demo' },
];
