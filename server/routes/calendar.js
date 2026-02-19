const express = require("express");
const router = express.Router();
const prisma = require("../db");

// GET /api/calendar — reservations for a date range (for calendar view)
router.get("/", async (req, res) => {
  try {
    const shop = res.locals.shopify.session.shop;
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({ error: "start and end query params required" });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    const items = await prisma.reservationItem.findMany({
      where: {
        reservation: {
          shop,
          status: { in: ["reserved", "confirmed", "picked_up", "overdue"] },
        },
        OR: [
          { startDate: { lte: endDate }, endDate: { gte: startDate } },
        ],
      },
      include: {
        rentalProduct: { select: { title: true, imageUrl: true, shopifyProductId: true } },
        reservation: {
          select: {
            id: true,
            status: true,
            customerName: true,
            shopifyOrderName: true,
          },
        },
      },
      orderBy: { startDate: "asc" },
    });

    // Group by product for timeline view
    const byProduct = {};
    for (const item of items) {
      const pid = item.rentalProduct.shopifyProductId;
      if (!byProduct[pid]) {
        byProduct[pid] = {
          productTitle: item.rentalProduct.title,
          imageUrl: item.rentalProduct.imageUrl,
          items: [],
        };
      }
      byProduct[pid].items.push({
        id: item.id,
        reservationId: item.reservation.id,
        status: item.reservation.status,
        customerName: item.reservation.customerName,
        orderName: item.reservation.shopifyOrderName,
        startDate: item.startDate,
        endDate: item.endDate,
        quantity: item.quantity,
      });
    }

    // Also fetch blackout dates in range
    const blackouts = await prisma.blackoutDate.findMany({
      where: {
        shop,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
    });

    res.json({ products: byProduct, blackouts });
  } catch (err) {
    console.error("GET /api/calendar error:", err);
    res.status(500).json({ error: "Failed to load calendar data" });
  }
});

module.exports = router;
