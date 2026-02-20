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

// Serve frontend in production
if (isProd) {
  app.use(express.static(path.join(__dirname, "../web/dist")));
}

// All other routes: serve the embedded app shell (SPA fallback)
app.use("/*", shopify.ensureInstalledOnShop(), async (_req, res) => {
  const apiKey = process.env.SHOPIFY_API_KEY || "";

  if (isProd) {
    // Inject SHOPIFY_API_KEY at runtime so the build doesn't need it baked in
    const htmlPath = path.join(__dirname, "../web/dist/index.html");
    const rawHtml = fs.readFileSync(htmlPath, "utf-8");
    const html = rawHtml
      .replace(/%SHOPIFY_API_KEY%/g, apiKey)
      .replace(/content=""(\s*\/>)\s*<!--\s*shopify-api-key\s*-->/i, `content="${apiKey}"$1`);
    res.set("Content-Type", "text/html");
    return res.send(html);
  }

  // In dev, serve a minimal HTML that loads the dev frontend
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
