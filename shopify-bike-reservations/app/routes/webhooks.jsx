import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }) => {
  const { topic, shop, session, admin } = await authenticate.webhook(request);

  if (!admin) {
    // The admin context isn't returned if the webhook originates from a shop
    // that's no longer installed.
    throw new Response();
  }

  switch (topic) {
    case "APP_UNINSTALLED":
      if (session) {
        await prisma.session.deleteMany({ where: { shop } });
      }
      break;

    case "CUSTOMERS_DATA_REQUEST":
    case "CUSTOMERS_REDACT":
    case "SHOP_REDACT":
      // Handle GDPR webhooks - in production you'd implement data export/deletion
      console.log(`Received ${topic} webhook for ${shop}`);
      break;

    default:
      throw new Response("Unhandled webhook topic", { status: 404 });
  }

  throw new Response();
};
