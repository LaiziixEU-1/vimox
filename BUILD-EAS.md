# Premier build de test (EAS) : VimoX hors d'Expo Go

Pourquoi : certaines fonctions ne marchent pas, ou mal, dans Expo Go : le changement d'icône, les achats, les
publicités, les notifications complètes. Un « build de développement » est ta vraie app, installée sur ton téléphone,
qui se connecte à ton PC comme Expo Go.

## Ce qu'il faut

| | iPhone | Android |
|---|---|---|
| Compte Expo (expo.dev) | gratuit | gratuit |
| Compte Apple Developer | **99 USD par an**, obligatoire | non |
| Temps d'un build | environ 15 à 30 min | environ 15 à 30 min |

Le forfait gratuit d'EAS limite le nombre de builds par mois et les met en file d'attente : vérifie les limites
actuelles sur expo.dev/pricing.

## 0. Décide maintenant de l'identifiant de l'app

Il est dans `app.config.ts` : `ios.bundleIdentifier` et `android.package`, aujourd'hui **`com.vimox.app`**.
Il doit être **unique dans le monde** : si quelqu'un l'a déjà pris, Apple ou Google le refusera. Il est
**impossible à changer après la publication**, et AdMob, RevenueCat et les stores s'y rattachent. Si tu veux un
identifiant plus sûr, change-le **avant** de créer le moindre compte, par exemple `com.tonnom.vimox`.
(Firebase n'est pas concerné : l'app utilise sa configuration web.)

## 1. Préparer le projet (une seule fois)

```
npx expo install expo-dev-client expo-font expo-asset
npx expo install --fix
npx expo-doctor
```
- `expo-dev-client` est obligatoire pour un build de développement.
- `expo-font` et `expo-asset` sont requis **hors d'Expo Go** (polices des icônes, fichiers audio) : sans eux, l'app
  construite peut planter. Dans Expo Go tout marche sans, ce qui les cache.
- `npx expo install --fix` aligne tous les paquets sur les versions exactes du SDK.
- `expo-doctor` doit afficher **20/20**. Si une ligne est marquée ✖, envoie-la-moi avant de continuer.
- Les « vulnérabilités » signalées par npm sont du bruit : **ne lance pas `npm audit fix --force`**, il peut casser
  le projet.

## 2. Connexion, projet et variables (important)

### a) Connexion

```
npx eas-cli@latest whoami
```
Si ton nom d'utilisateur Expo s'affiche, tu es connecté : passe à la suite. Sinon : `npx eas-cli@latest login`.
Ces commandes utilisent `eas-cli@latest` : une ancienne version gardée en cache ne connaît pas toutes les commandes
(par exemple `env:set`).

> **Si le terminal dit « EXPO_TOKEN is set in your environment » et refuse `login`** : ton ordinateur a déjà un
> **jeton d'accès Expo** (variable `EXPO_TOKEN`) qui sert à toutes les commandes EAS. Si `whoami` affiche ton nom,
> tout va bien : ignore ce message. Si `whoami` échoue (jeton périmé), supprime-le, rouvre le terminal, puis
> connecte-toi : `[Environment]::SetEnvironmentVariable("EXPO_TOKEN", $null, "User")`.
> Un jeton donne accès à ton compte Expo : ne le partage jamais, ni dans un message ni sur une capture d'écran.

### b) Relier le projet à TON compte (une seule fois)

Un projet EAS appartient à un compte. L'ancien identifiant qui était dans `app.config.ts` appartenait à **un autre
compte** : le tien n'avait pas le droit de le lire (erreur « Entity Not Authorized »). L'identifiant est maintenant
lu dans un fichier `eas-project.json`, que tu crées toi-même et qu'aucun pack n'écrase.

```
npx eas-cli@latest init
```
Réponds **oui** pour créer le projet sous ton compte. L'outil affiche l'**identifiant du projet** (une suite du type
`12345678-abcd-1234-abcd-1234567890ab`) ; il peut aussi dire qu'il ne peut pas modifier un fichier de configuration
dynamique : c'est normal. Copie l'identifiant, puis :

