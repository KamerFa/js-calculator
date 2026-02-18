import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import {
  Page, Layout, Card, Text, BlockStack, InlineGrid, InlineStack,
  Badge, DataTable, EmptyState, Banner,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  let session;
  try {
    ({ session } = await authenticate.admin(request));
  } catch (err) {
    if (err instanceof Response) throw err;
    return json({ stats: {}, recentBookings: [], dbError: err.message });
  }
  const shop = session.shop;

  try {
    const settings = await prisma.appSettings.upsert({
      where: { shop },
      create: { shop },
      update: {},
    });

    if (!settings.onboardingComplete) {
      return redirect("/app/onboarding");
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      totalTypes, totalItems, activeItems,
      todayReservations, upcomingReservations, recentBookings,
    ] = await Promise.all([
      prisma.rentalItemType.count({ where: { shop } }),
      prisma.rentalItem.count({ where: { shop } }),
      prisma.rentalItem.count({ where: { shop, isActive: true } }),
      prisma.reservation.count({
        where: {
          shop, status: "confirmed",
          startDate: { lte: todayEnd }, endDate: { gte: todayStart },
        },
      }),
      prisma.reservation.count({
        where: {
          shop, status: "confirmed",
          startDate: { gte: todayStart, lte: weekEnd },
        },
      }),
      prisma.reservation.findMany({
        where: { shop },
        include: {
          rentalItem: { include: { rentalItemType: { select: { name: true } } } },
          customerInfo: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

    return json({
      stats: {
        totalTypes, totalItems, activeItems,
        todayReservations, upcomingReservations,
      },
      recentBookings,
      currency: settings.currency || "USD",
    });
  } catch (error) {
    return json({
      stats: {}, recentBookings: [],
      dbError: error.message,
    });
  }
};

export default function Dashboard() {
  const { stats, recentBookings, currency, dbError } = useLoaderData();

  const recentRows = (recentBookings || []).map((r) => [
    r.confirmationCode,
    r.rentalItem?.name || "—",
    r.rentalItem?.rentalItemType?.name || "—",
    r.customerInfo ? `${r.customerInfo.firstName} ${r.customerInfo.lastName}` : "—",
    new Date(r.startDate).toLocaleDateString("en-GB"),
    new Date(r.endDate).toLocaleDateString("en-GB"),
    `${r.totalPrice} ${currency || "USD"}`,
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
    <Page title="Rental Dashboard">
      <BlockStack gap="500">
        {dbError && (
          <Banner title="Database Error" tone="critical">
            <p>{dbError}</p>
          </Banner>
        )}

        <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm" tone="subdued">Rental Types</Text>
              <Text as="p" variant="headingXl">{stats.totalTypes || 0}</Text>
              <Text as="p" variant="bodySm" tone="subdued">categories configured</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm" tone="subdued">Active Items</Text>
              <Text as="p" variant="headingXl">{stats.activeItems || 0}/{stats.totalItems || 0}</Text>
              <Text as="p" variant="bodySm" tone="subdued">rentable products</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm" tone="subdued">Today's Rentals</Text>
              <Text as="p" variant="headingXl">{stats.todayReservations || 0}</Text>
              <Text as="p" variant="bodySm" tone="subdued">active today</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm" tone="subdued">This Week</Text>
              <Text as="p" variant="headingXl">{stats.upcomingReservations || 0}</Text>
              <Text as="p" variant="bodySm" tone="subdued">upcoming reservations</Text>
            </BlockStack>
          </Card>
        </InlineGrid>

        <InlineGrid columns={{ xs: 2, sm: 3, md: 5 }} gap="400">
          {[
            { to: "/app/item-types", title: "Rental Items", desc: "Manage types & items" },
            { to: "/app/bookings", title: "Bookings", desc: "View reservations" },
            { to: "/app/availability", title: "Availability", desc: "Calendar schedule" },
            { to: "/app/pricing", title: "Pricing", desc: "Set rental prices" },
            { to: "/app/settings", title: "Settings", desc: "Business config" },
          ].map(({ to, title, desc }) => (
            <Link key={to} to={to} style={{ textDecoration: "none" }}>
              <Card>
                <BlockStack gap="200" inlineAlign="center">
                  <Text as="h3" variant="headingSm" alignment="center">{title}</Text>
                  <Text as="p" variant="bodySm" tone="subdued" alignment="center">{desc}</Text>
                </BlockStack>
              </Card>
            </Link>
          ))}
        </InlineGrid>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Recent Bookings</Text>
                {recentRows.length > 0 ? (
                  <DataTable
                    columnContentTypes={["text","text","text","text","text","text","numeric","text"]}
                    headings={["Code","Item","Type","Customer","Pickup","Return","Total","Status"]}
                    rows={recentRows}
                  />
                ) : (
                  <EmptyState
                    heading="No bookings yet"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>Reservations will appear here once customers start booking.</p>
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
