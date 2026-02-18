import { json } from "@remix-run/node";

/**
 * Public API: Get pricing for a bike and date range
 * GET /api/pricing?shop=xxx&productId=gid://...&start=2024-06-01&end=2024-06-03
 * Also supports bikeId for backwards compatibility.
 */
export const loader = async ({ request }) => {
  const prisma = (await import("../db.server")).default;
  const { calculatePrice } = await import("../utils/pricing.server");

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const productId = url.searchParams.get("productId");
  const bikeId = url.searchParams.get("bikeId");
  const startDate = url.searchParams.get("start");
  const endDate = url.searchParams.get("end");

  if (!shop) {
    return json({ error: "shop parameter required" }, { status: 400 });
  }

  // Resolve internal bikeId from productId if needed
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

  // If a specific bike + dates, calculate the price
  if (resolvedBikeId && startDate && endDate) {
    const pricing = await calculatePrice(shop, resolvedBikeId, startDate, endDate);

    // Get deposit percentage
    const settings = await prisma.appSettings.findUnique({ where: { shop } });
    const depositPct = settings?.depositPercentage ?? 30;
    const depositAmount = Math.round(pricing.total * (depositPct / 100) * 100) / 100;

    return json({
      ...pricing,
      depositPercentage: depositPct,
      depositAmount,
      remainingAmount: Math.round((pricing.total - depositAmount) * 100) / 100,
      currency: settings?.currency || "BAM",
    }, { headers: corsHeaders() });
  }

  // Otherwise return available tiers
  const defaultTiers = await prisma.pricingTier.findMany({
    where: { shop, isDefault: true, bikeId: null },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, durationHours: true, price: true },
  });

  let bikeTiers = [];
  if (resolvedBikeId) {
    bikeTiers = await prisma.pricingTier.findMany({
      where: { shop, bikeId: resolvedBikeId },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, durationHours: true, price: true },
    });
  }

  return json({
    defaultTiers,
    bikeTiers: bikeTiers.length > 0 ? bikeTiers : null,
    tiers: bikeTiers.length > 0 ? bikeTiers : defaultTiers,
  }, { headers: corsHeaders() });
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
