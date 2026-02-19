const express = require("express");
const router = express.Router();
const prisma = require("../db");

// GET /api/dashboard — dashboard stats for today
router.get("/", async (req, res) => {
  try {
    const shop = res.locals.shopify.session.shop;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      todaysPickups,
      activeRentals,
      returnsDue,
      overdueItems,
      recentReservations,
      totalReservations,
      totalProducts,
    ] = await Promise.all([
      // Today's pickups: confirmed reservations with items starting today
      prisma.reservation.findMany({
        where: {
          shop,
          status: "confirmed",
          items: {
            some: {
              startDate: { gte: today, lt: tomorrow },
            },
          },
        },
        include: {
          items: {
            include: { rentalProduct: { select: { title: true, imageUrl: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
      }),

      // Active rentals: picked_up status
      prisma.reservation.count({
        where: { shop, status: "picked_up" },
      }),

      // Returns due today: picked_up with items ending today
      prisma.reservation.findMany({
        where: {
          shop,
          status: "picked_up",
          items: {
            some: {
              endDate: { gte: today, lt: tomorrow },
            },
          },
        },
        include: {
          items: {
            include: { rentalProduct: { select: { title: true, imageUrl: true } } },
          },
        },
        orderBy: { createdAt: "desc" },
      }),

      // Overdue items
      prisma.reservation.count({
        where: { shop, status: "overdue" },
      }),

      // Recent reservations (last 10)
      prisma.reservation.findMany({
        where: { shop },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          items: {
            include: { rentalProduct: { select: { title: true } } },
          },
        },
      }),

      // Total reservations
      prisma.reservation.count({ where: { shop } }),

      // Total rental products
      prisma.rentalProduct.count({ where: { shop, active: true } }),
    ]);

    res.json({
      todaysPickups,
      activeRentals,
      returnsDue,
      overdueItems,
      recentReservations,
      totalReservations,
      totalProducts,
    });
  } catch (err) {
    console.error("GET /api/dashboard error:", err);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

module.exports = router;
