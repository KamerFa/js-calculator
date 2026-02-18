import { json } from "@remix-run/node";

/**
 * Public API: List bikes and check availability
 *
 * GET /api/bikes?shop=xxx                                     → all rental bikes
 * GET /api/bikes?shop=xxx&productId=gid://...&start=...&end=... → single bike by Shopify ID
 * GET /api/bikes?shop=xxx&bikeId=xxx&start=...&end=...          → single bike by internal ID
 */
export const loader = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  try {
    const prisma = (await import("../db.server")).default;

    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");
    const productId = url.searchParams.get("productId");
    const bikeId = url.searchParams.get("bikeId");
    const startDate = url.searchParams.get("start");
    const endDate = url.searchParams.get("end");

    if (!shop) {
      return json({ error: "shop parameter required" }, { status: 400, headers: corsHeaders() });
    }

    // ── Single-bike lookup (by productId OR bikeId) ───────────
    let bike = null;
    if (productId) {
      bike = await prisma.bike.findUnique({
        where: { shop_shopifyProductId: { shop, shopifyProductId: productId } },
        select: { id: true, name: true, description: true, imageUrl: true, shopifyProductId: true, isActive: true },
      });
    } else if (bikeId) {
      bike = await prisma.bike.findFirst({
        where: { id: bikeId, shop },
        select: { id: true, name: true, description: true, imageUrl: true, shopifyProductId: true, isActive: true },
      });
    }

    if (bike) {
      if (!bike.isActive) {
        return json({ available: false, bike: null }, { headers: corsHeaders() });
      }

      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);

        const conflicting = await prisma.reservation.findFirst({
          where: {
            shop, bikeId: bike.id,
            status: { in: ["confirmed", "pending"] },
            startDate: { lt: end }, endDate: { gt: start },
          },
        });

        const blocked = await prisma.blockedDate.findFirst({
          where: {
            shop,
            OR: [{ bikeId: bike.id }, { bikeId: null }],
            startDate: { lt: end }, endDate: { gt: start },
          },
        });

        return json({
          available: !conflicting && !blocked,
          bike: { id: bike.id, name: bike.name, productId: bike.shopifyProductId },
        }, { headers: corsHeaders() });
      }

      return json({
        available: true,
        bike: { id: bike.id, name: bike.name, productId: bike.shopifyProductId },
      }, { headers: corsHeaders() });
    }

    // ── No specific bike → list all rental-enabled bikes ──────
    const bikes = await prisma.bike.findMany({
      where: { shop, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, description: true, imageUrl: true, shopifyProductId: true },
    });

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const available = [];

      for (const b of bikes) {
        const conflicting = await prisma.reservation.findFirst({
          where: {
            shop, bikeId: b.id,
            status: { in: ["confirmed", "pending"] },
            startDate: { lt: end }, endDate: { gt: start },
          },
        });
        const blocked = await prisma.blockedDate.findFirst({
          where: {
            shop,
            OR: [{ bikeId: b.id }, { bikeId: null }],
            startDate: { lt: end }, endDate: { gt: start },
          },
        });
        if (!conflicting && !blocked) available.push(b);
      }

      return json({ bikes: available }, { headers: corsHeaders() });
    }

    return json({ bikes }, { headers: corsHeaders() });
  } catch (err) {
    console.error("api.bikes error:", err);
    return json({ error: "Internal server error" }, { status: 500, headers: corsHeaders() });
  }
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
