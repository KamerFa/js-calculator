const express = require("express");
const router = express.Router();
const prisma = require("../db");

/**
 * GDPR webhook: Customer data request
 * When a customer requests their data, return what we have.
 */
router.post("/customers-data-request", async (req, res) => {
  try {
    const { shop_domain, customer } = req.body;
    if (!shop_domain || !customer?.id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // We acknowledge the request. In production, you'd compile and send data.
    console.log(`[GDPR] Customer data request for customer ${customer.id} from ${shop_domain}`);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("[GDPR] Customer data request error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

/**
 * GDPR webhook: Customer redact
 * Delete all customer personal data.
 */
router.post("/customers-redact", async (req, res) => {
  try {
    const { shop_domain, customer } = req.body;
    if (!shop_domain || !customer?.id) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const shopifyCustomerId = String(customer.id);

    // Delete customer record
    const existing = await prisma.customer.findUnique({
      where: { shop_shopifyCustomerId: { shop: shop_domain, shopifyCustomerId } },
    });

    if (existing) {
      // Anonymize reservation records instead of deleting (preserve business data)
      await prisma.reservation.updateMany({
        where: { customerId: existing.id },
        data: {
          customerName: "[REDACTED]",
          customerEmail: null,
          customerPhone: null,
        },
      });

      await prisma.customer.delete({ where: { id: existing.id } });
    }

    console.log(`[GDPR] Customer redacted: ${shopifyCustomerId} from ${shop_domain}`);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("[GDPR] Customer redact error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

/**
 * GDPR webhook: Shop redact
 * Delete all data for a shop that has uninstalled the app.
 */
router.post("/shop-redact", async (req, res) => {
  try {
    const { shop_domain } = req.body;
    if (!shop_domain) {
      return res.status(400).json({ error: "Missing shop_domain" });
    }

    // Delete all shop data
    await prisma.blackoutDate.deleteMany({ where: { shop: shop_domain } });
    await prisma.appSettings.deleteMany({ where: { shop: shop_domain } });

    // Delete reservations and related data (cascade handles items/history)
    await prisma.reservation.deleteMany({ where: { shop: shop_domain } });
    await prisma.customer.deleteMany({ where: { shop: shop_domain } });

    // Delete rental products (cascade handles inventory units)
    await prisma.rentalProduct.deleteMany({ where: { shop: shop_domain } });

    console.log(`[GDPR] Shop redacted: ${shop_domain}`);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error("[GDPR] Shop redact error:", err);
    res.status(500).json({ error: "Internal error" });
  }
});

module.exports = router;
