ARG DRUPAL_BASE_IMAGE_TAG
FROM docker.io/library/drupal:${DRUPAL_BASE_IMAGE_TAG}

LABEL org.opencontainers.image.source="https://github.com/antblu/antalos"

ARG DRUPAL_OPENID_CONNECT_VERSION
RUN composer require --no-interaction --no-progress --update-no-dev \
    "drupal/openid_connect:${DRUPAL_OPENID_CONNECT_VERSION}" \
    && composer update 'symfony/*' --with-dependencies --no-dev --no-interaction --no-progress \
    && composer audit --no-dev \
    && composer clear-cache

COPY antalos_blog/antalos_blog.info.yml.in /opt/drupal/web/modules/custom/antalos_blog/antalos_blog.info.yml
COPY antalos_blog/antalos_blog.module /opt/drupal/web/modules/custom/antalos_blog/antalos_blog.module
COPY configure.php /usr/local/share/drupal/configure.php
COPY welcome.html /usr/local/share/drupal/welcome.html
