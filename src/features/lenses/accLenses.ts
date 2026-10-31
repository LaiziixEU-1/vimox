import type { LensCategoryId, SeasonId, VimoxLens } from './types';

/**
 * Lenses « par modèles » : chaque lens est décrite par des réglages (pas de code).
 * Le moteur (faceLensHtml) sait placer des éléments sur le visage, faire tomber des objets,
 * réagir à la bouche ouverte, teinter l'image, déformer, lisser la peau, etc.
 * Pour ajouter une lens : une ligne dans LENSES ci-dessous.
 */

// Déclencheurs : la lens réagit à une expression du visage, comme les lenses interactives de Snap
export type Trigger = 'open' | 'closed' | 'smile' | 'blink' | 'wink' | 'brows' | 'frown' | 'kiss' | 'puff';

export type Anchor =
  | 'top' | 'eyes' | 'leye' | 'reye' | 'nose' | 'mouth' | 'chin' | 'face'
  | 'lcheek' | 'rcheek' | 'lear' | 'rear';

export interface AccPart {
  e: string;          // emoji
  at: Anchor;         // point d'accroche sur le visage
  size: number;       // taille (en écart entre les yeux, ou en hauteur de visage si unit = 'face')
  up?: number;        // décalage vers le haut
  side?: number;      // décalage sur le côté
  rot?: number;       // rotation (radians)
  unit?: 'eye' | 'face';
  when?: Trigger;     // seulement pendant cette expression (bouche ouverte, sourire, clin d'œil…)
  pulse?: number;     // battement
  wobble?: number;    // balancement
  both?: boolean;     // dessiné des deux côtés (side et -side)
}

export interface AccParticles {
  chars: string[];
  mode: 'rain' | 'rise' | 'burst' | 'drip' | 'orbit';
  from?: Anchor;      // pour burst / drip
  rate?: number;      // probabilité par image (0 à 1)
  size?: number;      // taille relative
  when?: Trigger;
  count?: number;     // pour orbit
}

export interface AccConfig {
  parts?: AccPart[];
  particles?: AccParticles[];
  tint?: string;      // teinte douce de l'image
  bw?: boolean;       // noir et blanc
  smooth?: boolean;   // peau lisse
  lips?: string;      // couleur des lèvres
  warp?: { eyes?: number; mouth?: number; head?: number; nose?: number; cheeks?: number };
  symmetry?: boolean;  // visage miroir (moitié gauche recopiée à droite)
  pixel?: number;      // pixels 8-bit (0.05 = très gros pixels, 0.15 = petits)
  invert?: boolean;    // négatif
  scanlines?: boolean; // lignes de vieille télé / VHS
  vignette?: number;   // bords assombris (0 à 1)
  tintMode?: string;   // mode de la teinte ("soft-light" par défaut, "color" pour recolorer)
  hint?: string;      // message tant que l'expression attendue n'est pas faite
  hintWhen?: Trigger; // expression attendue (bouche ouverte par défaut)
  iris?: string;      // couleur des yeux (seul l'iris est recoloré)
  irisPaint?: boolean; // iris peint (yeux blancs) au lieu de recoloré
  liner?: string;     // eyeliner
  shadow?: string;    // ombre à paupières
  corners?: string[]; // emojis dans les 4 coins de l'écran
  game?: { good: string[]; bad?: string[]; mode?: 'catch' | 'dodge' };
}

// ---------- Petits raccourcis pour écrire les lenses ----------
const faceMask = (e: string, size = 1.3): AccPart => ({ e, at: 'face', unit: 'face', size });
const hat = (e: string, size = 0.72, up = 0.2): AccPart => ({ e, at: 'top', unit: 'face', size, up });
const glasses = (e: string, size = 2.3): AccPart => ({ e, at: 'eyes', size, up: -0.05 });
const onEyes = (e: string, size = 0.8, pulse = 0.12): AccPart[] => [
  { e, at: 'leye', size, pulse },
  { e, at: 'reye', size, pulse },
];
const nose = (e: string, size = 0.6): AccPart => ({ e, at: 'nose', size });
const mouth = (e: string, size = 0.7, when?: Trigger): AccPart => ({ e, at: 'mouth', size, when });
const rain = (chars: string[], rate = 0.25, size = 1, when?: Trigger): AccParticles => ({ chars, mode: 'rain', rate, size, when });
const rise = (chars: string[], rate = 0.2, size = 1, when?: Trigger): AccParticles => ({ chars, mode: 'rise', rate, size, when });
const burst = (chars: string[], from: Anchor, rate = 0.4, when?: Trigger, size = 0.4): AccParticles => ({ chars, mode: 'burst', from, rate, when, size });
const drip = (chars: string[], from: Anchor, rate = 0.15, size = 0.3): AccParticles => ({ chars, mode: 'drip', from, rate, size });
const orbit = (chars: string[], count = 3, size = 0.5): AccParticles => ({ chars, mode: 'orbit', count, size });

type Def = [id: string, name: string, emoji: string, accent: string, cats: LensCategoryId[], cfg: AccConfig, premium?: boolean];

const OPEN = 'Ouvre la bouche 😮';

