# Application Android – Système de gestion hôtelière

Application Android (Capacitor 8) qui ouvre l’application web de l’hôtel en plein écran, avec sa propre icône. Ce sont les mêmes écrans que sur le web (tableau de bord, ménage, réception, restaurant, rapports…), adaptés au téléphone et **synchronisés en direct** avec le tableau de bord : une chambre nettoyée, une arrivée ou une consommation saisie sur un téléphone apparaît aussitôt sur les autres écrans, et inversement.

## Fonctionnement

1. **Premier lancement** : l’application demande l’adresse du serveur de l’hôtel (`https://pms.mon-hotel.com`, ou `192.168.1.10:3001` sur le réseau de l’hôtel). Elle vérifie qu’il s’agit bien de l’application de gestion (manifeste), l’enregistre, puis l’ouvre.
2. **Lancements suivants** : ouverture directe sur ce serveur ; la session reste ouverte comme dans un navigateur.
3. **Changer de serveur** : lien « Changer de serveur » sur la page de connexion et en bas du menu (visible uniquement dans l’application).

- Le lanceur (`www/`) est la seule partie embarquée : tout le reste vient du serveur, donc une mise à jour du serveur met à jour l’application sans nouvelle version.
- En ligne uniquement : sans réseau, une page « Pas de connexion » s’affiche ; au retour du réseau, tout est rechargé.
- Bouton retour Android : page précédente, puis sortie de l’application.
- Langue : celle du téléphone pour le lanceur (français, anglais, arabe), puis celle du profil dans l’application.

## Construire l’APK

Prérequis : Node 20+, le SDK Android (Android Studio) et un **JDK 17 à 21**. Gradle 8.14 ne fonctionne pas avec le JDK 25 fourni par les versions récentes d’Android Studio : pointer `JAVA_HOME` vers un JDK 21 (par exemple Eclipse Temurin).

```bash
npm ci
npm run build:debug        # cap sync + gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

`npm run open` ouvre le projet dans Android Studio (émulateur, signature, publication).

**Version publiable** : créer une clé de signature, puis `gradlew bundleRelease` (Google Play) ou `assembleRelease` (installation directe), voir la documentation Android sur la signature des applications. Ne jamais versionner la clé.

## Serveur

- **HTTPS recommandé** en production. Le HTTP est accepté pour un serveur du réseau local (`cleartext`), sans perte de fonction.
- Émulateur Android : le poste de développement est joignable à l’adresse `10.0.2.2` (ex. `10.0.2.2:3001` pour la pile de démonstration).
- Limites dans l’application : l’impression des factures et l’export CSV des rapports restent à faire depuis un ordinateur.

## Fichiers

| Fichier | Rôle |
| --- | --- |
| `capacitor.config.json` | Identifiant `com.hotelpms.app`, navigation vers n’importe quel serveur, marque `HotelPMSApp` ajoutée à l’agent utilisateur (détectée par l’application web), barres système |
| `www/` | Lanceur : saisie et vérification de l’adresse du serveur |
| `android/` | Projet Android généré par Capacitor ; icônes vectorielles (`res/drawable/ic_launcher_*.xml`) et écran de démarrage personnalisés |
