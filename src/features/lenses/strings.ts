/**
 * Textes du module. Pour l'i18n, remplace ces valeurs par des appels à ton t()
 * ou ajoute les clés dans i18n/index.ts (FR / EN / AR).
 */
export const STR = {
  // Catégories
  recents: 'Récents',
  favorites: 'Favoris',
  forYou: 'Pour toi',
  seasonal: 'Halloween', // ← change selon la saison (Noël, Ramadan, Été…)
  games: 'Jeux',
  funny: 'Drôle',
  premium: 'Vim+',
  new: 'Nouveau',
  trending: 'Tendance',
  beauty: 'Beauté',
  backgrounds: 'Fonds',

  // Caméra
  noLens: 'Aucune lens',
  holdToRecord: 'Maintiens pour filmer',
  cameraPermissionTitle: 'VimoX a besoin de la caméra',
  cameraPermissionBody: 'Autorise la caméra pour utiliser les lenses et prendre des photos.',
  allowCamera: 'Autoriser la caméra',
  demoBanner: 'Mode aperçu : les lenses AR fonctionnent dans la version installée',
  share: 'Partager',
  discard: 'Supprimer',
  captureError: "La capture n'a pas fonctionné. Réessaie.",

  // Explorateur
  searchLenses: 'Rechercher une lens',
  emptyFavorites: 'Maintiens une lens appuyée pour l’ajouter à tes favoris.',
  emptyRecents: 'Les lenses que tu utilises apparaîtront ici.',
  emptySearch: 'Aucune lens ne correspond à ta recherche.',
  addedToFavorites: 'Ajoutée aux favoris',
  removedFromFavorites: 'Retirée des favoris',

  // Premium
  premiumLensTitle: 'Lens Vim+',
  premiumLensBody: 'Cette lens fait partie de Vim+, avec des nouveautés chaque semaine.',
  discoverPremium: 'Découvrir Vim+',
  notNow: 'Plus tard',

  // Sons
  sounds: 'Sons',
  featured: 'À la une',
  saved: 'Enregistrés',
  trendingSounds: 'Tendance',
  searchSounds: 'Rechercher un son',
  popular: 'Populaires',
  playlists: 'Playlists',
  createSound: 'Créer un son',
  soundTitlePlaceholder: 'Titre de ton son',
  holdToRecordSound: 'Maintiens le micro pour enregistrer',
  useSound: 'Utiliser',
  removeSound: 'Retirer le son',
  emptySaved: 'Enregistre des sons pour les retrouver ici.',
  emptySounds: 'Aucun son pour le moment.',
  soundCreated: 'Ton son est publié',
} as const;
