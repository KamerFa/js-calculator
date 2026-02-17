import prisma from "../db.server";

/**
 * Check if a specific bike is available for the given date range.
 */
export async function isBikeAvailable(shop, bikeId, startDate, endDate, excludeReservationId = null) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Check for overlapping reservations
  const whereClause = {
    shop,
    bikeId,
    status: { in: ["confirmed", "pending"] },
    startDate: { lt: end },
    endDate: { gt: start },
  };

  if (excludeReservationId) {
    whereClause.id = { not: excludeReservationId };
  }

  const conflicting = await prisma.reservation.findFirst({ where: whereClause });

  if (conflicting) return false;

  // Check for blocked dates
  const blocked = await prisma.blockedDate.findFirst({
    where: {
      shop,
      OR: [
        { bikeId },
        { bikeId: null }, // global blocks
      ],
      startDate: { lt: end },
      endDate: { gt: start },
    },
  });

  return !blocked;
}

/**
 * Get all available bikes for a given date range.
 */
export async function getAvailableBikes(shop, startDate, endDate) {
  const allBikes = await prisma.bike.findMany({
    where: { shop, isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  const available = [];
  for (const bike of allBikes) {
    const isAvail = await isBikeAvailable(shop, bike.id, startDate, endDate);
    if (isAvail) {
      available.push(bike);
    }
  }

  return available;
}

/**
 * Get a calendar view of availability for a specific bike over a month.
 * Returns an array of dates with availability status.
 */
export async function getBikeCalendar(shop, bikeId, year, month) {
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);

  const reservations = await prisma.reservation.findMany({
    where: {
      shop,
      bikeId,
      status: { in: ["confirmed", "pending"] },
      startDate: { lte: endOfMonth },
      endDate: { gte: startOfMonth },
    },
    select: { startDate: true, endDate: true },
  });

  const blockedDates = await prisma.blockedDate.findMany({
    where: {
      shop,
      OR: [{ bikeId }, { bikeId: null }],
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
