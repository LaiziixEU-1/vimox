# Activer l'abonnement Vim+ (paiements réels)

Le code est **prêt** : écran d'abonnement (formules mensuelle et annuelle, essai gratuit), achat, « Restaurer mes
achats », vérification des paiements **par le serveur**, renouvellement, résiliation, expiration et remboursement.
Tant que les étapes ci-dessous ne sont pas faites, l'écran Vim+ reste en **mode démonstration** (gratuit).

---

## 1. Les comptes à créer

| Compte | Prix | À quoi il sert |
|---|---|---|
| **Apple Developer** | 99 USD / an | publier sur l'App Store et vendre l'abonnement sur iPhone |
| **Google Play Console** | 25 USD une fois | publier sur Google Play et vendre l'abonnement sur Android |
| **RevenueCat** | gratuit jusqu'à 2 500 USD de revenus par mois, puis 1 % | relie Apple et Google à VimoX et vérifie chaque paiement |
| **Firebase, forfait Blaze** | à l'usage (quelques centimes au début) | nécessaire pour les fonctions serveur |

Dans App Store Connect **et** dans Google Play Console : signe l'accord des applications payantes et renseigne
tes coordonnées **bancaires et fiscales**, sinon les achats sont refusés.

## 2. Créer l'abonnement dans les stores

Utilise **les mêmes identifiants** des deux côtés :

| Formule | Identifiant | Prix conseillé (à adapter) |
|---|---|---|
| Mensuelle | `vimplus_monthly` | 4,99 € / 4,90 CHF par mois |
| Annuelle | `vimplus_yearly` | 34,99 € / 34,90 CHF par an (environ 40 % moins cher) |

