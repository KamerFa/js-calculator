const express = require("express");
const fs = require("fs");
const compression = require("compression");
const helmet = require("helmet");
const morgan = require("morgan");
const path = require("path");

const shopify = require("./shopify");
const { verifyRequest } = require("./middleware/auth");

const dashboardRoutes = require("./routes/dashboard");
const productRoutes = require("./routes/products");
const reservationRoutes = require("./routes/reservations");
const calendarRoutes = require("./routes/calendar");
const settingsRoutes = require("./routes/settings");
const storefrontRoutes = require("./routes/storefront");
const gdprRoutes = require("./routes/gdpr");

const PORT = parseInt(process.env.PORT || "3000", 10);
const isProd = process.env.NODE_ENV === "production";

const app = express();

// Logging
app.use(morgan(isProd ? "combined" : "dev"));

// Shopify auth routes (must come before body parsers for webhooks)
app.get(shopify.config.auth.path, shopify.auth.begin());
app.get(
  shopify.config.auth.callbackPath,
  shopify.auth.callback(),
  shopify.redirectToShopifyOrAppRoot()
);
app.post(
  shopify.config.webhooks.path,
  shopify.processWebhooks({ webhookHandlers: {} })
);

// Body parsing (after webhook route which needs raw body)
app.use(express.json());

// Security headers (relaxed for Shopify iframe embedding)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    frameguard: false, // Allow Shopify admin to embed app in iframe
  })
);

app.use(compression());

// GDPR webhooks (no session auth, verified by Shopify HMAC via webhook middleware)
app.use("/api/webhooks/gdpr", gdprRoutes);

// Storefront API (App Proxy — no session auth, public access)
app.use("/api/storefront", storefrontRoutes);

// Authenticated admin API routes
app.use("/api/dashboard", verifyRequest, dashboardRoutes);
app.use("/api/products", verifyRequest, productRoutes);
app.use("/api/reservations", verifyRequest, reservationRoutes);
app.use("/api/calendar", verifyRequest, calendarRoutes);
app.use("/api/settings", verifyRequest, settingsRoutes);

// Serve frontend static assets in production (JS, CSS, images — NOT index.html)
if (isProd) {
  app.use(express.static(path.join(__dirname, "../web/dist"), { index: false }));
}

// Pre-read and cache the production HTML at startup so every request doesn't hit disk
let prodHtml = null;
if (isProd) {
  try {
    const htmlPath = path.join(__dirname, "../web/dist/index.html");
    const apiKey = process.env.SHOPIFY_API_KEY || "";
    const rawHtml = fs.readFileSync(htmlPath, "utf-8");
    prodHtml = rawHtml
      .replace(/%SHOPIFY_API_KEY%/g, apiKey)
      .replace(/content=""(\s*\/>)\s*<!--\s*shopify-api-key\s*-->/i, `content="${apiKey}"$1`);
    console.log(`Loaded production HTML (${prodHtml.length} bytes), API key injected: ${apiKey ? "yes" : "NO — SHOPIFY_API_KEY is not set!"}`);
  } catch (err) {
    console.error("FATAL: Could not read web/dist/index.html —", err.message);
    console.error("Did the frontend build run? Check your build command.");
  }
}

// All other routes: serve the embedded app shell (SPA fallback)
// NOTE: We intentionally do NOT use ensureInstalledOnShop() here.
// That middleware tries server-side auth redirects (/exitiframe → /api/auth
// → accounts.shopify.com) which cannot work inside an iframe due to
// cross-origin and frame-ancestors CSP restrictions.
// Instead, App Bridge v4 CDN handles authentication entirely client-side
// via session tokens + postMessage to Shopify admin.  API routes are still
// protected by validateAuthenticatedSession (verifyRequest).
app.use("/*", async (req, res, next) => {
  try {
    // Allow Shopify admin to embed this app in an iframe.
    // All sensitive data is behind authenticated API routes (verifyRequest).
    res.setHeader(
      "Content-Security-Policy",
      "frame-ancestors https://*.myshopify.com https://admin.shopify.com https://*.spin.dev;"
    );

    if (isProd) {
      if (!prodHtml) {
        return res.status(500).send("App HTML not found. The frontend build may have failed.");
      }
      res.set("Content-Type", "text/html");
      return res.send(prodHtml);
    }

    // In dev, serve a minimal HTML that loads the dev frontend
    const apiKey = process.env.SHOPIFY_API_KEY || "";
    res.set("Content-Type", "text/html");
    res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="shopify-api-key" content="${apiKey}" />
  <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js"></script>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/frontend/main.jsx"></script>
</body>
</html>`);
  } catch (err) {
    console.error("Error serving app shell:", err);
    next(err);
  }
});

// Global error handler — catches unhandled errors from middleware
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(err.statusCode || 500).json({
    error: isProd ? "Internal server error" : err.message,
  });
});

app.listen(PORT, () => {
  console.log(`Rental app server running on port ${PORT}`);
});
