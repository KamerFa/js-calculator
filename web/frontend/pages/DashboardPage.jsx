import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  EmptyState,
  Spinner,
  Banner,
  ResourceList,
  ResourceItem,
  Thumbnail,
  Badge,
} from "@shopify/polaris";
import { useApiQuery } from "../hooks/useApi";
import StatusBadge from "../components/StatusBadge";

export default function DashboardPage() {
  const { data, loading, error } = useApiQuery("/api/dashboard");
  const navigate = useNavigate();

  if (loading) {
    return (
      <Page title="Dashboard">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack align="center" inlineAlign="center">
                <Spinner size="large" />
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  if (error) {
    return (
      <Page title="Dashboard">
        <Layout>
          <Layout.Section>
            <Banner tone="critical">{error}</Banner>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  const {
    todaysPickups = [],
    activeRentals = 0,
    returnsDue = [],
    overdueItems = 0,
    recentReservations = [],
    totalReservations = 0,
    totalProducts = 0,
  } = data || {};

  const hasData = totalReservations > 0 || totalProducts > 0;

  if (!hasData) {
    return (
      <Page title="Dashboard">
        <Layout>
          <Layout.Section>
            <Card>
              <EmptyState
                heading="Welcome to Rental Manager"
                action={{
                  content: "Set up rental products",
                  onAction: () => navigate("/products"),
                }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>
                  Get started by configuring which products in your store are
                  available for rent.
                </p>
              </EmptyState>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page title="Dashboard">
      <Layout>
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text variant="headingSm" as="h3">
                Active Rentals
              </Text>
              <Text variant="heading2xl" as="p">
                {activeRentals}
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text variant="headingSm" as="h3">
                Overdue
              </Text>
              <Text
                variant="heading2xl"
                as="p"
                tone={overdueItems > 0 ? "critical" : undefined}
              >
                {overdueItems}
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text variant="headingSm" as="h3">
                Rental Products
              </Text>
              <Text variant="heading2xl" as="p">
                {totalProducts}
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        {todaysPickups.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Today's Pickups
                </Text>
                <ResourceList
                  items={todaysPickups}
                  renderItem={(reservation) => (
                    <ResourceItem
                      id={reservation.id}
                      onClick={() =>
                        navigate(`/reservations/${reservation.id}`)
                      }
                    >
                      <InlineStack align="space-between" blockAlign="center">
                        <BlockStack gap="100">
                          <Text variant="bodyMd" fontWeight="bold">
                            {reservation.customerName || "Walk-in"}
                          </Text>
                          <Text variant="bodySm" tone="subdued">
                            {reservation.items
                              ?.map((i) => i.rentalProduct?.title)
                              .join(", ")}
                          </Text>
                        </BlockStack>
                        <StatusBadge status={reservation.status} />
                      </InlineStack>
                    </ResourceItem>
                  )}
                />
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {returnsDue.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">
                  Returns Due Today
                </Text>
                <ResourceList
                  items={returnsDue}
                  renderItem={(reservation) => (
                    <ResourceItem
                      id={reservation.id}
                      onClick={() =>
                        navigate(`/reservations/${reservation.id}`)
                      }
                    >
                      <InlineStack align="space-between" blockAlign="center">
                        <BlockStack gap="100">
                          <Text variant="bodyMd" fontWeight="bold">
                            {reservation.customerName || "Walk-in"}
                          </Text>
                          <Text variant="bodySm" tone="subdued">
                            {reservation.items
                              ?.map((i) => i.rentalProduct?.title)
                              .join(", ")}
                          </Text>
                        </BlockStack>
                        <StatusBadge status={reservation.status} />
                      </InlineStack>
                    </ResourceItem>
                  )}
                />
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">
                Recent Reservations
              </Text>
              <ResourceList
                items={recentReservations}
                renderItem={(reservation) => (
                  <ResourceItem
                    id={reservation.id}
                    onClick={() =>
                      navigate(`/reservations/${reservation.id}`)
                    }
                  >
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="100">
                        <Text variant="bodyMd" fontWeight="bold">
                          {reservation.customerName ||
                            reservation.shopifyOrderName ||
                            "Walk-in"}
                        </Text>
                        <Text variant="bodySm" tone="subdued">
                          {reservation.items
                            ?.map((i) => i.rentalProduct?.title)
                            .join(", ")}
                        </Text>
                      </BlockStack>
                      <InlineStack gap="300" blockAlign="center">
                        <Text variant="bodySm" tone="subdued">
                          ${parseFloat(reservation.totalPrice || 0).toFixed(2)}
                        </Text>
                        <StatusBadge status={reservation.status} />
                      </InlineStack>
                    </InlineStack>
                  </ResourceItem>
                )}
              />
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
