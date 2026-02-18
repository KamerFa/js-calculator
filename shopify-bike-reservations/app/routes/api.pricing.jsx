import { json } from "@remix-run/node";

/**
 * Public API: Get pricing for a rental item and date range
 * GET /api/pricing?shop=xxx&productId=gid://...&start=2024-06-01&end=2024-06-03
 * Also supports itemId for internal lookups.
 */
export const loader = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  try {
    const prisma = (await import("../db.server")).default;
    const { calculatePrice } = await import("../utils/pricing.server");

    const url = new URL(request.url);
    const shop = url.searchParams.get("shop");
    const productId = url.searchParams.get("productId");
    const itemId = url.searchParams.get("itemId");
    const startDate = url.searchParams.get("start");
    const endDate = url.searchParams.get("end");

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

    if (resolvedItemId && startDate && endDate) {
      const pricing = await calculatePrice(shop, resolvedItemId, startDate, endDate);
      const settings = await prisma.appSettings.findUnique({ where: { shop } });
      const depositPct = settings?.depositPercentage ?? 30;
      const depositAmount = Math.round(pricing.total * (depositPct / 100) * 100) / 100;

      return json({
        ...pricing,
        depositPercentage: depositPct,
        depositAmount,
        remainingAmount: Math.round((pricing.total - depositAmount) * 100) / 100,
        currency: settings?.currency || "USD",
      }, { headers: corsHeaders() });
    }

    // Return available tiers (3-tier hierarchy)
    const defaultTiers = await prisma.pricingTier.findMany({
      where: { shop, isDefault: true, rentalItemTypeId: null, rentalItemId: null },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, durationHours: true, price: true },
    });

    let itemTiers = [];
    let typeTiers = [];
    if (resolvedItemId) {
      const item = await prisma.rentalItem.findUnique({
        where: { id: resolvedItemId },
        select: { rentalItemTypeId: true },
      });

      itemTiers = await prisma.pricingTier.findMany({
        where: { shop, rentalItemId: resolvedItemId },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, durationHours: true, price: true },
      });

      if (item?.rentalItemTypeId) {
        typeTiers = await prisma.pricingTier.findMany({
          where: { shop, rentalItemTypeId: item.rentalItemTypeId, rentalItemId: null },
          orderBy: { sortOrder: "asc" },
          select: { id: true, name: true, durationHours: true, price: true },
        });
      }
    }

    const tiers = itemTiers.length > 0 ? itemTiers : typeTiers.length > 0 ? typeTiers : defaultTiers;

    return json({
      defaultTiers,
      typeTiers: typeTiers.length > 0 ? typeTiers : null,
      itemTiers: itemTiers.length > 0 ? itemTiers : null,
      tiers,
    }, { headers: corsHeaders() });
  } catch (err) {
    console.error("api.pricing error:", err);
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
