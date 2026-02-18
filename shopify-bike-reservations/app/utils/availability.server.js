import prisma from "../db.server";

/**
 * Check if a specific rental item is available for the given date range.
 */
export async function isItemAvailable(shop, rentalItemId, startDate, endDate, excludeReservationId = null) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const whereClause = {
    shop,
    rentalItemId,
    status: { in: ["confirmed", "pending"] },
    startDate: { lt: end },
    endDate: { gt: start },
  };

  if (excludeReservationId) {
    whereClause.id = { not: excludeReservationId };
  }

  const conflicting = await prisma.reservation.findFirst({ where: whereClause });
  if (conflicting) return false;

  const blocked = await prisma.blockedDate.findFirst({
    where: {
      shop,
      OR: [
        { rentalItemId },
        { rentalItemId: null },
      ],
      startDate: { lt: end },
      endDate: { gt: start },
    },
  });

  return !blocked;
}

/**
 * Get all available rental items for a given date range.
 * Optionally filter by rental item type.
 */
export async function getAvailableItems(shop, startDate, endDate, rentalItemTypeId = null) {
  const where = { shop, isActive: true };
  if (rentalItemTypeId) where.rentalItemTypeId = rentalItemTypeId;

  const allItems = await prisma.rentalItem.findMany({
    where,
    include: { rentalItemType: { select: { name: true, slug: true } } },
    orderBy: { sortOrder: "asc" },
  });

  const available = [];
  for (const item of allItems) {
    const isAvail = await isItemAvailable(shop, item.id, startDate, endDate);
    if (isAvail) {
      available.push(item);
    }
  }

  return available;
}

/**
 * Get a calendar view of availability for a specific rental item over a month.
 */
export async function getItemCalendar(shop, rentalItemId, year, month) {
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);

  const reservations = await prisma.reservation.findMany({
    where: {
      shop,
      rentalItemId,
      status: { in: ["confirmed", "pending"] },
      startDate: { lte: endOfMonth },
      endDate: { gte: startOfMonth },
    },
    select: { startDate: true, endDate: true },
  });

  const blockedDates = await prisma.blockedDate.findMany({
    where: {
      shop,
      OR: [{ rentalItemId }, { rentalItemId: null }],
      startDate: { lte: endOfMonth },
      endDate: { gte: startOfMonth },
    },
  });

  const daysInMonth = endOfMonth.getDate();
  const calendar = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month - 1, day);
    const nextDate = new Date(year, month - 1, day + 1);

    let isBooked = false;
    let isBlocked = false;

    for (const res of reservations) {
      if (res.startDate < nextDate && res.endDate > date) {
        isBooked = true;
        break;
      }
    }

    for (const block of blockedDates) {
      if (block.startDate < nextDate && block.endDate > date) {
        isBlocked = true;
        break;
      }
    }

    calendar.push({
      date: date.toISOString().split("T")[0],
      available: !isBooked && !isBlocked,
      isBooked,
      isBlocked,
    });
  }

  return calendar;
}
