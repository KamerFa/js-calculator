import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  InlineGrid,
  Select,
  Badge,
  EmptyState,
  Banner,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getBikeCalendar } from "../utils/availability.server";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const url = new URL(request.url);
  const now = new Date();
  const year = parseInt(url.searchParams.get("year") || now.getFullYear());
  const month = parseInt(url.searchParams.get("month") || (now.getMonth() + 1));

  const bikes = await prisma.bike.findMany({
    where: { shop, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, imageUrl: true },
  });

  // Get calendar for each bike
  const bikeCalendars = [];
  for (const bike of bikes) {
    const calendar = await getBikeCalendar(shop, bike.id, year, month);
    bikeCalendars.push({ bike, calendar });
  }

  // Get upcoming reservations for context
  const startOfMonth = new Date(year, month - 1, 1);
  const endOfMonth = new Date(year, month, 0, 23, 59, 59);

  const reservations = await prisma.reservation.findMany({
    where: {
      shop,
      status: { in: ["confirmed", "pending"] },
      startDate: { lte: endOfMonth },
      endDate: { gte: startOfMonth },
    },
    include: {
      bike: { select: { name: true } },
      customerInfo: { select: { firstName: true, lastName: true } },
    },
    orderBy: { startDate: "asc" },
  });

  return json({ bikes, bikeCalendars, reservations, year, month });
};

export default function Availability() {
  const { bikeCalendars, reservations, year, month } = useLoaderData();
  const [searchParams, setSearchParams] = useSearchParams();

  const now = new Date();
  const currentYear = now.getFullYear();

  const monthOptions = MONTH_NAMES.map((name, i) => ({
    label: name,
    value: String(i + 1),
  }));

  const yearOptions = [currentYear, currentYear + 1].map((y) => ({
    label: String(y),
    value: String(y),
  }));

  function navigateMonth(dir) {
    let newMonth = month + dir;
    let newYear = year;
    if (newMonth < 1) { newMonth = 12; newYear--; }
    if (newMonth > 12) { newMonth = 1; newYear++; }
    setSearchParams({ year: String(newYear), month: String(newMonth) });
  }

  return (
    <Page
      title="Availability Schedule"
      subtitle={`${MONTH_NAMES[month - 1]} ${year}`}
    >
      <BlockStack gap="500">
        {/* Month navigation */}
        <Card>
          <InlineStack align="space-between" blockAlign="center">
            <button
              onClick={() => navigateMonth(-1)}
              style={{
                background: "none", border: "1px solid #ccc", borderRadius: 6,
                padding: "8px 16px", cursor: "pointer", fontSize: 14,
              }}
            >
              &larr; Previous
            </button>
            <InlineStack gap="200">
              <Select
                label=""
                labelHidden
                options={monthOptions}
                value={String(month)}
                onChange={(v) => setSearchParams({ year: String(year), month: v })}
              />
              <Select
                label=""
                labelHidden
                options={yearOptions}
                value={String(year)}
                onChange={(v) => setSearchParams({ year: v, month: String(month) })}
              />
            </InlineStack>
            <button
              onClick={() => navigateMonth(1)}
              style={{
                background: "none", border: "1px solid #ccc", borderRadius: 6,
                padding: "8px 16px", cursor: "pointer", fontSize: 14,
              }}
            >
              Next &rarr;
            </button>
          </InlineStack>
        </Card>

        {bikeCalendars.length === 0 ? (
          <Card>
            <EmptyState
              heading="No rental bikes configured"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>Enable rental on products from the Dashboard first.</p>
            </EmptyState>
          </Card>
        ) : (
          bikeCalendars.map(({ bike, calendar }) => (
            <Card key={bike.id}>
              <BlockStack gap="300">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">{bike.name}</Text>
                  <InlineStack gap="200">
                    <Badge tone="success">
                      {calendar.filter((d) => d.available).length} days free
                    </Badge>
                    <Badge tone="critical">
                      {calendar.filter((d) => d.isBooked).length} days booked
                    </Badge>
                    {calendar.some((d) => d.isBlocked) && (
                      <Badge tone="warning">
                        {calendar.filter((d) => d.isBlocked).length} blocked
                      </Badge>
                    )}
                  </InlineStack>
                </InlineStack>

                {/* Calendar grid */}
                <div style={{ overflowX: "auto" }}>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, 1fr)",
                    gap: 2,
                    minWidth: 350,
                  }}>
                    {DAY_NAMES.map((day) => (
                      <div key={day} style={{
                        textAlign: "center", padding: 6,
                        fontSize: 12, fontWeight: 600, color: "#6b7280",
                      }}>
                        {day}
                      </div>
                    ))}
                    {/* Empty cells for days before the 1st */}
                    {Array.from({ length: getStartDayOffset(year, month) }).map((_, i) => (
                      <div key={`empty-${i}`} />
                    ))}
                    {calendar.map((day) => {
                      const dayNum = new Date(day.date).getDate();
                      const isToday = day.date === now.toISOString().split("T")[0];
                      let bg = "#e8f5e9"; // green = available
                      let color = "#2e7d32";
                      if (day.isBooked) { bg = "#ffebee"; color = "#c62828"; }
                      if (day.isBlocked) { bg = "#fff3e0"; color = "#e65100"; }
                      return (
                        <div
                          key={day.date}
                          style={{
                            textAlign: "center",
                            padding: "8px 4px",
                            borderRadius: 6,
                            fontSize: 13,
                            fontWeight: isToday ? 700 : 400,
                            background: bg,
                            color,
                            border: isToday ? "2px solid #1a1a2e" : "none",
                          }}
                          title={
                            day.isBooked ? "Booked" :
                            day.isBlocked ? "Blocked" : "Available"
                          }
                        >
                          {dayNum}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Legend */}
                <InlineStack gap="300">
                  <InlineStack gap="100" blockAlign="center">
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: "#e8f5e9" }} />
                    <Text variant="bodySm">Available</Text>
                  </InlineStack>
                  <InlineStack gap="100" blockAlign="center">
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: "#ffebee" }} />
                    <Text variant="bodySm">Booked</Text>
                  </InlineStack>
                  <InlineStack gap="100" blockAlign="center">
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: "#fff3e0" }} />
                    <Text variant="bodySm">Blocked</Text>
                  </InlineStack>
                </InlineStack>
              </BlockStack>
            </Card>
          ))
        )}

        {/* Reservations this month */}
        {reservations.length > 0 && (
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Reservations in {MONTH_NAMES[month - 1]}
              </Text>
              {reservations.map((r) => (
                <div
                  key={r.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 12px",
                    background: "#f8f9fa",
                    borderRadius: 8,
                    fontSize: 14,
                  }}
                >
                  <div>
                    <strong>{r.bike?.name}</strong>
                    {" — "}
                    {r.customerInfo
                      ? `${r.customerInfo.firstName} ${r.customerInfo.lastName}`
                      : "Unknown"}
                  </div>
                  <div style={{ color: "#6b7280" }}>
                    {new Date(r.startDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    {" – "}
                    {new Date(r.endDate).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </div>
                  <Badge tone={r.status === "confirmed" ? "success" : "warning"}>
                    {r.status}
                  </Badge>
                </div>
              ))}
            </BlockStack>
          </Card>
        )}
      </BlockStack>
    </Page>
  );
}

function getStartDayOffset(year, month) {
  // 0=Sun, 1=Mon ... We want Monday first
  const firstDay = new Date(year, month - 1, 1).getDay();
  return firstDay === 0 ? 6 : firstDay - 1;
}
