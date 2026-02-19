const express = require("express");
const router = express.Router();
const prisma = require("../db");

// GET /api/settings — load shop settings
router.get("/", async (req, res) => {
  try {
    const shop = res.locals.shopify.session.shop;

    let settings = await prisma.appSettings.findUnique({ where: { shop } });

    // Create defaults if not yet configured
    if (!settings) {
      settings = await prisma.appSettings.create({
        data: { shop },
      });
    }

    // Also fetch blackout dates
    const blackoutDates = await prisma.blackoutDate.findMany({
      where: { shop },
      orderBy: { startDate: "asc" },
    });

    res.json({ settings, blackoutDates });
  } catch (err) {
    console.error("GET /api/settings error:", err);
    res.status(500).json({ error: "Failed to load settings" });
  }
});

// PUT /api/settings — update shop settings
router.put("/", async (req, res) => {
  try {
    const shop = res.locals.shopify.session.shop;
    const data = req.body;

    const settings = await prisma.appSettings.upsert({
      where: { shop },
      create: { shop, ...data },
      update: data,
    });

    res.json({ settings });
  } catch (err) {
    console.error("PUT /api/settings error:", err);
    res.status(500).json({ error: "Failed to save settings" });
  }
});

// POST /api/settings/blackout — add a blackout date
router.post("/blackout", async (req, res) => {
  try {
    const shop = res.locals.shopify.session.shop;
    const { startDate, endDate, reason } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate are required" });
    }

    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({ error: "startDate must be before endDate" });
    }

    const blackout = await prisma.blackoutDate.create({
      data: {
        shop,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason: reason || null,
      },
    });

    res.json({ blackout });
  } catch (err) {
    console.error("POST /api/settings/blackout error:", err);
    res.status(500).json({ error: "Failed to add blackout date" });
  }
});

// DELETE /api/settings/blackout/:id — remove a blackout date
router.delete("/blackout/:id", async (req, res) => {
  try {
    const shop = res.locals.shopify.session.shop;
    const blackout = await prisma.blackoutDate.findFirst({
      where: { id: req.params.id, shop },
    });

    if (!blackout) return res.status(404).json({ error: "Not found" });

    await prisma.blackoutDate.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/settings/blackout/:id error:", err);
    res.status(500).json({ error: "Failed to delete blackout date" });
  }
});

module.exports = router;
