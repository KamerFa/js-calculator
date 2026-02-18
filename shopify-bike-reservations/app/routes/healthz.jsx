import { json } from "@remix-run/node";

export const loader = async () => {
  try {
    const prisma = (await import("../db.server")).default;
    await prisma.$queryRaw`SELECT 1`;
    return json({ status: "ok", db: "connected" });
  } catch (err) {
    console.error("Health check failed:", err.message);
    return json({ status: "error", db: "disconnected", error: err.message }, { status: 500 });
  }
};
