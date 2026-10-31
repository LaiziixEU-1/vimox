# Dossier pour la relecture juridique de VimoX

*Document préparé pour ton juriste ou ton avocat. Il décrit ce que fait l'application ; il ne remplace
pas un avis juridique. Les points à compléter sont marqués « À COMPLÉTER ».*

## 1. Le service

Application mobile (iPhone, Expo / React Native) de rencontre et de discussion :
- mise en relation **aléatoire** avec des inconnus (messages, messages vocaux, photos, appels) ;
- amis, discussions privées, Vims éphémères, stories visibles 24 h, jeux à deux, appels audio/vidéo ;
- statut en ligne (désactivable), notifications push, traduction de messages à la demande.

Public : **16 ans et plus** (contrôle déclaratif de l'âge à l'inscription, aucune vérification d'identité).

## 2. Éditeur (À COMPLÉTER)

Nom / forme juridique : …  Adresse : …  E-mail de contact : …  Pays de l'éditeur : …
Ces informations se renseignent dans `.env` (`EXPO_PUBLIC_EDITOR_NAME`, `EXPO_PUBLIC_EDITOR_ADDRESS`,
`EXPO_PUBLIC_SUPPORT_EMAIL`, `EXPO_PUBLIC_PRIVACY_EMAIL`) et s'affichent dans les textes légaux.

## 3. Données personnelles traitées

| Donnée | Finalité | Base légale proposée | Durée |
|---|---|---|---|
| Nom, âge, genre, pays, photo, bio (l'e-mail reste dans le système de connexion et n'est pas dans le profil) | Compte et profil | Exécution du service | Jusqu'à suppression du compte |
| Messages, vocaux, photos, stories, souvenirs | Fonctionnement du service | Exécution du service | Messages : tant que la conversation existe ; stories : 24 h (visibles seulement par les amis de l'auteur au moment de la publication) ; Vims : lien effacé à l'ouverture |
| Amis, demandes, blocages, flammes | Fonctionnement du service | Exécution du service | Jusqu'à suppression du compte |
| Statut en ligne, dernière connexion | Fonctionnement (désactivable) | Consentement / réglage | Mis à jour en continu |
| Jeton de notification | Envoyer des notifications | Consentement | Jusqu'à désactivation / déconnexion |
| Sourdines par ami (qui a coupé les notifications de qui : messages, appels) | Respecter le choix de la personne | Exécution du service | Jusqu'à ce que la personne remette le son, retire l'ami ou supprime son compte |
| Pseudo unique (@, facultatif) | Retrouver et distinguer les personnes | Exécution du service | Jusqu'à retrait du pseudo ou suppression du compte |
| Index de recherche : prénom, pseudo, photo, pays, indicateur adulte/mineur (jamais l'âge exact) | Permettre aux autres de te trouver et de te suggérer | Consentement / réglage (activé par défaut pour les adultes, désactivé par défaut pour les moins de 18 ans) | Jusqu'à désactivation du réglage ou suppression du compte |
| Signalements (auteur, cible, motif) | Sécurité de la communauté | Intérêt légitime | **12 mois** (effacement automatique) |
| Catégorie des messages refusés par le filtre (jamais le texte) | Repérer les abus répétés | Intérêt légitime | 12 mois |
| Demandes envoyées au support | Support | Exécution / intérêt légitime | À COMPLÉTER |

## 4. Sous-traitants et destinataires

Google Firebase (authentification, base de données, hébergement du site légal) · Cloudinary (photos, Vims, stories, vocaux) ·
Giphy (recherche de GIF) · MyMemory (traduction à la demande) · Expo (envoi des notifications) ·
Jitsi Meet (appels : serveur public meet.jit.si, ou serveur de l'éditeur) · à l'avenir : Apple (achats),
RevenueCat (si abonnements).
**Questions** : contrats de sous-traitance, transferts hors Suisse/UE (clauses types ?), mentions requises.

## 5. Modération mise en place

- **Filtre automatique** avant envoi (messages, réponses aux stories, stories, prénom, bio) : menaces,
  propos haineux, sollicitations sexuelles, contenu visant des mineurs, arnaques. Traitement sur le
  téléphone ; les refus ne conservent que la catégorie.
- **Signalement** depuis les conversations, stories et profils ; **blocage** d'une personne.
- **Suspension automatique** de 24 h après 3 signalants différents en 24 h ou 5 refus du filtre.
- **Recours** : par e-mail à l'adresse de contact.
- Aucune modération automatique des **images**.
**Questions** : obligations de notification et de retrait (UE : règlement sur les services numériques),
procédure en cas de contenu pédocriminel (signalement aux autorités compétentes, conservation de preuves),
délais de traitement à annoncer, exposition de l'éditeur pour un service de discussion avec des inconnus.

## 6. Exigences de l'App Store à connaître

Guideline 1.2 (contenus générés par les utilisateurs) : filtre, signalement avec réponse rapide,
blocage, coordonnées publiées dans l'app. La même règle indique que les apps utilisées surtout pour
des **« Chatroulette-style experiences, random or anonymous chat »** « ne sont pas les bienvenues sur
l'App Store et peuvent être retirées sans préavis » (texte consulté le 17 octobre 2026). VimoX propose
une mise en relation aléatoire : **risque de refus ou de retrait à évaluer avec ton conseil**.

## 7. Mineurs

Âge minimum 16 ans (déclaratif). **Questions** : suffisant ? vérification d'âge à prévoir ? classification
d'âge à choisir dans l'App Store ? consentement parental selon le pays ?

## 8. Achats (si Premium devient payant)

Aujourd'hui : démonstration gratuite. Le code d'achat (RevenueCat, abonnement mensuel géré par l'App Store) est
prêt mais éteint (`ACTIVER-LES-PAIEMENTS.md`). L'écran affiche alors le prix du store, les mentions de
renouvellement automatique, « Restaurer mes achats » et les liens vers les Conditions et la Confidentialité.
**Questions** : droit de rétractation, information avant achat, mentions dans les CGU (section 9), TVA.

## 9. Questions à poser

1. Quelle forme juridique et quel droit applicable pour l'éditeur ? Quelle juridiction dans les CGU ?
2. Les textes de l'app (Conditions, Confidentialité) sont-ils conformes (LPD suisse / RGPD / DSA) ?
3. Quelle obligation de signaler un contenu illicite, à qui, dans quel délai ?
4. Que faire pour la vérification de l'âge et la protection des 16–17 ans ?
5. Quels engagements de délai de traitement des signalements peut-on promettre ?
6. Les transferts de données vers les sous-traitants sont-ils suffisamment encadrés ?
7. Comment présenter le service pour limiter le risque de refus par l'App Store ?

## 10. Où se trouvent les textes

Une seule source : `src/config/legalContent.json` (13 sections de conditions, 9 de confidentialité). Elle alimente
l'application (écrans **Conditions d'utilisation** et **Confidentialité**, depuis l'inscription et le profil) **et**
le site web (`site/`, fabriqué par `scripts/build-legal-site.mjs`, pages exigées par l'App Store). Les
espaces réservés (éditeur, adresse, contacts, droit applicable) se remplissent dans `.env`. Contenu des règles
de sécurité : `firestore.rules`. Fonctions de droit d'accès : « Télécharger mes données » (Paramètres) et
suppression du compte.

## 11. Mesures de protection de la vie privée mises en place

- Les stories ne sont lisibles que par l'auteur et par ses amis au moment de la publication (liste enregistrée
  dans la story, vérifiée par les règles de sécurité) ; les stories expirées sont effacées par leur auteur.
- Les profils ne sont pas listables (lecture un par un seulement) ; l'e-mail n'est pas dans le profil public.
- Une amitié ne peut être créée que par l'acceptation d'une vraie demande ; pas de demande vers une personne
  qui a bloqué l'expéditeur.
- **Recherche d'amis** : index minimal et volontaire (prénom, photo, pays). Adultes et mineurs ne se trouvent pas
  entre eux ; les mineurs ne reçoivent aucune suggestion de personnes inconnues et n'apparaissent pas par défaut.
  Les règles de sécurité refusent toute lecture en bloc de l'index (limite de 30 résultats par requête).
  **Questions** : défaut « visible » pour les adultes acceptable ? séparation adultes / mineurs suffisante ? les
  suggestions fondées sur les personnes rencontrées en match nécessitent-elles une information spécifique ?
- **Sourdines** : stockées sous « moi_ami », lisibles seulement par moi et par l'ami concerné (son téléphone envoie les
  notifications et doit savoir s'il doit s'abstenir) ; l'application ne le lui montre pas, mais une personne technique
  pourrait le lire. Les épingles, emojis, raccourcis, conversations effacées chez soi, amis dont on masque les stories
  restent SUR le téléphone de la personne (rien dans la base) ; seul « masquer ma story à X » retire X de la liste de
  visibilité de mes stories.
- **Pseudos** : uniques (réservation atomique vérifiée par les règles de sécurité), format contrôlé, mots réservés
  (admin, vimox…) et liste de mots clairement abusifs refusés ; impossible de s'attribuer le pseudo d'autrui.
  **Question** : obligations de modération des pseudos trompeurs ou offensants (le signalement existe, sans
  procédure dédiée aux pseudos).
- **Limites restantes** : jeton de notification lisible par un compte connecté qui connaît l'identifiant ;
  aucune modération automatique des images ; âge déclaratif.
