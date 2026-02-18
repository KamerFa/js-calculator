import { json } from "@remix-run/node";

/**
 * Public API: Get available add-ons
 * GET /api/addons?shop=xxx
 */
export const loader = async ({ request }) => {
  const prisma = (await import("../db.server")).default;

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");

  if (!shop) {
    return json({ error: "shop parameter required" }, { status: 400 });
  }

  const addons = await prisma.addon.findMany({
    where: { shop, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      price: true,
      priceType: true,
      imageUrl: true,
    },
  });

  return json({ addons }, { headers: corsHeaders() });
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
