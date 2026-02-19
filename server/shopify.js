const { shopifyApp } = require("@shopify/shopify-app-express");
const { PrismaSessionStorage } = require("@shopify/shopify-app-session-storage-prisma");
const prisma = require("./db");

const sessionStorage = new PrismaSessionStorage(prisma);

const shopify = shopifyApp({
  api: {
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    scopes: (process.env.SCOPES || "").split(","),
    hostScheme: process.env.HOST?.split("://")[0] || "https",
    hostName: process.env.HOST?.replace(/https?:\/\//, "") || "localhost:3000",
  },
  auth: {
    path: "/api/auth",
    callbackPath: "/api/auth/callback",
  },
  webhooks: {
    path: "/api/webhooks",
  },
  sessionStorage,
});

module.exports = shopify;