const LENSES: Def[] = [
  // ----- Masques d'animaux (tout le visage) -----
  ['frog', 'Grenouille', '🐸', '#1A4A1A', ['funny', 'forYou'], { parts: [faceMask('🐸')], particles: [burst(['🪰'], 'mouth', 0.2, 'open')] }],
  ['monkey', 'Petit singe', '🐵', '#4A2A10', ['funny'], { parts: [faceMask('🐵')], particles: [burst(['🍌'], 'mouth', 0.25, 'open')] }],
  ['pig', 'Cochon', '🐷', '#5A2A3A', ['funny'], { parts: [faceMask('🐷')] }],
  ['panda', 'Panda', '🐼', '#2A2A2A', ['funny', 'forYou'], { parts: [faceMask('🐼')], particles: [orbit(['🎋'], 2, 0.5)] }],
  ['lion', 'Lion', '🦁', '#5A3A00', ['funny', 'trending'], { parts: [faceMask('🦁', 1.45)], hint: OPEN, particles: [burst(['💥'], 'mouth', 0.3, 'open')] }],
  ['tiger', 'Tigre', '🐯', '#5A3000', ['funny'], { parts: [faceMask('🐯')] }],
  ['bear', 'Ourson', '🐻', '#3A2010', ['funny'], { parts: [faceMask('🐻')], particles: [burst(['🍯'], 'mouth', 0.2, 'open')] }],
  ['fox', 'Renard', '🦊', '#5A2A00', ['funny', 'new'], { parts: [faceMask('🦊')] }],
  ['koala', 'Koala', '🐨', '#3A3A3A', ['funny'], { parts: [faceMask('🐨')] }],
  ['unicorn', 'Licorne', '🦄', '#4A1A5A', ['forYou', 'beauty'], { parts: [faceMask('🦄')], particles: [rain(['✨', '🌈', '💖'], 0.2, 0.8)], tint: 'rgba(220,150,255,0.3)' }],
  ['dragon', 'Dragon', '🐲', '#1A4A2A', ['funny', 'trending'], { parts: [faceMask('🐲')], hint: OPEN, particles: [burst(['🔥'], 'mouth', 0.7, 'open', 0.5)] }],
  ['octopus', 'Pieuvre', '🐙', '#5A1A3A', ['funny', 'new'], { parts: [faceMask('🐙')], particles: [rise(['🫧'], 0.2, 0.7)] }],
  ['owl', 'Hibou', '🦉', '#3A2A1A', ['funny'], { parts: [faceMask('🦉')] }],
  ['chicken', 'Poulet', '🐔', '#5A4A20', ['funny'], { parts: [faceMask('🐔')], particles: [burst(['🥚'], 'mouth', 0.2, 'open')] }],
  ['cow', 'Vache', '🐮', '#3A3A3A', ['funny'], { parts: [faceMask('🐮')] }],
  ['wolf', 'Loup-garou', '🐺', '#2A2A3A', ['funny', 'seasonal'], { parts: [faceMask('🐺')], particles: [orbit(['🌕'], 1, 0.6)], tint: 'rgba(60,60,140,0.3)' }],
  ['penguin', 'Pingouin', '🐧', '#1A2A3A', ['funny'], { parts: [faceMask('🐧')], particles: [rain(['❄️'], 0.2, 0.7)], tint: 'rgba(160,210,255,0.25)' }],
  ['hamster', 'Hamster', '🐹', '#5A3A20', ['funny', 'trending'], { parts: [faceMask('🐹')], particles: [burst(['🌻'], 'mouth', 0.2, 'open')] }],
  ['dog2', 'Chiot', '🐶', '#4A3A20', ['funny'], { parts: [faceMask('🐶')], particles: [burst(['🦴'], 'mouth', 0.2, 'open')] }],
  ['cat2', 'Minou', '🐱', '#4A3A20', ['funny'], { parts: [faceMask('🐱')], particles: [burst(['🐟'], 'mouth', 0.2, 'open')] }],

  // ----- Personnages -----
  ['robot', 'Robot', '🤖', '#1A2A3A', ['funny', 'new'], { parts: [faceMask('🤖')], particles: [rise(['⚙️'], 0.12, 0.6)], tint: 'rgba(120,200,255,0.25)' }],
  ['alien', 'Alien', '👽', '#1A4A2A', ['funny', 'trending'], { parts: [faceMask('👽')], particles: [orbit(['🛸'], 2, 0.6)], tint: 'rgba(80,255,120,0.22)' }],
  ['poop', 'Caca', '💩', '#3A2010', ['funny'], { parts: [faceMask('💩')], particles: [orbit(['🪰'], 3, 0.3)] }],
  ['clown2', 'Clown farceur', '🤡', '#4A0A0A', ['funny'], { parts: [faceMask('🤡')], particles: [rain(['🎈'], 0.12)] }],
  ['nerd', 'Intello', '🤓', '#2A2A3A', ['funny'], { parts: [glasses('👓', 2.4)], particles: [orbit(['📚', '✏️'], 2, 0.45)] }],
  ['cool', 'Trop cool', '😎', '#1A1A1A', ['forYou', 'trending'], { parts: [glasses('🕶️', 2.5), mouth('🤙', 0.6)] }],
  ['cowboy', 'Cowboy', '🤠', '#4A3010', ['funny'], { parts: [faceMask('🤠', 1.35)], particles: [rain(['🌵'], 0.06, 0.8)], tint: 'rgba(255,170,80,0.28)' }],
  ['astronaut', 'Astronaute', '👩‍🚀', '#0A1A3A', ['new', 'funny'], { parts: [{ e: '🪐', at: 'top', unit: 'face', size: 0.35, up: 0.35, side: 0.5 }], particles: [orbit(['⭐', '🌙', '🚀'], 3, 0.45), rain(['✨'], 0.15, 0.6)], tint: 'rgba(60,40,160,0.35)' }],
  ['pirate', 'Pirate', '🏴‍☠️', '#2A1A1A', ['funny'], { parts: [{ e: '🏴‍☠️', at: 'top', unit: 'face', size: 0.5, up: 0.3 }, { e: '⚫', at: 'leye', size: 0.75 }, { e: '🦜', at: 'rear', size: 0.8, side: 0.4, up: -0.6 }] }],
  ['superhero', 'Super-héros', '🦸', '#5A0A0A', ['forYou', 'funny'], { parts: [{ e: '🎭', at: 'eyes', size: 2.4, up: 0 }], particles: [burst(['⚡'], 'eyes', 0.35, undefined, 0.45)], tint: 'rgba(255,40,40,0.2)' }],
  ['ninja', 'Ninja', '🥷', '#1A1A1A', ['funny', 'new'], { parts: [faceMask('🥷', 1.4)], particles: [rain(['⭐'], 0.08, 0.6)] }],
  ['king', 'Roi', '🤴', '#4A3A00', ['premium', 'beauty'], { parts: [hat('👑', 0.65, 0.24)], particles: [rain(['💎', '💰'], 0.15, 0.7)], tint: 'rgba(255,215,0,0.2)' }, true],
  ['princess', 'Princesse', '👸', '#5A1A4A', ['premium', 'beauty'], { parts: [hat('👑', 0.55, 0.22)], particles: [burst(['✨', '💖'], 'top', 0.3)], smooth: true, lips: 'rgba(255,60,140,0.55)', tint: 'rgba(255,170,220,0.25)' }, true],
  ['detective', 'Détective', '🕵️', '#2A2A2A', ['funny'], { parts: [hat('🎩', 0.62, 0.2), { e: '🔍', at: 'reye', size: 1.2 }], bw: true }],

  // ----- Chapeaux -----
  ['tophat', 'Haut-de-forme', '🎩', '#1A1A1A', ['funny'], { parts: [hat('🎩')] }],
  ['cap', 'Casquette', '🧢', '#0A2A4A', ['funny', 'forYou'], { parts: [hat('🧢', 0.7, 0.15)] }],
  ['sunhat', 'Capeline', '👒', '#4A3A20', ['beauty'], { parts: [hat('👒', 0.85, 0.16)], particles: [rain(['🌸'], 0.12, 0.7)], tint: 'rgba(255,200,150,0.25)' }],
  ['graduate', 'Diplômé', '🎓', '#1A1A2A', ['funny'], { parts: [hat('🎓', 0.7, 0.18)], particles: [rain(['🎉', '🎊'], 0.3)] }],
  ['helmet', 'Casque de chantier', '⛑️', '#5A0A0A', ['funny'], { parts: [hat('⛑️', 0.72, 0.15)] }],
  ['party', 'Fête !', '🥳', '#3A1A4A', ['forYou', 'trending'], { parts: [hat('🎉', 0.55, 0.28), mouth('🥳', 0.4, 'open')], particles: [rain(['🎊', '🎉', '🎈'], 0.35)] }],
  ['chef', 'Chef cuisinier', '👨‍🍳', '#3A3A3A', ['funny', 'new'], { parts: [hat('🍳', 0.5, 0.3)], particles: [rain(['🍕', '🥐', '🍝'], 0.15, 0.8)] }],
  ['wizard', 'Magicien', '🧙', '#2A0A4A', ['funny', 'seasonal'], { parts: [hat('🧙', 0.8, 0.35)], particles: [burst(['✨', '🌟'], 'top', 0.4)], tint: 'rgba(140,60,255,0.25)' }],

  // ----- Yeux et lunettes -----
  ['stareyes', 'Yeux étoiles', '🤩', '#4A3A00', ['forYou', 'beauty'], { parts: onEyes('⭐', 0.85), particles: [burst(['✨'], 'top', 0.2)] }],
  ['moneyeyes', 'Yeux dollars', '🤑', '#1A4A1A', ['funny', 'trending'], { parts: onEyes('💲', 0.8), particles: [rain(['💸', '💵', '💰'], 0.35)] }],
  ['fireeyes', 'Yeux de feu', '🔥', '#5A1A00', ['funny', 'new'], { parts: onEyes('🔥', 0.9, 0.2), tint: 'rgba(255,90,0,0.25)' }],
  ['cyclops', 'Cyclope', '👁️', '#3A1A1A', ['funny'], { parts: [{ e: '👁️', at: 'eyes', size: 1.4, up: 0.05 }] }],
  ['crying', 'Fontaine de larmes', '😭', '#0A2A4A', ['funny', 'trending'], { particles: [drip(['💧'], 'leye', 0.5, 0.28), drip(['💧'], 'reye', 0.5, 0.28)], tint: 'rgba(80,140,255,0.2)' }],
  ['heartglasses', 'Lunettes cœur', '💖', '#5A0A2A', ['beauty', 'forYou'], { parts: onEyes('💗', 0.9, 0.15), particles: [rain(['💕'], 0.2, 0.7)] }],
  ['goggles', 'Plongée', '🤿', '#0A3A4A', ['funny'], { parts: [glasses('🥽', 2.3)], particles: [rise(['🫧'], 0.35, 0.6), rain(['🐠', '🐟'], 0.08, 0.8)], tint: 'rgba(0,140,220,0.3)' }],
  ['dizzy', 'Étourdi', '😵‍💫', '#3A3A0A', ['funny'], { parts: onEyes('💫', 0.8, 0.3), particles: [orbit(['⭐', '🐤'], 3, 0.4)] }],
  ['laser', 'Yeux laser', '🔴', '#5A0000', ['funny', 'new'], { parts: onEyes('🔴', 0.45, 0.4), particles: [burst(['💥'], 'eyes', 0.25)], tint: 'rgba(255,0,0,0.18)' }],
  ['sleepy', 'Dodo', '😴', '#1A1A3A', ['funny'], { parts: onEyes('➖', 0.7, 0), particles: [burst(['💤'], 'top', 0.15, undefined, 0.5)], tint: 'rgba(60,60,160,0.25)' }],

  // ----- Nez, joues, bouche -----
  ['pignose', 'Groin', '🐽', '#5A2A3A', ['funny'], { parts: [nose('🐽', 0.7)] }],
  ['snowman', 'Bonhomme de neige', '⛄', '#1A2A3A', ['seasonal', 'funny'], { parts: [nose('🥕', 0.55), hat('🎩', 0.6, 0.2)], particles: [rain(['❄️'], 0.35, 0.7)], tint: 'rgba(170,220,255,0.3)' }],
  ['rosy', 'Joues roses', '🥰', '#5A1A2A', ['beauty'], { parts: [{ e: '🌸', at: 'lcheek', size: 0.45 }, { e: '🌸', at: 'rcheek', size: 0.45 }], particles: [burst(['💕'], 'top', 0.2)], smooth: true }],
  ['tongue', 'Grimace', '😛', '#5A1A2A', ['funny'], { parts: [mouth('👅', 0.7, 'open')], hint: OPEN }],
  ['firebreath', 'Cracheur de feu', '🐉', '#5A1A00', ['funny', 'trending'], { hint: OPEN, particles: [burst(['🔥'], 'mouth', 0.9, 'open', 0.55)] }],
  ['bubbles', 'Bulles de savon', '🫧', '#0A3A4A', ['funny', 'beauty'], { hint: OPEN, particles: [burst(['🫧'], 'mouth', 0.5, 'open', 0.45)] }],
  ['singer', 'Chanteur', '🎤', '#2A1A4A', ['funny', 'new'], { parts: [{ e: '🎤', at: 'chin', size: 0.8, up: -0.2, side: 0.5 }], hint: 'Chante ! 🎶', particles: [burst(['🎵', '🎶'], 'mouth', 0.5, 'open', 0.45)] }],
  ['lollipop', 'Sucette', '🍭', '#5A1A4A', ['funny'], { parts: [{ e: '🍭', at: 'mouth', size: 0.8, side: 0.45, rot: 0.5 }] }],
  ['pizza', 'Miam pizza', '🍕', '#5A3A10', ['funny'], { parts: [mouth('🍕', 0.75)], particles: [rain(['🍕'], 0.15, 0.8)] }],
  ['icebreath', 'Souffle glacé', '❄️', '#0A2A4A', ['funny', 'seasonal'], { hint: OPEN, particles: [burst(['❄️', '🧊'], 'mouth', 0.7, 'open', 0.45)], tint: 'rgba(150,210,255,0.3)' }],
  ['wow', 'Waouh', '😮', '#3A3A0A', ['funny'], { hint: OPEN, parts: [{ e: '❗', at: 'top', unit: 'face', size: 0.35, up: 0.3, when: 'open' }], warp: { mouth: 1.4 } }],
  ['santa', 'Père Noël', '🎅', '#5A0A0A', ['seasonal', 'funny'], { parts: [faceMask('🎅', 1.4)], particles: [rain(['❄️', '🎁'], 0.3, 0.7)] }],

  // ----- Pluies et ambiances -----
  ['snow', 'Flocons', '❄️', '#1A2A4A', ['seasonal', 'beauty'], { particles: [rain(['❄️'], 0.45, 0.7)], tint: 'rgba(170,220,255,0.3)', smooth: true }],
  ['love', 'Pluie de cœurs', '💖', '#5A0A2A', ['forYou', 'beauty'], { particles: [rain(['💖', '💕', '❤️'], 0.4)], tint: 'rgba(255,120,180,0.25)' }],
  ['money', 'Pluie de billets', '💸', '#1A4A1A', ['funny', 'trending'], { particles: [rain(['💸', '💵'], 0.45)] }],
  ['confetti', 'Confettis', '🎊', '#3A1A4A', ['forYou'], { particles: [rain(['🎊', '🎉', '✨'], 0.5, 0.8)] }],
  ['autumn', 'Automne', '🍁', '#5A2A00', ['seasonal', 'beauty'], { particles: [rain(['🍁', '🍂'], 0.35)], tint: 'rgba(255,140,40,0.3)' }],
  ['spring', 'Printemps', '🌸', '#5A1A3A', ['beauty', 'new'], { particles: [rain(['🌸', '🌼'], 0.35, 0.8)], tint: 'rgba(255,180,210,0.25)', smooth: true }],
  ['lol', 'Mort de rire', '😂', '#4A3A00', ['funny', 'trending'], { particles: [rain(['😂', '🤣'], 0.35)] }],
  ['shootingstars', 'Étoiles filantes', '🌠', '#0A0A3A', ['beauty', 'new'], { particles: [rain(['🌠', '⭐', '✨'], 0.3, 0.7)], tint: 'rgba(40,40,140,0.35)' }],
  ['bees', 'Abeilles', '🐝', '#4A3A00', ['funny'], { particles: [orbit(['🐝'], 4, 0.4)] }],
  ['headstars', 'Tête dans les étoiles', '⭐', '#1A1A3A', ['beauty'], { particles: [orbit(['⭐', '🌟', '✨'], 5, 0.4)] }],
  ['sparkle', 'Paillettes', '✨', '#4A3A20', ['beauty', 'forYou'], { particles: [burst(['✨', '💫'], 'face', 0.5, undefined, 0.35)], smooth: true }],
  ['fireworks', 'Feu d\'artifice', '🎆', '#1A0A2A', ['new'], { particles: [rain(['🎆', '🎇', '✨'], 0.3)], tint: 'rgba(60,20,120,0.35)' }],
  ['food', 'Fringale', '🍔', '#5A3A10', ['funny'], { particles: [rain(['🍔', '🍟', '🍩', '🍕'], 0.3, 0.9)] }],
  ['sports', 'Champion', '🏆', '#4A3A00', ['funny', 'new'], { parts: [hat('🏆', 0.5, 0.3)], particles: [rain(['⚽', '🏀', '🏅'], 0.2, 0.8)] }],

  // ----- Beauté et filtres -----
  ['bw', 'Noir & blanc', '🖤', '#2A2A2A', ['beauty', 'trending'], { bw: true, smooth: true }],
  ['vintage', 'Rétro', '📷', '#4A3A20', ['beauty'], { tint: 'rgba(200,150,90,0.4)', corners: ['📼'] }],
  ['glam', 'Glamour', '💋', '#5A0A2A', ['beauty', 'forYou'], { smooth: true, lips: 'rgba(200,0,50,0.6)', particles: [burst(['✨'], 'face', 0.25, undefined, 0.3)] }],
  ['nude', 'Lèvres nude', '👄', '#5A3A2A', ['beauty'], { smooth: true, lips: 'rgba(200,120,100,0.5)' }],
  ['berry', 'Lèvres framboise', '🫐', '#4A0A3A', ['beauty', 'new'], { smooth: true, lips: 'rgba(150,0,90,0.6)' }],
  ['tan', 'Bronzage', '☀️', '#5A3A10', ['beauty'], { smooth: true, tint: 'rgba(255,150,60,0.32)' }],
  ['cold', 'Glacial', '🧊', '#0A2A4A', ['beauty'], { tint: 'rgba(80,170,255,0.32)' }],
  ['dreamy', 'Rêveur', '☁️', '#3A3A5A', ['beauty', 'new'], { smooth: true, tint: 'rgba(200,180,255,0.35)', particles: [rise(['☁️'], 0.06, 0.9)] }],
  ['babyface', 'Bébé', '👶', '#5A3A3A', ['funny', 'trending'], { warp: { eyes: 1.55 }, smooth: true, particles: [orbit(['🍼', '🧸'], 2, 0.4)] }],
  ['alieneyes', 'Yeux d\'insecte', '🪲', '#1A3A1A', ['funny'], { warp: { eyes: 2.0 }, tint: 'rgba(80,200,80,0.2)' }],
  ['bigface', 'Visage géant', '🫨', '#3A2A1A', ['funny'], { warp: { head: 1.5 } }],

  // ----- Halloween -----
  ['skull', 'Squelette', '💀', '#1A1A1A', ['seasonal', 'trending'], { parts: [faceMask('💀')], bw: true, particles: [orbit(['🦴'], 3, 0.4)] }],
  ['vampire', 'Vampire', '🧛', '#3A0000', ['seasonal'], { particles: [orbit(['🦇'], 4, 0.45)], tint: 'rgba(160,0,30,0.32)', lips: 'rgba(120,0,20,0.7)', smooth: true }],
  ['zombie', 'Zombie', '🧟', '#1A3A1A', ['seasonal', 'funny'], { parts: [faceMask('🧟', 1.35)], tint: 'rgba(80,160,60,0.3)' }],
  ['ghosts', 'Fantômes', '👻', '#2A2A3A', ['seasonal'], { particles: [orbit(['👻'], 3, 0.55)], tint: 'rgba(120,140,200,0.3)', bw: true }],
  ['spiders', 'Araignées', '🕷️', '#1A1A1A', ['seasonal'], { particles: [rain(['🕷️'], 0.2, 0.7)], corners: ['🕸️'] }],
  ['pumpkins', 'Citrouilles', '🎃', '#5C2A00', ['seasonal', 'forYou'], { particles: [orbit(['🎃'], 4, 0.45)], tint: 'rgba(255,120,0,0.3)' }],
  ['witch', 'Sorcière', '🧹', '#2A0A3A', ['seasonal'], { parts: [hat('🧙‍♀️', 0.85, 0.35)], particles: [orbit(['🦇', '🌙'], 3, 0.4)], tint: 'rgba(120,40,200,0.3)' }],
  ['mummy', 'Momie', '🤕', '#3A3020', ['seasonal'], { parts: [faceMask('🤕', 1.35)], tint: 'rgba(200,180,120,0.3)' }],

  // ----- Noël et Nouvel an -----
  ['reindeer', 'Renne', '🦌', '#3A2010', ['seasonal', 'funny'], { parts: [faceMask('🦌', 1.4), nose('🔴', 0.4)], particles: [rain(['❄️'], 0.3, 0.7)] }],
  ['elf', 'Lutin', '🧝', '#1A4A1A', ['seasonal', 'funny'], { parts: [faceMask('🧝', 1.35)], particles: [rain(['🎁', '🍬'], 0.2, 0.8)] }],
  ['xmastree', 'Sapin', '🎄', '#0A3A1A', ['seasonal'], { parts: [hat('🎄', 0.75, 0.32)], particles: [orbit(['⭐', '🔔', '🎁'], 3, 0.4)], tint: 'rgba(40,160,80,0.22)' }],
  ['gifts', 'Pluie de cadeaux', '🎁', '#5A0A0A', ['seasonal', 'forYou'], { particles: [rain(['🎁', '🍭', '🧸'], 0.35)] }],
  ['snowglobe', 'Boule à neige', '🔮', '#1A2A4A', ['seasonal', 'beauty'], { particles: [rain(['❄️', '✨'], 0.5, 0.6)], tint: 'rgba(170,210,255,0.35)', smooth: true }],
  ['newyear', 'Bonne année', '🥂', '#2A1A3A', ['seasonal', 'trending'], { parts: [hat('🎉', 0.5, 0.28)], particles: [rain(['🎆', '🎇', '🥂', '✨'], 0.4)] }],
  ['valentine', 'Saint-Valentin', '💘', '#5A0A2A', ['seasonal', 'beauty'], { parts: onEyes('💘', 0.85), particles: [rain(['💕', '🌹'], 0.35)], lips: 'rgba(210,0,70,0.55)', smooth: true }],
  ['summer', 'Vacances', '🏝️', '#0A3A5A', ['seasonal', 'funny'], { parts: [glasses('🕶️'), hat('👒', 0.8, 0.15)], particles: [rain(['🌴', '🍹', '☀️'], 0.15)], tint: 'rgba(255,190,90,0.28)' }],

  // ----- Lenses interactives (elles réagissent à ton visage, comme sur Snap) -----
  ['smilemagic', 'Sourire magique', '😁', '#4A3A00', ['forYou', 'new', 'trending'], { hint: 'Souris 😁', hintWhen: 'smile', parts: [{ e: '🌈', at: 'top', unit: 'face', size: 0.6, up: 0.32, when: 'smile' }], particles: [burst(['✨', '🌟', '💛'], 'mouth', 0.6, 'smile', 0.45)] }],
  ['smilecrown', 'Sourire royal', '👑', '#4A3A00', ['forYou', 'beauty'], { hint: 'Souris pour ta couronne 👑', hintWhen: 'smile', parts: [{ ...hat('👑', 0.6, 0.22), when: 'smile' }], particles: [burst(['✨'], 'top', 0.5, 'smile')] }],
  ['browsparty', 'Sourcils en fête', '🤨', '#3A1A4A', ['funny', 'new'], { hint: 'Lève les sourcils 🤨', hintWhen: 'brows', particles: [rain(['🎉', '🎊', '✨'], 0.7, 0.8, 'brows')] }],
  ['shocked', 'Choqué', '😲', '#3A3A0A', ['funny', 'new'], { hint: 'Lève les sourcils 😲', hintWhen: 'brows', parts: [{ e: '❗', at: 'top', unit: 'face', size: 0.3, up: 0.32, side: -0.18, rot: -0.3, when: 'brows' }, { e: '❓', at: 'top', unit: 'face', size: 0.3, up: 0.32, side: 0.18, rot: 0.3, when: 'brows' }], particles: [burst(['💥'], 'top', 0.4, 'brows')] }],
  ['winkheart', "Clin d'œil", '😉', '#5A0A2A', ['forYou', 'funny', 'trending'], { hint: "Fais un clin d'œil 😉", hintWhen: 'wink', particles: [burst(['💖', '💘', '✨'], 'eyes', 0.9, 'wink', 0.5)] }],
  ['flyingkiss', 'Bisou volant', '😘', '#5A0A2A', ['beauty', 'new'], { hint: 'Fais un bisou 😘', hintWhen: 'kiss', lips: 'rgba(220,0,60,0.5)', particles: [burst(['💋', '❤️', '💕'], 'mouth', 0.8, 'kiss', 0.5)] }],
  ['pufferfish', 'Poisson-globe', '🐡', '#0A3A4A', ['funny', 'new'], { hint: 'Gonfle les joues 🐡', hintWhen: 'puff', parts: [{ ...faceMask('🐡', 1.45), when: 'puff' }], particles: [rise(['🫧'], 0.25, 0.7)], tint: 'rgba(0,140,220,0.25)' }],
  ['laserblink', 'Regard laser', '😳', '#5A0000', ['funny', 'trending'], { hint: 'Ferme les yeux ⚡', hintWhen: 'blink', particles: [burst(['⚡', '💥'], 'eyes', 0.9, 'blink', 0.5)], tint: 'rgba(255,0,0,0.15)' }],
  ['angry', 'Colère', '😡', '#5A0A0A', ['funny', 'new'], { hint: 'Fronce les sourcils 😠', hintWhen: 'frown', parts: [{ e: '💢', at: 'top', unit: 'face', size: 0.3, up: 0.2, side: 0.3, pulse: 0.2, when: 'frown' }], particles: [burst(['💨'], 'lear', 0.5, 'frown', 0.5), burst(['💨'], 'rear', 0.5, 'frown', 0.5)] }],
  ['yawnstars', 'Bâillement', '🥱', '#1A1A3A', ['funny'], { hint: 'Ouvre grand la bouche 🥱', particles: [burst(['💤', '⭐'], 'mouth', 0.5, 'open', 0.45)], tint: 'rgba(60,60,160,0.2)' }],

  // ----- Couleur des yeux -----
  ['eyesblue', 'Yeux bleus', '🔵', '#0A2A5A', ['beauty', 'new'], { iris: 'rgba(30,120,255,0.85)' }],
  ['eyesgreen', 'Yeux verts', '🟢', '#0A3A1A', ['beauty', 'new'], { iris: 'rgba(20,200,90,0.8)' }],
  ['eyesviolet', 'Yeux violets', '🟣', '#2A0A4A', ['beauty'], { iris: 'rgba(160,60,255,0.85)' }],
  ['eyesamber', 'Yeux de miel', '🍯', '#4A3010', ['beauty'], { iris: 'rgba(230,160,20,0.8)', smooth: true }],
  ['eyesgalaxy', 'Yeux galaxie', '🌌', '#1A0A3A', ['beauty', 'trending'], { iris: 'rgba(150,80,255,0.9)', particles: [orbit(['⭐', '✨', '🌟'], 4, 0.35)], tint: 'rgba(60,30,140,0.25)' }],
  ['eyesice', 'Yeux de glace', '🧊', '#0A2A4A', ['beauty', 'seasonal'], { iris: 'rgba(160,230,255,0.9)', particles: [rain(['❄️'], 0.25, 0.6)], tint: 'rgba(150,210,255,0.25)' }],
  ['eyesdemon', 'Yeux de démon', '😈', '#4A0000', ['seasonal', 'trending'], { iris: 'rgba(255,20,20,0.95)', parts: [{ e: '🔺', at: 'top', unit: 'face', size: 0.2, up: 0.12, side: 0.3, rot: 0.35, both: true }], particles: [rise(['🔥'], 0.2, 0.8)], tint: 'rgba(160,0,0,0.3)' }],
  ['eyespossessed', 'Possédé', '👁️', '#1A1A1A', ['seasonal'], { iris: 'rgba(245,245,245,0.95)', irisPaint: true, bw: true, particles: [rain(['🦇'], 0.08, 0.7)] }],

  // ----- Maquillage des yeux -----
  ['eyeliner', 'Eyeliner', '✒️', '#2A2A2A', ['beauty', 'new'], { liner: 'rgba(15,10,10,0.9)', smooth: true }],
  ['smoky', 'Smoky eyes', '🖤', '#2A1A2A', ['beauty', 'trending'], { liner: 'rgba(20,10,20,0.9)', shadow: 'rgba(70,30,80,0.45)', lips: 'rgba(120,20,40,0.5)', smooth: true }],
  ['goldglam', 'Glam doré', '✨', '#4A3A10', ['beauty'], { liner: 'rgba(160,110,20,0.9)', shadow: 'rgba(255,190,60,0.4)', lips: 'rgba(200,40,60,0.55)', iris: 'rgba(230,160,20,0.5)', smooth: true, particles: [burst(['✨'], 'face', 0.25, undefined, 0.3)] }, true],
  ['dollface', 'Poupée', '🎀', '#5A1A3A', ['beauty', 'funny'], { warp: { eyes: 1.35 }, liner: 'rgba(20,10,10,0.9)', lips: 'rgba(255,80,140,0.55)', smooth: true, parts: [{ e: '🎀', at: 'top', unit: 'face', size: 0.35, up: 0.15, side: 0.35 }] }],
  ['idol', 'Idole K-pop', '💜', '#3A1A4A', ['beauty', 'trending'], { smooth: true, liner: 'rgba(40,20,20,0.8)', lips: 'rgba(230,60,110,0.45)', tint: 'rgba(255,200,230,0.25)', particles: [burst(['💜', '✨'], 'face', 0.2, undefined, 0.3)] }],
  ['pinkshadow', 'Paupières roses', '🌸', '#5A1A3A', ['beauty'], { shadow: 'rgba(255,90,160,0.45)', liner: 'rgba(60,20,40,0.7)', smooth: true }],

  // ----- Jeux Esquive : bouge la tête -----
  ['dodgebomb', 'Esquive les bombes', '💣', '#2A2A2A', ['games', 'new', 'forYou'], { game: { good: [], bad: ['💣', '🪨'], mode: 'dodge' } }],
  ['meteors', 'Pluie de météores', '☄️', '#1A0A3A', ['games', 'trending'], { game: { good: [], bad: ['☄️', '🔥'], mode: 'dodge' }, tint: 'rgba(80,20,120,0.3)' }],
  ['dodgezombie', 'Fuis les zombies', '🧟', '#1A3A1A', ['games', 'seasonal'], { game: { good: [], bad: ['🧟', '💀'], mode: 'dodge' }, tint: 'rgba(80,160,60,0.25)' }],

  // ----- Nouveaux looks (v41) -----
  ['mirror', 'Visage miroir', '🪞', '#2A2A3A', ['funny', 'trending', 'forYou'], { symmetry: true }],
  ['pixel8', '8-bit', '👾', '#1A1A3A', ['funny', 'new'], { pixel: 0.06, particles: [rain(['👾', '🕹️'], 0.08, 0.7)] }],
  ['mosaic', 'Mosaïque', '🧩', '#2A2A2A', ['funny'], { pixel: 0.12 }],
  ['negative', 'Négatif', '🎞️', '#1A1A1A', ['new'], { invert: true }],
  ['thermal', 'Caméra thermique', '🌡️', '#5A1A00', ['trending', 'funny'], { invert: true, tint: 'rgba(255,60,0,0.55)', tintMode: 'color' }],
  ['vhs', 'VHS 90s', '📼', '#3A1A3A', ['trending', 'beauty'], { scanlines: true, tint: 'rgba(255,120,200,0.25)', vignette: 0.6, corners: ['📼'] }],
  ['filmnoir', 'Film noir', '🎬', '#1A1A1A', ['beauty'], { bw: true, vignette: 0.8, scanlines: true }],
  ['sepia', 'Sépia', '🟤', '#3A2A1A', ['beauty'], { bw: true, tint: 'rgba(160,110,60,0.55)', tintMode: 'color', vignette: 0.5 }],
  ['goldenhour', 'Heure dorée', '🌅', '#5A3A10', ['beauty', 'forYou'], { tint: 'rgba(255,170,60,0.35)', vignette: 0.4, smooth: true }],
  ['neonnight', 'Néon de nuit', '🌃', '#2A0A4A', ['beauty', 'new'], { tint: 'rgba(120,0,255,0.35)', vignette: 0.6, particles: [rise(['✨'], 0.15, 0.5)] }],
  ['matrix', 'Matrix', '💚', '#0A2A0A', ['new', 'funny'], { tint: 'rgba(0,255,80,0.45)', tintMode: 'color', scanlines: true, particles: [rain(['0', '1'], 0.5, 0.5)] }],
  ['cyberpunk', 'Cyberpunk', '🦾', '#0A2A3A', ['trending', 'beauty'], { tint: 'rgba(0,240,255,0.3)', vignette: 0.6, liner: 'rgba(0,240,255,0.9)', lips: 'rgba(255,0,180,0.55)' }],
  ['polaroid', 'Polaroid', '📸', '#4A3A2A', ['beauty'], { tint: 'rgba(255,230,190,0.35)', vignette: 0.45, smooth: true }],

  // ----- Déformations (v41) -----
  ['bignose', 'Gros nez', '👃', '#4A2A1A', ['funny', 'trending'], { warp: { nose: 1.75 } }],
  ['chipmunk', 'Écureuil', '🐿️', '#4A2A10', ['funny', 'new'], { warp: { cheeks: 1.6 }, parts: [{ e: '🌰', at: 'mouth', size: 0.5, when: 'open' }] }],
  ['alienhead', "Tête d'alien", '🛸', '#1A3A1A', ['funny'], { warp: { head: 1.4, eyes: 1.8 }, tint: 'rgba(80,255,120,0.25)' }],
  ['cartoon', 'Dessin animé', '🎨', '#3A2A4A', ['funny', 'beauty'], { warp: { eyes: 1.5, mouth: 1.3 }, smooth: true, liner: 'rgba(0,0,0,0.85)' }],
  ['owleyes', 'Yeux de hibou', '🦉', '#3A2A1A', ['funny'], { warp: { eyes: 2.2 } }],
  ['bigsmile', 'Sourire XXL', '😁', '#4A3A00', ['funny'], { warp: { mouth: 1.7 }, hint: 'Ouvre grand ! 😁', particles: [burst(['✨'], 'mouth', 0.4, 'open')] }],

  // ----- Masques et personnages (v41) -----
  ['dino', 'Dino', '🦖', '#1A3A1A', ['funny', 'trending'], { parts: [faceMask('🦖', 1.4)], hint: OPEN, particles: [burst(['💥', '🔥'], 'mouth', 0.6, 'open')] }],
  ['croco', 'Crocodile', '🐊', '#1A3A1A', ['funny'], { parts: [faceMask('🐊', 1.45)] }],
  ['shark', 'Requin', '🦈', '#0A2A4A', ['funny', 'new'], { parts: [faceMask('🦈', 1.45)], particles: [rise(['🫧'], 0.3, 0.6)], tint: 'rgba(0,120,220,0.3)' }],
  ['raccoon', 'Raton laveur', '🦝', '#2A2A2A', ['funny'], { parts: [faceMask('🦝')] }],
  ['horse', 'Cheval', '🐴', '#3A2A1A', ['funny'], { parts: [faceMask('🐴', 1.4)] }],
  ['zebra', 'Zèbre', '🦓', '#2A2A2A', ['funny'], { parts: [faceMask('🦓', 1.4)], bw: true }],
  ['gorilla', 'Gorille', '🦍', '#2A1A1A', ['funny'], { parts: [faceMask('🦍', 1.35)], particles: [burst(['🍌'], 'mouth', 0.3, 'open')] }],
  ['bird', 'Petit oiseau', '🐦', '#0A2A4A', ['funny'], { parts: [faceMask('🐦')], particles: [orbit(['🪶'], 3, 0.4)] }],
  ['ladybug', 'Coccinelle', '🐞', '#4A0A0A', ['beauty', 'new'], { particles: [orbit(['🐞'], 4, 0.4)], tint: 'rgba(255,80,80,0.2)' }],
  ['genie', 'Génie', '🧞', '#1A1A4A', ['funny'], { parts: [faceMask('🧞', 1.35)], particles: [rise(['✨', '💨'], 0.25, 0.6)], tint: 'rgba(60,90,255,0.3)' }],
  ['mermaid', 'Sirène', '🧜‍♀️', '#0A3A4A', ['beauty', 'trending'], { parts: [faceMask('🧜‍♀️', 1.35)], particles: [rise(['🫧', '🐚'], 0.25, 0.6)], tint: 'rgba(0,200,220,0.3)' }],
  ['fairy', 'Fée', '🧚', '#3A1A4A', ['beauty', 'forYou'], { particles: [orbit(['🧚', '✨'], 3, 0.45), burst(['✨'], 'top', 0.3)], smooth: true, tint: 'rgba(230,170,255,0.3)' }],
  ['villain', 'Méchant', '🦹', '#1A0A1A', ['funny'], { parts: [faceMask('🦹', 1.35)], tint: 'rgba(80,0,60,0.35)', vignette: 0.7 }],
  ['police', 'Police', '👮', '#0A1A3A', ['funny'], { parts: [faceMask('👮', 1.35)], particles: [orbit(['🚨'], 2, 0.4)] }],
  ['royalguard', 'Garde royal', '💂', '#4A0A0A', ['funny'], { parts: [faceMask('💂', 1.45)] }],

  // ----- Accessoires (v41) -----
  ['dj', 'DJ', '🎧', '#2A0A4A', ['funny', 'new', 'trending'], { parts: [hat('🎧', 0.95, 0.02)], particles: [rain(['🎵', '🎶'], 0.25, 0.7)], tint: 'rgba(140,0,255,0.25)' }],
  ['caesar', 'César', '🌿', '#1A3A1A', ['funny'], { parts: [hat('🌿', 0.7, 0.12)], tint: 'rgba(255,215,140,0.25)' }],
  ['catears', 'Oreilles de chat', '😺', '#3A1A2A', ['beauty', 'forYou'], { parts: [{ e: '🔺', at: 'top', unit: 'face', size: 0.22, up: 0.12, side: 0.32, rot: 0.3, both: true }, nose('🖤', 0.25)], smooth: true }],
  ['joytears', 'Larmes de joie', '😂', '#4A3A00', ['funny', 'trending'], { particles: [drip(['😂'], 'leye', 0.25, 0.3), drip(['😂'], 'reye', 0.25, 0.3)] }],
  ['sweat', 'Stress', '😅', '#0A2A4A', ['funny'], { particles: [drip(['💧'], 'top', 0.35, 0.3)] }],
  ['sneeze', 'Atchoum', '🤧', '#2A3A4A', ['funny'], { hint: OPEN, particles: [burst(['💦'], 'mouth', 0.8, 'open', 0.4)] }],
  ['chatterbox', 'Bavard', '💬', '#2A2A3A', ['funny'], { hint: OPEN, parts: [{ e: '💬', at: 'top', unit: 'face', size: 0.35, up: 0.25, side: 0.5, when: 'open', pulse: 0.1 }] }],

  // ----- Lenses interactives (v41) -----
  ['sunflower', 'Tournesol', '🌻', '#4A3A00', ['beauty', 'new'], { hint: 'Souris 🌻', hintWhen: 'smile', particles: [rain(['🌻', '☀️'], 0.5, 0.8, 'smile')] }],
  ['storm', 'Orage', '⛈️', '#1A1A2A', ['funny', 'new'], { hint: 'Fronce les sourcils ⛈️', hintWhen: 'frown', particles: [rain(['🌧️', '⚡'], 0.5, 0.8, 'frown')], tint: 'rgba(40,40,90,0.3)' }],
  ['kissbutterfly', 'Papillons du cœur', '🦋', '#3A1A4A', ['beauty'], { hint: 'Fais un bisou 😘', hintWhen: 'kiss', particles: [burst(['🦋', '💕'], 'mouth', 0.7, 'kiss', 0.45)] }],
  ['balloon', 'Ballon', '🎈', '#5A0A0A', ['funny'], { hint: 'Gonfle les joues 🎈', hintWhen: 'puff', parts: [{ e: '🎈', at: 'mouth', size: 0.9, up: -0.4, when: 'puff', wobble: 0.3 }] }],
  ['liftoff', 'Décollage', '🚀', '#0A0A2A', ['funny', 'new'], { hint: 'Lève les sourcils 🚀', hintWhen: 'brows', particles: [rise(['🚀', '✨'], 0.5, 0.7, 'brows')] }],

  // ----- Jeux (v41) -----
  ['candy', 'Gobe les bonbons', '🍬', '#5A1A4A', ['games', 'new'], { game: { good: ['🍬', '🍭', '🍫'], bad: ['🌶️'] } }],
  ['catchhearts', 'Attrape les cœurs', '💖', '#5A0A2A', ['games', 'beauty'], { game: { good: ['💖', '💕', '💗'], bad: ['💔'] } }],
  ['dodgeballs', 'Esquive les ballons', '⚽', '#0A3A1A', ['games', 'funny'], { game: { good: [], bad: ['⚽', '🏀', '🏈'], mode: 'dodge' } }],

  // ----- Saisons (v41) -----
  ['mrsclaus', 'Mère Noël', '🤶', '#5A0A0A', ['seasonal', 'funny'], { parts: [faceMask('🤶', 1.4)], particles: [rain(['❄️', '🎁'], 0.3, 0.7)] }],
  ['blizzard', 'Tempête de neige', '🌨️', '#1A2A4A', ['seasonal'], { particles: [rain(['❄️', '❅'], 0.8, 0.6)], tint: 'rgba(200,230,255,0.4)', vignette: 0.4 }],
  ['sparklers', 'Feux de Bengale', '🎇', '#2A1A0A', ['seasonal', 'new'], { particles: [burst(['🎇', '✨'], 'face', 0.5, undefined, 0.4)], tint: 'rgba(255,190,90,0.25)' }],
  ['dracula', 'Dracula', '🧛', '#3A0000', ['seasonal', 'trending'], { parts: [faceMask('🧛', 1.35)], particles: [orbit(['🦇'], 3, 0.4)], vignette: 0.7 }],
  ['ogre', 'Ogre', '👹', '#4A0A0A', ['seasonal', 'funny'], { parts: [faceMask('👹', 1.4)], tint: 'rgba(200,0,0,0.25)' }],
  ['calavera', 'Calavera', '💀', '#2A0A2A', ['seasonal', 'beauty'], { parts: [faceMask('💀', 1.3), ...[-2, -1, 0, 1, 2].map((i) => ({ e: i % 2 ? '🌼' : '🌺', at: 'top' as Anchor, unit: 'face' as const, size: 0.18, up: 0.18 + Math.cos(i * 0.5) * 0.06, side: i * 0.16 }))], tint: 'rgba(255,90,160,0.2)' }],

  // ----- Jeux -----
  ['catchpizza', 'Gobe-pizzas', '🍕', '#5A3A10', ['games', 'funny'], { game: { good: ['🍕', '🍔', '🍩'], bad: ['🌶️'] } }],
  ['catchstars', 'Attrape-étoiles', '🌟', '#1A1A3A', ['games', 'new'], { game: { good: ['⭐', '🌟'], bad: ['💣'] } }],
  ['catchmoney', 'Jackpot', '💰', '#1A4A1A', ['games', 'trending'], { game: { good: ['💰', '💎', '🪙'], bad: ['💣'] } }],
];

