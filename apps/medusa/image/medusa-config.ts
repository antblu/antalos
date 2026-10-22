import { defineConfig } from "@medusajs/framework/utils"

const redisUrl = process.env.REDIS_URL
const redisOptions = {
  sentinels: (process.env.REDIS_SENTINELS || "").split(",").filter(Boolean)
    .map((host) => ({ host, port: 26379 })),
  name: "medusa",
  password: process.env.REDIS_PASSWORD,
  sentinelPassword: process.env.REDIS_PASSWORD,
  // Reconnect on Sentinel promotion even when the old TCP socket stays open.
  failoverDetector: true,
  maxRetriesPerRequest: null,
}

module.exports = defineConfig({
  admin: { disable: process.env.DISABLE_MEDUSA_ADMIN === "true" },
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    databaseDriverOptions: { connection: { ssl: false } },
    workerMode: (process.env.MEDUSA_WORKER_MODE || "server") as "server" | "worker",
    redisUrl,
    redisOptions,
    http: {
      storeCors: process.env.STORE_CORS || "",
      adminCors: process.env.ADMIN_CORS || "",
      authCors: process.env.AUTH_CORS || "",
      jwtSecret: process.env.JWT_SECRET!,
      cookieSecret: process.env.COOKIE_SECRET!,
      authMethodsPerActor: {
        user: ["emailpass", "antid"],
        customer: ["emailpass"],
      },
    },
  },
  modules: [
    // Auth still consumes the legacy cache interface for OAuth state. Keep it
    // shared through Sentinel so initiation and callback can hit different pods.
    { resolve: "@medusajs/medusa/cache-redis", options: { redisUrl, redisOptions } },
    {
      resolve: "@medusajs/medusa/auth",
      dependencies: ["cache", "logger"],
      options: {
        providers: [
          { resolve: "@medusajs/medusa/auth-emailpass", id: "emailpass" },
          {
            resolve: "./src/modules/antid",
            id: "antid",
            options: {
              display_name: process.env.OIDC_DISPLAY_NAME,
              issuer: process.env.OIDC_ISSUER,
              client_id: process.env.OIDC_CLIENT_ID,
              client_secret: process.env.OIDC_CLIENT_SECRET,
              callback_url: process.env.OIDC_CALLBACK_URL,
              require_verified_email: process.env.OIDC_REQUIRE_VERIFIED_EMAIL !== "false",
            },
          },
        ],
      },
    },
    { resolve: "@medusajs/medusa/caching", options: { providers: [
      { resolve: "@medusajs/caching-redis", id: "caching-redis", is_default: true,
        options: { redisUrl, redisOptions } },
    ] } },
    { resolve: "@medusajs/medusa/event-bus-redis", options: { redisUrl, redisOptions } },
    { resolve: "@medusajs/medusa/workflow-engine-redis",
      options: { redis: { redisUrl, redisOptions } } },
    { resolve: "@medusajs/medusa/locking", options: { providers: [
      { resolve: "@medusajs/medusa/locking-redis", id: "locking-redis", is_default: true,
        options: { redisUrl, redisOptions } },
    ] } },
    { resolve: "@medusajs/medusa/file", options: { providers: [
      { resolve: "@medusajs/medusa/file-s3", id: "s3", options: {
        file_url: process.env.S3_FILE_URL,
        access_key_id: process.env.S3_ACCESS_KEY_ID,
        secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
        region: process.env.S3_REGION,
        bucket: process.env.S3_BUCKET,
        endpoint: process.env.S3_ENDPOINT,
        acl: false,
        additional_client_config: { forcePathStyle: true },
      } },
    ] } },
  ],
})
