import prisma from "../db.server";

/**
 * Send email notification using nodemailer
 */
async function sendEmail(to, subject, html) {
  const nodemailer = await import("nodemailer");

  const transporter = nodemailer.default.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: `"Rental Reservations" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
}

/**
 * Send WhatsApp message via WhatsApp Business API
 */
async function sendWhatsApp(to, message) {
  const apiUrl = process.env.WHATSAPP_API_URL;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!apiUrl || !token) {
    console.log("WhatsApp not configured, skipping notification");
    return;
  }

  await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: to.replace(/[^0-9]/g, ""),
      type: "text",
      text: { body: message },
    }),
  });
}

/**
 * Format reservation details into a readable HTML email
 */
function formatReservationEmail(reservation, customer, rentalItem, addons, currency) {
  const startDate = new Date(reservation.startDate).toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const endDate = new Date(reservation.endDate).toLocaleDateString("en-GB", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  const typeName = rentalItem.rentalItemType?.name || "Rental";

  const addonList = addons.length > 0
    ? addons.map(a => `<li>${a.addon.name} - ${a.priceCharged} ${currency}</li>`).join("")
    : "<li>None</li>";

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a2e;">New Reservation #${reservation.confirmationCode}</h2>
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 16px 0;">
        <h3 style="margin-top: 0;">Rental Details</h3>
        <p><strong>Type:</strong> ${typeName}</p>
        <p><strong>Item:</strong> ${rentalItem.name}</p>
        <p><strong>Pick-up:</strong> ${startDate}</p>
        <p><strong>Return:</strong> ${endDate}</p>
        <p><strong>Pricing Tier:</strong> ${reservation.pricingTierName || "Custom"}</p>
      </div>
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 16px 0;">
        <h3 style="margin-top: 0;">Customer Info</h3>
        <p><strong>Name:</strong> ${customer.firstName} ${customer.lastName}</p>
        <p><strong>Email:</strong> ${customer.email}</p>
        <p><strong>Phone:</strong> ${customer.phone}</p>
      </div>
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 16px 0;">
        <h3 style="margin-top: 0;">Add-ons</h3>
        <ul>${addonList}</ul>
      </div>
      <div style="background: #1a1a2e; color: white; padding: 20px; border-radius: 8px; margin: 16px 0;">
        <h3 style="margin-top: 0; color: white;">Payment Summary</h3>
        <p>Subtotal: ${reservation.subtotal} ${currency}</p>
        <p>Add-ons: ${reservation.addonTotal} ${currency}</p>
        ${reservation.seasonalMultiplier !== 1 ? `<p>Seasonal adjustment: x${reservation.seasonalMultiplier}</p>` : ""}
        <p style="font-size: 18px;"><strong>Total: ${reservation.totalPrice} ${currency}</strong></p>
        <p>Deposit (paid online): ${reservation.depositAmount} ${currency}</p>
        <p>Remaining (pay on pickup): ${(reservation.totalPrice - reservation.depositAmount).toFixed(2)} ${currency}</p>
      </div>
    </div>
  `;
}

/**
 * Format reservation details for WhatsApp
 */
function formatReservationWhatsApp(reservation, customer, rentalItem, currency) {
  const startDate = new Date(reservation.startDate).toLocaleDateString("en-GB");
  const endDate = new Date(reservation.endDate).toLocaleDateString("en-GB");

  return [
    `*New Reservation #${reservation.confirmationCode}*`,
    ``,
    `Item: ${rentalItem.name}`,
    `Customer: ${customer.firstName} ${customer.lastName}`,
    `Phone: ${customer.phone}`,
    `Dates: ${startDate} - ${endDate}`,
    `Total: ${reservation.totalPrice} ${currency}`,
    `Deposit: ${reservation.depositAmount} ${currency}`,
    `Remaining: ${(reservation.totalPrice - reservation.depositAmount).toFixed(2)} ${currency}`,
  ].join("\n");
}

/**
 * Send all configured notifications for a new reservation
 */
export async function notifyNewReservation(shop, reservationId) {
  try {
    const reservation = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: {
        rentalItem: {
          include: { rentalItemType: { select: { name: true } } },
        },
        customerInfo: true,
        addons: { include: { addon: true } },
      },
    });

    if (!reservation || !reservation.customerInfo) return;

    const settings = await prisma.appSettings.findUnique({ where: { shop } });
    if (!settings) return;

    const { rentalItem, customerInfo, addons } = reservation;
    const currency = settings.currency || "USD";

    // Send email to owner
    if (settings.emailNotifications && settings.ownerEmail) {
      try {
        const html = formatReservationEmail(reservation, customerInfo, rentalItem, addons, currency);
        await sendEmail(
          settings.ownerEmail,
          `New Reservation #${reservation.confirmationCode} - ${rentalItem.name}`,
          html
        );
      } catch (err) {
        console.error("Failed to send owner email:", err.message);
      }
    }

    // Send confirmation email to customer
    if (customerInfo.email) {
      try {
        const html = formatReservationEmail(reservation, customerInfo, rentalItem, addons, currency);
        await sendEmail(
          customerInfo.email,
          `Reservation Confirmed - #${reservation.confirmationCode}`,
          html
        );
      } catch (err) {
        console.error("Failed to send customer email:", err.message);
      }
    }

    // Send WhatsApp to owner
    if (settings.whatsAppNotifications && settings.ownerWhatsApp) {
      try {
        const message = formatReservationWhatsApp(reservation, customerInfo, rentalItem, currency);
        await sendWhatsApp(settings.ownerWhatsApp, message);
      } catch (err) {
        console.error("Failed to send WhatsApp:", err.message);
      }
    }
  } catch (err) {
    console.error("Notification error:", err);
  }
}
