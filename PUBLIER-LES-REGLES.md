# Publier la sécurité de ta base de données (version 2) — pas à pas

Ce guide explique comment mettre en ligne les règles de sécurité (`firestore.rules`), l'effacement
automatique des signalements et, en option, la suspension automatique des comptes.

> **Tu as déjà publié la version 1.** La version 2 ferme les failles restantes. **Ne la publie qu'APRÈS avoir
> installé la dernière version de l'application** (zip n°6) et testé : l'ancienne application ne sait pas
> fonctionner avec les nouvelles règles (liste des amis et stories en panne).

## Ce que la version 2 change
| Avant (version 1) | Maintenant (version 2) |
|---|---|
| N'importe quel compte connecté pouvait **lister tous les profils** | Un profil se lit un par un ; la **liste de tous les profils est interdite** |
| Une personne pouvait se déclarer **« amie » de n'importe qui** sans demande | Un lien d'amitié n'existe que si la **demande a été acceptée** par son destinataire |
| Les stories étaient lisibles par **tout compte connecté** | Visibles seulement par **les amis de l'auteur au moment de la publication** |
| On pouvait envoyer une demande d'ami à quelqu'un qui nous **a bloqué**, ou à soi-même | **Refusé** par les règles |
| L'**e-mail** était dans le profil lisible par les autres comptes | L'e-mail **n'y est plus** (les anciens profils sont nettoyés à la connexion suivante) |
| Rien ne permettait de couper les notifications d'un ami | **Sourdines par ami** : lisibles seulement par leur propriétaire et par l'ami concerné (son téléphone envoie les notifications), écrites seulement par le propriétaire ; aucune liste |
| Aucune garantie qu'un pseudo soit unique ni authentique | **Pseudos uniques** : un seul document par pseudo ; impossible de prendre celui d'un autre, ou de l'afficher dans son profil ou dans la recherche sans l'avoir réservé |
| Pas de recherche d'amis possible sans exposer les profils | **Index de recherche minimal et volontaire** (prénom, photo, pays) ; une requête sans limite, ou de plus de 30 résultats, est **refusée** |

Conséquences à connaître : les **stories publiées avant la version 2** ne seront plus visibles par tes amis
(seulement par toi) ; les nouvelles le seront. Les amitiés existantes restent valables.

## A. Avant de publier (15 minutes)
1. Installe le zip n°6 et relance `npx expo start --clear`.
2. Sur **chaque appareil de test** : **Paramètres > Sécurité** doit afficher **« Connexion sécurisée : active »**.
   Sinon touche **Activer**. Si l'activation échoue, le message indique un **code** : note-le.
3. **Sauvegarde les règles actuelles** : console Firebase > **Firestore Database** > **Règles** : copie tout le
   texte dans un fichier `regles-v1.txt` (c'est ton retour en arrière).
4. **Teste l'application** avec deux comptes (l'iPhone et le navigateur du PC) : demande d'ami et acceptation,
   message d'ami, publication d'une story vue par l'ami, présence « en ligne » des amis, match et message,
   **appui long sur un ami** (fiche : épingler, couper ses notifications, masquer ma story ; couper les notifications de l'ami A, puis lui faire envoyer un message depuis l'autre compte : aucune notification ne doit arriver),
   **choix d'un pseudo** (Profil > Modifier le profil ; un 2e compte ne doit pas pouvoir prendre le même),
   **recherche d'un prénom ou d'un @pseudo** dans « Ajouter des amis » (le 2e compte doit avoir « Apparaître dans la recherche »
   activé), ajout depuis les suggestions, acceptation depuis « Ils t'ont ajouté », **annulation d'une demande envoyée** (menu ⋯ > Gérer les amitiés).

## B. Publier les règles
1. Console Firebase > **Firestore Database** > **Règles**.
2. Remplace tout le texte par le contenu de `firestore.rules`, puis **Publier**.
3. Attends environ une minute, **ferme et rouvre l'app**, puis reteste la liste d'actions du A4.
4. **Si quelque chose affiche « permission refusée »** : recolle `regles-v1.txt`, **Publier**, et envoie-moi
   l'action et le message exact.