```
powershell -ExecutionPolicy Bypass -File scripts\link-eas.ps1 -Id "COLLE-L-IDENTIFIANT-ICI"
```
Le script écrit `eas-project.json`, puis vérifie auprès d'Expo que ton compte a bien accès au projet.

- Si `init` échoue : sur expo.dev, crée un projet nommé **vimox**, copie son identifiant (« Project ID », dans les
  réglages du projet) et lance la commande ci-dessus.
- Si un **autre compte Expo** a déjà créé VimoX et que tu veux le réutiliser : connecte-toi avec ce compte (voir
  l'encadré `EXPO_TOKEN`) et utilise l'identifiant de son projet avec `link-eas.ps1`.
- Tant que le projet n'est pas relié, un avertissement `registerPushToken` peut apparaître dans Expo Go : sans
  conséquence, les notifications se réenregistrent une fois le projet relié.

### c) Envoyer les variables

```
powershell -ExecutionPolicy Bypass -File scripts\push-env.ps1
npx eas-cli@latest env:list --environment development
```
**Pourquoi le script :** le build est fabriqué sur les serveurs d'Expo, qui **n'ont pas ton fichier `.env`**. Sans
tes variables (surtout Firebase), l'app construite planterait dès l'ouverture. Le script envoie les variables
`EXPO_PUBLIC_…` à EAS, sans jamais afficher leurs valeurs. Relance-le à chaque changement du `.env`.

## 3a. Sur iPhone

```
npx eas-cli@latest device:create
npx eas-cli@latest build --profile development --platform ios
```
- `device:create` affiche un QR code : scanne-le avec l'iPhone pour enregistrer l'appareil. **Fais-le avant le build** ;
  un téléphone ajouté plus tard demande un nouveau build.
- EAS te demande ton identifiant Apple (compte Apple Developer) et crée les certificats lui-même.
- Quand le build est fini, ouvre le lien ou le QR code sur l'iPhone pour installer l'app.
- Au premier lancement, l'iPhone peut demander d'activer le **Mode développeur** : Réglages → Confidentialité et
  sécurité → Mode développeur → activer, puis redémarre l'iPhone.

## 3b. Sur Android (gratuit)

```
npx eas-cli@latest build --profile development --platform android
```
Télécharge et installe le fichier obtenu sur le téléphone.

## 4. Lancer l'app

```
npx expo start --dev-client
```
Ouvre l'app VimoX installée sur le téléphone : elle se connecte à ton PC.

## Ce que ce premier build ne contient volontairement pas

Pour un premier build **le plus sûr possible**, il ne contient que `expo-dev-client`. Les modules suivants
s'ajoutent un par un, avec un nouveau build à chaque fois :

| Module | Ce qu'il permet | Commande avant le build |
|---|---|---|
| `expo-alternate-app-icons` | changer l'icône de l'app (Vim+) | `npx expo install expo-alternate-app-icons` |
| `react-native-google-mobile-ads` | les publicités (pubs de test d'abord) | `npx expo install react-native-google-mobile-ads` |
| `react-native-purchases` | les achats et abonnements | `npx expo install react-native-purchases` |

`app.config.ts` ajoute chaque module **tout seul** dès qu'il est installé.

Le module Camera Kit (effets visage, inutilisé) est **exclu du build** par le fichier `react-native.config.js` :
c'est un ancien module, pas prévu pour la nouvelle architecture de React Native, qui risquait de faire échouer le
build.

## À tester dans ce build

Les notifications (autorise-les à l'ouverture), le rappel de flamme de 20 h, le chiffre sur l'icône de l'app, et
tout ce que tu testais dans Expo Go, plus fluide.

## Si un build échoue

Ouvre la page du build sur expo.dev, onglet **Build logs**, copie les dernières lignes rouges et envoie-les-moi.
