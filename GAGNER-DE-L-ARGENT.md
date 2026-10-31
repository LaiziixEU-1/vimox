# Gagner de l'argent avec VimoX

> Ce guide donne des informations générales. Je ne suis ni juriste, ni fiscaliste : pour le statut, les impôts et la
> TVA, fais valider ta situation par une **fiduciaire** (en Suisse, beaucoup proposent un premier rendez-vous gratuit).

> ⚠️ **Avant de dépenser quoi que ce soit, lis `FICHE-STORES.md`.** Les stores se sont durcis en 2026 contre les apps
> de chat aléatoire. VimoX est donc passé en « amis d'abord » : **Match est réservé aux 18 ans et plus**, et les
> publicités n'apparaissent que dans Match. Conséquence : **les revenus publicitaires seront plus modestes**, et
> l'essentiel viendra de **Vim+** et des achats à l'unité.

## Les 3 sources de revenus de VimoX

| Source | Qui paie l'utilisateur | Qui TE verse l'argent | Commission |
|---|---|---|---|
| **Vim+** (abonnement mensuel / annuel) | Apple ou Google | **Apple** (iPhone) et **Google Play** (Android) | 15 % (programme petits développeurs, sous 1 M$ / an), sinon 30 % |
| **Achats à l'unité** (⚡ Boost, 🔥 flamme) | Apple ou Google | **Apple** et **Google Play** | 15 % / 30 % |
| **Publicités** (version gratuite) | les annonceurs | **Google AdMob** | Google garde sa part, tu reçois le reste |

**RevenueCat ne te verse rien** : il sert seulement à vérifier les achats (gratuit jusqu'à 2 500 $ de revenus par
mois, puis 1 %). L'argent va directement d'Apple et de Google vers **ton compte bancaire**.

---

## Étape 0 — Avant tout : statut, banque et impôts

1. **Compte bancaire** à ton nom (IBAN), au même nom que tes comptes développeur.
2. **Statut** : en Suisse, des revenus réguliers tirés d'une app sont en général une **activité indépendante**.
   Renseigne-toi auprès de ta **caisse de compensation AVS** (canton de Vaud) pour t'annoncer comme indépendant
   quand l'activité démarre vraiment.
3. **Impôts** : ces revenus se déclarent dans ta déclaration d'impôts.
4. **TVA** : en Suisse, l'inscription n'est obligatoire qu'au-delà d'un certain chiffre d'affaires annuel ; vérifie le
   seuil actuel avec ta fiduciaire, ainsi que la façon dont Apple et Google gèrent la TVA sur tes ventes.
5. **Formulaire fiscal américain W-8BEN** (personne physique non américaine) : Apple, Google Play et AdMob te le
   demandent. Il évite une retenue d'impôt américaine sur tes revenus (la Suisse a une convention fiscale avec les
   États-Unis).

---

## Étape 1 — Les comptes (à faire une fois)

| Compte | Coût | Ce que tu y remplis |
|---|---|---|
| **Apple Developer** (developer.apple.com) | 99 USD / an | accord « Applications payantes », coordonnées bancaires, formulaire fiscal |
| **Google Play Console** (play.google.com/console) | 25 USD une fois | profil de paiement (compte marchand), coordonnées bancaires, formulaire fiscal |
| **Google AdMob** (admob.google.com) | gratuit | profil de paiement, adresse postale (un code PIN y sera envoyé), formulaire fiscal |
| **RevenueCat** (revenuecat.com) | gratuit au début | rien de bancaire |
| **Firebase, forfait Blaze** | à l'usage | carte bancaire (quelques centimes par mois au début) |

> Apple ne verse rien tant que l'accord « Applications payantes », la banque et la fiscalité ne sont pas remplis.

---

## Étape 2 — Vendre Vim+ et les achats à l'unité

Tout est expliqué pas à pas dans **`ACTIVER-LES-PAIEMENTS.md`** : création des abonnements et des achats dans les
stores, RevenueCat, mise en ligne du serveur, tests sans payer, et le **jour du lancement** (couper le mode démo
dans `firestore.rules`).

---

## Étape 3 — Ajouter les publicités (Google AdMob)

Ce que fait déjà le code : une pub plein écran toutes les 3 personnes passées dans le chat aléatoire, **jamais** pour
les abonnés Vim+, jamais après « Signaler et passer », pubs **non personnalisées** et contenu « Ados » pour les
16-17 ans, **fenêtre de consentement de Google** avant toute pub, bouton **« Mes choix publicitaires »** dans les
paramètres, et pub maison Vim+ quand aucune pub n'est disponible.

