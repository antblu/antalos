ARG DRUPAL_BASE_IMAGE_TAG
ARG DRUPAL_NODE_IMAGE_TAG
FROM docker.io/library/node:${DRUPAL_NODE_IMAGE_TAG} AS journal-build

ARG DRUPAL_REACT_VERSION
ARG DRUPAL_REACT_DOM_VERSION
ARG DRUPAL_ESBUILD_VERSION
WORKDIR /build
COPY antalos_journal/src/ ./src/
RUN npm install --no-save --package-lock=false --no-audit --no-fund \
    "react@${DRUPAL_REACT_VERSION}" "react-dom@${DRUPAL_REACT_DOM_VERSION}" "esbuild@${DRUPAL_ESBUILD_VERSION}" \
    && ./node_modules/.bin/esbuild src/journal.jsx --bundle --minify --format=iife \
      --target=es2020 --define:process.env.NODE_ENV='"production"' \
      --legal-comments=linked --outfile=dist/journal.js

FROM docker.io/library/drupal:${DRUPAL_BASE_IMAGE_TAG}

LABEL org.opencontainers.image.source="https://github.com/antblu/antalos"

ARG DRUPAL_OPENID_CONNECT_VERSION
RUN composer require --no-interaction --no-progress --update-no-dev \
    "drupal/openid_connect:${DRUPAL_OPENID_CONNECT_VERSION}" \
    && composer update 'symfony/*' --with-dependencies --no-dev --no-interaction --no-progress \
    && composer audit --no-dev \
    && composer clear-cache

COPY antalos_blog/ /opt/drupal/web/modules/custom/antalos_blog/
COPY antalos_journal/ /opt/drupal/web/themes/custom/antalos_journal/
COPY --from=journal-build /build/dist/ /opt/drupal/web/themes/custom/antalos_journal/dist/
RUN mv /opt/drupal/web/modules/custom/antalos_blog/antalos_blog.info.yml.in /opt/drupal/web/modules/custom/antalos_blog/antalos_blog.info.yml \
    && mv /opt/drupal/web/modules/custom/antalos_blog/antalos_blog.routing.yml.in /opt/drupal/web/modules/custom/antalos_blog/antalos_blog.routing.yml \
    && mv /opt/drupal/web/themes/custom/antalos_journal/antalos_journal.info.yml.in /opt/drupal/web/themes/custom/antalos_journal/antalos_journal.info.yml \
    && mv /opt/drupal/web/themes/custom/antalos_journal/antalos_journal.libraries.yml.in /opt/drupal/web/themes/custom/antalos_journal/antalos_journal.libraries.yml
COPY configure.php /usr/local/share/drupal/configure.php
COPY configure-theme.php /usr/local/share/drupal/configure-theme.php
COPY welcome.html /usr/local/share/drupal/welcome.html
