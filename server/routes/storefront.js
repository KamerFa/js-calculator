const express = require("express");
const router = express.Router();
const prisma = require("../db");
const { calculateRentalPrice, checkAvailability } = require("../helpers/pricing");

/**
 * Storefront API routes — accessed via Shopify App Proxy (no session auth).
 * The shop is identified from the Shopify proxy headers.
 */

// GET /api/storefront/product/:shopifyProductId — rental config for a product
router.get("/product/:shopifyProductId", async (req, res) => {
  try {
    const shop = req.query.shop;
    if (!shop) return res.status(400).json({ error: "shop parameter required" });

    const product = await prisma.rentalProduct.findFirst({
      where: {
        shop,
        shopifyProductId: req.params.shopifyProductId,
        active: true,
      },
      select: {
        id: true,
        shopifyProductId: true,
        title: true,
        hourlyRate: true,
        dailyRate: true,
        weeklyRate: true,
        depositAmount: true,
        quantityTotal: true,
        minDuration: true,
        maxDuration: true,
        durationUnit: true,
        bufferTime: true,
        bufferUnit: true,
      },
    });

    if (!product) {
      return res.json({ rentable: false });
    }

    // Get widget settings
    const settings = await prisma.appSettings.findUnique({
      where: { shop },
      select: {
        widgetInheritTheme: true,
        widgetPrimaryColor: true,
        widgetBorderRadius: true,
        businessHoursStart: true,
        businessHoursEnd: true,
        businessDays: true,
      },
    });

    res.json({ rentable: true, product, settings: settings || {} });
  } catch (err) {
    console.error("Storefront product error:", err);
    res.status(500).json({ error: "Failed to load product" });
  }
});

// POST /api/storefront/availability — check availability for dates
router.post("/availability", async (req, res) => {
  try {
    const { rentalProductId, startDate, endDate, shop } = req.body;
    if (!rentalProductId || !startDate || !endDate || !shop) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const availability = await checkAvailability(prisma, rentalProductId, startDate, endDate);
    res.json(availability);
  } catch (err) {
    console.error("Storefront availability error:", err);
    res.status(500).json({ error: "Failed to check availability" });
  }
});

// POST /api/storefront/price — calculate rental price
router.post("/price", async (req, res) => {
  try {
    const { rentalProductId, startDate, endDate } = req.body;
    if (!rentalProductId || !startDate || !endDate) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const product = await prisma.rentalProduct.findUnique({
      where: { id: rentalProductId },
    });

    if (!product || !product.active) {
      return res.status(404).json({ error: "Product not available" });
    }

    const pricing = calculateRentalPrice(product, startDate, endDate);
    res.json(pricing);
  } catch (err) {
    console.error("Storefront price error:", err);
    res.status(500).json({ error: "Failed to calculate price" });
  }
});

// POST /api/storefront/cart — generate cart line item properties for a rental
router.post("/cart", async (req, res) => {
  try {
    const { rentalProductId, startDate, endDate, quantity, shop } = req.body;
    if (!rentalProductId || !startDate || !endDate || !shop) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const product = await prisma.rentalProduct.findUnique({
      where: { id: rentalProductId },
    });

    if (!product || !product.active) {
      return res.status(404).json({ error: "Product not available" });
    }

    // Check availability
    const avail = await checkAvailability(prisma, rentalProductId, startDate, endDate);
    const qty = quantity || 1;
    if (!avail.available || avail.availableQty < qty) {
      return res.status(400).json({ error: "Not enough availability for selected dates" });
    }

    const pricing = calculateRentalPrice(product, startDate, endDate);

    // Create reservation
    const reservation = await prisma.reservation.create({
      data: {
        shop,
        status: "reserved",
        totalPrice: pricing.price * qty,
        depositTotal: pricing.deposit * qty,
        items: {
          create: {
            rentalProductId: product.id,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            duration: pricing.duration,
            durationUnit: pricing.unit,
            unitPrice: pricing.price,
            linePrice: pricing.price * qty,
            deposit: pricing.deposit * qty,
            quantity: qty,
          },
        },
        statusHistory: {
          create: { toStatus: "reserved", note: "Created from storefront" },
        },
      },
    });

    // Return line item properties to add to cart
    const lineItemProperties = {
      _rental_reservation_id: reservation.id,
      _rental_start_date: startDate,
      _rental_end_date: endDate,
      _rental_duration: `${pricing.duration} ${pricing.unit}`,
      _rental_unit_price: pricing.price.toFixed(2),
      _rental_deposit: pricing.deposit.toFixed(2),
      "Rental Start": new Date(startDate).toLocaleDateString(),
      "Rental End": new Date(endDate).toLocaleDateString(),
      "Rental Duration": `${pricing.duration} ${pricing.unit}`,
    };

    res.json({
      success: true,
      reservationId: reservation.id,
      variantId: product.shopifyVariantId || product.shopifyProductId,
      quantity: qty,
      properties: lineItemProperties,
      price: pricing.price * qty,
      deposit: pricing.deposit * qty,
    });
  } catch (err) {
    console.error("Storefront cart error:", err);
    res.status(500).json({ error: "Failed to process rental" });
  }
});

module.exports = router;
