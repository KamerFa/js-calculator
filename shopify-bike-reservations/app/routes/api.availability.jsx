import { json } from "@remix-run/node";

/**
 * Public API: Get availability calendar for a product
 * GET /api/availability?shop=xxx&productId=gid://...&year=2024&month=6
 * Also supports bikeId.
 */
export const loader = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  try {
    const prisma = (await import("../db.server")).default;
    const { getBikeCalendar } = await import("../utils/availability.server");

    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");
    const productId = url.searchParams.get("productId");
    const bikeId = url.searchParams.get("bikeId");
    const year = parseInt(url.searchParams.get("year") || new Date().getFullYear());
    const month = parseInt(url.searchParams.get("month") || new Date().getMonth() + 1);

    if (!shop) {
      return json({ error: "shop parameter required" }, { status: 400, headers: corsHeaders() });
    }

    let resolvedBikeId = bikeId;
    if (productId && !bikeId) {
      const bike = await prisma.bike.findUnique({
        where: { shop_shopifyProductId: { shop, shopifyProductId: productId } },
        select: { id: true },
      });
      if (!bike) {
        return json({ error: "Product not configured for rental" }, { status: 404, headers: corsHeaders() });
      }
      resolvedBikeId = bike.id;
    }

    if (resolvedBikeId) {
      const calendar = await getBikeCalendar(shop, resolvedBikeId, year, month);
      return json({ bikeId: resolvedBikeId, year, month, calendar }, { headers: corsHeaders() });
    }

    const bikes = await prisma.bike.findMany({
      where: { shop, isActive: true },
      select: { id: true, name: true },
    });

    const summary = [];
    for (const bike of bikes) {
      const calendar = await getBikeCalendar(shop, bike.id, year, month);
      const availableDays = calendar.filter((d) => d.available).length;
      summary.push({
        bikeId: bike.id,
        bikeName: bike.name,
        availableDays,
        totalDays: calendar.length,
      });
    }

    return json({ year, month, bikes: summary }, { headers: corsHeaders() });
  } catch (err) {
    console.error("api.availability error:", err);
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
