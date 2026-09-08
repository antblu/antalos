ARG PHP_BASE_IMAGE
FROM ${PHP_BASE_IMAGE}

ARG SUITECRM_VERSION
ARG SUITECRM_RELEASE_SHA256

LABEL org.opencontainers.image.title="SuiteCRM"
LABEL org.opencontainers.image.description="SuiteCRM packaged from the official upstream release"
LABEL org.opencontainers.image.source="https://github.com/antblu/antalos"
LABEL org.opencontainers.image.url="https://suitecrm.com"
LABEL org.opencontainers.image.licenses="AGPL-3.0-only"
LABEL org.opencontainers.image.version="${SUITECRM_VERSION}"

RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        libfreetype6-dev \
        libicu-dev \
        libjpeg62-turbo-dev \
        libc-client2007e-dev \
        libkrb5-dev \
        libonig-dev \
        libpng-dev \
        libxml2-dev \
        libzip-dev \
        unzip; \
    docker-php-ext-configure gd --with-freetype --with-jpeg; \
    docker-php-ext-configure imap --with-imap-ssl --with-kerberos; \
    docker-php-ext-install -j"$(nproc)" \
        bcmath \
        exif \
        gd \
        imap \
        intl \
        mbstring \
        mysqli \
        opcache \
        pdo_mysql \
        soap \
        zip; \
    a2enmod expires headers rewrite; \
    curl -fL --retry 3 \
        -o /tmp/suitecrm.zip \
        "https://github.com/SuiteCRM/SuiteCRM-Core/releases/download/v${SUITECRM_VERSION}/SuiteCRM-${SUITECRM_VERSION}.zip"; \
    echo "${SUITECRM_RELEASE_SHA256}  /tmp/suitecrm.zip" | sha256sum -c -; \
    rm -rf /var/www/html/*; \
    unzip -q /tmp/suitecrm.zip -d /var/www/html; \
    rm /tmp/suitecrm.zip; \
    groupmod --gid 82 www-data; \
    usermod --uid 82 --gid 82 www-data; \
    chown -R www-data:www-data /var/www/html; \
    mkdir -p /var/lock/apache2 /var/run/apache2; \
    chown -R www-data:www-data /var/lock/apache2 /var/run/apache2; \
    rm -rf /var/lib/apt/lists/*

COPY apache-suitecrm.conf /etc/apache2/sites-available/000-default.conf
COPY suitecrm.ini /usr/local/etc/php/conf.d/suitecrm.ini

RUN sed -i 's/^Listen 80$/Listen 8080/' /etc/apache2/ports.conf

WORKDIR /var/www/html

EXPOSE 8080

USER www-data

CMD ["apache2-foreground"]
