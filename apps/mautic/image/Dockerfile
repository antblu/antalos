ARG MAUTIC_BASE_IMAGE_TAG
FROM mautic/mautic:${MAUTIC_BASE_IMAGE_TAG}

USER root
ARG PHPREDIS_VERSION
RUN apt-get update \
    && apt-get install -y --no-install-recommends $PHPIZE_DEPS \
    && pecl install redis-${PHPREDIS_VERSION} \
    && docker-php-ext-enable redis \
    && rm -rf /var/lib/apt/lists/* /tmp/pear \
    && groupmod -g 1010 www-data \
    && usermod -d /nonexistent www-data \
    && usermod -u 1010 -g 1010 www-data \
    && usermod -d /var/www www-data \
    && chown -R 1010:1010 /var/www/html/config /var/www/html/var /var/www/html/docroot/media \
    && sed -i 's/Listen 80/Listen 8080/' /etc/apache2/ports.conf \
    && sed -i 's/:80>/:8080>/' /etc/apache2/sites-available/000-default.conf

COPY --chmod=755 entrypoint.sh /usr/local/bin/antalos-mautic
ENV APACHE_RUN_DIR=/tmp/apache2 \
    APACHE_LOCK_DIR=/tmp/apache2 \
    APACHE_PID_FILE=/tmp/apache2/apache2.pid \
    PHP_INI_SCAN_DIR=/usr/local/etc/php/conf.d:/tmp/php.d
USER 1010:1010
WORKDIR /var/www/html
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/antalos-mautic"]
CMD ["web"]
