const { shopifyApp } = require("@shopify/shopify-app-express");
const { PrismaSessionStorage } = require("@shopify/shopify-app-session-storage-prisma");
const prisma = require("./db");

const sessionStorage = new PrismaSessionStorage(prisma);

// Parse HOST robustly — handle with/without protocol and trailing slash
const rawHost = (process.env.HOST || "").replace(/\/+$/, "");
const hasProtocol = rawHost.includes("://");
const hostScheme = hasProtocol ? rawHost.split("://")[0] : "https";
const hostName = hasProtocol ? rawHost.split("://")[1] : rawHost || "localhost:3000";

const shopify = shopifyApp({
  api: {
    apiKey: process.env.SHOPIFY_API_KEY,
    apiSecretKey: process.env.SHOPIFY_API_SECRET,
    scopes: (process.env.SCOPES || "").split(","),
    hostScheme,
    hostName,
    apiVersion: "2025-04",
  },
  auth: {
    path: "/api/auth",
    callbackPath: "/api/auth/callback",
  },
  webhooks: {
    path: "/api/webhooks",
  },
  isEmbeddedApp: true,
  sessionStorage,
});

module.exports = shopify;
