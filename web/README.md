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

Les autres entrées du menu affichent un écran d’attente.

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

## Test de bout en bout dans le navigateur

`e2e/reservations.py`, `e2e/planning.py` et `e2e/billing.py` (Playwright) rejouent le parcours complet sur la journée de démonstration : recherche, création, double clic, modification, conflit, annulation, arrivées, arabe, droits du profil ménage ; attribution de chambre au menu et par glisser-déposer, refus d’un chevauchement ; départ bloqué par le solde, prestation, refus d’un numéro de carte, encaissement, facture en arabe, contrôle d’intégrité, export CSV et avoir.

```bash
pip install playwright && playwright install chromium
python e2e/reservations.py        # API sur :3000 et web sur :3001, base « seed:demo »
python e2e/planning.py            # même prérequis, sur une base « seed:demo » neuve
python e2e/billing.py             # idem
```
