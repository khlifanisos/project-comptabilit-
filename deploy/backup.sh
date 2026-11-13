#!/bin/sh
# Daily backup: MySQL dump + uploaded files. Keeps the last 14 days.
# Install on the server:  crontab -e  ->  30 2 * * * /opt/app/deploy/backup.sh >> /var/log/app-backup.log 2>&1
set -e
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/comptabilite}"
STAMP="$(date +%Y-%m-%d_%H%M)"
COMPOSE="docker compose -f $APP_DIR/docker-compose.yml -f $APP_DIR/docker-compose.prod.yml"

mkdir -p "$BACKUP_DIR"
cd "$APP_DIR"

$COMPOSE exec -T db sh -c 'mysqldump --single-transaction --routines -u root -p"$MYSQL_ROOT_PASSWORD" "$MYSQL_DATABASE"' \
  | gzip > "$BACKUP_DIR/db_$STAMP.sql.gz"

$COMPOSE exec -T backend tar czf - -C /var/www/html storage/app public/uploads \
  > "$BACKUP_DIR/files_$STAMP.tar.gz"

find "$BACKUP_DIR" -type f -mtime +14 -delete
echo "$(date) backup ok -> $BACKUP_DIR"
