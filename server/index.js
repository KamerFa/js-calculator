/**
 * Server entry point.
 *
 * Auth strategy: App Bridge v4 CDN handles authentication entirely
 * client-side via postMessage with Shopify admin. The server never
 * redirects to accounts.shopify.com (which can't render in an iframe).
 * API routes are protected by validateAuthenticatedSession() which
 * verifies the Bearer session-token that App Bridge adds to fetch().
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
const verifyRequest = shopify.validateAuthenticatedSession();
app.use("/api/dashboard", verifyRequest, dashboardRoutes);
app.use("/api/products", verifyRequest, productRoutes);
app.use("/api/reservations", verifyRequest, reservationRoutes);
app.use("/api/calendar", verifyRequest, calendarRoutes);
app.use("/api/settings", verifyRequest, settingsRoutes);

// ── 5. Diagnostic endpoint (no auth — helps debug deploy issues) ────────────
app.get("/api/health", (_req, res) => {
  const apiKey = process.env.SHOPIFY_API_KEY || "";
  res.json({
    status: "ok",
    apiKeySet: apiKey.length > 0,
    apiKeyPrefix: apiKey.substring(0, 4) + "...",
    host: process.env.HOST || "(not set)",
    scopes: process.env.SCOPES || "(not set)",
    nodeEnv: process.env.NODE_ENV || "(not set)",
  });
});

// ── 6. Frontend ─────────────────────────────────────────────────────────────
// CSP headers: frame-ancestors allows Shopify admin to embed this app
app.use(shopify.cspHeaders());

// Static assets (JS, CSS, images) — NOT index.html
if (isProd) {
  app.use(express.static(STATIC_PATH, { index: false }));
}

// Pre-read production HTML at startup, inject API key as fallback
// (Vite should replace %SHOPIFY_API_KEY% at build time, but if the env
// var wasn't available during the Render build, we patch it here.)
let prodHtml = null;
if (isProd) {
  try {
    const htmlPath = path.join(STATIC_PATH, "index.html");
    const apiKey = process.env.SHOPIFY_API_KEY || "";
    const raw = fs.readFileSync(htmlPath, "utf-8");

    // If Vite already replaced the key, these regexes are harmless no-ops
    prodHtml = raw.replace(/%SHOPIFY_API_KEY%/g, apiKey);

    console.log(
      `Production HTML loaded (${prodHtml.length} bytes). ` +
      `API key in meta tag: ${prodHtml.includes(`content="${apiKey}"`) && apiKey ? "YES" : "CHECK — key may be missing"}`
    );
  } catch (err) {
    console.error("Could not read web/dist/index.html:", err.message);
  }
}

// SPA catch-all — NO ensureInstalledOnShop() because that middleware
// tries server-side redirects to accounts.shopify.com which CANNOT
// render inside an iframe.  App Bridge v4 CDN handles auth client-side.
app.use("/*", async (req, res) => {
  // Set frame-ancestors for this specific request (the cspHeaders()
  // middleware above may have already set it, but we ensure it here
  // for the HTML document response specifically).
  const shop = req.query.shop;
  if (shop) {
    res.setHeader(
      "Content-Security-Policy",
      `frame-ancestors https://${shop} https://admin.shopify.com https://*.spin.dev;`
    );
  } else {
    res.setHeader(
      "Content-Security-Policy",
      "frame-ancestors https://*.myshopify.com https://admin.shopify.com https://*.spin.dev;"
    );
  }

  if (isProd) {
    if (!prodHtml) {
      return res.status(500).send("App HTML not found — frontend build may have failed.");
    }
    return res.status(200).set("Content-Type", "text/html").send(prodHtml);
  }

  // Dev mode
  const apiKey = process.env.SHOPIFY_API_KEY || "";
  return res.status(200).set("Content-Type", "text/html").send(`<!DOCTYPE html>
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
