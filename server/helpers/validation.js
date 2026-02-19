/**
 * Validate rental product input fields.
 */
function validateRentalProduct(data) {
  const errors = [];

  if (!data.shopifyProductId) {
    errors.push("shopifyProductId is required");
  }

  if (data.hourlyRate != null && (isNaN(data.hourlyRate) || data.hourlyRate < 0)) {
    errors.push("hourlyRate must be a non-negative number");
  }
  if (data.dailyRate != null && (isNaN(data.dailyRate) || data.dailyRate < 0)) {
    errors.push("dailyRate must be a non-negative number");
  }
  if (data.weeklyRate != null && (isNaN(data.weeklyRate) || data.weeklyRate < 0)) {
    errors.push("weeklyRate must be a non-negative number");
  }

  if (!data.hourlyRate && !data.dailyRate && !data.weeklyRate) {
    errors.push("At least one rate (hourly, daily, or weekly) is required");
  }

  if (data.quantityTotal != null && (!Number.isInteger(data.quantityTotal) || data.quantityTotal < 1)) {
    errors.push("quantityTotal must be a positive integer");
  }

  if (data.minDuration != null && data.maxDuration != null && data.minDuration > data.maxDuration) {
    errors.push("minDuration cannot exceed maxDuration");
  }

  if (data.depositAmount != null && (isNaN(data.depositAmount) || data.depositAmount < 0)) {
    errors.push("depositAmount must be a non-negative number");
  }

  return errors;
}

/**
 * Validate reservation input.
 */
function validateReservation(data) {
  const errors = [];

  if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
    errors.push("At least one rental item is required");
  }

  if (data.items) {
    data.items.forEach((item, i) => {
      if (!item.rentalProductId) errors.push(`Item ${i}: rentalProductId is required`);
      if (!item.startDate) errors.push(`Item ${i}: startDate is required`);
      if (!item.endDate) errors.push(`Item ${i}: endDate is required`);
      if (item.startDate && item.endDate && new Date(item.startDate) >= new Date(item.endDate)) {
        errors.push(`Item ${i}: endDate must be after startDate`);
      }
    });
  }

  return errors;
}

const VALID_STATUSES = ["reserved", "confirmed", "picked_up", "returned", "completed", "cancelled", "overdue"];

const VALID_TRANSITIONS = {
  reserved: ["confirmed", "cancelled"],
  confirmed: ["picked_up", "cancelled"],
  picked_up: ["returned", "overdue"],
  returned: ["completed"],
  overdue: ["returned", "cancelled"],
  completed: [],
  cancelled: [],
};

function validateStatusTransition(from, to) {
  if (!VALID_STATUSES.includes(to)) {
    return { valid: false, error: `Invalid status: ${to}` };
  }
  if (from && !VALID_TRANSITIONS[from]?.includes(to)) {
    return { valid: false, error: `Cannot transition from '${from}' to '${to}'` };
  }
  return { valid: true };
}

module.exports = { validateRentalProduct, validateReservation, validateStatusTransition, VALID_STATUSES };
