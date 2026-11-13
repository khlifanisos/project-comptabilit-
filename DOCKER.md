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

## Production on an OVH VPS (with your domain)

**1. DNS (OVH Control Panel > Web Cloud > Domains > DNS zone)**
Add `A` records for `@` and `www` pointing to the VPS IPv4 (plus `AAAA` for IPv6 if you use it).
Delete the default OVH records that point to OVH's parking page.

**2. Server (Ubuntu 24.04 / Debian 12), as root or with sudo**
```bash
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable
git clone <repo-url> /opt/app && cd /opt/app
cp .env.docker.example .env.docker && nano .env.docker
```
In `.env.docker` set:
`APP_URL`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS` = `https://your-domain.com`;
`SANCTUM_STATEFUL_DOMAINS=your-domain.com`; `DOMAIN`, `ACME_EMAIL`; `SESSION_SECURE_COOKIE=true`;
strong DB passwords; mail and API keys; then generate `APP_KEY`.

**3. Start**
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```
Caddy gets the HTTPS certificate on its own (the DNS must already point to the server).
Never run `db:seed` in production (it creates demo accounts).

**4. Update after a `git pull`**: run the same `up -d --build` command. Migrations run automatically.

**5. Backups**: `chmod +x deploy/backup.sh`, then add it to `crontab -e`:
`30 2 * * * /opt/app/deploy/backup.sh >> /var/log/app-backup.log 2>&1`
Copy `/var/backups/comptabilite` off the server from time to time (OVH Object Storage or your PC).
