# HOTELIA – application mobile (Expo)

Application mobile native de l'hôtel (Expo SDK 58, React Native), à la charte HOTELIA : marine et or, Poppins et Inter (Noto Kufi Arabic pour l'arabe), modes clair et sombre. Mêmes données et même **synchronisation en direct** que l'application web : une chambre nettoyée sur un téléphone apparaît aussitôt sur le tableau de bord, et inversement.

## Écrans

| Écran | État |
| --- | --- |
| Adresse du serveur, connexion, code à 6 chiffres | Natif |
| Accueil : salutation, résumé du jour, alertes, tableau des chambres, arrivées et départs | Natif |
| Chambres (ménage) : priorités, à nettoyer, départs, hors service, prêtes, annulation 8 s | Natif |
| Scan : code QR d'une chambre (`hotelpms://room/<numéro>`) ou numéro saisi | Natif |
| Réservations : recherche, filtres, fiche, arrivée et départ | Natif |
| Profil : autres écrans, apparence, serveur, déconnexion | Natif |
| Planning, clients, factures, rapports, administration | Version web dans l'application (même session, sans le menu web) |
| Activation de la double authentification | Version web (code QR) |

Les onglets suivent les droits du profil ; Tâches, Messages et Notifications viendront avec leurs API.

## Lancer

```bash
npm ci
npx expo start            # QR code à scanner avec Expo Go (SDK 58), ou « Enter URL manually »
```

- Téléphone et poste sur le même Wi-Fi. Adresse du serveur dans l'application : celle du poste, ex. `192.168.1.10:3001` (pile de démonstration : `docker compose up --build -d` à la racine).
- Émulateur Android : `adb reverse tcp:8081 tcp:8081` et `adb reverse tcp:3001 tcp:3001`, ouvrir `exp://127.0.0.1:8081` dans Expo Go, serveur `localhost:3001`.
- Expo Go ne prend en charge qu'une version du SDK (celle des stores). Message « incompatible » : mettre Expo Go à jour, ou le projet (`npx expo install expo@^<version> --fix`).

## Charte et textes

- `design/tokens.json` : copie des tokens de la charte HOTELIA (artefact « HOTELIA »). `npm run theme` génère `src/theme/tokens.ts` (couleurs par mode, échelles, ombres iOS/Android, styles de texte et leur variante arabe, durées).
- `npm run i18n` copie les dictionnaires et les types de l'application web (`web/lib`) dans `src/i18n/shared` et `src/api/types.ts` : une seule source pour les textes. Les textes propres au mobile sont dans `src/i18n/mobile.ts`.
- La langue suit le profil ; l'arabe passe la mise en page de droite à gauche (redémarrage de l'application). `supportsRTL` est déclaré dans `app.json` (`extra`). La langue du téléphone est lue par React Native (`src/i18n/device.ts`) : pas d'`expo-localization`, dont le module natif remettait le sens de lecture à zéro à chaque démarrage.
- Expo Go ne garde pas ce choix d'un lancement à l'autre : il suit la langue du téléphone. Pour tester l'arabe de droite à gauche dans Expo Go, mettre Expo Go en arabe (Android : Paramètres > Applications > Expo Go > Langue, ou `adb shell cmd locale set-app-locales host.exp.exponent --locales ar`). Dans l'application construite (APK), la bascule fonctionne seule.

## Architecture

| Dossier | Rôle |
| --- | --- |
| `src/api` | Appels à l'API par le serveur web (`/api/session`, `/api/v1`, cookies httpOnly partagés avec les écrans web), requêtes, flux en direct (`/v1/events`) |
| `src/ui` | Composants de la charte : Text, Button, Input, Card, Badge, RoomTile, alertes, Toast, BottomSheet, SearchBar, filtres, Screen |
| `src/screens` | Écrans natifs |
| `src/navigation` | Onglets selon les droits, pile (fiche réservation, écrans web) |
| `src/theme`, `src/i18n` | Thème généré, préférences clair/sombre, langues |

## Construire

- EAS : `npx eas-cli build -p android --profile preview` (compte Expo).
- Local : `npx expo run:android --variant release` (SDK Android, JDK 17 à 21).

Identifiant : `com.hotelpms.expo`. Logo et icônes recadrés dans la planche de la charte : à remplacer par les fichiers vectoriels d'origine.
