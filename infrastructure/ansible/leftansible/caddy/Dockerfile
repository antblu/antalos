ARG CADDY_BUILDER_IMAGE
ARG CADDY_RUNTIME_IMAGE
FROM ${CADDY_BUILDER_IMAGE} AS builder

RUN xcaddy build \
    --with github.com/caddy-dns/cloudflare

FROM ${CADDY_RUNTIME_IMAGE}

COPY --from=builder /usr/bin/caddy /usr/bin/caddy
