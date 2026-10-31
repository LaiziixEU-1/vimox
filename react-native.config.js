// Camera Kit (Snap) est installé mais inutilisé : les effets visage sont retirés de l'app.
// On l'exclut du build natif : moins risqué (module ancien, pas prévu pour la nouvelle architecture
// de React Native), plus léger, et rien de Snap n'est embarqué dans l'app.
// Pour le réactiver un jour : supprime ce fichier.
module.exports = {
  dependencies: {
    "@snap/camera-kit-react-native": {
      platforms: { ios: null, android: null },
    },
  },
};
