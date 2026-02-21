# Shopify Rental App — Master Implementation Plan

> **Repo:** `KamerFa/js-calculator`
> **Stack:** Express + Prisma + React/Polaris + Vanilla JS storefront widget
> **Date:** 2026-02-21

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [What's Already Built](#2-whats-already-built)
3. [Competitive Landscape](#3-competitive-landscape)
4. [Gap Analysis & Priority Matrix](#4-gap-analysis--priority-matrix)
5. [Implementation Sprints](#5-implementation-sprints)
   - [Sprint 1: Automated Overdue Detection + Email Notifications](#sprint-1-automated-overdue-detection--email-notifications)
   - [Sprint 2: Calendar Sync (Google/iCal/Outlook)](#sprint-2-calendar-sync-googleicaloutlook)
   - [Sprint 3: Customer Self-Service Portal](#sprint-3-customer-self-service-portal)
   - [Sprint 4: Rent-or-Buy Toggle + Insurance Upsell](#sprint-4-rent-or-buy-toggle--insurance-upsell)
   - [Sprint 5: Seasonal Pricing + Discount Engine](#sprint-5-seasonal-pricing--discount-engine)
   - [Sprint 6: Deposit Refund Workflow + Damage Tracking](#sprint-6-deposit-refund-workflow--damage-tracking)
   - [Sprint 7: Analytics Dashboard + Reporting](#sprint-7-analytics-dashboard--reporting)
   - [Sprint 8: Multi-language (i18n) Support](#sprint-8-multi-language-i18n-support)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    SHOPIFY ADMIN (iframe)                    │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              React + Polaris Frontend                  │  │
│  │  ┌──────────┬──────────┬──────────┬────────────────┐  │  │
│  │  │Dashboard │Products  │Reserva-  │  Calendar  │Set-│  │  │
│  │  │  Page    │  Page    │tions Page│   Page    │tings│  │  │
│  │  └────┬─────┴────┬─────┴────┬─────┴─────┬─────┴──┬─┘  │  │
│  │       │          │          │           │        │     │  │
│  │       ▼          ▼          ▼           ▼        ▼     │  │
│  │  ┌─────────────────────────────────────────────────┐   │  │
│  │  │           useApi.js (App Bridge auth)            │   │  │
│  │  └──────────────────────┬──────────────────────────┘   │  │
│  └─────────────────────────┼──────────────────────────────┘  │
└────────────────────────────┼─────────────────────────────────┘
                             │ authenticated fetch
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                  Express.js Server                           │
│                                                              │
│  shopify.js ──► auth middleware ──► verifyRequest             │
│                                                              │
│  Routes:                                                     │
│  ├─ /api/dashboard    GET         (stats & KPIs)             │
│  ├─ /api/products     CRUD        (rental product config)    │
│  ├─ /api/reservations CRUD+status (booking lifecycle)        │
│  ├─ /api/calendar     GET         (timeline data)            │
│  ├─ /api/settings     CRUD        (app config + blackouts)   │
│  ├─ /api/storefront   PUBLIC      (widget API)               │
│  └─ /api/webhooks     PUBLIC      (GDPR + Shopify events)    │
│                                                              │
│  Helpers:                                                    │
│  ├─ pricing.js    calculateRentalPrice / checkAvailability   │
│  └─ validation.js validateProduct / validateReservation      │
│                                                              │
│                         ┌──────────┐                         │
│                         │  Prisma  │                         │
│                         └────┬─────┘                         │
└──────────────────────────────┼───────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │    PostgreSQL DB     │
                    │                     │
                    │  Session            │
                    │  RentalProduct      │
                    │  InventoryUnit      │
                    │  Reservation        │
                    │  ReservationItem    │
                    │  Customer           │
                    │  StatusHistory      │
                    │  BlackoutDate       │
                    │  AppSettings        │
                    └─────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              SHOPIFY STOREFRONT (product pages)              │
│                                                              │
│  rental-widget.liquid  ──► rental-widget.js (vanilla JS)     │
│                              │                               │
│       ┌──────────────────────┤                               │
│       │  Date picker         │  Calls /api/storefront/*      │
│       │  Qty selector        │  ├─ GET  /product/:id         │
│       │  Availability check  │  ├─ POST /availability        │
│       │  Price display       │  ├─ POST /price               │
│       │  Add-to-cart         │  └─ POST /cart                 │
│       └──────────────────────┘                               │
│                                                              │
│  rental-widget.css  (theme-aware or standalone styling)       │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. What's Already Built

### Core Rental Engine
- **Product config** — hourly/daily/weekly rates, deposit, quantity, min/max duration, buffer time
- **Smart pricing** — auto-selects best rate tier (weekly+daily combo for long rentals)
- **Availability** — counts overlapping reservations, respects blackouts + buffer time
- **Reservation lifecycle** — `reserved → confirmed → picked_up → returned → completed` with `cancelled`/`overdue` branches
- **Status audit trail** — every transition logged with timestamp + note

### Admin UI (7 pages)
- Dashboard with KPIs (active rentals, overdue, today's pickups/returns)
- Products list + detail with Shopify resource picker integration
- Reservations list with filters + detail with status controls
- Calendar (month grid) + product timeline
- Settings (business hours, defaults, deposit policy, widget appearance, blackout dates)

### Storefront Widget
- Vanilla JS IIFE, zero dependencies
- Date pickers, quantity selector, live availability + price
- Adds to Shopify cart with line item properties (`_rental_*`)
- Theme-aware styling (inherits Shopify CSS vars) or standalone mode

### Infrastructure
- GDPR webhooks (data request, customer redact, shop redact)
- Prisma migrations, Render.com deploy config
- App Bridge v4 CDN auth (no server-side OAuth redirects)
- CSP headers for embedded iframe security

---

## 3. Competitive Landscape

### Top Competitors Analyzed

| App | Rating | Pricing | Strength | Weakness |
|-----|--------|---------|----------|----------|
| **BookThatApp** | 4.7/5 (507 reviews) | Free → $39/mo | Most mature; 8K+ merchants; seasonal rates, group booking, Zoom integration, API | Calendar design customization limited |
| **IzyRent** | High (praised) | ~$25/mo | Best UX; Airbnb/iCal sync; auto-block dates; deposit + pay-later | Limited design customization |
| **Booqable** | Positive (7.5K+ businesses) | $29–Enterprise/mo | Full rental platform; inventory tracking, mobile app, website builder, barcode scanning | Standalone platform (not Shopify-native) |
| **Product Rentals Pro** | 5.0/5 (41 reviews) | Usage-based | Perfect 5-star; Rent-or-Buy toggle; insurance upsell; buffer by delivery method | Smaller user base; email-only support |
| **Sesami** | 4.6/5 (418 reviews) | Free → $299/mo | Booking flows SDK; Klaviyo integration; POS; multi-language; group appointments | Service-focused (less product rental) |
| **FlexCon** | 5.0/5 (4 reviews) | Free (beta) | Currently free; deposit refund workflow; try-on appointments; hybrid rent/sell | New/beta; limited reviews |
| **Webkul Booking** | — | $18/mo | 6 booking types; QR codes; Google Meet; staff management; cart-lock | Complex setup; jack-of-all-trades |
| **Rentinus** | — | Usage-based | Rent + sell same product/variant in one cart | Limited features beyond dual-mode |
| **ShopSTR** | Mixed | — | Good website builder; Shopify payment processing | 27+ bugs reported; unstable for large operators |

### What Customers Love (across all apps)
- **Responsive support** — #1 mentioned positive across every app
- **Simple setup** — merchants want to be live in minutes, not days
- **Clean calendar UI** — visual availability is critical
- **Shopify-native feel** — embedded admin, no external dashboards

### What Customers Hate (across all apps)
- **Calendar customization** — can't match store branding
- **Missing email notifications** — manual follow-up is painful
- **No auto-overdue** — have to manually mark items overdue
- **Buggy date handling** — timezone issues, off-by-one errors
- **Limited reporting** — "how much revenue did rentals generate this month?"

---

## 4. Gap Analysis & Priority Matrix

Ranked by **impact × effort** — highest ROI first:

| Priority | Feature | Impact | Effort | Competitors With It |
|----------|---------|--------|--------|-------------------|
| **P0** | Auto overdue detection (cron job) | High | Low | All mature apps |
| **P0** | Email notifications (confirmation, reminder, overdue) | High | Medium | BookThatApp, IzyRent, Sesami |
| **P1** | Google/iCal/Outlook calendar export (iCal feed) | High | Medium | BookThatApp, IzyRent, Booqable |
| **P1** | Customer self-service (cancel/reschedule from storefront) | High | Medium | BookThatApp, Sesami |
| **P2** | Rent-or-Buy toggle on product page | Medium | Low | Product Rentals Pro, FlexCon |
| **P2** | Insurance upsell option | Medium | Low | Product Rentals Pro |
| **P2** | Seasonal/dynamic pricing rules | Medium | Medium | BookThatApp |
| **P3** | Deposit refund workflow (track refund status) | Medium | Medium | FlexCon, Webkul |
| **P3** | Damage/condition tracking with photos | Medium | Medium | — (differentiator) |
| **P3** | Analytics & revenue reporting | Medium | Medium | Booqable, Sesami |
| **P4** | Multi-language (i18n) | Low | Medium | Sesami, BookThatApp |
| **P4** | Shopify POS integration | Low | High | Sesami, Booqable |
| **P4** | Recurring/subscription rentals | Low | High | BookThatApp |

---

## 5. Implementation Sprints

> **How to use:** Copy-paste each sprint section into Claude as a standalone prompt.
> Each sprint is self-contained with the full context needed to implement it.

---

### Sprint 1: Automated Overdue Detection + Email Notifications

**Copy the prompt below into Claude:**

```
## Task: Implement automated overdue detection and email notifications for the Shopify rental app

### Context
This is a Shopify rental app at /home/user/js-calculator with:
- Express.js backend in server/
- Prisma ORM with PostgreSQL (schema at prisma/schema.prisma)
- React/Polaris frontend in web/frontend/
- Reservation status lifecycle: reserved → confirmed → picked_up → returned → completed (+ cancelled, overdue)
- Status transitions validated in server/helpers/validation.js

### Requirements

#### 1. Overdue Detection Cron Job
Create `server/jobs/overdue-checker.js`:
- Runs every hour via setInterval (no external deps needed)
- Queries all reservations where:
  - status = "picked_up"
  - ALL reservation items have endDate < now
- Transitions each to status "overdue"
- Creates StatusHistory entry: fromStatus="picked_up", toStatus="overdue", changedBy="system", note="Auto-marked overdue"
- Logs count of newly overdue reservations
- Initialize the interval in server/index.js on startup

#### 2. Email Notification System
Create `server/services/email.js`:
- Use Shopify's built-in email capabilities via the Admin API, OR
- Implement a lightweight SMTP sender using nodemailer (add to package.json)
- Support these notification types:
  - `reservation_confirmed` — sent when status → confirmed
  - `pickup_reminder` — sent 24h before startDate (check in cron)
  - `return_reminder` — sent 24h before endDate (check in cron)
  - `overdue_notice` — sent when auto-marked overdue
- Each email template is a function returning { subject, html, text }
- Templates should include: customer name, reservation ID, item list, dates, total price
- Keep templates simple — inline CSS, no external template engine needed

#### 3. Notification Preferences in Settings
- Add to AppSettings model in prisma/schema.prisma:
  - emailNotificationsEnabled Boolean @default(true)
  - emailFromName String @default("Rental Manager")
  - smtpHost String?
  - smtpPort Int?
  - smtpUser String?
  - smtpPass String?
- Add SMTP config section to SettingsPage.jsx (collapsible card)
- Add "Send test email" button that sends a test to the shop owner

#### 4. Hook Notifications into Status Transitions
- In server/routes/reservations.js PUT /:id/status handler:
  - After successful status update, fire the appropriate email
  - Don't await the email (fire-and-forget, log errors)

#### 5. Notification Log (optional but nice)
- Add NotificationLog model to prisma/schema.prisma:
  - id, reservationId, type, recipient, subject, status (sent/failed), error, createdAt
- Log every send attempt

Create the Prisma migration after schema changes. Don't break existing functionality.
Test the overdue checker logic by reading the existing cron-less code and ensuring the query is correct.
```

---

### Sprint 2: Calendar Sync (Google/iCal/Outlook)

**Copy the prompt below into Claude:**

```
## Task: Add iCal calendar feed export for Google Calendar, iCal, and Outlook

### Context
This is a Shopify rental app at /home/user/js-calculator with:
- Express.js backend in server/
- Prisma ORM (schema at prisma/schema.prisma)
- Existing calendar route at server/routes/calendar.js (protected, returns reservation items + blackouts for a date range)
- Storefront proxy at /api/storefront (public, shop identified by query param)

### Requirements

#### 1. iCal Feed Generation
Create `server/services/ical.js`:
- Use the `ical-generator` npm package (add to package.json)
- Function: `generateCalendarFeed(shop, options)` where options = { type: "all" | "product", productId? }
- Each reservation item becomes a VEVENT:
  - DTSTART = item.startDate
  - DTEND = item.endDate
  - SUMMARY = `Rental: ${product.title} - ${customer.customerName}`
  - DESCRIPTION = `Reservation #${reservation.id}\nStatus: ${reservation.status}\nQty: ${item.quantity}\nCustomer: ${customer.customerName} (${customer.customerEmail})`
  - UID = `${item.id}@rental-manager`
  - STATUS = map reservation.status to iCal status (CONFIRMED/TENTATIVE/CANCELLED)
- Blackout dates become VEVENT with:
  - SUMMARY = `[BLOCKED] ${blackout.reason || "Unavailable"}`
  - TRANSP = OPAQUE

#### 2. Public Calendar Feed Endpoint
Add to server/routes/calendar.js (or a new route):
- GET `/api/calendar/feed/:token.ics`
  - Token = base64(shop + ":" + secret) — validates the feed belongs to this shop
  - Returns `text/calendar` content type
  - No session auth required (feed URLs must work in Google Calendar)
  - Query params: ?type=all or ?type=product&productId=xxx

#### 3. Feed Token Management
- Add to AppSettings model in prisma/schema.prisma:
  - calendarFeedToken String? @default(uuid())
- Generate token on first settings load if null
- Add "Regenerate" button (invalidates old feed URLs)

#### 4. Admin UI — Calendar Sync Section
In web/frontend/pages/SettingsPage.jsx, add a "Calendar Sync" card:
- Show the feed URL (read-only text field with copy button)
- "Add to Google Calendar" link: `https://calendar.google.com/calendar/r?cid=webcal://YOUR_FEED_URL`
- "Add to Outlook" link: direct webcal:// link
- "Add to Apple Calendar" link: webcal:// link
- "Regenerate feed URL" button with confirmation modal
- Per-product feeds: on ProductDetailPage.jsx, add a "Calendar feed" link for that specific product

#### 5. Security
- Feed token must be unguessable (use crypto.randomUUID())
- Rate limit the feed endpoint (max 60 requests/min per token)
- Token regeneration invalidates all existing subscriptions (warn user)
```

---

### Sprint 3: Customer Self-Service Portal

**Copy the prompt below into Claude:**

```
## Task: Build a customer-facing rental management page on the storefront

### Context
This is a Shopify rental app at /home/user/js-calculator with:
- Express.js backend, public storefront API at server/routes/storefront.js
- App proxy configured: prefix="apps", subpath="rentals" → requests to /apps/rentals/* proxy to /api/storefront/*
- Theme extension at extensions/rental-widget/
- Reservation model with customerId linking to Customer model (shopifyCustomerId)

### Requirements

#### 1. Storefront API Endpoints
Add to server/routes/storefront.js:

- **GET /api/storefront/my-rentals?shop=xxx&customerId=xxx**
  - Returns all reservations for this customer (active + past)
  - Sorted by startDate descending
  - Include: items with product title, dates, status, total price
  - Security: customerId must be validated against Shopify's logged-in customer (see below)

- **POST /api/storefront/cancel**
  - Body: { shop, customerId, reservationId }
  - Only cancellable if status is "reserved" or "confirmed"
  - Transitions to "cancelled", creates StatusHistory (changedBy="customer")
  - Fires cancellation email notification (from Sprint 1)

- **POST /api/storefront/reschedule**
  - Body: { shop, customerId, reservationId, items: [{ itemId, newStartDate, newEndDate }] }
  - Validates new dates pass availability check
  - Updates ReservationItem dates
  - Recalculates pricing
  - Creates StatusHistory note: "Rescheduled by customer"
  - Fires rescheduled email notification

#### 2. Customer Authentication
- Use Shopify's customer account proxy headers:
  - The app proxy forwards `X-Shopify-Customer-Id` for logged-in customers
  - Validate this header matches the customerId in the request
  - Return 401 if not logged-in or mismatched

#### 3. Storefront "My Rentals" Page
Create a new Liquid page template or app proxy page:

Option A (recommended): Serve an HTML page from the storefront route
- **GET /api/storefront/my-rentals-page?shop=xxx**
  - Returns a full HTML page (or a snippet the theme can render)
  - Use vanilla JS (consistent with existing widget approach)

Create `extensions/rental-widget/blocks/my-rentals.liquid`:
- New theme app extension block for "My Rentals" page
- Customer must be logged in (check `customer` liquid object)
- Renders a container div, loads my-rentals.js

Create `extensions/rental-widget/assets/my-rentals.js`:
- Fetches /apps/rentals/my-rentals?customerId=XXX
- Renders:
  - **Active Rentals** section:
    - Card per reservation: product image, title, dates, status badge, price
    - "Cancel" button (if cancellable) → confirmation dialog → POST /cancel
    - "Reschedule" button (if status=reserved|confirmed) → date picker modal → POST /reschedule
  - **Past Rentals** section:
    - Same cards but read-only, greyed out
    - "Rent Again" button → navigates to product page
- Style with rental-widget.css (extend existing styles)
- Theme-aware (same inherit-theme logic as rental widget)

#### 4. Admin Visibility
- In ReservationDetailPage.jsx, show a badge if the action was taken by the customer
- StatusHistory entries with changedBy="customer" get a distinct label

#### 5. Settings Toggle
- Add to AppSettings: allowCustomerCancel Boolean @default(true), allowCustomerReschedule Boolean @default(true)
- Add toggles in SettingsPage.jsx under a "Customer Self-Service" card
- Storefront endpoints check these settings before allowing actions

Create the Prisma migration. Update the extension's shopify.extension.toml if adding new blocks.
```

---

### Sprint 4: Rent-or-Buy Toggle + Insurance Upsell

**Copy the prompt below into Claude:**

```
## Task: Add "Rent or Buy" product option and optional insurance upsell to the storefront widget

### Context
This is a Shopify rental app at /home/user/js-calculator with:
- Storefront widget: extensions/rental-widget/assets/rental-widget.js (vanilla JS IIFE)
- Widget fetches product config from /api/storefront/product/:id
- Widget adds to cart via Shopify's /cart/add.js with line item properties
- RentalProduct model has: hourlyRate, dailyRate, weeklyRate, depositAmount

### Requirements

#### 1. Schema Changes
Add to RentalProduct in prisma/schema.prisma:
- allowPurchase Boolean @default(false)  // enable buy option alongside rent
- purchaseVariantId String?              // Shopify variant ID for purchase (can be same or different)
- insuranceEnabled Boolean @default(false)
- insuranceRate Decimal? @db.Decimal(10,2)  // flat fee per rental
- insuranceDescription String? @default("Covers accidental damage during the rental period")

#### 2. Admin UI Updates
In web/frontend/pages/ProductDetailPage.jsx:
- Add "Purchase Option" card:
  - Toggle: "Allow customers to buy this product"
  - If enabled: variant picker for purchase variant (can default to same variant)
- Add "Insurance" card:
  - Toggle: "Offer rental insurance"
  - If enabled: insurance fee (currency input), description (text field)
- Save these fields alongside existing product config

#### 3. Storefront Widget Updates
In extensions/rental-widget/assets/rental-widget.js:

**Rent or Buy Toggle:**
- If product.allowPurchase is true, render a toggle/tab at the top of the widget:
  - [Rent] [Buy] — two buttons, "Rent" selected by default
  - When "Buy" is selected:
    - Hide date pickers, quantity stays
    - Show product's regular Shopify price
    - "Add to Cart" button adds the purchase variant normally (no rental properties)
  - When "Rent" is selected:
    - Show the existing rental UI (dates, availability, price)

**Insurance Upsell:**
- If product.insuranceEnabled is true and mode is "Rent":
  - Below the price summary, show a checkbox:
    - [ ] Add rental insurance — $X.XX
    - Description text below checkbox
  - When checked:
    - Add insurance fee to displayed total
    - Include `_rental_insurance: "true"` and `_rental_insurance_fee: "X.XX"` in cart line properties

#### 4. Storefront API Updates
In server/routes/storefront.js:
- GET /product/:id — include allowPurchase, purchaseVariantId, insuranceEnabled, insuranceRate, insuranceDescription in response
- POST /price — if insurance=true in body, add insuranceRate to response
- POST /cart — if insurance=true, store it on the reservation (add insuranceFee field to ReservationItem model)

#### 5. Reservation Display
- In ReservationDetailPage.jsx items table, show "Insurance" column if any item has insurance
- In the storefront my-rentals page (Sprint 3), show insurance status

Create Prisma migration. Keep the widget JS clean — no external deps.
```

---

### Sprint 5: Seasonal Pricing + Discount Engine

**Copy the prompt below into Claude:**

```
## Task: Implement seasonal pricing rules and a basic discount engine

### Context
This is a Shopify rental app at /home/user/js-calculator with:
- Pricing logic in server/helpers/pricing.js (calculateRentalPrice function)
- RentalProduct model has hourlyRate, dailyRate, weeklyRate
- Storefront POST /price endpoint calculates price for a date range

### Requirements

#### 1. New Prisma Models
Add to prisma/schema.prisma:

model PricingRule {
  id              String   @id @default(uuid())
  shop            String
  rentalProductId String?  // null = applies to all products
  rentalProduct   RentalProduct? @relation(fields: [rentalProductId], references: [id], onDelete: Cascade)
  name            String           // e.g., "Summer Peak", "Holiday Discount"
  type            String           // "seasonal_rate" | "duration_discount" | "early_bird"
  // Seasonal rate fields
  startDate       DateTime?        // season start (recurring yearly if recurring=true)
  endDate         DateTime?        // season end
  recurring       Boolean @default(true)  // same dates every year
  multiplier      Decimal? @db.Decimal(5,2)  // e.g., 1.5 = 150% of base rate
  // Duration discount fields
  minDays         Int?             // discount kicks in after this many days
  discountPct     Decimal? @db.Decimal(5,2)  // percentage off
  // Common
  priority        Int     @default(0)  // higher = applied first
  active          Boolean @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  @@index([shop])
}

Add relation to RentalProduct: pricingRules PricingRule[]

#### 2. Pricing Engine Updates
In server/helpers/pricing.js, update calculateRentalPrice:
- After calculating the base price, query applicable PricingRules
- Apply rules in priority order:
  1. **seasonal_rate**: if rental dates overlap with a seasonal period, apply multiplier to the overlapping days (pro-rate if partial overlap)
  2. **duration_discount**: if rental duration >= minDays, apply discountPct to total
  3. **early_bird**: if booking is made >= N days before startDate, apply discountPct
- Return breakdown: { basePrice, seasonalAdjustment, durationDiscount, finalPrice, rulesApplied: [...] }

#### 3. Admin UI — Pricing Rules Page
Create web/frontend/pages/PricingRulesPage.jsx:
- Table of existing rules: Name, Type, Product (or "All"), Date range, Multiplier/Discount, Active toggle
- "Add rule" button → modal with:
  - Name (text)
  - Type (select: Seasonal rate, Duration discount, Early bird)
  - Product (select from rental products, or "All products")
  - Conditional fields based on type:
    - Seasonal: start date, end date, recurring checkbox, rate multiplier (e.g., 1.5x)
    - Duration: min days, discount percentage
    - Early bird: days in advance, discount percentage
  - Priority number
- Edit/delete existing rules
- Add route in App.jsx: /pricing-rules → PricingRulesPage

#### 4. API Route
Create server/routes/pricing-rules.js:
- GET /api/pricing-rules — list rules for shop (with optional product filter)
- POST /api/pricing-rules — create rule
- PUT /api/pricing-rules/:id — update rule
- DELETE /api/pricing-rules/:id — delete rule
- Register in server/index.js

#### 5. Storefront Price Display
- Update POST /api/storefront/price to return the breakdown
- In rental-widget.js, show:
  - Base price (with strikethrough if discounted)
  - Applied rules (e.g., "Summer rate +50%", "7+ day discount -10%")
  - Final price

Create Prisma migration. Add the route to the nav menu in App.jsx.
```

---

### Sprint 6: Deposit Refund Workflow + Damage Tracking

**Copy the prompt below into Claude:**

```
## Task: Implement deposit refund tracking and damage/condition reporting

### Context
This is a Shopify rental app at /home/user/js-calculator with:
- Reservation model has: depositTotal, depositPaid (boolean)
- ReservationDetailPage.jsx shows deposit info
- Status lifecycle: reserved → confirmed → picked_up → returned → completed

### Requirements

#### 1. Schema Changes
Add to Reservation in prisma/schema.prisma:
- depositRefunded   Boolean  @default(false)
- depositRefundAmt  Decimal? @db.Decimal(10,2)
- depositRefundNote String?
- depositRefundedAt DateTime?

Add new model:

model ConditionReport {
  id             String   @id @default(uuid())
  reservationId  String
  reservation    Reservation @relation(fields: [reservationId], references: [id], onDelete: Cascade)
  type           String   // "checkout" | "return"
  notes          String
  photoUrls      String[] // array of URLs (stored in Shopify Files or external)
  reportedBy     String   // staff name or "customer"
  createdAt      DateTime @default(now())
}

Add to Reservation: conditionReports ConditionReport[]

#### 2. Condition Report UI
In web/frontend/pages/ReservationDetailPage.jsx:

**On pickup (status → picked_up):**
- Show "Checkout Condition Report" card:
  - Notes textarea (describe item condition at checkout)
  - Photo upload (up to 5 photos) — use Shopify's stagedUploadsCreate mutation or simple URL input for MVP
  - Save creates a ConditionReport with type="checkout"

**On return (status → returned):**
- Show "Return Condition Report" card:
  - Same as above but type="return"
  - Side-by-side comparison: checkout condition vs return condition
  - "Flag damage" checkbox → if checked, shows damage fee input

**Condition History:**
- Display all condition reports on the reservation detail page
- Show photos inline (or as thumbnails with lightbox)

#### 3. Deposit Refund Controls
In ReservationDetailPage.jsx, when status is "returned" or "completed":
- Show "Deposit Refund" card:
  - Deposit amount: $XX.XX
  - Refund amount input (default = full deposit, can reduce for damages)
  - Refund note (reason for partial/no refund)
  - "Process Refund" button → PUT /api/reservations/:id/refund
  - Status indicators: Pending / Partial Refund / Full Refund / Withheld

#### 4. API Endpoints
In server/routes/reservations.js:

- **POST /api/reservations/:id/condition-report**
  - Body: { type, notes, photoUrls, reportedBy }
  - Validates reservation exists, type is valid

- **PUT /api/reservations/:id/refund**
  - Body: { refundAmount, note }
  - Sets depositRefunded=true, depositRefundAmt, depositRefundNote, depositRefundedAt
  - Creates StatusHistory entry with note
  - Fires refund email notification

#### 5. Dashboard Updates
- In DashboardPage.jsx, add "Pending Refunds" count (returned reservations where depositPaid=true and depositRefunded=false)
- Make it clickable → navigates to filtered reservations list

Create Prisma migration.
```

---

### Sprint 7: Analytics Dashboard + Reporting

**Copy the prompt below into Claude:**

```
## Task: Build an analytics and reporting dashboard for rental business insights

### Context
This is a Shopify rental app at /home/user/js-calculator with:
- Prisma ORM with Reservation, ReservationItem, RentalProduct, Customer models
- Existing DashboardPage.jsx shows basic KPIs (active rentals, overdue, today's pickups/returns)
- Express backend with authenticated API routes

### Requirements

#### 1. Analytics API Endpoint
Create server/routes/analytics.js:

- **GET /api/analytics?period=30d|90d|12m|custom&start=&end=**
  Returns:

  **Revenue Metrics:**
  - totalRevenue: sum of all completed reservation totalPrice in period
  - revenueByMonth: [{ month, revenue }] for chart
  - revenueByProduct: [{ productId, title, revenue, count }] top 10
  - avgOrderValue: totalRevenue / completedReservations
  - depositRevenue: sum of deposits collected
  - insuranceRevenue: sum of insurance fees (if Sprint 4 done)

  **Utilization Metrics:**
  - utilizationRate: (booked days / available days) * 100 per product
  - topProducts: [{ productId, title, totalRentals, avgDuration, revenue }]
  - underperformers: products with < 20% utilization

  **Customer Metrics:**
  - totalCustomers: distinct customers in period
  - repeatCustomerRate: customers with 2+ reservations / total
  - topCustomers: [{ name, email, totalSpent, rentalCount }] top 10
  - newVsReturning: { new, returning } counts

  **Operational Metrics:**
  - avgRentalDuration: average days per reservation
  - cancellationRate: cancelled / total reservations
  - overdueRate: overdue / total active
  - onTimeReturnRate: returned on or before endDate / total returns
  - statusBreakdown: { reserved, confirmed, picked_up, returned, completed, cancelled, overdue }

#### 2. Analytics Page
Create web/frontend/pages/AnalyticsPage.jsx:

- Period selector: Last 30 days | Last 90 days | Last 12 months | Custom range
- 4 KPI cards at top: Total Revenue, Avg Order Value, Utilization Rate, Repeat Customer Rate
- Revenue chart (use Polaris's VerticalStack + simple bar chart via CSS, or a lightweight chart lib like recharts — add to web/package.json)
- Top Products table: rank, product, rentals, revenue, utilization %
- Customer insights card: new vs returning, top customers
- Operational stats card: on-time rate, cancellation rate, avg duration

#### 3. CSV Export
- "Export" button on analytics page
- GET /api/analytics/export?period=30d&type=reservations|revenue|customers
- Returns CSV with appropriate columns
- Browser downloads the file

#### 4. Navigation
- Add to App.jsx routes: /analytics → AnalyticsPage
- Add to NavMenu in App.jsx

Register the route in server/index.js. Keep queries efficient — use Prisma aggregations (groupBy, aggregate) not raw loops.
```

---

### Sprint 8: Multi-language (i18n) Support

**Copy the prompt below into Claude:**

```
## Task: Add multi-language support to the storefront rental widget

### Context
This is a Shopify rental app at /home/user/js-calculator with:
- Storefront widget: extensions/rental-widget/assets/rental-widget.js (vanilla JS)
- Theme extension locales: extensions/rental-widget/locales/en.default.json (currently minimal)
- Widget renders: "Rent This Item", date labels, price labels, availability messages, button text

### Requirements

#### 1. Expand Locale Files
Update extensions/rental-widget/locales/en.default.json with ALL user-facing strings:
```json
{
  "rental_widget": {
    "name": "Rent This Item",
    "title": "Rent This Item",
    "or_buy": "Or Buy It",
    "mode_rent": "Rent",
    "mode_buy": "Buy",
    "start_date": "Start date",
    "end_date": "End date",
    "quantity": "Quantity",
    "check_availability": "Check Availability",
    "available": "Available",
    "unavailable": "Not available for selected dates",
    "blackout": "Unavailable during this period",
    "select_dates": "Select rental dates to see pricing",
    "duration": "Duration",
    "days": "days",
    "hours": "hours",
    "weeks": "weeks",
    "subtotal": "Subtotal",
    "deposit": "Security deposit",
    "insurance": "Rental insurance",
    "total": "Total",
    "add_to_cart": "Add Rental to Cart",
    "adding": "Adding...",
    "added": "Added to cart!",
    "per_hour": "/hour",
    "per_day": "/day",
    "per_week": "/week",
    "min_duration": "Minimum rental: {{ min }} {{ unit }}",
    "max_duration": "Maximum rental: {{ max }} {{ unit }}",
    "my_rentals_title": "My Rentals",
    "active_rentals": "Active Rentals",
    "past_rentals": "Past Rentals",
    "cancel_rental": "Cancel Rental",
    "reschedule": "Reschedule",
    "rent_again": "Rent Again",
    "no_rentals": "You haven't rented anything yet.",
    "confirm_cancel": "Are you sure you want to cancel this rental?"
  }
}
```

#### 2. Add Additional Languages
Create locale files for top Shopify markets:
- `locales/fr.json` — French
- `locales/de.json` — German
- `locales/es.json` — Spanish
- `locales/nl.json` — Dutch (big rental market)
- `locales/ja.json` — Japanese

Each file follows the same structure. Translate all strings accurately.

#### 3. Widget i18n Integration
In rental-widget.js:
- The theme extension has access to Shopify's `Shopify.locale` or the locale can be read from the HTML lang attribute
- Shopify theme extensions support locales natively via the `t` filter in Liquid
- For JS strings: pass translations via data attributes on the widget container, OR
- Fetch translations from a locale endpoint, OR
- Embed the current locale's strings in the Liquid block as a JSON script tag (recommended — zero extra requests):

In rental-widget.liquid:
```liquid
<script type="application/json" id="rental-widget-i18n">
  {
    "title": {{ 'rental_widget.title' | t | json }},
    "start_date": {{ 'rental_widget.start_date' | t | json }},
    ...
  }
</script>
```

In rental-widget.js:
- Read from #rental-widget-i18n JSON on init
- Replace all hardcoded strings with translation lookups
- Fallback to English if a key is missing

#### 4. Admin-Side i18n (optional, lower priority)
- Polaris supports i18n natively via AppProvider's i18n prop
- For MVP: admin stays English-only (merchants expect English admin)
- Add a note in settings: "Widget language follows your store's language settings"

Keep the Liquid block clean. The JSON approach means zero additional network requests.
```

---

## 6. Execution Order & Dependencies

```
Sprint 1 (Overdue + Email)     ← no dependencies, do first
    │
    ├── Sprint 2 (Calendar Sync)     ← independent, can parallel with 1
    │
    ├── Sprint 3 (Self-Service)      ← uses email from Sprint 1
    │       │
    │       └── Sprint 4 (Rent/Buy + Insurance)  ← extends widget from Sprint 3
    │
    ├── Sprint 5 (Seasonal Pricing)  ← independent of 2-4
    │
    ├── Sprint 6 (Deposits + Damage) ← uses email from Sprint 1
    │
    ├── Sprint 7 (Analytics)         ← best after Sprint 5 (includes pricing data)
    │
    └── Sprint 8 (i18n)             ← do last (translates all strings from previous sprints)
```

**Recommended parallel tracks:**
- **Track A:** Sprint 1 → Sprint 3 → Sprint 4
- **Track B:** Sprint 2 → Sprint 5 → Sprint 7
- **Track C:** Sprint 6 (anytime after Sprint 1)
- **Last:** Sprint 8 (after all UI is finalized)

---

## 7. Files You'll Touch Per Sprint

| Sprint | New Files | Modified Files |
|--------|-----------|---------------|
| 1 | `server/jobs/overdue-checker.js`, `server/services/email.js` | `prisma/schema.prisma`, `server/index.js`, `server/routes/reservations.js`, `web/frontend/pages/SettingsPage.jsx`, `package.json` |
| 2 | `server/services/ical.js` | `prisma/schema.prisma`, `server/routes/calendar.js`, `web/frontend/pages/SettingsPage.jsx`, `web/frontend/pages/ProductDetailPage.jsx`, `package.json` |
| 3 | `extensions/rental-widget/blocks/my-rentals.liquid`, `extensions/rental-widget/assets/my-rentals.js` | `prisma/schema.prisma`, `server/routes/storefront.js`, `web/frontend/pages/ReservationDetailPage.jsx`, `web/frontend/pages/SettingsPage.jsx`, `extensions/rental-widget/shopify.extension.toml` |
| 4 | — | `prisma/schema.prisma`, `server/routes/storefront.js`, `extensions/rental-widget/assets/rental-widget.js`, `web/frontend/pages/ProductDetailPage.jsx`, `web/frontend/pages/ReservationDetailPage.jsx` |
| 5 | `server/routes/pricing-rules.js`, `web/frontend/pages/PricingRulesPage.jsx` | `prisma/schema.prisma`, `server/helpers/pricing.js`, `server/index.js`, `server/routes/storefront.js`, `extensions/rental-widget/assets/rental-widget.js`, `web/frontend/App.jsx` |
| 6 | — | `prisma/schema.prisma`, `server/routes/reservations.js`, `web/frontend/pages/ReservationDetailPage.jsx`, `web/frontend/pages/DashboardPage.jsx` |
| 7 | `server/routes/analytics.js`, `web/frontend/pages/AnalyticsPage.jsx` | `server/index.js`, `web/frontend/App.jsx`, `web/package.json` |
| 8 | `extensions/rental-widget/locales/fr.json`, `de.json`, `es.json`, `nl.json`, `ja.json` | `extensions/rental-widget/locales/en.default.json`, `extensions/rental-widget/blocks/rental-widget.liquid`, `extensions/rental-widget/assets/rental-widget.js`, (Sprint 3's `my-rentals.liquid` + `my-rentals.js`) |

---

*Generated by Claude for KamerFa/js-calculator — Shopify Rental App*
