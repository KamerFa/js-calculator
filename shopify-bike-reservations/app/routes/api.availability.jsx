import { json } from "@remix-run/node";

/**
 * Public API: Get availability calendar for a bike
 * GET /api/availability?shop=xxx&bikeId=xxx&year=2024&month=6
 */
export const loader = async ({ request }) => {
  const prisma = (await import("../db.server")).default;
  const { getBikeCalendar } = await import("../utils/availability.server");

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  const bikeId = url.searchParams.get("bikeId");
  const year = parseInt(url.searchParams.get("year") || new Date().getFullYear());
  const month = parseInt(url.searchParams.get("month") || new Date().getMonth() + 1);

  if (!shop) {
    return json({ error: "shop parameter required" }, { status: 400 });
  }

  // If bikeId provided, return calendar for that bike
  if (bikeId) {
    const calendar = await getBikeCalendar(shop, bikeId, year, month);
    return json({ bikeId, year, month, calendar }, { headers: corsHeaders() });
  }

  // Otherwise return availability summary for all active bikes
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
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