> Les règles ont été vérifiées avec l'analyseur officiel de Firebase (aucune erreur, aucune alerte) **et** avec
> un simulateur que j'ai écrit : 220 scénarios (opérations normales de l'app et tentatives d'abus), tous
> conformes ; les écritures réelles de l'app (demande d'ami, acceptation, story) y passent. Ce simulateur n'est
> pas le moteur officiel de Firebase : le test de l'étape A4/B3 sur ton vrai projet reste indispensable.

## C. Effacement automatique des signalements (12 mois)
Les textes légaux annoncent que les signalements sont effacés au bout de 12 mois. Chaque signalement contient
déjà une date d'effacement (`expireAt`) ; il reste à activer la règle. **Cela ne se fait PAS dans la console
Firebase** (pas d'onglet TTL), mais dans la **console Google Cloud**, qui appartient au même projet :

1. Va sur console.cloud.google.com et choisis ton projet.
2. Menu **Firestore** > ta base `(default)` > menu de gauche **Time-to-live** > **Créer une stratégie**.
3. Groupe de collections : `reports` — Champ d'horodatage : `expireAt` — **Créer**.

Alternative en ligne de commande, si tu as `gcloud` :
`gcloud firestore fields ttls update expireAt --collection-group=reports --enable-ttl`

(Les stories expirées, elles, sont effacées par l'application de leur auteur : rien à configurer.)

## D. Suspension automatique des comptes (optionnel — plan Blaze requis)
Le dossier `functions/` contient une petite fonction serveur : quand **3 personnes différentes** signalent le
même compte en 24 h (ou que le filtre refuse **5 messages** en 24 h), le compte est suspendu **24 h** et la
personne voit un écran « Compte suspendu ». Elle demande le plan Firebase **Blaze** (carte bancaire, voir
`COUTS-ET-COMPTES.md`) ; sans elle, l'app fonctionne quand même.

1. Passe ton projet au plan **Blaze** et **crée une alerte de budget** (ex. 5 €) : les alertes préviennent mais
   **ne bloquent pas** la dépense.
2. Installe l'outil Firebase : `npm install -g firebase-tools`, puis `firebase login`.
3. Dans `firebase.json`, ajoute (en gardant ce qui existe déjà) :
   ```json
   "functions": [
     {
       "source": "functions",
       "codebase": "default",
       "predeploy": ["npm --prefix \"$RESOURCE_DIR\" run build"]
     }
   ]
   ```
4. Dans un terminal, à la racine du projet :
   ```
   cd functions
   npm install
   cd ..
   firebase deploy --only functions
   ```
5. Vérifie dans la console > **Functions** que `onReportCreated` apparaît.
6. Test : avec 4 comptes de test, fais signaler le 4e par les 3 autres → il doit voir « Compte suspendu ».
   Pour lever la suspension à la main : console > Firestore > `users` > le compte > supprime `suspendedUntil`.

> Cette fonction est testée pour sa logique et compile avec les vraies bibliothèques Firebase, mais elle n'a
> **jamais été déployée** (il faut ton projet).

## E. Ce que ces règles ne peuvent PAS empêcher (limites connues)
Sans serveur, une règle ne peut pas tout vérifier. Restent possibles :

- **Le jeton de notification** reste lisible par un compte connecté qui connaît l'identifiant d'une personne
  (les identifiants ne sont pas listables). Pour le cacher complètement : envoyer les notifications depuis une
  fonction serveur (plan Blaze).
- **Recherche par prénom** : l'index ne contient que des données volontaires, mais une personne très motivée peut
  l'explorer lettre par lettre (30 résultats par requête). Les comptes de moins de 18 ans n'y sont pas par défaut.
- **Demandes d'ami en rafale** (spam) : chacune doit être acceptée, mais rien n'en limite le nombre.
- **Messages vers un non-ami** : les règles ne vérifient pas qu'une amitié existe avant d'accepter un message
  dans une conversation d'amis « moi_autre ». L'autre personne ne voit rien dans l'application (aucun lien
  d'amitié), mais une notification peut partir tant que son jeton est lisible (premier point).
- **Images** : aucune modération automatique des photos (seulement signalement).
- **Badge Premium** écrit par le téléphone (voir `ACTIVER-LES-PAIEMENTS.md`).
