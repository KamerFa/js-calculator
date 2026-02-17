/**
 * Generate a unique, human-readable confirmation code
 * Format: BR-XXXXXX (BR = Bike Reservation, 6 alphanumeric chars)
 */
export function generateConfirmationCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // excluded I, O, 0, 1 for clarity
  let code = "BR-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
