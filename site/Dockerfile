ARG NODE_IMAGE_TAG
ARG NGINX_IMAGE_TAG
FROM node:${NODE_IMAGE_TAG} AS build

WORKDIR /workspace

COPY site/package.json site/pnpm-lock.yaml site/pnpm-workspace.yaml ./site/
RUN npm install --global pnpm@11.19.0 && cd site && pnpm install --frozen-lockfile

COPY docs ./docs
COPY site ./site
RUN cd site && pnpm run build

FROM nginxinc/nginx-unprivileged:${NGINX_IMAGE_TAG}

LABEL org.opencontainers.image.source="https://github.com/antblu/antalos"
LABEL org.opencontainers.image.description="Antalos documentation built with Astro Starlight"

COPY site/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/site/dist /usr/share/nginx/html

EXPOSE 8080