// Saison de chaque lens saisonnière (affichée seulement à la bonne période)
const SEASON_OF: Record<string, SeasonId> = {
  skull: 'halloween', vampire: 'halloween', zombie: 'halloween', ghosts: 'halloween', spiders: 'halloween',
  pumpkins: 'halloween', witch: 'halloween', mummy: 'halloween', wolf: 'halloween', wizard: 'halloween', autumn: 'halloween',
  snowman: 'christmas', santa: 'christmas', reindeer: 'christmas', elf: 'christmas', xmastree: 'christmas',
  gifts: 'christmas', snowglobe: 'christmas', snow: 'christmas', icebreath: 'christmas',
  newyear: 'newyear', valentine: 'valentine', summer: 'summer',
  eyesdemon: 'halloween', eyespossessed: 'halloween', dodgezombie: 'halloween', eyesice: 'christmas',
  mrsclaus: 'christmas', blizzard: 'christmas', sparklers: 'newyear', dracula: 'halloween', ogre: 'halloween', calavera: 'halloween',
};

export const ACC_CONFIGS: Record<string, AccConfig> = {};
export const ACC_LENSES: VimoxLens[] = LENSES.map(([id, name, emoji, accent, cats, cfg, premium], i) => {
  ACC_CONFIGS[id] = cfg;
  return {
    id: `acc-${id}`,
    name,
    emoji,
    accent,
    arEffect: `acc_${id}`,
    categories: premium && !cats.includes('premium') ? [...cats, 'premium'] : cats,
    premium: !!premium,
    // Les vraies utilisations viennent de Firebase (lensStats) ; 0 au départ
    views: 0,
    createdAt: Date.UTC(2026, 9, 1) + i * 3600_000,
    season: SEASON_OF[id],
    source: 'demo',
  };
});
