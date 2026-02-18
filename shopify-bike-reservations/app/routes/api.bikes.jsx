import { json } from "@remix-run/node";

/**
 * Public API: Check availability for a specific product by Shopify product ID
 * GET /api/bikes?shop=xxx&productId=gid://shopify/Product/123&start=2024-06-01&end=2024-06-03
 *
 * If productId is provided, returns availability for that single product.
 * If no productId, returns all rental-enabled bikes (with optional date filtering).
 */
export const loader = async ({ request }) => {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const prisma = (await import("../db.server")).default;

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const productId = url.searchParams.get("productId");
  const startDate = url.searchParams.get("start");
  const endDate = url.searchParams.get("end");

  if (!shop) {
    return json({ error: "shop parameter required" }, { status: 400, headers: corsHeaders() });
  }

  // If a specific product is requested, check its availability
  if (productId) {
    const bike = await prisma.bike.findUnique({
      where: { shop_shopifyProductId: { shop, shopifyProductId: productId } },
      select: {
        id: true,
        name: true,
        description: true,
        imageUrl: true,
        shopifyProductId: true,
        isActive: true,
      },
    });

    if (!bike || !bike.isActive) {
      return json({ available: false, bike: null }, { headers: corsHeaders() });
    }

    // Check date availability if dates provided
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      const conflicting = await prisma.reservation.findFirst({
        where: {
          shop,
          bikeId: bike.id,
          status: { in: ["confirmed", "pending"] },
          startDate: { lt: end },
          endDate: { gt: start },
        },
      });

      const blocked = await prisma.blockedDate.findFirst({
        where: {
          shop,
          OR: [{ bikeId: bike.id }, { bikeId: null }],
          startDate: { lt: end },
          endDate: { gt: start },
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

  // No productId — return all rental-enabled bikes
  const bikes = await prisma.bike.findMany({
    where: { shop, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      imageUrl: true,
      shopifyProductId: true,
    },
  });

  // If dates provided, filter to available bikes only
  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const available = [];
    for (const bike of bikes) {
      const conflicting = await prisma.reservation.findFirst({
        where: {
          shop,
          bikeId: bike.id,
          status: { in: ["confirmed", "pending"] },
          startDate: { lt: end },
          endDate: { gt: start },
        },
      });

      const blocked = await prisma.blockedDate.findFirst({
        where: {
          shop,
          OR: [{ bikeId: bike.id }, { bikeId: null }],
          startDate: { lt: end },
          endDate: { gt: start },
        },
      });

      if (!conflicting && !blocked) {
        available.push(bike);
      }
    }
    return json({ bikes: available }, { headers: corsHeaders() });
  }

  return json({ bikes }, { headers: corsHeaders() });
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
