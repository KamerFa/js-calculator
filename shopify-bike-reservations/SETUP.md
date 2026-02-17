# Bike Reservations — Shopify App Setup Guide

## Overview

A Shopify app for managing motorbike rental reservations in Sarajevo. Features include:
- Multi-step booking modal on your storefront (pop-up or embedded)
- Real-time availability checking
- Tiered pricing (half day, 1.5 days, 4 days) + seasonal adjustments
- Add-ons (helmets, GPS, insurance)
- Full customer info collection (name, contact, license, ID)
- Deposit payment via Shopify, remainder on pickup
- Auto-confirm with email + WhatsApp notifications
- Admin dashboard inside Shopify

---

## Prerequisites

- Node.js 18+
- [Shopify CLI](https://shopify.dev/docs/apps/tools/cli)
- A [Shopify Partner account](https://partners.shopify.com/)
- A development store

---

## Quick Start

### 1. Install dependencies

```bash
cd shopify-bike-reservations
npm install
```

### 2. Create your app in Shopify Partners

1. Go to https://partners.shopify.com/
2. Create a new app
3. Copy the **API Key** and **API Secret**

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:
- `SHOPIFY_API_KEY` — from Shopify Partners
- `SHOPIFY_API_SECRET` — from Shopify Partners
- `DATABASE_URL` — leave as `file:./dev.db` for SQLite

### 4. Set up the database

```bash
npx prisma generate
npx prisma migrate deploy
```

### 5. Update shopify.app.toml

Replace `client_id` with your API key and `dev_store_url` with your dev store domain.

### 6. Start development

```bash
npm run dev
```

This launches the Shopify CLI dev server, creates a tunnel, and opens your app in the dev store admin.

---

## App Setup (First Run)

1. **Add Bikes** — Go to Fleet tab, add your motorbikes with names, images, engine sizes
2. **Set Pricing** — Go to Pricing tab, create default tiers:
   - Half Day (4h) — e.g. 30 BAM
   - 1.5 Days (36h) — e.g. 60 BAM
   - 4 Days (96h) — e.g. 150 BAM
3. **Add Seasonal Pricing** — e.g. "Summer Peak" (Jun-Sep) x1.3 multiplier
4. **Add Extras** — Go to Add-ons tab, add helmets, GPS, insurance, etc.
5. **Configure Settings** — Set deposit %, notification email/WhatsApp, pickup location

---

## Theme Integration

### Option A: Reservation Button (Pop-up Modal)

1. In Shopify Admin, go to **Online Store > Themes > Customize**
2. Add the **"Reserve Bike Button"** app block to any section
3. Configure the button text, colors, and your App URL
4. The button opens a full booking modal overlay

### Option B: Dedicated Booking Page

1. Create a new page in Shopify (e.g. `/pages/book`)
2. In the theme customizer, add the **"Reservation Page"** app block
3. This renders the full booking flow inline on the page

---

## Notifications

### Email
Configure SMTP in `.env`:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```
For Gmail, use an [App Password](https://myaccount.google.com/apppasswords).

### WhatsApp
Requires [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started) or Twilio.
```
WHATSAPP_API_URL=https://graph.facebook.com/v18.0/YOUR_PHONE_ID/messages
WHATSAPP_ACCESS_TOKEN=your_token
```

---

## Deployment

### Fly.io (Recommended)

```bash
fly launch
fly secrets set SHOPIFY_API_KEY=xxx SHOPIFY_API_SECRET=xxx DATABASE_URL="file:/data/prod.db"
fly deploy
```

### Docker

A Dockerfile can be generated with:
```bash
npx shopify app generate dockerfile
```

---

## Architecture

```
shopify-bike-reservations/
├── app/
│   ├── routes/
│   │   ├── app.jsx              # Admin layout + nav
│   │   ├── app._index.jsx       # Dashboard
│   │   ├── app.bikes.jsx        # Fleet management
│   │   ├── app.bookings.jsx     # Booking management
│   │   ├── app.pricing.jsx      # Pricing tiers + seasonal
│   │   ├── app.addons.jsx       # Add-ons / extras
│   │   ├── app.settings.jsx     # App settings
│   │   ├── api.bikes.jsx        # Public: available bikes
│   │   ├── api.pricing.jsx      # Public: pricing calculation
│   │   ├── api.addons.jsx       # Public: add-ons list
│   │   ├── api.availability.jsx # Public: calendar availability
│   │   └── api.reservations.jsx # Public: create/lookup reservations
│   ├── utils/
│   │   ├── pricing.server.js    # Pricing calculation logic
│   │   ├── availability.server.js # Availability checking
│   │   ├── notifications.server.js # Email + WhatsApp
│   │   └── confirmation.server.js  # Confirmation code generator
│   ├── db.server.js             # Prisma client
│   └── shopify.server.js        # Shopify auth + config
├── prisma/
│   └── schema.prisma            # Database schema
├── extensions/
│   └── bike-reservation-widget/ # Theme App Extension
│       ├── assets/
│       │   ├── reservation-modal.js  # Storefront booking widget
│       │   └── reservation-modal.css # Widget styles
│       └── blocks/
│           ├── reservation-button.liquid # Pop-up trigger block
│           └── reservation-page.liquid   # Inline page block
└── shopify.app.toml             # App config
```

---

## Booking Flow

1. Customer clicks **"Reserve a Bike"** button on your store
2. Modal opens → **Select dates** (pick-up + return)
3. **Choose bike** — only available bikes shown, with pricing
4. **Add extras** — helmets, insurance, GPS (optional)
5. **Enter details** — name, email, phone, license, ID
6. **Confirm** — reservation created, confirmation code shown
7. Owner receives **email + WhatsApp** notification
8. Customer pays **deposit** (via Shopify checkout link)
9. Customer pays **remainder on pickup**
