# Publier le petit site (politique de confidentialité, conditions, assistance) — gratuit

L'App Store demande **une adresse web** pour ta politique de confidentialité et pour l'assistance. Le dossier
`site/` les contient déjà ; ils sont fabriqués à partir des mêmes textes que l'application. Firebase Hosting
les met en ligne à l'adresse `https://[identifiant-du-projet].web.app` (l'offre gratuite de Firebase inclut
Hosting avec un quota ; vérifie les limites actuelles sur firebase.google.com/pricing).

## 1. Remplir tes informations
Dans ton fichier `.env`, complète : `EXPO_PUBLIC_EDITOR_NAME`, `EXPO_PUBLIC_EDITOR_ADDRESS`,
`EXPO_PUBLIC_SUPPORT_EMAIL`, `EXPO_PUBLIC_PRIVACY_EMAIL` et `EXPO_PUBLIC_GOVERNING_LAW` (droit applicable,
à définir avec ton juriste).

## 2. Fabriquer les pages
```
node scripts/build-legal-site.mjs
```
Le script écrit les pages dans `site/` et te dit s'il manque des informations. Ouvre `site/privacy.html`
dans ton navigateur pour vérifier. **À refaire à chaque changement des textes ou de `.env`.**

## 3. Mettre en ligne
1. Dans `firebase.json` (à la racine), ajoute cette section en gardant le reste :
   ```json
   "hosting": {
     "public": "site",
     "ignore": ["firebase.json", "**/.*", "**/node_modules/**"]
   }
   ```
2. Connecte-toi une fois : `npx firebase-tools login`.
3. Publie : `npx firebase-tools deploy --only hosting`
4. Le script affiche l'adresse du site (de la forme `https://vimox-xxxxx.web.app`). Tes adresses sont alors :
   - confidentialité : `https://[identifiant-du-projet].web.app/privacy.html`
   - assistance : `https://[identifiant-du-projet].web.app/support.html`

Si la commande te demande d'activer Hosting, accepte (c'est gratuit à ce niveau d'usage).
