/**
 * Calculate rental price based on duration and product rates.
 */
function calculateRentalPrice(rentalProduct, startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffMs = end - start;
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  const diffWeeks = diffDays / 7;

  const hourly = parseFloat(rentalProduct.hourlyRate) || 0;
  const daily = parseFloat(rentalProduct.dailyRate) || 0;
  const weekly = parseFloat(rentalProduct.weeklyRate) || 0;

  // Pick the best rate for the customer
  let price = 0;
  let unit = "days";
  let duration = Math.ceil(diffDays);

  if (weekly > 0 && diffDays >= 7) {
    const fullWeeks = Math.floor(diffWeeks);
    const remainingDays = Math.ceil(diffDays - fullWeeks * 7);
    const weeklyTotal = fullWeeks * weekly;
    const remainderCost = daily > 0 ? remainingDays * daily : remainingDays * (weekly / 7);
    price = weeklyTotal + remainderCost;
    unit = "weeks";
    duration = fullWeeks + (remainingDays > 0 ? remainingDays / 7 : 0);
  } else if (daily > 0) {
    price = Math.ceil(diffDays) * daily;
    unit = "days";
    duration = Math.ceil(diffDays);
  } else if (hourly > 0) {
    price = Math.ceil(diffHours) * hourly;
    unit = "hours";
    duration = Math.ceil(diffHours);
  }

  return {
    price: Math.round(price * 100) / 100,
    duration,
    unit,
    deposit: parseFloat(rentalProduct.depositAmount) || 0,
  };
}

/**
 * Check availability for a rental product in a date range.
 */
async function checkAvailability(prisma, rentalProductId, startDate, endDate, excludeReservationId) {
  const product = await prisma.rentalProduct.findUnique({
    where: { id: rentalProductId },
  });

  if (!product || !product.active) {
    return { available: false, reason: "Product not available for rent" };
  }

  // Count overlapping active reservations
  const where = {
    rentalProductId,
    reservation: {
      status: { in: ["reserved", "confirmed", "picked_up"] },
    },
    OR: [
      { startDate: { lte: new Date(endDate) }, endDate: { gte: new Date(startDate) } },
    ],
  };

  if (excludeReservationId) {
    where.reservation.id = { not: excludeReservationId };
  }

  const overlapping = await prisma.reservationItem.count({ where });
  const availableQty = product.quantityTotal - overlapping;

  // Check blackout dates
  const blackouts = await prisma.blackoutDate.count({
    where: {
      shop: product.shop,
      startDate: { lte: new Date(endDate) },
      endDate: { gte: new Date(startDate) },
    },
  });

  if (blackouts > 0) {
    return { available: false, reason: "Selected dates include blackout period", availableQty: 0 };
  }

  // Check buffer time
  if (product.bufferTime > 0) {
    const bufferMs =
      product.bufferUnit === "days"
        ? product.bufferTime * 24 * 60 * 60 * 1000
        : product.bufferTime * 60 * 60 * 1000;

    const bufferedStart = new Date(new Date(startDate).getTime() - bufferMs);
    const bufferedEnd = new Date(new Date(endDate).getTime() + bufferMs);

    const bufferOverlap = await prisma.reservationItem.count({
      where: {
        rentalProductId,
        reservation: {
          status: { in: ["reserved", "confirmed", "picked_up"] },
        },
        OR: [
          { startDate: { lte: bufferedEnd }, endDate: { gte: bufferedStart } },
        ],
      },
    });

    const bufferAvailable = product.quantityTotal - bufferOverlap;
    return {
      available: bufferAvailable > 0,
      availableQty: Math.max(0, bufferAvailable),
      totalQty: product.quantityTotal,
    };
  }

  return {
    available: availableQty > 0,
    availableQty: Math.max(0, availableQty),
    totalQty: product.quantityTotal,
  };
}

module.exports = { calculateRentalPrice, checkAvailability };