- **App Store Connect** > ton app > Abonnements : crée un groupe « Vim+ », puis les deux abonnements (durée,
  prix, nom affiché, description, capture d'écran de l'écran Vim+ pour la relecture d'Apple).
- **Google Play Console** > Monétiser > Abonnements : crée les deux abonnements avec les mêmes identifiants.
- **Essai gratuit (facultatif)** : ajoute une « offre de lancement » de 7 jours gratuits. L'app l'affiche toute seule
  (« 7 jours gratuits, puis 4,99 €/mois ») et le bouton devient « Commencer l'essai gratuit ».

## 3. Configurer RevenueCat

1. Crée un projet, puis ajoute l'app **iOS** (identifiant `com.vimox.app`) et l'app **Android** (`com.vimox.app`),
   en suivant leur assistant pour les relier à App Store Connect et à Google Play.
2. **Products** : importe `vimplus_monthly` et `vimplus_yearly` (iOS et Android).
3. **Entitlements** : crée un entitlement nommé **`premium`** et attache-lui les deux produits.
4. **Offerings** : crée l'offering **`default`** (marquée « current ») avec deux packages :
   **Monthly** → `vimplus_monthly`, **Annual** → `vimplus_yearly`.
5. **API keys** : copie les clés **publiques** dans `.env` :
   ```
   EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_xxxxxxxx
   EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_xxxxxxxx
   EXPO_PUBLIC_REVENUECAT_ENTITLEMENT=premium
   ```

## 4. Mettre en ligne la vérification des paiements (serveur)

Dans le terminal, à la racine du projet (une seule fois) :

```
npm install -g firebase-tools
firebase login
firebase use vimox-36f77
firebase functions:secrets:set REVENUECAT_SECRET_KEY
```
→ colle la **clé secrète** RevenueCat (Project settings > API keys > « Secret API key », commence par `sk_`).

```
firebase functions:secrets:set REVENUECAT_WEBHOOK_AUTH
```
→ invente un long mot de passe (ex. 40 caractères au hasard) et **garde-le** pour l'étape suivante.

```
cd functions
npm install
cd ..
firebase deploy --only functions
```

À la fin, Firebase affiche l'adresse de **`revenuecatWebhook`** (ex. `https://revenuecatwebhook-xxxx-uc.a.run.app`).

Dans **RevenueCat > Integrations > Webhooks** : colle cette adresse, et mets dans **Authorization header** le mot de
passe choisi pour `REVENUECAT_WEBHOOK_AUTH`. Envoie un « test event » : il doit répondre **200**.

## 5. Construire l'app avec le module d'achat

```
npx expo install react-native-purchases
npx eas-cli@latest build --profile preview --platform ios
npx eas-cli@latest build --profile preview --platform android
```
Les achats **ne marchent pas dans Expo Go** : il faut cette version construite.

## 6. Tester sans payer

- **iPhone** : App Store Connect > Utilisateurs et accès > **Sandbox** → crée un testeur, connecte-le dans
  Réglages > App Store > Compte Sandbox. Les abonnements de test se renouvellent toutes les quelques minutes.
- **Android** : Play Console > Configuration > **Testeurs de licence** → ajoute ton adresse Gmail.
- À vérifier : achat mensuel, achat annuel, « Restaurer mes achats » sur un 2ᵉ téléphone, résiliation
  (les avantages restent jusqu'à la fin de la période), expiration (le badge Vim+ disparaît).

## 7. Le jour du lancement (important)

1. Dans **`firestore.rules`**, remplace `return true;` par **`return false;`** dans la fonction
   `premiumDemoAllowed()`, puis publie les règles. Plus personne ne pourra alors s'activer Vim+ gratuitement.
2. Mets à jour les **Conditions d'utilisation** (section 9 de `src/config/legalContent.json`) avec les prix et fais-les
   relire par ton juriste.
3. Vérifie que la fiche de l'app dans les stores mentionne l'abonnement et ses prix.

## Comment ça marche (résumé)

1. La personne choisit une formule : le paiement passe par **Apple ou Google** (jamais par VimoX).
2. RevenueCat reçoit la preuve d'achat et la vérifie auprès du store.
3. Le **serveur VimoX** (fonctions `syncPremium` et `revenuecatWebhook`) demande l'état réel à RevenueCat et met
   le profil à jour. L'app, elle, **ne peut pas** se déclarer abonnée (règles Firebase).
4. Renouvellement, résiliation, expiration, remboursement : RevenueCat prévient le serveur, qui met le profil à jour,
   même quand l'app est fermée.

---

## Page membre Vim+ (comme Snapchat+)

Quand on est abonné, l'écran Vim+ devient une **page membre** : « Membre depuis le … », date de renouvellement ou
de fin, « Gérer mon abonnement », **Pass Vim+**, **icône de l'application**, couleur de chat et avantages.

### 🎁 Pass Vim+ (offrir 1 mois à un ami, 3 par an)
- Fonctionne dès que la vérification des paiements est en ligne (étape 4) : la fonction **`giftVimPass`** est
  déployée en même temps que les autres (`firebase deploy --only functions`).
- RevenueCat accorde 1 mois de Vim+ à l'ami (« promotional entitlement »), son profil est mis à jour et un message
  « 🎁 … t'a offert 1 mois de Vim+ ! » apparaît dans votre conversation.
- Les Pass reviennent le 1er janvier. L'ami doit être dans ta liste d'amis et ne pas déjà avoir Vim+.

### 🖼️ Icônes de l'application (8 au choix)
Les icônes sont prêtes dans `assets/app-icons/` (Classique, Or, Néon, Glacier, Rose, Menthe, Argent, Neige).
Pour les activer, une seule commande, puis un nouveau build :
```
npx expo install expo-alternate-app-icons
npx eas-cli@latest build --profile preview --platform all
```
La configuration (`app.config.ts`) ajoute le module **automatiquement** dès qu'il est installé. Le changement
d'icône ne fonctionne pas dans Expo Go (l'écran l'indique).

---

## Achats à l'unité : ⚡ Boost et 🔥 restauration de flamme

| Produit | Identifiant (stores et RevenueCat) | Type | Prix conseillé | Ce qu'il donne |
|---|---|---|---|---|
| ⚡ Boost | `vimox_boost_30` | **consommable** | 1,99 € / 1,90 CHF | 30 minutes de priorité dans les matchs (cumulable) |
| 🔥 Restauration de flamme | `vimox_flame_restore` | **consommable** | 0,99 € / 1,00 CHF | rallume une flamme éteinte depuis moins de 3 jours |

1. **App Store Connect** > ton app > **Achats intégrés** : crée deux achats de type **« Consommable »** avec ces
   identifiants. **Google Play Console** > Monétiser > **Produits intégrés à l'application** : idem.
2. **RevenueCat** > Products : importe les deux produits (iOS et Android). **Ne les attache pas** à l'entitlement
   `premium` : ce sont des achats à l'unité.
3. Rien d'autre à faire : les fonctions **`claimPurchases`** et **`useFlameRestore`** sont déployées avec les autres
   (`firebase deploy --only functions`), et le webhook crédite aussi les achats faits pendant que l'app était fermée.

Comment c'est protégé :
- chaque achat est crédité **une seule fois** (le serveur note chaque transaction dans `users/{id}/purchases`) ;
- la date de fin du Boost et le nombre de restaurations achetées sont écrits **seulement par le serveur** ;
- les règles vérifient la priorité dans la file d'attente : impossible de se déclarer « Vim+ » ou « boosté » sans
  l'être vraiment ;
- limite connue : les flammes elles-mêmes sont encore calculées par l'app ; quelqu'un de très technique pourrait
  rallumer une flamme sans passer par l'achat. La protection complète demanderait de déplacer tout le calcul des
  flammes sur le serveur (chantier possible plus tard).