### 3.1 Créer les applications et les blocs d'annonces
1. **AdMob > Applications > Ajouter une application** : iOS, puis Android (si l'app n'est pas encore publiée,
   choisis « Non » à la question des stores ; tu la relieras plus tard).
2. Pour chaque app, note l'**identifiant de l'application** (il contient un `~`).
3. Dans chaque app : **Blocs d'annonces > Ajouter > Interstitiel**, nom « Chat aléatoire ». Note l'**identifiant du
   bloc** (il contient un `/`).
4. Mets les 4 identifiants dans `.env` :
   ```
   EXPO_PUBLIC_ADMOB_IOS_APP_ID=ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX
   EXPO_PUBLIC_ADMOB_ANDROID_APP_ID=ca-app-pub-XXXXXXXXXXXXXXXX~XXXXXXXXXX
   EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID_IOS=ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX
   EXPO_PUBLIC_ADMOB_INTERSTITIAL_ID_ANDROID=ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX
   ```

### 3.2 La fenêtre de consentement (obligatoire en Europe et en Suisse)
**AdMob > Confidentialité et messages > Règlementations européennes** : crée le message (langue : français), relie-le
à tes deux apps, ajoute le lien vers ta politique de confidentialité, puis **Publier**. L'app l'affiche toute seule
avant la première pub.

### 3.3 Le fichier app-ads.txt (sinon tes pubs rapportent beaucoup moins)
AdMob te donne une ligne à publier sur **ton site web** (celui indiqué sur la fiche de l'app dans les stores), à
l'adresse `https://ton-site/app-ads.txt`. Sans site, Firebase Hosting le fait gratuitement :
```
firebase init hosting        (dossier public : « public »)
```
Crée `public/app-ads.txt` avec la ligne donnée par AdMob, puis :
```
firebase deploy --only hosting
```
Indique ensuite cette adresse (`https://vimox-36f77.web.app`) comme site du développeur dans App Store Connect et
Google Play Console.

### 3.4 Installer le module et construire l'app
```
npx expo install react-native-google-mobile-ads
npx eas-cli@latest build --profile preview --platform all
```
La configuration (`app.config.ts`) ajoute le module **automatiquement** dès qu'il est installé. Les pubs ne
marchent pas dans Expo Go.

### 3.5 Tester sans risque
- En version de développement, l'app affiche automatiquement des **pubs de test** de Google.
- ⚠️ **Ne clique jamais sur tes propres vraies pubs** et ne demande pas à tes amis de le faire : Google peut
  fermer ton compte AdMob et garder l'argent.
- Garde une **modération sérieuse** : AdMob coupe les apps qui laissent passer des contenus choquants.

---

## Étape 4 — Comment et quand l'argent arrive

| Qui | Quand | Conditions |
|---|---|---|
| **Apple** | une fois par mois, dans les 45 jours après la fin de chaque « mois fiscal » d'Apple (souvent environ 33 jours) | accord « Applications payantes » + banque + fiscalité remplis |
| **Google Play** | vers le **15 de chaque mois**, pour les ventes du mois précédent | profil de paiement complet |
| **Google AdMob** | vers le **21 de chaque mois**, si ton solde a atteint le seuil de paiement | identité vérifiée, **code PIN** reçu par la poste à saisir (envoyé dès 10 $ de gains), moyen de paiement choisi |

Si le seuil d'AdMob n'est pas atteint, tes gains sont simplement reportés au mois suivant.

**Exemple (illustratif)** : 100 abonnés Vim+ à 4,99 €/mois = 499 € de ventes → environ **424 €** pour toi après les
15 % d'Apple et de Google (avant impôts, et avant le 1 % de RevenueCat au-delà de 2 500 $ par mois).

---

## Check-list dans l'ordre

1. ☐ Compte bancaire, et rendez-vous avec une fiduciaire (statut, impôts, TVA)
2. ☐ Comptes Apple Developer, Google Play Console, AdMob, RevenueCat, forfait Blaze
3. ☐ Banque et formulaire fiscal W-8BEN dans Apple, Google Play et AdMob
4. ☐ Abonnements et achats créés dans les stores, RevenueCat configuré (`ACTIVER-LES-PAIEMENTS.md`)
5. ☐ Serveur en ligne : `firebase deploy --only functions`
6. ☐ AdMob : apps, blocs d'annonces, message de consentement, `app-ads.txt`
7. ☐ Identifiants dans `.env`, modules installés (`react-native-purchases`, `react-native-google-mobile-ads`)
8. ☐ Build EAS, tests (achats de test, pubs de test), bêta avec quelques amis
9. ☐ Textes légaux complétés et relus, fiches des stores remplies (captures, description, prix)
10. ☐ Jour du lancement : `premiumDemoAllowed()` → `false` dans `firestore.rules`, puis publication des règles
