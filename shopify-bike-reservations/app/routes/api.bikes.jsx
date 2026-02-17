import { json } from "@remix-run/node";
import prisma from "../db.server";

/**
 * Public API: Get available bikes for a given date range
 * GET /api/bikes?shop=xxx&start=2024-06-01&end=2024-06-03
 */
export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const startDate = url.searchParams.get("start");
  const endDate = url.searchParams.get("end");

  if (!shop) {
    return json({ error: "shop parameter required" }, { status: 400 });
  }

  const where = { shop, isActive: true };
  const bikes = await prisma.bike.findMany({
    where,
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      category: true,
      imageUrl: true,
      engineSize: true,
      year: true,
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
