# Fiche App Store de VimoX — textes prêts à copier

*À copier dans App Store Connect quand tu auras ton compte Apple Developer. Les passages entre crochets
`[ ]` sont à compléter. Ces textes décrivent l'application telle qu'elle est aujourd'hui.*

## 1. Informations générales

| Champ | Valeur proposée |
|---|---|
| Nom (30 car. max) | VimoX |
| Sous-titre (30 car. max) | Discute, joue, partage |
| Catégorie principale | Réseaux sociaux |
| Catégorie secondaire | Divertissement |
| URL de la politique de confidentialité | `https://[ton-projet].web.app/privacy.html` (voir `PUBLIER-LE-SITE.md`) |
| URL d'assistance | `https://[ton-projet].web.app/support.html` |
| Âge minimum de l'application | 16 ans (déclaratif) — à garder cohérent avec la classification d'âge (section 5) |
| Droits d'auteur | `© 2026 [ton nom ou celui de ta société]` |

## 2. Texte promotionnel (170 car. max)

Retrouve tes amis, joue à deux, partage des stories de 24 h et discute en toute simplicité. Signalement et blocage à portée de main.

## 3. Description

VimoX réunit tout ce qu'il faut pour rester en contact :

• Messages, messages vocaux et photos
• Recherche d'amis par prénom ou @pseudo, et suggestions (réglage pour ne pas apparaître)
• Fiche d'ami (appui long) : envoyer un Vim, chat, appels, épingles, notifications et story par ami
• Liste de conversations avec statuts (« Nouveau message », « Reçu », « Envoyé »), filtre « Non lu » et conversations épinglées
• Raccourcis pour envoyer un Vim à plusieurs amis en une touche
• Stories visibles 24 heures, uniquement par tes amis
• Vims éphémères
• Appels audio et vidéo avec tes amis
• Jeux à deux : Morpion, 4 à la suite, Dames, Bataille navale, UNO, Ludo, Dessin deviné
• Flammes pour garder le rythme avec tes amis
• Rencontres : discute avec de nouvelles personnes

TA SÉCURITÉ COMPTE
• Signale ou bloque une personne en deux touches (conversations, stories, profils)
• Filtre automatique des messages abusifs ou dangereux
• Les stories ne sont visibles que par tes amis
• Tu peux télécharger tes données et supprimer ton compte depuis les Paramètres

VimoX est réservé aux personnes de 16 ans et plus.

## 4. Mots-clés (100 car. max, séparés par des virgules)

chat,amis,stories,jeux,messages,vocal,snap,appel vidéo,rencontres,discussion

## 5. Classification d'âge

Réponds honnêtement au questionnaire d'Apple (App Store Connect > Informations sur l'app > Classification d'âge). Depuis 2025, les
niveaux sont **4+, 9+, 13+, 16+ et 18+** ; tu ne choisis pas : Apple calcule le niveau d'après tes réponses, et tu peux le **relever**.
Apple a ajouté en juillet 2026 des questions sur les **fonctions sociales** (contenu partagé par un fil), obligatoires pour toute
nouvelle app ou mise à jour dès septembre 2026 : déclarer ces fonctions impose au minimum **13+**.

Pour VimoX, déclare : **messagerie / chat avec d'autres personnes**, **contenu généré par les utilisateurs** (photos, stories), **fil de stories**
(entre amis), et les **contrôles dans l'app** (signalement, blocage, filtre). Choisis un niveau **cohérent avec l'âge minimum de 16 ans** de
l'application (ex. 16+). Si Apple impose plus haut, aligne l'âge minimum dans l'app et dans les Conditions (section 4 de
`src/config/legalContent.json`). **À valider avec ton conseil.**

## 6. Confidentialité des données (« App Privacy »)

Déclaration proposée — à vérifier avec ton juriste. Aucun suivi publicitaire (« tracking ») : l'app n'utilise
ni publicité, ni outil de mesure d'audience.

| Type de donnée Apple | Collectée ? | Lien avec l'utilisateur | Usage |
|---|---|---|---|
| Coordonnées : adresse e-mail | Oui | Oui | Fonctionnement de l'app (connexion) |
| Coordonnées : nom | Oui | Oui | Fonctionnement de l'app (profil) |
| Contenu utilisateur : photos ou vidéos | Oui | Oui | Fonctionnement de l'app |
| Contenu utilisateur : données audio | Oui | Oui | Fonctionnement de l'app (messages vocaux) |
| Contenu utilisateur : autre contenu (messages, stories) | Oui | Oui | Fonctionnement de l'app |
| Contenu utilisateur : assistance client | Oui | Oui | Assistance |

