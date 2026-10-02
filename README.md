# Système de gestion hôtelière

Mise en œuvre de l’option A du cahier des charges v1.1.

| Dossier | Contenu |
| --- | --- |
| `api/` | API REST NestJS 11 et PostgreSQL : session et MFA, menu dynamique, chambres, clients, disponibilités, réservations (recherche, devis, historique, pré-attribution des chambres), planning, réception, facturation (compte du séjour, encaissements, factures et avoirs inaltérables, export comptable), tableau de bord et indicateurs |
| `web/` | Application Next.js 16 : connexion, tableau de bord, réservations, arrivées et départs, planning des chambres, facturation |

## Démarrage rapide avec Docker

```bash
cp .env.example .env
sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/" .env
docker compose up --build -d
docker compose exec api node dist/database/seed.js --demo-day
```

Le fichier `.env` (non versionné) est lu par toutes les commandes `docker compose`. Commandes utiles : `docker compose ps`, `docker compose logs -f api`, `docker compose down` (ajouter `-v` pour effacer la base).

Ouvrez http://localhost:3001 et connectez-vous avec `reception@hotel.local`, `menage@hotel.local` ou `admin@hotel.local` (mot de passe `ChangeMe!2026`). Le compte direction vous guidera pour activer la double authentification.

## Développement

Voir `api/README.md` puis `web/README.md`.

## Tests

- API : `npm run test:e2e` dans `api/` (base PostgreSQL de test).
- Parcours complets dans le navigateur : `python web/e2e/run.py` (pile Docker isolée, voir `web/README.md`).
