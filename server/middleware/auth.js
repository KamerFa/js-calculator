const shopify = require("../shopify");

/**
 * Middleware to verify the request is from an authenticated Shopify session.
 * Attaches session to res.locals.shopify.
 */
const verifyRequest = shopify.validateAuthenticatedSession();

module.exports = { verifyRequest };
