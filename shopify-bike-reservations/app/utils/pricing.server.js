import prisma from "../db.server";

/**
 * Calculate the rental price for an item over a given date range.
 * Uses 3-tier pricing fallback: item-specific → type-level → shop-wide default.
 */
export async function calculatePrice(shop, rentalItemId, startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const durationMs = end.getTime() - start.getTime();
  const durationHours = durationMs / (1000 * 60 * 60);

  // Get the item to know its type
  const item = await prisma.rentalItem.findUnique({
    where: { id: rentalItemId },
    select: { rentalItemTypeId: true },
  });

  // 3-tier pricing fallback
  const itemTiers = await prisma.pricingTier.findMany({
    where: { shop, rentalItemId },
    orderBy: { durationHours: "asc" },
  });

  const typeTiers = item?.rentalItemTypeId
    ? await prisma.pricingTier.findMany({
        where: { shop, rentalItemTypeId: item.rentalItemTypeId, rentalItemId: null },
        orderBy: { durationHours: "asc" },
      })
    : [];

  const defaultTiers = await prisma.pricingTier.findMany({
    where: { shop, rentalItemTypeId: null, rentalItemId: null, isDefault: true },
    orderBy: { durationHours: "asc" },
  });

  // Use first non-empty set
  const tiers = itemTiers.length > 0 ? itemTiers : typeTiers.length > 0 ? typeTiers : defaultTiers;

  if (tiers.length === 0) {
    return { subtotal: 0, seasonalMultiplier: 1, total: 0, tierName: null, durationHours };
  }

  // Find the best matching tier
  let selectedTier = tiers[tiers.length - 1];
  for (const tier of tiers) {
    if (durationHours <= tier.durationHours) {
      selectedTier = tier;
      break;
    }
  }

  // If rental is longer than all tiers, calculate proportionally
  let subtotal;
  if (durationHours > selectedTier.durationHours) {
    const ratio = durationHours / selectedTier.durationHours;
    subtotal = Math.ceil(selectedTier.price * ratio);
  } else {
    subtotal = selectedTier.price;
  }

  // Check for seasonal pricing
  const seasonalRules = await prisma.seasonalPricing.findMany({
    where: {
      shop,
      isActive: true,
      startDate: { lte: end },
      endDate: { gte: start },
    },
  });

  let seasonalMultiplier = 1.0;
  for (const rule of seasonalRules) {
    if (rule.multiplier > seasonalMultiplier) {
      seasonalMultiplier = rule.multiplier;
    }
  }

  const total = Math.round(subtotal * seasonalMultiplier * 100) / 100;

  return {
    subtotal,
    seasonalMultiplier,
    total,
    tierName: selectedTier.name,
    durationHours,
  };
}

/**
 * Calculate add-on costs
 */
export function calculateAddonTotal(addons, durationHours) {
  let total = 0;
  for (const addon of addons) {
    if (addon.priceType === "per_day") {
      const days = Math.ceil(durationHours / 24);
      total += addon.price * days * (addon.quantity || 1);
    } else {
      total += addon.price * (addon.quantity || 1);
    }
  }
  return Math.round(total * 100) / 100;
}

/**
 * Calculate deposit amount based on settings
 */
export async function calculateDeposit(shop, totalPrice) {
  const settings = await prisma.appSettings.findUnique({ where: { shop } });
  const percentage = settings?.depositPercentage ?? 30;
  return Math.round(totalPrice * (percentage / 100) * 100) / 100;
}
