# Laravel API — PHP-FPM. Nginx (in the frontend image) forwards /api to this container on port 9000.
FROM php:8.4-fpm-bookworm

# PHP extensions: pdo_mysql (DB), gd (dompdf images), zip/xml (phpspreadsheet), intl, bcmath, opcache
COPY --from=mlocati/php-extension-installer:2 /usr/bin/install-php-extensions /usr/local/bin/
RUN install-php-extensions pdo_mysql gd zip intl bcmath exif opcache \
 && apt-get update && apt-get install -y --no-install-recommends unzip \
 && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2.8 /usr/bin/composer /usr/bin/composer
COPY docker/php.ini /usr/local/etc/php/conf.d/zz-app.ini

WORKDIR /var/www/html

# Install dependencies first so this layer is cached when only app code changes
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction

COPY . .
RUN composer dump-autoload --optimize --no-dev \
 && sed -i 's/\r$//' docker/entrypoint.sh && chmod +x docker/entrypoint.sh \
 && chown -R www-data:www-data storage bootstrap/cache public/uploads

ENTRYPOINT ["/var/www/html/docker/entrypoint.sh"]
CMD ["php-fpm"]
