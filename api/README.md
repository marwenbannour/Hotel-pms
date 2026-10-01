# API – Système de gestion hôtelière (socle V1)

Implémentation de la section 22 du cahier des charges v1.1 (option A) : NestJS 11, TypeScript, PostgreSQL 16+.

## Démarrage

```bash
cp .env.example .env            # renseigner JWT_SECRET
npm ci
npm run seed                    # migrations, comptes, chambres et menu
npm run seed:demo               # idem + une journée type (base vide uniquement)
npm run start:dev               # http://localhost:3000/v1 — documentation : /docs
```

Avec Docker, depuis la racine du dépôt : voir `../README.md`.

Comptes de démonstration (mot de passe `ChangeMe!2026`) : `admin@`, `reception@`, `menage@`, `restaurant@`, `compta@` et `it@hotel.local`. Les profils Direction, Comptabilité et IT doivent activer la double authentification à la première connexion.

## Périmètre implémenté

| Domaine | Endpoints | Section du CDC |
| --- | --- | --- |
| Session | `/auth/login`, `/auth/mfa/verify`, `/auth/refresh`, `/auth/logout`, `/me`, `/me/mfa/*` | 4.3, 22.3 |
| Menu dynamique | `GET /me/navigation`, `/navigation-items` (administration) | 5 |
| Chambres | `/room-types`, `/rooms`, `PATCH /rooms/{id}/status` | 3.3 |
| Clients | `/guests`, `/guests/{id}/stays`, `POST /guests/{id}/erase` | 3.2, 4.3 |
| Disponibilités | `GET /availability` | 3.1 |
| Réservations | `/reservations` (recherche par nom, email ou référence), `/quote`, `/{id}/history`, `PUT /{id}/room` (pré-attribution d’une chambre), `/cancel`, `/check-in`, `/check-out` | 3.1, 3.4 |
| Planning | `GET /planning` (chambres et séjours sur 31 jours au plus, départs en retard signalés) | 5 |
| Facturation | `GET /reservations/{id}/folio`, `POST …/folio/charges`, `POST /rooms/{id}/charges` (facturation à la chambre), `POST …/payments`, `POST …/invoice`, `GET /invoices`, `POST /invoices/{id}/credit-note`, `GET /invoices/integrity`, `GET /accounting/exports`, `GET` et `PUT /settings/billing` | 3.5, 3.7 |
| Tableau de bord | `GET /dashboard` (contenu adapté au profil), `GET /reports/kpis` | 3.8, 5 |
| Supervision | `GET /health` | 22.6 |

Le contrat complet est dans `openapi.json` (régénéré par `npm run openapi`).

## Garanties techniques

- **Pas de surréservation.** Chaque vente verrouille le type de chambre puis vérifie la disponibilité nuit par nuit. Une contrainte d'exclusion PostgreSQL (`reservations_no_room_overlap`) interdit physiquement deux séjours actifs sur la même chambre.
- **Idempotence.** `POST /reservations` exige `Idempotency-Key` ; un rejeu renvoie la même réponse (`Idempotent-Replayed: true`), une clé réutilisée pour une autre requête est refusée (422).
- **Concurrence optimiste.** Les ressources renvoient un `ETag` ; toute modification exige `If-Match` (absent → 428, périmé → 412).
- **Jetons.** Accès JWT de 15 min ; rafraîchissement rotatif stocké haché. Une réutilisation révoque toute la session et est journalisée.
- **MFA TOTP** obligatoire pour Direction, Comptabilité et IT.
- **RBAC** par permission ; le menu est calculé à partir des mêmes droits et des modules activés (`ENABLED_MODULES`).
- **Erreurs RFC 9457** traduites en français, anglais et arabe selon `Accept-Language`, avec `traceId`.
- **Pagination par curseur** (`limit`, `cursor`, `sort`, `fields`).
- **Limites d'appels** avec en-têtes `RateLimit-*` ; 10 tentatives par minute sur `/auth/*`.
- **Journal d'audit** : connexions échouées, réutilisation de jeton, MFA, réservations, changements d'état des chambres, effacements RGPD, menu.

## Tests

```bash
createdb hotel_test               # base dédiée, réinitialisée à chaque exécution
npm run test:e2e
```

51 tests de bout en bout couvrent notamment la surréservation sous 8 ventes simultanées, la réutilisation de jeton, le parcours arrivée → départ → nettoyage, le menu filtré par profil, la recherche et le devis de réservation, la pré-attribution des chambres (y compris l’arrivée qui ne prend jamais une chambre promise à un autre client), la facturation (TVA par taux, taxe de séjour, numérotation sans trou sous émissions simultanées, détection d’une facture altérée en base, refus d’un numéro de carte, export équilibré), et les indicateurs (occupation, ADR, RevPAR, durée moyenne de séjour) sur un jeu de données dont les valeurs attendues sont calculées à la main.

## Indicateurs

- **Chambres disponibles** : chambres hors maintenance, selon leur état actuel (l’historique des mises en maintenance n’est pas encore conservé).
- **Chiffre d’affaires** : montant du séjour réparti à parts égales sur ses nuits. Il inclut le supplément pension tant que la facturation détaillée n’est pas livrée.
- **Prévisions** : les réservations confirmées à venir sont incluses.

## Hors de ce socle

Ces éléments sont prévus dans la section 22 mais restent à livrer :

- intégration d’un prestataire de paiement (le terminal ou la page de paiement renvoie la référence de transaction saisie aujourd’hui à la main) ;
- génération PDF côté serveur et envoi des factures par email (la facture s’imprime ou s’enregistre en PDF depuis le navigateur) ;
- changement de chambre d’un client déjà installé ;
- channel manager, webhooks et évènements Socket.IO ;
- synchronisation hors ligne (`/sync/*`) ;
- plans tarifaires saisonniers ;
- rapports exportables ;
- modules V2 (personnel, restauration, carte dynamique).

La tarification actuelle est volontairement simple : tarif de base du type de chambre plus supplément pension par personne et par nuit.

## Facturation

- **Compte du séjour** : séjour (TVA hébergement), taxe de séjour (par adulte et par nuit, hors TVA) et prestations portées au compte, TVA selon la catégorie. Montants TTC en centimes ; la TVA est extraite ligne par ligne.
- **Encaissements** : acompte, paiement, remboursement ; espèces, carte, virement, bon de commande. Pour la carte, seule la référence de transaction du terminal ou du prestataire est conservée ; un numéro de carte saisi par erreur est refusé (contrôle de Luhn).
- **Factures** : séries `F{année}` et `A{année}` (avoirs), numérotation continue garantie par un verrou transactionnel. Chaque pièce est scellée par une empreinte SHA-256 chaînée à la précédente ; `GET /invoices/integrity` recalcule toute la chaîne. Les factures, leurs lignes et les encaissements sont protégés par des déclencheurs PostgreSQL : toute modification passe par un avoir ou un remboursement.
- **Départ** : refusé tant que le compte n’est pas soldé (409 `BALANCE_DUE`), sauf dérogation motivée de la direction ou de la comptabilité, tracée au journal. Un départ anticipé ramène le prix au prorata des nuits passées.
- **Export comptable** : CSV « ; » (journaux VE, BQ, CA, OD), écritures équilibrées par pièce, comptes paramétrables (`PUT /settings/billing`).

À valider avant la mise en service : les taux et règles du pays d’exploitation (TVA, taxe de séjour, mentions obligatoires) et l’obligation éventuelle de certification du logiciel de caisse ou de facturation électronique ; les valeurs livrées sont des défauts à adapter.
