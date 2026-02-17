import { PrismaClient } from "@prisma/client";

/** @type {PrismaClient} */
let prisma;

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  // Avoid multiple instances in development due to hot reloading
  if (!global.__prisma) {
    global.__prisma = new PrismaClient();
  }
  prisma = global.__prisma;
}

export default prisma;
