import { json } from "@remix-run/node";

/**
 * Public API: Create a reservation
 * POST /api/reservations
 */
export const action = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders() });
  }

  try {
    const prisma = (await import("../db.server")).default;
    const { calculatePrice } = await import("../utils/pricing.server");
    const { isItemAvailable } = await import("../utils/availability.server");
    const { generateConfirmationCode } = await import("../utils/confirmation.server");
    const { notifyNewReservation } = await import("../utils/notifications.server");

    const body = await request.json();
    const {
      shop, itemId, productId, startDate, endDate,
      customer, selectedAddons,
    } = body;

    if (!shop || !startDate || !endDate) {
      return json(
        { error: "Missing required fields: shop, startDate, endDate" },
        { status: 400, headers: corsHeaders() }
      );
    }

    if (!itemId && !productId) {
      return json(
        { error: "Either itemId or productId is required" },
        { status: 400, headers: corsHeaders() }
      );
    }

    if (!customer?.firstName || !customer?.lastName || !customer?.email || !customer?.phone) {
      return json(
        { error: "Missing customer info: firstName, lastName, email, phone required" },
        { status: 400, headers: corsHeaders() }
      );
    }

    // Resolve rental item
    let rentalItem;
    if (productId) {
      rentalItem = await prisma.rentalItem.findUnique({
        where: { shop_shopifyProductId: { shop, shopifyProductId: productId } },
      });
    } else {
      rentalItem = await prisma.rentalItem.findFirst({
        where: { id: itemId, shop },
      });
    }

    if (!rentalItem || !rentalItem.isActive) {
      return json(
        { error: "Product not found or rental not enabled" },
        { status: 404, headers: corsHeaders() }
      );
    }

    // Check availability
    const available = await isItemAvailable(shop, rentalItem.id, startDate, endDate);
    if (!available) {
      return json(
        { error: "This item is not available for the selected dates" },
        { status: 409, headers: corsHeaders() }
      );
    }

    // Calculate pricing
    const pricing = await calculatePrice(shop, rentalItem.id, startDate, endDate);

    // Calculate add-on costs
    let addonTotal = 0;
    const addonRecords = [];
    if (selectedAddons?.length > 0) {
      const addonIds = selectedAddons.map((a) => a.id);
      const addons = await prisma.addon.findMany({
        where: { id: { in: addonIds }, shop, isActive: true },
      });

      for (const addon of addons) {
        const selected = selectedAddons.find((a) => a.id === addon.id);
        const qty = selected?.quantity || 1;
        let price;
        if (addon.priceType === "per_day") {
          const days = Math.ceil(pricing.durationHours / 24);
          price = addon.price * days * qty;
        } else {
          price = addon.price * qty;
        }
        addonTotal += price;
        addonRecords.push({ addonId: addon.id, quantity: qty, priceCharged: price });
      }
    }

    addonTotal = Math.round(addonTotal * 100) / 100;
    const totalPrice = Math.round((pricing.total + addonTotal) * 100) / 100;

    const settings = await prisma.appSettings.findUnique({ where: { shop } });
    const depositPct = settings?.depositPercentage ?? 30;
    const depositAmount = Math.round(totalPrice * (depositPct / 100) * 100) / 100;

    // Generate confirmation code (retry if collision)
    let confirmationCode;
    let attempts = 0;
    while (attempts < 10) {
      confirmationCode = await generateConfirmationCode(shop);
      const existing = await prisma.reservation.findUnique({ where: { confirmationCode } });
      if (!existing) break;
      attempts++;
    }

    // Build custom fields for customer info
    const customFields = {};
    if (customer.customFields && typeof customer.customFields === "object") {
      Object.assign(customFields, customer.customFields);
    }

    const reservation = await prisma.reservation.create({
      data: {
        shop,
        rentalItemId: rentalItem.id,
        confirmationCode,
        status: "confirmed",
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        pricingTierName: pricing.tierName,
        subtotal: pricing.total,
        addonTotal,
        seasonalMultiplier: pricing.seasonalMultiplier,
        totalPrice,
        depositAmount,
        depositPaid: false,
        customerInfo: {
          create: {
            firstName: customer.firstName,
            lastName: customer.lastName,
            email: customer.email,
            phone: customer.phone,
            customFields,
            notes: customer.notes || null,
          },
        },
        addons: {
          create: addonRecords,
        },
      },
      include: {
        rentalItem: {
          include: { rentalItemType: { select: { name: true } } },
        },
        customerInfo: true,
        addons: { include: { addon: true } },
      },
    });

    // Send notifications (fire and forget)
    notifyNewReservation(shop, reservation.id).catch((err) =>
      console.error("Notification failed:", err)
    );

    return json({
      success: true,
      reservation: {
        id: reservation.id,
        confirmationCode: reservation.confirmationCode,
        status: reservation.status,
        item: {
          id: rentalItem.id,
          name: rentalItem.name,
          type: reservation.rentalItem.rentalItemType?.name,
        },
        startDate: reservation.startDate,
        endDate: reservation.endDate,
        pricingTier: reservation.pricingTierName,
        subtotal: reservation.subtotal,
        addonTotal: reservation.addonTotal,
        totalPrice: reservation.totalPrice,
        depositAmount: reservation.depositAmount,
        remainingAmount: Math.round((totalPrice - depositAmount) * 100) / 100,
        currency: settings?.currency || "USD",
        pickupLocation: settings?.pickupLocation,
        pickupInstructions: settings?.pickupInstructions,
      },
    }, { headers: corsHeaders() });
  } catch (err) {
    console.error("Reservation error:", err);
    return json(
      { error: "Failed to create reservation" },
      { status: 500, headers: corsHeaders() }
    );
  }
};

/**
 * Reservation lookup by confirmation code
 */
export const loader = async ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  const prisma = (await import("../db.server")).default;

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const shop = url.searchParams.get("shop");

  if (code && shop) {
    const reservation = await prisma.reservation.findFirst({
      where: { confirmationCode: code, shop },
      include: {
        rentalItem: {
          select: { name: true, imageUrl: true },
        },
        addons: { include: { addon: { select: { name: true } } } },
      },
    });

    if (!reservation) {
      return json({ error: "Reservation not found" }, { status: 404, headers: corsHeaders() });
    }

    return json({ reservation }, { headers: corsHeaders() });
  }

  return json({ error: "Provide ?code=XX&shop=XX" }, { status: 400, headers: corsHeaders() });
};

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
