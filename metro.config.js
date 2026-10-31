// Configuration de Metro (le "compilateur" d'Expo).
// Identique à la configuration par défaut, avec UNE seule différence, uniquement pour le WEB :
// deux modules du téléphone qui n'existent pas dans un navigateur sont remplacés par des
// versions vides, pour pouvoir tester l'application sur l'ordinateur (npx expo start --web).
// Aucun effet sur iPhone et Android.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Le dossier functions/ (fonctions serveur Firebase) ne fait pas partie de l'application :
// Metro l'ignore, même après « npm install » dedans. (Seul le dossier de CE projet est visé.)
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const dossierFonctions = new RegExp("^" + escapeRegExp(path.resolve(__dirname, "functions")) + "[\\\\/].*");
const dejaBloque = config.resolver.blockList;
config.resolver.blockList = [].concat(dejaBloque ? dejaBloque : [], dossierFonctions);

// FIREBASE : UNE SEULE COPIE DU CŒUR SUR TÉLÉPHONE.
// Sans cela, Metro embarque deux copies de @firebase/app (une « require », une « import »).
// La connexion Firebase s'enregistre dans l'une, la base de données lit l'autre : elles ne se voient
// jamais (erreur « Component auth has not been registered yet »), la « connexion sécurisée » reste
// inactive et les règles de sécurité bloqueraient toute l'application.
// On impose donc la même version (celle déclarée « main » par chaque paquet) à tous les importateurs.
const fs = require("fs");
const UNE_SEULE_COPIE_FIREBASE = {};
for (const pkg of ["@firebase/app", "@firebase/component", "@firebase/logger"]) {
  try {
    const dir = path.resolve(__dirname, "node_modules", pkg);
    const main = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).main;
    const file = path.join(dir, main);
    if (fs.existsSync(file)) UNE_SEULE_COPIE_FIREBASE[pkg] = file;
  } catch (e) {}
}

const MODULES_VIDES_SUR_LE_WEB = {
  "expo-media-library": path.resolve(__dirname, "src/webStubs/mediaLibrary.ts"),
  "expo-contacts": path.resolve(__dirname, "src/webStubs/contacts.ts"),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && MODULES_VIDES_SUR_LE_WEB[moduleName]) {
    return { type: "sourceFile", filePath: MODULES_VIDES_SUR_LE_WEB[moduleName] };
  }
  if (platform !== "web" && UNE_SEULE_COPIE_FIREBASE[moduleName]) {
    return { type: "sourceFile", filePath: UNE_SEULE_COPIE_FIREBASE[moduleName] };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
