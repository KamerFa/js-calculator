const express = require("express");
const router = express.Router();
const prisma = require("../db");
const { validateRentalProduct } = require("../helpers/validation");

// GET /api/products — list all rental products for this shop
router.get("/", async (req, res) => {
  try {
    const shop = res.locals.shopify.session.shop;
    const { active, search } = req.query;

    const where = { shop };
    if (active !== undefined) where.active = active === "true";
    if (search) {
      where.title = { contains: search, mode: "insensitive" };
    }

    const products = await prisma.rentalProduct.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { inventoryUnits: true, reservationItems: true } },
      },
    });

    res.json({ products });
  } catch (err) {
    console.error("GET /api/products error:", err);
    res.status(500).json({ error: "Failed to load products" });
  }
});

// GET /api/products/:id — single rental product
router.get("/:id", async (req, res) => {
  try {
    const shop = res.locals.shopify.session.shop;
    const product = await prisma.rentalProduct.findFirst({
      where: { id: req.params.id, shop },
      include: { inventoryUnits: true },
    });

    if (!product) return res.status(404).json({ error: "Not found" });
    res.json({ product });
  } catch (err) {
    console.error("GET /api/products/:id error:", err);
    res.status(500).json({ error: "Failed to load product" });
  }
});

// POST /api/products — create or update a rental product
router.post("/", async (req, res) => {
  try {
    const shop = res.locals.shopify.session.shop;
    const data = req.body;

    const errors = validateRentalProduct(data);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const product = await prisma.rentalProduct.upsert({
      where: {
        shop_shopifyProductId: {
          shop,
          shopifyProductId: data.shopifyProductId,
        },
      },
      create: {
        shop,
        shopifyProductId: data.shopifyProductId,
        shopifyVariantId: data.shopifyVariantId || null,
        title: data.title || "Untitled",
        imageUrl: data.imageUrl || null,
        active: data.active !== false,
        hourlyRate: data.hourlyRate || null,
        dailyRate: data.dailyRate || null,
        weeklyRate: data.weeklyRate || null,
        depositAmount: data.depositAmount || 0,
        quantityTotal: data.quantityTotal || 1,
        minDuration: data.minDuration || 1,
        maxDuration: data.maxDuration || 30,
        durationUnit: data.durationUnit || "days",
        bufferTime: data.bufferTime || 0,
        bufferUnit: data.bufferUnit || "hours",
        notes: data.notes || null,
      },
      update: {
        shopifyVariantId: data.shopifyVariantId,
        title: data.title,
        imageUrl: data.imageUrl,
        active: data.active,
        hourlyRate: data.hourlyRate,
        dailyRate: data.dailyRate,
        weeklyRate: data.weeklyRate,
        depositAmount: data.depositAmount,
        quantityTotal: data.quantityTotal,
        minDuration: data.minDuration,
        maxDuration: data.maxDuration,
        durationUnit: data.durationUnit,
        bufferTime: data.bufferTime,
        bufferUnit: data.bufferUnit,
        notes: data.notes,
      },
    });

    res.json({ product });
  } catch (err) {
    console.error("POST /api/products error:", err);
    res.status(500).json({ error: "Failed to save product" });
  }
});

// PUT /api/products/:id/toggle — toggle active state
router.put("/:id/toggle", async (req, res) => {
  try {
    const shop = res.locals.shopify.session.shop;
    const product = await prisma.rentalProduct.findFirst({
      where: { id: req.params.id, shop },
    });

    if (!product) return res.status(404).json({ error: "Not found" });

    const updated = await prisma.rentalProduct.update({
      where: { id: req.params.id },
      data: { active: !product.active },
    });

    res.json({ product: updated });
  } catch (err) {
    console.error("PUT /api/products/:id/toggle error:", err);
    res.status(500).json({ error: "Failed to toggle product" });
  }
});

// DELETE /api/products/:id — remove rental config
router.delete("/:id", async (req, res) => {
  try {
    const shop = res.locals.shopify.session.shop;
    const product = await prisma.rentalProduct.findFirst({
      where: { id: req.params.id, shop },
    });

    if (!product) return res.status(404).json({ error: "Not found" });

    await prisma.rentalProduct.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/products/:id error:", err);
    res.status(500).json({ error: "Failed to delete product" });
  }
});

// POST /api/products/:id/inventory — add inventory unit
router.post("/:id/inventory", async (req, res) => {
  try {
    const shop = res.locals.shopify.session.shop;
    const product = await prisma.rentalProduct.findFirst({
      where: { id: req.params.id, shop },
    });

    if (!product) return res.status(404).json({ error: "Not found" });

    const unit = await prisma.inventoryUnit.create({
      data: {
        rentalProductId: req.params.id,
        label: req.body.label || `Unit ${Date.now()}`,
        status: "available",
        conditionNotes: req.body.conditionNotes || null,
      },
    });

    res.json({ unit });
  } catch (err) {
    console.error("POST /api/products/:id/inventory error:", err);
    res.status(500).json({ error: "Failed to add inventory unit" });
  }
});

module.exports = router;
