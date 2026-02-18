import prisma from "../db.server";

/**
 * Generate a unique, human-readable confirmation code.
 * Format: {PREFIX}-XXXXXX (6 alphanumeric chars, excluding ambiguous I/O/0/1)
 * Prefix is configurable per shop via AppSettings.confirmationPrefix.
 */
export async function generateConfirmationCode(shop) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let prefix = "RN";

  if (shop) {
    const settings = await prisma.appSettings.findUnique({
      where: { shop },
      select: { confirmationPrefix: true },
    });
    if (settings?.confirmationPrefix) {
      prefix = settings.confirmationPrefix;
    }
  }

  let code = `${prefix}-`;
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
