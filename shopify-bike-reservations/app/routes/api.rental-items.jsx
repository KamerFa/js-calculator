import { json } from "@remix-run/node";

/**
 * Public API: List rental items and check availability
 *
 * GET /api/rental-items?shop=xxx                                            → all rental items
 * GET /api/rental-items?shop=xxx&productId=gid://...&start=...&end=...      → single item by Shopify ID
 * GET /api/rental-items?shop=xxx&itemId=xxx&start=...&end=...               → single item by internal ID
 * GET /api/rental-items?shop=xxx&typeSlug=bikes                             → items filtered by type
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
    const itemId = url.searchParams.get("itemId");
    const typeSlug = url.searchParams.get("typeSlug");
    const startDate = url.searchParams.get("start");
    const endDate = url.searchParams.get("end");

    if (!shop) {
      return json({ error: "shop parameter required" }, { status: 400, headers: corsHeaders() });
    }

    // Single-item lookup
    let item = null;
    if (productId) {
      item = await prisma.rentalItem.findUnique({
        where: { shop_shopifyProductId: { shop, shopifyProductId: productId } },
        include: { rentalItemType: { select: { id: true, name: true, slug: true } } },
      });
    } else if (itemId) {
      item = await prisma.rentalItem.findFirst({
        where: { id: itemId, shop },
        include: { rentalItemType: { select: { id: true, name: true, slug: true } } },
      });
    }

    if (item) {
      if (!item.isActive) {
        return json({ available: false, item: null }, { headers: corsHeaders() });
      }

      const result = {
        id: item.id,
        name: item.name,
        description: item.description,
        imageUrl: item.imageUrl,
        productId: item.shopifyProductId,
        type: item.rentalItemType,
      };

      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);

        const conflicting = await prisma.reservation.findFirst({
          where: {
            shop,
            rentalItemId: item.id,
            status: { in: ["confirmed", "pending"] },
            startDate: { lt: end },
            endDate: { gt: start },
          },
        });

        const blocked = await prisma.blockedDate.findFirst({
          where: {
            shop,
            OR: [{ rentalItemId: item.id }, { rentalItemId: null }],
            startDate: { lt: end },
            endDate: { gt: start },
          },
        });

        return json({
          available: !conflicting && !blocked,
          item: result,
        }, { headers: corsHeaders() });
      }

      return json({ available: true, item: result }, { headers: corsHeaders() });
    }

    // List all rental items (optionally filtered by type)
    const where = { shop, isActive: true };
    if (typeSlug) {
      const type = await prisma.rentalItemType.findUnique({
        where: { shop_slug: { shop, slug: typeSlug } },
        select: { id: true },
      });
      if (type) where.rentalItemTypeId = type.id;
    }

    const items = await prisma.rentalItem.findMany({
      where,
      include: { rentalItemType: { select: { id: true, name: true, slug: true } } },
      orderBy: { sortOrder: "asc" },
    });

    // Also fetch item types for the picker
    const types = await prisma.rentalItemType.findMany({
      where: { shop, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true, imageUrl: true },
    });

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const available = [];

      for (const i of items) {
        const conflicting = await prisma.reservation.findFirst({
          where: {
            shop,
            rentalItemId: i.id,
            status: { in: ["confirmed", "pending"] },
            startDate: { lt: end },
            endDate: { gt: start },
          },
        });
        const blocked = await prisma.blockedDate.findFirst({
          where: {
            shop,
            OR: [{ rentalItemId: i.id }, { rentalItemId: null }],
            startDate: { lt: end },
            endDate: { gt: start },
          },
        });
        if (!conflicting && !blocked) available.push(i);
      }

      return json({ items: available, types }, { headers: corsHeaders() });
    }

    return json({ items, types }, { headers: corsHeaders() });
  } catch (err) {
    console.error("api.rental-items error:", err);
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
