import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation, Link } from "@remix-run/react";
import { useState, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineGrid,
  InlineStack,
  Box,
  Badge,
  DataTable,
  EmptyState,
  Banner,
  Button,
  Thumbnail,
  ResourceList,
  ResourceItem,
  Modal,
  TextField,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const PRODUCTS_QUERY = `
  query getProducts($first: Int!) {
    products(first: $first) {
      edges {
        node {
          id
          title
          description
          status
          featuredImage {
            url
            altText
          }
          variants(first: 1) {
            edges {
              node {
                price
              }
            }
          }
        }
      }
    }
  }
`;

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;

  try {
    // Ensure settings exist
    await prisma.appSettings.upsert({
      where: { shop },
      create: { shop },
      update: {},
    });

    // Fetch products from Shopify
    const response = await admin.graphql(PRODUCTS_QUERY, {
      variables: { first: 50 },
    });
    const { data } = await response.json();
    const shopifyProducts = data.products.edges.map((e) => e.node);

    // Get all rental-enabled bikes for this shop
    const rentalBikes = await prisma.bike.findMany({
      where: { shop },
      include: {
        _count: {
          select: {
            reservations: {
              where: { status: { in: ["confirmed", "pending"] } },
            },
          },
        },
      },
    });

    // Build a map of shopifyProductId -> rental config
    const rentalMap = {};
    for (const bike of rentalBikes) {
      rentalMap[bike.shopifyProductId] = bike;
    }

    // Stats
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [todayReservations, upcomingReservations, recentBookings] =
      await Promise.all([
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

    const activeBikes = rentalBikes.filter((b) => b.isActive).length;

    return json({
      shopifyProducts,
      rentalMap,
      stats: {
        totalProducts: shopifyProducts.length,
        rentalEnabled: rentalBikes.length,
        activeBikes,
        todayReservations,
        upcomingReservations,
      },
      recentBookings,
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return json({
      shopifyProducts: [],
      rentalMap: {},
      stats: {
        totalProducts: 0,
        rentalEnabled: 0,
        activeBikes: 0,
        todayReservations: 0,
        upcomingReservations: 0,
      },
      recentBookings: [],
      dbError: error.message,
    });
  }
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "enableRental") {
    const shopifyProductId = formData.get("shopifyProductId");
    const name = formData.get("name");
    const imageUrl = formData.get("imageUrl") || null;
    const description = formData.get("description") || null;

    await prisma.bike.upsert({
      where: { shop_shopifyProductId: { shop, shopifyProductId } },
      create: {
        shop,
        shopifyProductId,
        name,
        imageUrl,
        description,
        isActive: true,
      },
      update: {
        name,
        imageUrl,
        description,
        isActive: true,
      },
    });
  }

  if (intent === "disableRental") {
    const shopifyProductId = formData.get("shopifyProductId");
    const bike = await prisma.bike.findUnique({
      where: { shop_shopifyProductId: { shop, shopifyProductId } },
    });
    if (bike) {
      // Check for active reservations before disabling
      const activeCount = await prisma.reservation.count({
        where: { bikeId: bike.id, status: { in: ["confirmed", "pending"] } },
      });
      if (activeCount > 0) {
        return json(
          { error: "Cannot disable rental — there are active reservations for this product." },
          { status: 400 }
        );
      }
      await prisma.bike.update({
        where: { id: bike.id },
        data: { isActive: false },
      });
    }
  }

  if (intent === "updatePlateNumber") {
    const shopifyProductId = formData.get("shopifyProductId");
    const plateNumber = formData.get("plateNumber") || null;
    await prisma.bike.update({
      where: { shop_shopifyProductId: { shop, shopifyProductId } },
      data: { plateNumber },
    });
  }

  return json({ ok: true });
};

export default function Dashboard() {
  const { shopifyProducts, rentalMap, stats, recentBookings, dbError } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isLoading = navigation.state !== "idle";

  const [editingProduct, setEditingProduct] = useState(null);
  const [plateNumber, setPlateNumber] = useState("");

  const handleEnableRental = useCallback(
    (product) => {
      const data = new FormData();
      data.set("intent", "enableRental");
      data.set("shopifyProductId", product.id);
      data.set("name", product.title);
      data.set("imageUrl", product.featuredImage?.url || "");
      data.set("description", product.description || "");
      submit(data, { method: "post" });
    },
    [submit]
  );

  const handleDisableRental = useCallback(
    (productId) => {
      if (!confirm("Disable rental for this product?")) return;
      const data = new FormData();
      data.set("intent", "disableRental");
      data.set("shopifyProductId", productId);
      submit(data, { method: "post" });
    },
    [submit]
  );

  const openPlateEditor = useCallback((product) => {
    const rental = rentalMap[product.id];
    setPlateNumber(rental?.plateNumber || "");
    setEditingProduct(product);
  }, [rentalMap]);

  const handleSavePlate = useCallback(() => {
    if (!editingProduct) return;
    const data = new FormData();
    data.set("intent", "updatePlateNumber");
    data.set("shopifyProductId", editingProduct.id);
    data.set("plateNumber", plateNumber);
    submit(data, { method: "post" });
    setEditingProduct(null);
  }, [editingProduct, plateNumber, submit]);

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
        {dbError && (
          <Banner title="Database Error" tone="critical">
            <p>{dbError}</p>
            <p>Make sure your database is migrated. Run: <code>npx prisma migrate deploy</code></p>
          </Banner>
        )}

        {/* Quick Navigation */}
        <InlineGrid columns={{ xs: 2, sm: 3, md: 5 }} gap="400">
          <Link to="/app/availability" style={{ textDecoration: "none" }}>
            <Card>
              <BlockStack gap="200" inlineAlign="center">
                <Text as="h3" variant="headingSm" alignment="center">
                  Availability
                </Text>
                <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                  Bike schedule & calendar
                </Text>
              </BlockStack>
            </Card>
          </Link>
          <Link to="/app/bookings" style={{ textDecoration: "none" }}>
            <Card>
              <BlockStack gap="200" inlineAlign="center">
                <Text as="h3" variant="headingSm" alignment="center">
                  Bookings
                </Text>
                <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                  View & manage reservations
                </Text>
              </BlockStack>
            </Card>
          </Link>
          <Link to="/app/pricing" style={{ textDecoration: "none" }}>
            <Card>
              <BlockStack gap="200" inlineAlign="center">
                <Text as="h3" variant="headingSm" alignment="center">
                  Pricing
                </Text>
                <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                  Set rental prices & tiers
                </Text>
              </BlockStack>
            </Card>
          </Link>
          <Link to="/app/addons" style={{ textDecoration: "none" }}>
            <Card>
              <BlockStack gap="200" inlineAlign="center">
                <Text as="h3" variant="headingSm" alignment="center">
                  Add-ons
                </Text>
                <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                  Manage extras (helmet, GPS)
                </Text>
              </BlockStack>
            </Card>
          </Link>
          <Link to="/app/settings" style={{ textDecoration: "none" }}>
            <Card>
              <BlockStack gap="200" inlineAlign="center">
                <Text as="h3" variant="headingSm" alignment="center">
                  Settings
                </Text>
                <Text as="p" variant="bodySm" tone="subdued" alignment="center">
                  Business config & notifications
                </Text>
              </BlockStack>
            </Card>
          </Link>
        </InlineGrid>

        <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm" tone="subdued">
                Shopify Products
              </Text>
              <Text as="p" variant="headingXl">
                {stats.totalProducts}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                in your store
              </Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm" tone="subdued">
                Rental Enabled
              </Text>
              <Text as="p" variant="headingXl">
                {stats.activeBikes}/{stats.rentalEnabled}
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                active rentals
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
        </InlineGrid>

        {/* Products list with rental status */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">
                    Your Products
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Enable rental for products customers can reserve
                  </Text>
                </InlineStack>

                {shopifyProducts.length > 0 ? (
                  <ResourceList
                    resourceName={{ singular: "product", plural: "products" }}
                    items={shopifyProducts}
                    renderItem={(product) => {
                      const rental = rentalMap[product.id];
                      const isRentalEnabled = rental?.isActive;
                      const activeReservations = rental?._count?.reservations || 0;

                      return (
                        <ResourceItem
                          id={product.id}
                          media={
                            <Thumbnail
                              source={
                                product.featuredImage?.url ||
                                "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png"
                              }
                              alt={product.title}
                              size="medium"
                            />
                          }
                          shortcutActions={
                            isRentalEnabled
                              ? [
                                  {
                                    content: "Edit Plate #",
                                    onAction: () => openPlateEditor(product),
                                  },
                                  {
                                    content: "Disable Rental",
                                    destructive: true,
                                    onAction: () => handleDisableRental(product.id),
                                  },
                                ]
                              : [
                                  {
                                    content: "Enable Rental",
                                    onAction: () => handleEnableRental(product),
                                  },
                                ]
                          }
                        >
                          <InlineStack align="space-between" blockAlign="center">
                            <BlockStack gap="100">
                              <Text variant="bodyMd" fontWeight="bold">
                                {product.title}
                              </Text>
                              {rental?.plateNumber && (
                                <Text variant="bodySm" tone="subdued">
                                  Plate: {rental.plateNumber}
                                </Text>
                              )}
                            </BlockStack>
                            <InlineStack gap="200">
                              {activeReservations > 0 && (
                                <Badge tone="info">
                                  {activeReservations} active
                                </Badge>
                              )}
                              {isRentalEnabled ? (
                                <Badge tone="success">Rental Enabled</Badge>
                              ) : rental && !rental.isActive ? (
                                <Badge tone="warning">Rental Disabled</Badge>
                              ) : (
                                <Badge>Not Rentable</Badge>
                              )}
                            </InlineStack>
                          </InlineStack>
                        </ResourceItem>
                      );
                    }}
                  />
                ) : (
                  <EmptyState
                    heading="No products found"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>
                      Add products to your Shopify store first, then come back here to
                      enable them for rental.
                    </p>
                  </EmptyState>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Recent bookings */}
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

      {/* Plate number editor modal */}
      {editingProduct && (
        <Modal
          open={true}
          onClose={() => setEditingProduct(null)}
          title={`Edit ${editingProduct.title}`}
          primaryAction={{
            content: "Save",
            onAction: handleSavePlate,
            loading: isLoading,
          }}
          secondaryActions={[{ content: "Cancel", onAction: () => setEditingProduct(null) }]}
        >
          <Modal.Section>
            <TextField
              label="Plate Number"
              value={plateNumber}
              onChange={setPlateNumber}
              autoComplete="off"
              placeholder="e.g. A12-B-345"
              helpText="Physical plate number for this vehicle"
            />
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}
