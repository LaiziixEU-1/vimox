# Ce qu'il faut payer (et ce qui reste gratuit)

*Prix relevés le 17 octobre 2026 sur les pages officielles ou des comparatifs récents. Les prix changent :
vérifie la page du fournisseur avant de payer. Les montants marqués « estimation » ne viennent pas d'une
source vérifiée.*

## En une phrase

Pour publier sur iPhone, **le seul paiement obligatoire est l'adhésion Apple : 99 USD par an.** Tout le reste est
gratuit au début ou facultatif. Mais **deux risques ne se règlent pas avec de l'argent** (voir section 6) :
la règle d'Apple sur les chats avec des inconnus, et la fiabilité des appels.

---

## 1. Obligatoire pour publier sur l'App Store

| Poste | Prix | À savoir |
|---|---|---|
| **Apple Developer Program** | **99 USD / an** (ou l'équivalent en monnaie locale affiché par Apple) | Un seul abonnement pour toutes tes apps, mises à jour comprises. Si tu ne renouvelles pas, l'app est retirée du store. Apple ne rembourse en général pas une adhésion payée. Sans lui : ni publication, ni TestFlight. |

Même prix pour un particulier et pour une organisation (Apple demande des justificatifs pour une organisation).
Des taxes peuvent s'ajouter selon ton pays.

Option Android : **Google Play = 25 USD, une seule fois.**

## 2. Gratuit pour démarrer — et quand ça devient payant

| Service | Gratuit | Ensuite |
|---|---|---|
| **Firebase (plan Spark)** — connexion, base de données | 50 000 lectures et 20 000 écritures par jour, 1 Go de données, 50 000 utilisateurs actifs/mois de connexion. Pas de carte bancaire. | Au-delà, il faut passer au plan Blaze. |
| **Firebase (plan Blaze, paiement à l'usage)** | Mêmes quotas gratuits. Fonctions serveur : 2 millions d'appels/mois gratuits. | Environ 0,03 $ par 100 000 lectures et 0,09 $ par 100 000 écritures au-delà du gratuit (tarif région US, les autres régions diffèrent) ; fonctions : 0,40 $ par million d'appels. **Les alertes de budget préviennent mais ne bloquent pas la dépense.** |
| **Cloudinary** — photos, Vims, stories, vocaux | Offre gratuite : 25 crédits/mois (1 crédit = 1 Go de stockage, ou 1 Go de bande passante, ou 1 000 transformations). | Offre « Plus » : environ 89–99 $/mois selon les sources. Sur les offres fixes, dépasser peut **bloquer les envois** plutôt que facturer. |
| **Expo EAS** — fabrique la vraie app à envoyer à Apple (sans Mac) | Jusqu'à 15 builds iOS + 15 Android par mois ; file d'attente lente (parfois plus d'une heure), build interrompu après 45 min. | Starter 19 $/mois (file prioritaire), Production 199 $/mois. |
| **Notifications push (Expo)** | Gratuit, à ma connaissance. | — |
| **Giphy, MyMemory** (GIF, traduction) | Offres gratuites limitées. | À vérifier selon ton usage. |

Ton app n'utilise pas Firebase Storage (tout passe par Cloudinary) : pas de coût de ce côté.

À savoir : ouvrir « Ajouter des amis » lit au plus environ 100 documents (suggestions) puis 0 pendant 5 minutes ; chaque
recherche de prénom en lit 25 au plus ; chaque notification envoyée lit 1 document de plus (la sourdine de l'ami). Avec le quota gratuit de 50 000 lectures par jour, cela reste confortable.

## 3. Probablement nécessaire avant d'ouvrir au public

- **Nom de domaine + adresse e-mail de contact** : estimation 10–20 € par an pour le domaine. Apple exige des
  coordonnées publiées dans l'app : l'adresse doit exister et être lue. À défaut, une adresse e-mail dédiée gratuite.
- **Une page web de politique de confidentialité et une page d'assistance** (App Store Connect demande des adresses
  web) : le dossier `site/` est déjà prêt et se met en ligne gratuitement avec Firebase Hosting (`PUBLIER-LE-SITE.md`) ;
  tu n'as pas besoin d'acheter un nom de domaine pour ces pages.
- **Relecture juridique** (`DOSSIER-JURISTE.md`) : sur devis, non chiffrée ici.
- **Plan Blaze** (carte bancaire) seulement si tu déploies la suspension automatique (`PUBLIER-LES-REGLES.md`, section D).

## 4. Les appels : attention au serveur public

Les appels utilisent par défaut le serveur public **meet.jit.si**. Il est gratuit, mais :
- il demande parfois à la première personne de **se connecter avec Google, Facebook ou GitHub** pour démarrer
  (message « attendre le modérateur ») ;
- l'équipe Jitsi précise que les applications qui s'appuient sur ce service comme infrastructure ne respectent pas
  son **usage équitable**.

Conséquence possible : les appels ne démarrent pas, ou sont coupés. **Teste un appel entre deux téléphones avant
toute décision.** Si ça pose problème :

| Option | Coût | Remarque |
|---|---|---|
| **Ton propre serveur Jitsi** | Serveur : estimation 5–20 €/mois, plus ton temps de maintenance | Tu renseignes l'adresse dans `.env` : `EXPO_PUBLIC_CALL_SERVER=https://appels.tondomaine.com`. |
| **JaaS (Jitsi géré par 8x8)** | Gratuit jusqu'à 25 utilisateurs actifs/mois (développement), puis 99 $/mois (300), 499 $/mois (1 500) ; 0,99 $ par utilisateur au-delà | Demande en plus un petit serveur pour signer les accès : non prévu dans l'app. |
| **Retirer les appels au lancement** | 0 | Le plus simple pour une première version. |

## 5. Si Premium devient payant

- Il faut le compte Apple, un **produit d'abonnement** créé dans App Store Connect, et les informations bancaires et
  fiscales. Une version « construite » avec EAS est indispensable (Expo Go ne suffit pas).
- **Commission d'Apple** : 30 % (15 % pour un abonnement après sa 1re année). **15 % dès le premier jour** avec le
  *Small Business Program* (gratuit, réservé aux revenus de 1 M$/an ou moins, à demander à Apple).
- **RevenueCat** (outil qui gère les achats) : gratuit jusqu'à 2 500 $ de revenus suivis par mois, puis **1 %** des
  revenus bruts suivis, en plus d'Apple.
- Dès que tu encaisses de l'argent : voir un comptable (forme juridique, impôts, TVA). Non chiffré ici.
- Le code de paiement **est écrit et testé avec un faux SDK**, mais éteint : l'écran Premium reste en démonstration
  tant que la clé RevenueCat n'est pas dans `.env` et que le module d'achat n'est pas installé dans une version
  construite avec EAS. Mode d'emploi : `ACTIVER-LES-PAIEMENTS.md`. Il n'a **jamais tourné avec le vrai App Store**.

## 6. Les risques qui ne se règlent pas avec de l'argent

1. **La règle d'Apple sur les chats avec des inconnus.** Le guide d'Apple (Guideline 1.2, consulté le 17 octobre 2026)
   dit que les apps utilisées surtout pour des *« Chatroulette-style experiences, random or anonymous chat »* « ne
   sont pas les bienvenues sur l'App Store et peuvent être retirées sans préavis ». VimoX met en relation avec des
   inconnus : **payer 99 $ ne garantit pas l'acceptation**, et l'adhésion n'est en général pas remboursée. Je ne
   peux pas prédire la décision d'Apple. Pistes à discuter : présenter l'app « amis d'abord », publier d'abord sur
   Android (25 $ une fois, qui demande aussi signalement et blocage), ou proposer d'abord une version sans mise en
   relation aléatoire. C'est une décision de produit à prendre avec ton conseil.
2. **Répondre aux signalements vite.** Des développeurs rapportent qu'Apple attend un traitement sous 24 h (retrait du
   contenu et exclusion de la personne). Il faut quelqu'un qui lit la collection `reports` de Firestore chaque jour.
3. **Mineurs.** L'âge est déclaratif (16 ans et plus). À valider avec ton juriste.

## 7. Budgets types (première année)

| Scénario | Coût |
|---|---|
| **Minimum pour une première publication iPhone** | 99 USD (Apple) + domaine (estimation 10–20 €) ≈ **110–120**. Tout le reste en offres gratuites ; limites : appels peu fiables, pas de suspension automatique. |
| **Version plus sérieuse** | + serveur d'appels (estimation 60–240 €/an auto-hébergé, ou JaaS 99 $/mois) + plan Blaze (souvent quelques euros ou moins avec peu d'utilisateurs ; surveille) + relecture juridique (devis). |
| **Avec paiements Premium** | + commission Apple (15 % avec le Small Business Program) + RevenueCat gratuit puis 1 %. |
| **Android en plus** | + 25 USD, une seule fois. |

## 8. Comptes à créer, dans l'ordre

1. **Avant tout** : teste les appels entre 2 téléphones, remplis `.env` (éditeur, contact), publie les règles de
   sécurité (`PUBLIER-LES-REGLES.md`).
2. **Compte Expo** (gratuit) : pour fabriquer l'app avec EAS.
3. **Domaine + e-mail de contact**, puis une page de confidentialité.
4. **Compte Apple Developer** (99 $) quand tu es prêt à passer sur TestFlight.
5. Plus tard, selon les besoins : Blaze (suspension automatique), serveur d'appels, RevenueCat, avocat.

## Sources (consultées le 17 octobre 2026)

- Apple Developer Program et exemption : developer.apple.com/support/fee-waiver
- Règles de l'App Store (1.2) : developer.apple.com/app-store/review/guidelines
- Small Business Program : developer.apple.com/app-store/small-business-program
- Firebase : firebase.google.com/pricing
- Expo EAS : expo.dev/pricing
- Cloudinary : cloudinary.com/documentation/pricing
- RevenueCat : revenuecat.com (page de prix)
- Jitsi / JaaS : developer.8x8.com/jaas et github.com/jitsi/jitsi-meet/issues/14017
