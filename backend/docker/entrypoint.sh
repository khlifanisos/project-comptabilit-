#!/bin/sh
set -e
cd /var/www/html

# Volumes start empty on first run: make sure Laravel's writable dirs exist
mkdir -p storage/app/public storage/framework/cache/data storage/framework/sessions \
         storage/framework/views storage/logs bootstrap/cache public/uploads/avatars
chown -R www-data:www-data storage bootstrap/cache public/uploads

php artisan package:discover --ansi
php artisan storage:link --force >/dev/null 2>&1 || true
php artisan config:cache
php artisan route:cache
php artisan view:cache

if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  php artisan migrate --force
fi

exec "$@"
