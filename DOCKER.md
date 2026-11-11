# Running with Docker

Three containers: `web` (Nginx + built React app), `backend` (Laravel on PHP-FPM 8.4), `db` (MySQL 8.4).
Nginx serves the app and forwards `/api` to Laravel, so everything is on one origin (no CORS).

## First run
```bash
cp .env.docker.example .env.docker      # fill in APP_KEY, passwords, mail keys
docker compose up -d --build            # migrations run automatically on start
docker compose exec backend php artisan db:seed --force   # optional demo accounts (NOT in production)
```
Open http://localhost:8080 (change the port with `WEB_PORT=9000 docker compose up -d`).

## Everyday commands
| Task | Command |
|---|---|
| Rebuild after code changes | `docker compose up -d --build` |
| Logs | `docker compose logs -f backend` |
| Artisan | `docker compose exec backend php artisan <cmd>` |
| MySQL shell | `docker compose exec db mysql -u comptabilite -p comptabilite_db` |
| Import an SQL dump | `docker compose exec -T db mysql -u root -p"<root pw>" comptabilite_db < dump.sql` |
| Stop | `docker compose down` (data kept) |
| Stop **and delete all data** | `docker compose down -v` |

## Data
Persistent volumes: `db-data` (MySQL), `backend-storage` (uploaded files in `storage/`), `avatars` (`public/uploads`).
Back these up in production.
