# Application web – Système de gestion hôtelière

Interface Next.js 16 (React 19, TanStack Query, Tailwind 4) du cahier des charges v1.1. Modules livrés :

| Module | Écrans |
| --- | --- |
| Connexion | Mot de passe, code de vérification, activation guidée de la double authentification |
| Tableau de bord | Tableau des chambres, à traiter, arrivées et départs, performance |
| Réservations | Liste avec recherche et filtres, création, fiche, modification, annulation, historique |
| Réception | Arrivées et départs par jour, avec enregistrement |
| Facturation | Compte du séjour sur la fiche (prestations, encaissements, solde, émission de la facture), liste des factures et avoirs, facture imprimable en français, anglais ou arabe, export comptable et contrôle d’intégrité |
| Planning | Planning des chambres sur 14 jours : attribution par glisser-déposer ou par menu (clavier), réservations à attribuer, départs en retard |
| Clients | Liste avec recherche et segment, création, fiche (coordonnées, modification, séjours, nouvelle réservation présélectionnée), anonymisation RGPD |
| Ménage | Écran pour téléphone : priorités selon les arrivées du jour, chambres à nettoyer, départs du jour, hors service, filtre par étage, annulation de la dernière action |
| Rapports | Occupation, CA hébergement, ADR, RevPAR, nuitées, séjours, durée moyenne, comparaison avec la période précédente, graphiques par jour ou par semaine, tableau et export CSV |
| Administration | Types de chambre et chambres, menu (libellés en trois langues, ordre, permission, masquage), utilisateurs (création, profil, mot de passe, double authentification, désactivation) |

Les entrées des modules non activés (restaurant) affichent un écran d’attente.

## Démarrage

```bash
cp .env.example .env.local      # API_URL=http://localhost:3000
npm ci
npm run dev                     # http://localhost:3001
```

L’API doit tourner (voir `../api`). Pour une journée de démonstration réaliste : `npm run seed:demo` dans `../api`, sur une base vide.

## Tableau de bord

Il s’adapte au profil connecté, avec les mêmes droits que l’API :

| Profil | Contenu |
| --- | --- |
| Ménage | Tableau des chambres (changement d’état d’un clic), chambres qui se libèrent aujourd’hui, alertes chambres |
| Réception | En plus : arrivées et départs du jour avec enregistrement, clients présents, taux d’occupation, alertes (départ en retard, no-show, manque de chambres prêtes) |
| Direction, comptabilité | En plus : occupation sur 15 jours (réalisé et prévisions), ADR, RevPAR, chiffre d’affaires du jour et du mois, durée moyenne de séjour |

Les données se rafraîchissent toutes les 30 secondes. L’interface est disponible en français, anglais et arabe (mise en page RTL complète) ; à la première connexion, elle prend la langue du profil.

## Sécurité

Le navigateur ne voit jamais les jetons. Les routes `/api/session/*` et le proxy `/api/v1/*` du serveur web les conservent dans des cookies httpOnly, et ajoutent le jeton d’accès à chaque appel vers l’API.

Le rafraîchissement des jetons est dédoublonné : plusieurs requêtes simultanées avec un jeton expiré ne déclenchent qu’un seul rafraîchissement, sans quoi l’API détecterait une réutilisation et fermerait la session. Ce dédoublonnage vaut pour une instance du serveur web ; avec plusieurs instances, activez l’affinité de session sur le répartiteur de charge.

L’adresse du client est transmise à l’API via `X-Forwarded-For` pour la limitation de débit. En production, placez le serveur web derrière un proxy inverse qui renseigne cet en-tête.

## Dates et fuseau horaire

Le « jour » de l’interface est celui de l’établissement, fourni par l’API (`/me` → `hotel.today`), jamais celui du poste de travail. Les horodatages (historique, création, annulation) sont affichés dans le fuseau de l’hôtel.

## Réservations

- La création calcule le prix via `/reservations/quote` : l’interface n’embarque aucune règle tarifaire.
- Chaque formulaire de création porte sa propre clé d’idempotence : un double clic ou un nouvel envoi après une coupure réseau ne crée pas de doublon.
- Si une autre personne a modifié la réservation entre-temps, l’enregistrement est refusé (412), la fiche se recharge et un message l’explique.

## Tests de bout en bout

`e2e/` contient sept scénarios Playwright qui rejouent les parcours complets dans un vrai navigateur, sur la journée de démonstration :

| Scénario | Parcours |
| --- | --- |
| `reservations` | Recherche, création (pas de doublon au double clic), modification, conflit, annulation, arrivées, arabe, droits du ménage |
| `planning` | Attribution au menu et par glisser-déposer, refus d’un chevauchement, retrait, arabe |
| `billing` | Départ bloqué par le solde, prestation, refus d’un numéro de carte, encaissement, facture en arabe, intégrité, export, avoir |
| `guests` | Recherche, création avec erreur de validation, modification, réservation présélectionnée, lecture seule du restaurant |
| `housekeeping` | Format téléphone : à nettoyer, annulation, hors service, filtre par étage, arabe |
| `reports` | Période, indicateurs et comparaison, info-bulle, regroupement par semaine, tableau, CSV, arabe |
| `admin` | Types et chambres, menu, utilisateurs (création, mot de passe, désactivation), restrictions du profil IT |

`e2e/run.py` démarre une pile Docker isolée (`docker-compose.e2e.yml` : base en mémoire, port 3101, aucune donnée partagée avec la démonstration), **recrée la base avant chaque scénario** et affiche un bilan :

```bash
pip install -r e2e/requirements.txt && python -m playwright install chromium
python e2e/run.py                     # tous les scénarios, puis arrêt de la pile
python e2e/run.py guests reports      # une sélection
python e2e/run.py --keep              # garder la pile ; relancer ensuite avec --reuse (sans reconstruire)
HEADED=1 python e2e/run.py --reuse admin   # voir le navigateur
```

Les captures d’écran sont enregistrées dans `e2e/artifacts/<scénario>/`. En cas d’échec, chaque page encore ouverte est capturée (`failure-*.png`) et les journaux de l’API et du web sont affichés. `CHROME_PATH` permet d’utiliser un Chrome déjà installé.

Les profils soumis à la double authentification (direction, comptabilité, informatique) l’activent pendant le scénario, à partir de la clé affichée à l’écran : ne lancez jamais un scénario sur une base réelle.

En intégration continue, le job `e2e` joue tous les scénarios après les jobs `api` et `web` et publie les captures.
