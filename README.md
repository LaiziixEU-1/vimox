# VimoX

Application mobile (iOS / Android) de rencontres et de discussion : match avec des inconnus,
chat, Vims, stories, amis, jeux à deux, appels audio/vidéo.

**Technologies** : React Native, Expo SDK 57, TypeScript, Firebase (Firestore + Auth), Cloudinary (médias).

## Installation

```bash
npm install
npm install dotenv
npx expo install react-native-webview   # appels audio/vidéo
cp .env.example .env                    # puis remplis les valeurs
npx expo start --clear
```

Teste avec **Expo Go** : le téléphone et l'ordinateur doivent être connectés au même compte Expo.

## Configuration indispensable

- **Firebase** : crée un projet, active Firestore et l'authentification par email/mot de passe,
  puis remplis les variables `EXPO_PUBLIC_FIREBASE_*` du `.env`.
- **Cloudinary** : les photos, Vims, stories, messages vocaux et musiques sont envoyés avec un
  *Upload Preset* **non signé** (Settings > Upload > Upload presets > Signing mode = Unsigned).
  Le nom du compte et du preset se règlent dans `src/config/env.ts`.
- **Giphy** : clé `EXPO_PUBLIC_GIPHY_API_KEY` pour la recherche de GIF.

## Sécurité de la base de données

Le fichier `firestore.rules` couvre toutes les collections. **Ne le publie qu'après avoir vérifié**
que `Paramètres > Sécurité` affiche « Connexion sécurisée : active » sur chaque téléphone de test
(sinon l'app ne pourra plus lire ni écrire). Procédure détaillée en tête du fichier.

## Appels audio/vidéo

Salle Jitsi Meet affichée dans une WebView. Le serveur se change dans `src/services/videoService.ts`
(`CALL_SERVER`). Nécessite `react-native-webview`.

## Structure

```
src/screens      écrans (caméra, chats, amis, profil, réglages, stories...)
src/games        jeux à deux (+ règles testables : gameLogic, checkersLogic, battleshipLogic)
src/services     logique métier (match, amis, snaps, stories, authentification...)
src/components   composants partagés
src/navigation   navigation (pager caméra / amis / stories / profil)
src/utils        petits utilitaires (liens de profil)
```

## Limites connues

- Premium : démonstration gratuite (`BILLING_ENABLED` dans `premiumService.ts`) ; un vrai paiement
  demande un build natif (RevenueCat / StoreKit / Play Billing).
- Les liens `vimox://` ne s'ouvrent que dans une version installée (pas dans Expo Go).
- Pas de modération automatique du contenu : seulement signalement et blocage.
- Lenses AR, double caméra, découpe automatique par IA : impossibles dans Expo Go.

## Scripts

`scripts/generate-vimox-assets.js` génère les icônes (`node scripts/generate-vimox-assets.js`).
