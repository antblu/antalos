#!/bin/sh
set -eu
umask 027

if [ "$1" = prepare-storage ]; then
    # The export must already permit UID/GID 1010; never chown the NFS tree.
    mkdir -p /mnt/mautic/config /mnt/mautic/files /mnt/mautic/images /mnt/mautic/logs
    cp -rn /var/www/html/docroot/media/files/. /mnt/mautic/files/
    cp -rn /var/www/html/docroot/media/images/. /mnt/mautic/images/
    # Keep the image's Sass tooling while giving each pod its own empty cache.
    for directory in dart-sass sass; do
        if [ -d "/var/www/html/var/$directory" ]; then
            cp -rn "/var/www/html/var/$directory" /mnt/runtime/
        fi
    done
    exit 0
fi

mkdir -p /tmp/php.d /tmp/apache2 var/cache var/logs var/tmp
cat > /tmp/php.d/zz-sessions.ini <<EOF
session.save_handler = redis
session.save_path = "tcp://${MAUTIC_REDIS_HOST}:6379?auth=${REDIS_PASSWORD}&database=0&prefix=mautic_session:"
session.cookie_secure = 1
session.cookie_httponly = 1
redis.session.locking_enabled = 1
redis.session.lock_expire = 300
redis.session.lock_retries = 100
redis.session.lock_wait_time = 20000
EOF

case "$1" in
    web)
        exec apache2-foreground
        ;;
    worker)
        # Kubernetes supplies restart supervision and a unique consumer process.
        exec php bin/console messenger:consume email hit --time-limit=3600 --memory-limit=512M --no-interaction
        ;;
    install)
        if [ ! -s config/local.php ]; then
            cp /templates/local.php config/local.php
        fi
        # The installer exits without changing existing users on repeat runs.
        php bin/console mautic:install "$MAUTIC_URL" --no-interaction --force \
            --admin_username=admin --admin_email="$MAUTIC_ADMIN_EMAIL" \
            --admin_firstname=Mautic --admin_lastname=Administrator \
            --admin_password="$MAUTIC_ADMIN_PASSWORD"
        php bin/console doctrine:migrations:migrate --no-interaction
        ;;
    console)
        shift
        exec php bin/console "$@"
        ;;
    *)
        exec "$@"
        ;;
esac
