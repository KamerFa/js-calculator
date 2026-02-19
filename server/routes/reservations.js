const express = require("express");
const router = express.Router();
const prisma = require("../db");
const { validateReservation, validateStatusTransition } = require("../helpers/validation");
const { calculateRentalPrice, checkAvailability } = require("../helpers/pricing");

// GET /api/reservations — list all reservations
router.get("/", async (req, res) => {
  try {
    const shop = res.locals.shopify.session.shop;
    const { status, search, page = 1, limit = 25 } = req.query;

    const where = { shop };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { customerName: { contains: search, mode: "insensitive" } },
        { customerEmail: { contains: search, mode: "insensitive" } },
        { shopifyOrderName: { contains: search, mode: "insensitive" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [reservations, total] = await Promise.all([
      prisma.reservation.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit),
        include: {
          items: {
            include: { rentalProduct: { select: { title: true, imageUrl: true } } },
          },
        },
      }),
      prisma.reservation.count({ where }),
    ]);

    res.json({ reservations, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error("GET /api/reservations error:", err);
    res.status(500).json({ error: "Failed to load reservations" });
  }
});

// GET /api/reservations/:id — single reservation with full details
router.get("/:id", async (req, res) => {
  try {
    const shop = res.locals.shopify.session.shop;
    const reservation = await prisma.reservation.findFirst({
      where: { id: req.params.id, shop },
      include: {
        items: {
          include: {
            rentalProduct: { select: { title: true, imageUrl: true } },
            inventoryUnit: true,
          },
        },
        statusHistory: { orderBy: { createdAt: "desc" } },
        customer: true,
      },
    });

    if (!reservation) return res.status(404).json({ error: "Not found" });
    res.json({ reservation });
  } catch (err) {
    console.error("GET /api/reservations/:id error:", err);
    res.status(500).json({ error: "Failed to load reservation" });
  }
});

// POST /api/reservations — create a new reservation (admin)
router.post("/", async (req, res) => {
  try {
    const shop = res.locals.shopify.session.shop;
    const data = req.body;

    const errors = validateReservation(data);
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    // Check availability for all items
    for (const item of data.items) {
      const avail = await checkAvailability(prisma, item.rentalProductId, item.startDate, item.endDate);
      if (!avail.available) {
        return res.status(400).json({ error: `Item unavailable: ${avail.reason || "No availability"}` });
      }
    }

    // Calculate prices
    let totalPrice = 0;
    let depositTotal = 0;
    const itemsData = [];

    for (const item of data.items) {
      const product = await prisma.rentalProduct.findUnique({ where: { id: item.rentalProductId } });
      const pricing = calculateRentalPrice(product, item.startDate, item.endDate);
      const qty = item.quantity || 1;

      totalPrice += pricing.price * qty;
      depositTotal += pricing.deposit * qty;

      itemsData.push({
        rentalProductId: item.rentalProductId,
        inventoryUnitId: item.inventoryUnitId || null,
        startDate: new Date(item.startDate),
        endDate: new Date(item.endDate),
        duration: pricing.duration,
        durationUnit: pricing.unit,
        unitPrice: pricing.price,
        linePrice: pricing.price * qty,
        deposit: pricing.deposit * qty,
        quantity: qty,
      });
    }

    const reservation = await prisma.reservation.create({
      data: {
        shop,
        shopifyOrderId: data.shopifyOrderId || null,
        shopifyOrderName: data.shopifyOrderName || null,
        customerName: data.customerName || null,
        customerEmail: data.customerEmail || null,
        customerPhone: data.customerPhone || null,
        status: "reserved",
        totalPrice,
        depositTotal,
        notes: data.notes || null,
        items: { create: itemsData },
        statusHistory: {
          create: { toStatus: "reserved", note: "Reservation created" },
        },
      },
      include: { items: true },
    });

    res.json({ reservation });
  } catch (err) {
    console.error("POST /api/reservations error:", err);
    res.status(500).json({ error: "Failed to create reservation" });
  }
});

// PUT /api/reservations/:id/status — update reservation status
router.put("/:id/status", async (req, res) => {
  try {
    const shop = res.locals.shopify.session.shop;
    const { status, note, conditionOnReturn } = req.body;

    const reservation = await prisma.reservation.findFirst({
      where: { id: req.params.id, shop },
    });

    if (!reservation) return res.status(404).json({ error: "Not found" });

    const transition = validateStatusTransition(reservation.status, status);
    if (!transition.valid) {
      return res.status(400).json({ error: transition.error });
    }

    const updateData = { status };
    if (status === "returned" && conditionOnReturn) {
      updateData.conditionOnReturn = conditionOnReturn;
    }

    const updated = await prisma.reservation.update({
      where: { id: req.params.id },
      data: {
        ...updateData,
        statusHistory: {
          create: {
            fromStatus: reservation.status,
            toStatus: status,
            note: note || null,
          },
        },
      },
      include: {
        items: {
          include: { rentalProduct: { select: { title: true } } },
        },
        statusHistory: { orderBy: { createdAt: "desc" } },
      },
    });

    res.json({ reservation: updated });
  } catch (err) {
    console.error("PUT /api/reservations/:id/status error:", err);
    res.status(500).json({ error: "Failed to update status" });
  }
});

module.exports = router;
