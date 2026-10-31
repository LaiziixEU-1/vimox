# Fiche pour les stores — VimoX « amis d'abord »

> Ces textes sont des propositions. Je ne peux garantir ni l'acceptation par Apple ou Google, ni leur lecture de
> tes réponses. Relis toujours les règles à jour sur leurs sites avant d'envoyer l'app.

## 1. Le principe

VimoX se présente pour ce qu'il est d'abord : **une app pour rester en contact avec ses amis** (caméra, Vims,
stories, messages, groupes, jeux). **Match**, le chat avec des inconnus, est une **fonction secondaire réservée aux
18 ans et plus**, inaccessible aux comptes mineurs.

Ce qui est en place dans l'app :
- **Onglet Match masqué** pour les moins de 18 ans, et placé après les stories pour les adultes ;
- **règles Firebase** : un mineur ne peut ni entrer dans la file d'attente de Match, ni créer un salon de match,
  même avec une app modifiée (l'âge vient du profil enregistré à l'inscription) ;
- **interrupteur de secours** : `EXPO_PUBLIC_MATCH_ENABLED=false` dans `.env`, puis un nouveau build, retire Match de
  toute l'app (onglet, accueil, avantages Vim+). Utile si un store refuse l'app à cause de Match : tu peux publier
  sans Match, puis le réintroduire plus tard.

⚠️ **Ne cache jamais Match aux relecteurs des stores.** Décris-le franchement (modèle de texte plus bas). Essayer de
tromper la relecture est une cause de retrait de l'app et du compte développeur.

## 2. Textes proposés (français)

**Nom :** VimoX

**Sous-titre Apple (30 caractères max, 30 ici) :**
`Vims, stories, jeux entre amis`

**Description courte Google Play (80 max, 67 ici) :**
`Envoie des Vims, publie des stories, discute et joue avec tes amis.`

**Mots-clés Apple (100 max, 79 ici) :**
`vims,stories,amis,messagerie,jeux,photo,vidéo,groupes,flammes,appels,discussion`
(pas de nom d'une autre app : c'est interdit dans les métadonnées)

**Description longue :**

> VimoX, c'est l'app pour rester en contact avec tes amis, en photo, en vidéo et en jeu.
>
> 📸 VIMS ET CAMÉRA — Prends une photo ou une vidéo, ajoute du texte, des dessins, des autocollants et de la
> musique, puis envoie-la à tes amis. Les Vims s'effacent après lecture.
> 🔥 FLAMMES — Garde ta flamme allumée en vous envoyant un Vim chaque jour.
> 💬 MESSAGES ET GROUPES — Discute en messages, en vocal, en photo et en appel audio ou vidéo, à deux ou en groupe.
> 🎮 7 JEUX — UNO, Ludo, Bataille navale, Dames, 4 à la suite, Morpion et Dessin deviné, avec tes amis ou contre
> l'ordinateur.
> 📖 STORIES — Partage ton quotidien pendant 24 heures.
> 🛡️ TU GARDES LA MAIN — Signale, bloque, masque ton statut en ligne.
>
> MATCH (18 ans et plus) — Les adultes peuvent aussi faire de nouvelles rencontres. Cette fonction est
> inaccessible aux comptes de moins de 18 ans.
>
> VIM+ (abonnement facultatif) — Flammes restaurées, Pass pour offrir Vim+ à tes amis, couleur de chat, icône de
> l'app au choix, modification des messages et plus encore. Abonnement à renouvellement automatique, résiliable à
> tout moment dans les réglages de ton compte Apple ou Google Play.
>
> Conditions d'utilisation : [ton lien] · Confidentialité : [ton lien] · Contact : [ton e-mail]

## 3. Captures d'écran (dans cet ordre)

1. L'éditeur de la caméra (texte, autocollants, musique)
2. Le chat avec un ami, avec une bulle de jeu
3. Les stories
4. Le menu des jeux
5. Les groupes
6. Les flammes
7. La page membre Vim+

**Match ne doit pas être la vedette.** S'il apparaît sur une capture, la mention « 18 ans et + » doit être lisible.

## 4. Questionnaires de classification

- **Apple** et **Google Play** posent des questions sur le chat, le contenu généré par les utilisateurs et la
  communication avec des inconnus. **Réponds honnêtement**, sans chercher à faire baisser la classification : une
  réponse inexacte est plus dangereuse qu'une classification élevée.
- **Google Play** : depuis le 26 août 2026, les apps de chat aléatoire doivent utiliser les outils de la Play
  Console pour **bloquer les mineurs**, et une analyse spécialisée indique que si l'onglet qui met des inconnus en
  relation est la raison pour laquelle les gens ouvrent l'app, il est jugé « cœur » de l'app. **Prévois ce
  scénario** : si Google juge Match central, l'app pourrait devoir être réservée aux adultes sur Google Play. Dans ce
  cas, le plus simple est de publier **sans Match** (interrupteur de secours) pour garder les 16-17 ans.
- **Apple** : la règle 1.2 vise les apps *utilisées principalement* pour du chat aléatoire ou anonyme. Un Match
  secondaire, réservé aux adultes, n'est pas interdit en soi, mais le risque d'un refus existe.

## 5. Notes pour l'équipe de relecture (champ « Notes » d'App Store Connect, et équivalent Google)

> VimoX est une application de messagerie et de partage entre amis (caméra, Vims, stories, groupes, jeux). Une
> fonction secondaire, « Match », met en relation des adultes de 18 ans et plus. Elle est inaccessible aux comptes de
> moins de 18 ans : l'onglet est masqué et le serveur refuse l'accès (âge indiqué à l'inscription, non modifiable
> ensuite). Modération : filtre de messages, bouton « Signaler » et « Bloquer » dans chaque conversation, et dans
> Paramètres. Contact : [ton e-mail].
> Comptes de démonstration : adulte (Match visible) : [e-mail / mot de passe] ; mineur de 17 ans (Match absent) :
> [e-mail / mot de passe].

Crée ces **deux comptes de démonstration** avant l'envoi : un adulte et un mineur de 17 ans.

## 6. Ce que cette protection ne fait pas

- **L'âge est déclaré, pas vérifié.** Personne ne contrôle une pièce d'identité à l'inscription : un mineur peut
  mentir sur son âge. C'est le même niveau de confiance que la plupart des apps, mais c'est la limite principale.
  Certains pays et certains stores peuvent exiger davantage un jour (vérification d'âge). À surveiller.
- La modération reste indispensable : le filtre de messages, les signalements traités rapidement, et la suspension
  automatique des comptes signalés (fonction serveur, forfait Blaze).

## 7. Liste de contrôle avant l'envoi

- ☐ URL **publique** de la politique de confidentialité et des conditions (les stores l'exigent : les textes de
  l'app ne suffisent pas). Firebase Hosting peut les héberger gratuitement.
- ☐ E-mail de contact renseigné dans `.env` (`EXPO_PUBLIC_SUPPORT_EMAIL`) et dans les fiches
- ☐ Deux comptes de démonstration (adulte et mineur de 17 ans)
- ☐ Textes ci-dessus adaptés et liens remplis
- ☐ Questionnaires de classification remplis honnêtement
- ☐ Prêt à publier **sans Match** si un store le demande (`EXPO_PUBLIC_MATCH_ENABLED=false`)
