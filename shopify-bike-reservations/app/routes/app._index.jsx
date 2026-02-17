import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineGrid,
  Box,
  Badge,
  DataTable,
  EmptyState,
  Banner,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // Ensure settings exist
  await prisma.appSettings.upsert({
    where: { shop },
    create: { shop },
    update: {},
  });

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [totalBikes, activeBikes, todayReservations, upcomingReservations, recentBookings] =
    await Promise.all([
      prisma.bike.count({ where: { shop } }),
      prisma.bike.count({ where: { shop, isActive: true } }),
      prisma.reservation.count({
        where: {
          shop,
          status: "confirmed",
          startDate: { lte: todayEnd },
          endDate: { gte: todayStart },
        },
      }),
      prisma.reservation.count({
        where: {
          shop,
          status: "confirmed",
          startDate: { gte: todayStart, lte: weekEnd },
        },
      }),
      prisma.reservation.findMany({
        where: { shop },
        include: { bike: true, customerInfo: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

  const isSetupComplete = totalBikes > 0;

  return json({
    stats: {
      totalBikes,
      activeBikes,
      todayReservations,
      upcomingReservations,
    },
    recentBookings,
    isSetupComplete,
  });
};

export default function Dashboard() {
  const { stats, recentBookings, isSetupComplete } = useLoaderData();

  const recentRows = recentBookings.map((r) => [
    r.confirmationCode,
    r.bike?.name || "Unknown",
    r.customerInfo ? `${r.customerInfo.firstName} ${r.customerInfo.lastName}` : "N/A",
    new Date(r.startDate).toLocaleDateString("en-GB"),
    new Date(r.endDate).toLocaleDateString("en-GB"),
    `${r.totalPrice} BAM`,
    r.status === "confirmed" ? (
      <Badge tone="success">Confirmed</Badge>
    ) : r.status === "completed" ? (
      <Badge>Completed</Badge>
    ) : r.status === "cancelled" ? (
      <Badge tone="critical">Cancelled</Badge>
    ) : (
      <Badge tone="warning">{r.status}</Badge>
    ),
  ]);

  return (
    <Page title="Bike Reservations">
      <BlockStack gap="500">
        {!isSetupComplete && (
          <Banner
            title="Get started"
            tone="info"
            action={{ content: "Add your first bike", url: "/app/bikes" }}
          >
            <p>
              Add your motorbikes to the fleet, set up pricing tiers, and configure
              your settings to start accepting reservations.
            </p>
          </Banner>
        )}

        <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm" tone="subdued">
                Fleet Size
              </Text>
              <Text as="p" variant="headingXl">
                {stats.activeBikes}/{stats.totalBikes}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                active bikes
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm" tone="subdued">
                Today's Rentals
              </Text>
              <Text as="p" variant="headingXl">
                {stats.todayReservations}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                bikes out today
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm" tone="subdued">
                This Week
              </Text>
              <Text as="p" variant="headingXl">
                {stats.upcomingReservations}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                upcoming reservations
              </Text>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm" tone="subdued">
                Availability
              </Text>
              <Text as="p" variant="headingXl">
                {stats.activeBikes - stats.todayReservations}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                bikes available now
              </Text>
            </BlockStack>
          </Card>
        </InlineGrid>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Recent Bookings
                </Text>
                {recentRows.length > 0 ? (
                  <DataTable
                    columnContentTypes={[
                      "text", "text", "text", "text", "text", "numeric", "text",
                    ]}
                    headings={[
                      "Code", "Bike", "Customer", "Pickup", "Return", "Total", "Status",
                    ]}
                    rows={recentRows}
                  />
                ) : (
                  <EmptyState
                    heading="No bookings yet"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>
                      Once customers start making reservations through your store,
                      they will appear here.
                    </p>
                  </EmptyState>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
