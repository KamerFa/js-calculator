/**
 * Server entry point — mirrors the official Shopify Node.js app template.
 * https://github.com/Shopify/shopify-app-template-node
 */
const fs = require("fs");
const path = require("path");
const express = require("express");
const compression = require("compression");
const morgan = require("morgan");

const shopify = require("./shopify");

const dashboardRoutes = require("./routes/dashboard");
const productRoutes = require("./routes/products");
const reservationRoutes = require("./routes/reservations");
const calendarRoutes = require("./routes/calendar");
const settingsRoutes = require("./routes/settings");
const storefrontRoutes = require("./routes/storefront");
const gdprRoutes = require("./routes/gdpr");

const PORT = parseInt(process.env.PORT || "3000", 10);
const isProd = process.env.NODE_ENV === "production";
const STATIC_PATH = path.join(__dirname, "../web/dist");

const app = express();

app.use(morgan(isProd ? "combined" : "dev"));
app.use(compression());

// ── 1. Shopify auth & webhook routes (before body parsers) ──────────────────
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

// ── 2. Body parsing (after webhook route which needs raw body) ──────────────
app.use(express.json());

// ── 3. Public API routes (no session auth) ──────────────────────────────────
app.use("/api/webhooks/gdpr", gdprRoutes);
app.use("/api/storefront", storefrontRoutes);

// ── 4. Authenticated admin API routes ───────────────────────────────────────
// validateAuthenticatedSession checks the Bearer session-token that
// App Bridge automatically adds to every fetch() call.
const verifyRequest = shopify.validateAuthenticatedSession();
app.use("/api/dashboard", verifyRequest, dashboardRoutes);
app.use("/api/products", verifyRequest, productRoutes);
app.use("/api/reservations", verifyRequest, reservationRoutes);
app.use("/api/calendar", verifyRequest, calendarRoutes);
app.use("/api/settings", verifyRequest, settingsRoutes);

// ── 5. Frontend — exactly like the official Shopify Node template ───────────
// a) CSP headers (frame-ancestors) so the iframe is allowed
app.use(shopify.cspHeaders());

// b) Static assets (JS, CSS, images) — but NOT index.html
if (isProd) {
  app.use(express.static(STATIC_PATH, { index: false }));
}

// c) SPA catch-all: ensure the app is installed, then serve the shell HTML.
//    On first install the OAuth flow runs at the TOP level (not in an iframe),
//    so the redirect chain works normally.  After that the offline session
//    persists and ensureInstalledOnShop() just calls next().
app.use("/*", shopify.ensureInstalledOnShop(), async (_req, res, _next) => {
  if (isProd) {
    return res
      .status(200)
      .set("Content-Type", "text/html")
      .send(fs.readFileSync(path.join(STATIC_PATH, "index.html")));
  }

  // Dev mode — Vite dev server handles the frontend
  const apiKey = process.env.SHOPIFY_API_KEY || "";
  return res
    .status(200)
    .set("Content-Type", "text/html")
    .send(`<!DOCTYPE html>
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

app.listen(PORT, () => {
  console.log(`Rental app server running on port ${PORT}`);
});
