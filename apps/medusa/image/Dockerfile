ARG NODE_IMAGE_TAG
FROM node:${NODE_IMAGE_TAG} AS build
ARG MEDUSA_VERSION
WORKDIR /app
COPY package.json package-lock.json ./
RUN test "$(node -p 'require("./package.json").dependencies["@medusajs/medusa"]')" = "$MEDUSA_VERSION" \
    && npm ci --no-audit --no-fund
COPY medusa-config.ts tsconfig.json ./
COPY src ./src
RUN JWT_SECRET=build-only COOKIE_SECRET=build-only npm run build

FROM node:${NODE_IMAGE_TAG}
ENV NODE_ENV=production MEDUSA_TELEMETRY_DISABLED=true PORT=9000
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.medusa/server ./
USER node
EXPOSE 9000
CMD ["node", "node_modules/@medusajs/cli/cli.js", "start"]
