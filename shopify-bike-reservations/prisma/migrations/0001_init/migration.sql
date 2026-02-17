-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" DATETIME,
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT
);

-- CreateTable
CREATE TABLE "Bike" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "imageUrl" TEXT,
    "engineSize" TEXT,
    "year" INTEGER,
    "plateNumber" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PricingTier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "bikeId" TEXT,
    "name" TEXT NOT NULL,
    "durationHours" REAL NOT NULL,
    "price" REAL NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PricingTier_bikeId_fkey" FOREIGN KEY ("bikeId") REFERENCES "Bike" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SeasonalPricing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "multiplier" REAL NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Addon" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" REAL NOT NULL,
    "priceType" TEXT NOT NULL DEFAULT 'per_rental',
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "bikeId" TEXT NOT NULL,
    "confirmationCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'confirmed',
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "pricingTierName" TEXT,
    "subtotal" REAL NOT NULL,
    "addonTotal" REAL NOT NULL DEFAULT 0,
    "seasonalMultiplier" REAL NOT NULL DEFAULT 1.0,
    "totalPrice" REAL NOT NULL,
    "depositAmount" REAL NOT NULL,
    "depositPaid" BOOLEAN NOT NULL DEFAULT false,
    "remainderPaid" BOOLEAN NOT NULL DEFAULT false,
    "shopifyOrderId" TEXT,
    "shopifyDraftOrderId" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Reservation_bikeId_fkey" FOREIGN KEY ("bikeId") REFERENCES "Bike" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomerInfo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reservationId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "licenseNumber" TEXT,
    "idNumber" TEXT,
    "nationality" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerInfo_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReservationAddon" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reservationId" TEXT NOT NULL,
    "addonId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "priceCharged" REAL NOT NULL,
    CONSTRAINT "ReservationAddon_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReservationAddon_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "Addon" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "businessName" TEXT NOT NULL DEFAULT 'Bike Rentals',
    "currency" TEXT NOT NULL DEFAULT 'BAM',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Sarajevo',
    "depositPercentage" REAL NOT NULL DEFAULT 30,
    "minBookingHours" REAL NOT NULL DEFAULT 4,
    "ownerEmail" TEXT,
    "ownerWhatsApp" TEXT,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "whatsAppNotifications" BOOLEAN NOT NULL DEFAULT false,
    "pickupLocation" TEXT,
    "pickupInstructions" TEXT,
    "cancellationPolicy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "BlockedDate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "bikeId" TEXT,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Bike_shop_idx" ON "Bike"("shop");

-- CreateIndex
CREATE INDEX "PricingTier_shop_idx" ON "PricingTier"("shop");
CREATE INDEX "PricingTier_bikeId_idx" ON "PricingTier"("bikeId");

-- CreateIndex
CREATE INDEX "SeasonalPricing_shop_idx" ON "SeasonalPricing"("shop");

-- CreateIndex
CREATE INDEX "Addon_shop_idx" ON "Addon"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_confirmationCode_key" ON "Reservation"("confirmationCode");
CREATE INDEX "Reservation_shop_idx" ON "Reservation"("shop");
CREATE INDEX "Reservation_bikeId_idx" ON "Reservation"("bikeId");
CREATE INDEX "Reservation_startDate_endDate_idx" ON "Reservation"("startDate", "endDate");
CREATE INDEX "Reservation_confirmationCode_idx" ON "Reservation"("confirmationCode");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerInfo_reservationId_key" ON "CustomerInfo"("reservationId");

-- CreateIndex
CREATE INDEX "ReservationAddon_reservationId_idx" ON "ReservationAddon"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "AppSettings_shop_key" ON "AppSettings"("shop");

-- CreateIndex
CREATE INDEX "BlockedDate_shop_idx" ON "BlockedDate"("shop");
CREATE INDEX "BlockedDate_bikeId_idx" ON "BlockedDate"("bikeId");
