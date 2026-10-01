# Système de gestion hôtelière

Mise en œuvre de l’option A du cahier des charges v1.1.

| Dossier | Contenu |
| --- | --- |
| `api/` | API REST NestJS 11 et PostgreSQL : session et MFA, menu dynamique, chambres, clients, disponibilités, réservations (recherche, devis, historique, pré-attribution des chambres), planning, réception, facturation (compte du séjour, encaissements, factures et avoirs inaltérables, export comptable), tableau de bord et indicateurs |
| `web/` | Application Next.js 16 : connexion, tableau de bord, réservations, arrivées et départs, planning des chambres, facturation |

## Démarrage rapide avec Docker

```bash
JWT_SECRET=$(openssl rand -hex 32) docker compose up --build -d
docker compose exec api node dist/database/seed.js --demo-day
```

Ouvrez http://localhost:3001 et connectez-vous avec `reception@hotel.local`, `menage@hotel.local` ou `admin@hotel.local` (mot de passe `ChangeMe!2026`). Le compte direction vous guidera pour activer la double authentification.

## Développement

Voir `api/README.md` puis `web/README.md`.
