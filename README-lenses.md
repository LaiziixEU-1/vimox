# VimoX — Lenses, sons et caméra

Module complet : caméra plein écran, carrousel de lenses, explorateur par catégories, lenses Premium verrouillées, sélecteur de sons (écoute, enregistrés, tendance, création), capture photo / vidéo et partage.

Le même code tourne dans deux modes, détectés automatiquement :

| | Expo Go (maintenant) | Build EAS + Camera Kit |
|---|---|---|
| Interface complète | Oui | Oui |
| Lenses | Filtres couleur de démo | Vraies lenses AR Snap |
| Zoom / flash | Oui | Non (non exposés par le wrapper Snap) |
| Photo / vidéo / partage | Oui | Oui (avec la lens incrustée) |

---

## 1. Copier les fichiers

```
src/features/lenses/      → écran, moteur, catalogue, composants
src/features/sounds/      → service et sélecteur de sons
```

Ouvre `src/features/lenses/projectBindings.ts` et corrige les 3 chemins (firebase, types de navigation, VoiceRecorderButton). C'est le seul fichier à adapter.

## 2. Installer les dépendances

```bash
npx expo install expo-camera expo-audio expo-video expo-sharing @react-native-async-storage/async-storage react-native-safe-area-context
npm install @snap/camera-kit-react-native
```

Le package Snap doit être installé même pour Expo Go : il n'y est jamais exécuté, mais Metro doit pouvoir le trouver.

## 3. Navigation

Dans `RootStackParamList` :

```ts
LensCamera: undefined;
```

Dans le navigator :

```tsx
<Stack.Screen name="LensCamera" component={LensCameraScreen} options={{ headerShown: false, animation: 'slide_from_bottom' }} />
```

Puis depuis n'importe quel écran : `navigation.navigate('LensCamera')`.

## 4. app.json

```json
{
  "expo": {
    "plugins": [
      ["expo-camera", {
        "cameraPermission": "VimoX utilise la caméra pour les lenses, les photos et les appels vidéo.",
        "microphonePermission": "VimoX utilise le micro pour les vidéos, les vocaux et les appels."
      }],
      ["expo-audio", { "microphonePermission": "VimoX utilise le micro pour les vidéos, les vocaux et les appels." }],
      "expo-video",
      ["expo-build-properties", { "ios": { "deploymentTarget": "15.1" }, "android": { "minSdkVersion": 24 } }]
    ]
  }
}
```

(`npx expo install expo-build-properties` pour la dernière ligne.)

## 5. Règles Firestore et Storage

Firestore :

```
match /sounds/{soundId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null
    && request.resource.data.creatorId == request.auth.uid
    && request.resource.data.featured == false
    && request.resource.data.trendingScore == 0;
  allow delete: if request.auth != null && resource.data.creatorId == request.auth.uid;
}
match /users/{uid}/savedSounds/{soundId} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
```

Storage :

```
match /sounds/{uid}/{fileName} {
  allow read: if request.auth != null;
  allow write: if request.auth != null && request.auth.uid == uid
    && request.resource.size < 3 * 1024 * 1024
    && request.resource.contentType.matches('audio/.*');
}
```

Les champs `featured` et `trendingScore` ne sont modifiables que depuis la console ou une Cloud Function : un utilisateur ne peut pas mettre son propre son en avant.

Pour remplir le catalogue, ajoute des documents dans `sounds` depuis la console :
`title`, `artist`, `durationSec`, `audioURL`, `coverURL` (optionnel), `featured`, `trendingScore`, `playlist` (ex. « Cozy Winter »).
N'utilise que des sons libres de droits ou dont tu as la licence.

## 6. Tester dans Expo Go

`npx expo start`, ouvre l'écran LensCamera. Tu peux tout tester : filtres de démo, explorateur, verrou Premium (active la démo Premium pour débloquer), sons, photo, vidéo et partage.

---

## 7. Passer aux vraies lenses avec Camera Kit

### a. Compte Snap
1. Va sur le portail développeur Snap Kit / Camera Kit et crée une application « VimoX ».
2. Demande l'accès à Camera Kit (Snap examine l'app avant d'activer la production ; le token **Staging** fonctionne tout de suite pour tes tests).
3. Récupère le **API Token** (Staging pour l'instant).

### b. Créer les lenses
1. Installe **Lens Studio** (gratuit) et crée tes lenses, ou pars des modèles fournis.
2. Dans le portail Camera Kit (my-lenses.snapchat.com), crée un ou plusieurs **Lens Groups** et ajoutes-y tes lenses.
3. Pour chaque lens, remplis le champ **Vendor Data** — c'est lui qui pilote les catégories et le Premium :

| Clé | Exemple | Effet |
|---|---|---|
| `categories` | `forYou,games` | Onglets où la lens apparaît |
| `premium` | `true` | Lens verrouillée pour les non-abonnés |
| `views` | `1200000` | Compteur de vues affiché |
| `createdAt` | `2026-10-01` | Tri de l'onglet « Nouveau » |
| `facing` | `back` | Bascule la caméra automatiquement |

Catégories possibles : `forYou`, `seasonal`, `games`, `funny`, `premium`, `new`, `trending`, `beauty`.

### c. Variables d'environnement
Crée `.env` à la racine :

```
EXPO_PUBLIC_CAMERA_KIT_API_TOKEN=ton_token
EXPO_PUBLIC_CAMERA_KIT_GROUP_IDS=id_groupe_1,id_groupe_2
```

### d. Build de développement EAS

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --profile development --platform android
```

Installe l'APK sur ton téléphone, puis lance `npx expo start --dev-client`. L'écran détecte Camera Kit et passe automatiquement en vraies lenses ; le bandeau « Mode aperçu » disparaît.

Pour iOS : `eas build --profile development --platform ios` (compte Apple Developer requis, mais pas de Mac : EAS compile dans le cloud).

### e. Si le build échoue
Le wrapper React Native de Snap est fourni « tel quel » et n'est pas officiellement supporté en production. Avec Expo SDK 54 (nouvelle architecture activée par défaut), si le module n'est pas détecté ou si le build plante :

1. Essaie d'abord en désactivant la nouvelle architecture dans `app.json` : `"newArchEnabled": false` (SDK 54 est la dernière version qui le permet).
2. Vérifie dans les logs que `SCCameraKit` (iOS) et `com.snap.camerakit` (Android) sont bien téléchargés.
3. Envoie-moi le log d'erreur EAS et on corrige.

### f. Limites à connaître
- Tu n'as accès qu'aux lenses de tes propres Lens Groups, pas au catalogue public de Snapchat.
- Lenses Premium : le verrou est côté app. Pour un vrai paiement, branche RevenueCat et remplace `useIsPremium()` dans `lensPrefs.ts`.
- Le son choisi est joué pendant l'enregistrement et l'aperçu, mais n'est pas fusionné dans le fichier vidéo (ça demande un traitement natif type FFmpeg, à faire plus tard côté serveur ou après EAS).
- Les lenses dans les appels vidéo nécessiteront de brancher la sortie Camera Kit sur WebRTC : c'est une étape native séparée, à prévoir avec `react-native-webrtc`.