Note : le prénom, la photo et le pays des personnes qui acceptent d'être trouvées sont visibles par les autres
utilisateurs (recherche d'amis) ; ces données sont déjà déclarées ci-dessus (nom, photos).
| Identifiants : identifiant utilisateur | Oui | Oui | Fonctionnement de l'app |
| Identifiants : identifiant d'appareil (jeton de notification) | Oui, par prudence | Oui | Notifications |
| Position précise | Seulement si la personne la partage dans une conversation | Oui | Fonctionnement de l'app |
| Contacts | Seulement si la personne partage un contact dans une conversation | Oui | Fonctionnement de l'app |
| Achats, historique de navigation, santé, finances, diagnostics | Non | — | — |

## 7. Notes pour l'équipe de relecture d'Apple (« App Review Information »)

À coller dans « Notes » (en anglais, c'est la langue de l'équipe de relecture) :

> VimoX is a social app (messages, stories, games, calls) for users aged 16+. It includes matching with other
> users. Content safety measures required by Guideline 1.2:
> 1. Filtering: text (messages, story replies, stories, name, bio) is checked on-device before sending
>    (threats, hate, sexual solicitation, content involving minors, scams). Repeated violations trigger a
>    temporary lock and an automatic internal report.
> 2. Reporting: every conversation, story and profile has a "⋯" menu with "Report" (with reasons) and "Block".
> 3. Blocking: blocked users can no longer contact or send friend requests; unblock in Profile > Settings.
> 4. Moderation: reports are reviewed by our team; accounts reported by several distinct users are
>    automatically suspended for 24 hours pending review.
> 5. Contact: Profile > Settings > Assistance (in-app form and e-mail) and https://[ton-projet].web.app/support.html
> 6. Account deletion: Profile > Settings > Delete my account. Data export: Profile > Settings > Download my data.
>
> Demo accounts (please use two devices or two accounts to test matching, chat and games):
> Account 1: [e-mail 1] / [mot de passe 1]
> Account 2: [e-mail 2] / [mot de passe 2]
>
> The Premium screen is a free demo mode: no in-app purchase is active in this version.

**Avant d'envoyer** : crée vraiment ces deux comptes de démonstration, avec un ami déjà accepté entre eux, et
vérifie que tout fonctionne avec eux.

## 8. Captures d'écran

Un seul jeu suffit : **iPhone 6,9 pouces, 1320 × 2868 pixels**, de 1 à 10 images (png ou jpeg). Apple l'adapte aux autres iPhone. **Pas de
captures d'iPad** : l'application est réglée pour iPhone seulement (`supportsTablet: false`). Idées : le chat d'amis avec un appel, le fil des
stories, une partie de jeu, le profil. Utilise de vrais comptes de démonstration, **sans informations personnelles réelles**. Une capture
brute d'iPhone n'a pas la bonne taille (ex. 1179 × 2556) : prends-la sur l'iPhone puis agrandis-la, ou utilise un simulateur de capture.

## 9. Avant de cliquer sur « Envoyer pour examen » — liste de contrôle

- [ ] Compte Apple Developer actif, application créée dans App Store Connect (identifiant de bundle : voir `app.config.ts`)
- [ ] `.env` complet (éditeur, contact, droit applicable) et site publié (`PUBLIER-LE-SITE.md`)
- [ ] Règles de sécurité publiées et testées (`PUBLIER-LES-REGLES.md`)
- [ ] Appels testés entre deux téléphones (serveur d'appels décidé : `COUTS-ET-COMPTES.md`)
- [ ] Textes légaux relus par un juriste (`DOSSIER-JURISTE.md`)
- [ ] Quelqu'un lit la collection `reports` chaque jour
- [ ] Réglages envoyés à Expo (`node scripts/push-env-to-eas.mjs --apply`, voir `PASSER-AUX-ETAPES-PAYANTES.md`)
- [ ] Build de production fait avec EAS et testé sur TestFlight
- [ ] Comptes de démonstration créés et notés dans les notes de relecture
