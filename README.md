# VimoX - App mobile iOS/Android dans VS Code

VimoX est une base complète React Native + Expo + TypeScript pour une plateforme de chat anonyme texte + vidéo avec style cyber neon.

## Langages et outils

- TypeScript / TSX
- React Native
- Expo
- Firebase Auth
- Firebase Firestore
- Firebase Storage
- VS Code

## Installation

Ouvre le dossier `vimox-vscode` dans VS Code, puis lance :

```bash
npm install
npm start
```

Si le QR code du terminal ne se scanne pas, ouvre Expo Go sur ton téléphone et entre manuellement l'URL affichée, par exemple `exp://192.168.x.x:8081`.

Si ton téléphone n'est pas sur le même Wi-Fi que le PC :

```bash
npm run start:tunnel
```

Crée aussi ton fichier `.env` depuis le modèle :

```bash
copy .env.example .env
```

Puis remplis les valeurs Firebase et AdMob dans `.env`.

Pour tester sur iPhone :

- Avec Expo Go : scanne le QR code affiché par `npm start`.
- Pour WebRTC natif ou Agora : installe le SDK choisi ensuite et utilise un development build Expo/EAS, car Expo Go ne charge pas tous les modules natifs.

## Configuration Firebase

La configuration Firebase est lue depuis `.env`, pas directement dans le code.

Active ensuite dans Firebase Console :

- Authentication avec email/password
- Firestore Database
- Storage

## Collections Firestore utilisées

- `users`
- `waitingUsers`
- `rooms`
- `rooms/{roomId}/messages`
- `reports`

## Fonctionnalités incluses

- Inscription : nom, âge minimum 16 ans, email, mot de passe, genre, pays, photo.
- Firebase Auth + profil Firestore + photo Storage.
- Matching aléatoire avec filtres âge, genre, pays.
- Bouton Suivant.
- Chat temps réel Firestore.
- Messages Unicode avec emojis iOS.
- Barre de suggestions emojis.
- Historique local via AsyncStorage.
- Signalement et blocage.
- Design sombre cyber neon rouge/bleu/noir.
- Écran vidéo avec caméra/micro ON-OFF, switch texte/vidéo et effets premium visuels.
- Emplacement AdMob/Premium prêt à brancher.

## Important pour Expo Go

La version actuelle est optimisée pour démarrer dans Expo Go. L'écran vidéo est prêt côté interface et logique de session, mais le vrai flux WebRTC/Agora doit être ajouté dans un development build EAS, car Expo Go ne charge pas les modules natifs vidéo externes.

## Build iOS App Store

Depuis Windows, le plus simple est EAS Build :

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build -p ios
```

Pour publier App Store, il faudra un compte Apple Developer.

## Déploiement Firebase

Les règles sont incluses :

- `firestore.rules`
- `storage.rules`
- `firestore.indexes.json`

Après installation de Firebase CLI :

```bash
firebase login
firebase use TON_PROJECT_ID
firebase deploy --only firestore,storage
```

## À brancher pour production

- Ajouter Agora SDK ou configurer `react-native-webrtc` dans un development build.
- Remplacer l'emplacement AdMob par `react-native-google-mobile-ads`.
- Ajouter règles Firestore/Storage strictes.
- Ajouter Cloud Functions pour matching atomique très haute charge.
- Ajouter modération avancée côté serveur.
