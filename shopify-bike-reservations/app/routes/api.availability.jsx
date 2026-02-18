import { json } from "@remix-run/node";

/**
 * Public API: Get availability calendar for a rental item
 * GET /api/availability?shop=xxx&productId=gid://...&year=2024&month=6
 * Also supports itemId for internal lookups.
 */
export const loader = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  try {
    const prisma = (await import("../db.server")).default;
    const { getItemCalendar } = await import("../utils/availability.server");

    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");
    const productId = url.searchParams.get("productId");
    const itemId = url.searchParams.get("itemId");
    const year = parseInt(url.searchParams.get("year") || new Date().getFullYear());
    const month = parseInt(url.searchParams.get("month") || new Date().getMonth() + 1);

    if (!shop) {
      return json({ error: "shop parameter required" }, { status: 400, headers: corsHeaders() });
    }

    let resolvedItemId = itemId;
    if (productId && !itemId) {
      const item = await prisma.rentalItem.findUnique({
        where: { shop_shopifyProductId: { shop, shopifyProductId: productId } },
        select: { id: true },
      });
      if (!item) {
        return json({ error: "Product not configured for rental" }, { status: 404, headers: corsHeaders() });
      }
      resolvedItemId = item.id;
    }

    if (resolvedItemId) {
      const calendar = await getItemCalendar(shop, resolvedItemId, year, month);
      return json({ itemId: resolvedItemId, year, month, calendar }, { headers: corsHeaders() });
    }

    const items = await prisma.rentalItem.findMany({
      where: { shop, isActive: true },
      include: { rentalItemType: { select: { name: true } } },
      orderBy: { sortOrder: "asc" },
    });

    const summary = [];
    for (const item of items) {
      const calendar = await getItemCalendar(shop, item.id, year, month);
      const availableDays = calendar.filter((d) => d.available).length;
      summary.push({
        itemId: item.id,
        itemName: item.name,
        typeName: item.rentalItemType?.name,
        availableDays,
        totalDays: calendar.length,
      });
    }

    return json({ year, month, items: summary }, { headers: corsHeaders() });
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
