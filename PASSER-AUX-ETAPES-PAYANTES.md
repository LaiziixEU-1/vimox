# Passer aux étapes payantes — pas à pas

*Informations vérifiées en octobre 2026 sur les pages d'Apple et d'Expo. Les prix et délais changent : revérifie
sur les pages officielles avant de payer.*

## Ce qui est payant (et ce qui ne l'est pas)
| Poste | Prix | Remarque |
|---|---|---|
| **Compte Apple Developer** | **99 USD par an** (même prix pour un particulier et une société) | Le seul paiement obligatoire pour l'App Store |
| Expo EAS (fabrication de l'app) | Gratuit pour commencer (environ 15 fabrications iOS par mois, avec file d'attente) | Offre payante à partir de 19 $/mois si tu en veux plus |
| TestFlight (tests sur iPhone) | Inclus avec le compte Apple | |
| RevenueCat (abonnement Premium) | Gratuit jusqu'à 2 500 $ de revenus par mois | Seulement si tu rends Premium payant |
| Google Play (Android) | 25 USD, une seule fois | Facultatif |

## Avant de payer — 5 vérifications (gratuites)
1. Tu as installé la dernière version, testé avec **deux comptes**, et publié les règles de sécurité version 2.
2. Le **petit site légal** est en ligne (`PUBLIER-LE-SITE.md`) : Apple exige une adresse web pour la confidentialité et l'assistance.
3. Ton `.env` est complet (nom, adresse, e-mails, droit applicable, clés Firebase).
4. Tu as décidé comment présenter l'app (le risque « rencontres aléatoires » : voir `COUTS-ET-COMPTES.md`).
5. Tu sais si tu t'inscris comme **particulier** ou avec une **société** (étape 1).

## Étape 1 — Le compte Apple Developer (99 USD/an)
- **Particulier** : aucun numéro d'entreprise à fournir ; ton **nom personnel** apparaît comme vendeur sur l'App Store.
- **Société** : il faut un numéro **D-U-N-S** (gratuit, compte environ une semaine pour l'obtenir), un site web de la société
  et une adresse e-mail à son nom. Le nom de la société apparaît comme vendeur.
- Fais toute l'inscription **depuis le même appareil**. Écris ton prénom et ton nom **exactement comme sur ta pièce
  d'identité** (pas de pseudo). Paie avec **ta propre carte**. Sinon Apple retarde le dossier.
- Inscription : developer.apple.com > Account > Enroll. L'approbation peut prendre de quelques heures à quelques jours.

## Étape 2 — Expo : connexion et réglages (10 minutes)
```
npx eas-cli@latest login
node scripts/push-env-to-eas.mjs            ← simulation : montre ce qui serait envoyé
node scripts/push-env-to-eas.mjs --apply    ← envoie vraiment
npx eas-cli@latest env:list --environment production
```
**Pourquoi** : ton fichier `.env` reste sur ton ordinateur ; Expo fabrique l'app sur ses serveurs et ne le reçoit pas. Sans cet
envoi, la version publiée n'aurait aucune clé Firebase et ne démarrerait pas. Seules les variables publiques `EXPO_PUBLIC_*`
sont envoyées. **À refaire si tu modifies ton `.env`.** (Si Expo propose de créer un dépôt git, accepte.)

## Étape 3 — Fabriquer la première version
```
npx eas-cli@latest build --platform ios --profile production
```
- Expo demande ton identifiant Apple (avec code de vérification) : **accepte qu'elle crée les certificats, les profils et la
  clé de notifications** pour toi.
- Compte une demi-heure à une heure (file d'attente gratuite). Les builds utilisent Xcode 26, exigé par Apple depuis le 28 avril 2026.
- Le numéro de version de build augmente tout seul (`autoIncrement`).
- Si l'identifiant `com.vimox.app` est déjà pris par quelqu'un d'autre, Apple le refuse : change `bundleIdentifier` dans
  `app.config.ts` (et `android.package`), puis recommence.

## Étape 4 — Envoyer sur TestFlight (tests sur ton iPhone)
```
npx eas-cli@latest submit --platform ios
```
- La première fois, cela **crée la fiche de l'app dans App Store Connect** pour toi. Apple traite le fichier (quelques minutes).
- App Store Connect > ton app > **TestFlight** > ajoute-toi comme **testeur interne** : pas d'examen Apple, disponible tout de suite.
  Installe l'app « TestFlight » sur l'iPhone, puis VimoX.
- Des **testeurs externes** (amis) demandent un examen Apple de la première version : compte un à deux jours.
- Raccourci : `npx eas-cli@latest build --platform ios --profile production --auto-submit`.

## Étape 5 — Tester pour de vrai (TestFlight)
Ce qui ne se teste pas bien avant : **notifications** (message, Vim, appel, demande d'ami, sourdine), **liens `vimox://`**, **appels**
entre deux téléphones, permissions (caméra, micro, galerie, position, contacts), inscription, connexion sécurisée, suppression du
compte, export des données. Note tout ce qui ne va pas, envoie-le moi.

## Étape 6 — La fiche App Store et l'envoi pour examen
Tout est prêt à copier dans `FICHE-APP-STORE.md`. Rappels :
- **Captures** : un jeu de 1 à 10 images **1320 × 2868** (iPhone 6,9 pouces). Pas d'iPad : ton app est réglée iPhone seulement.
- **Âge** : réponds au questionnaire d'Apple (messagerie, contenu partagé, fil de stories). Apple calcule le niveau ; tu peux le relever
  (ex. 16+) pour rester cohérent avec ton âge minimum de 16 ans.
- **Confidentialité des données** : tableau de la section 6 de la fiche. **Adresses web** : confidentialité et assistance (ton site).
- **Notes pour la relecture** : section 7 de la fiche + **deux comptes de démonstration** (avec un ami déjà accepté).
- Choisis **« publier manuellement après approbation »** pour décider du jour de la mise en ligne.
- Délai d'examen : le plus souvent moins de deux jours, souvent moins de 24 h. Rien n'est garanti.

## Si Apple refuse (c'est fréquent à la première soumission)
Tu reçois un message précis dans App Store Connect (« Resolution Center »). Réponds-y, corrige, renvoie : un refus ne coûte rien de plus.
Les points sensibles pour VimoX : **règle 1.2** (modération : filtre, signalement, blocage, contact — c'est fait) et les
**rencontres aléatoires** (Apple déconseille les apps de type « chat aléatoire »). Payer 99 $ ne garantit pas l'acceptation.

## Après la mise en ligne (facultatif)
- **Premium payant** : `ACTIVER-LES-PAIEMENTS.md`.
- **Suspension automatique des comptes** (Firebase Blaze) : `PUBLIER-LES-REGLES.md`, section D.
- **Android** (Google Play, 25 $ une fois), **avocat**, **domaine** à toi.

## À savoir : Expo Go
Quand Expo publiera la version stable du SDK 58, l'application Expo Go de l'App Store passera au SDK 58 et cessera d'ouvrir les projets
en SDK 57 comme le tien. À partir de là, teste avec **TestFlight** (ou mets le projet à niveau, ce qui est un vrai chantier).
