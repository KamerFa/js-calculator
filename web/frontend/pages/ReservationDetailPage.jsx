import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Badge,
  Spinner,
  Banner,
  IndexTable,
  Select,
  TextField,
  Modal,
  Divider,
} from "@shopify/polaris";
import { useApiQuery, useAppFetch } from "../hooks/useApi";
import StatusBadge from "../components/StatusBadge";

const TRANSITIONS = {
  reserved: ["confirmed", "cancelled"],
  confirmed: ["picked_up", "cancelled"],
  picked_up: ["returned", "overdue"],
  returned: ["completed"],
  overdue: ["returned", "cancelled"],
};

export default function ReservationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useApiQuery(`/api/reservations/${id}`);
  const appFetch = useAppFetch();
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [conditionNote, setConditionNote] = useState("");
  const [updating, setUpdating] = useState(false);

  const reservation = data?.reservation;

  const handleUpdateStatus = useCallback(async () => {
    setUpdating(true);
    try {
      await appFetch(`/api/reservations/${id}/status`, {
        method: "PUT",
        body: JSON.stringify({
          status: newStatus,
          note: statusNote || undefined,
          conditionOnReturn: newStatus === "returned" ? conditionNote : undefined,
        }),
      });
      setShowStatusModal(false);
      setStatusNote("");
      setConditionNote("");
      refetch();
    } catch (err) {
      console.error("Status update error:", err);
    } finally {
      setUpdating(false);
    }
  }, [appFetch, id, newStatus, statusNote, conditionNote, refetch]);

  if (loading) {
    return (
      <Page title="Reservation" backAction={{ onAction: () => navigate("/reservations") }}>
        <Card><Spinner size="large" /></Card>
      </Page>
    );
  }

  if (error || !reservation) {
    return (
      <Page title="Reservation" backAction={{ onAction: () => navigate("/reservations") }}>
        <Banner tone="critical">{error || "Not found"}</Banner>
      </Page>
    );
  }

  const availableTransitions = TRANSITIONS[reservation.status] || [];

  return (
    <Page
      title={`Reservation${reservation.shopifyOrderName ? ` — ${reservation.shopifyOrderName}` : ""}`}
      backAction={{ onAction: () => navigate("/reservations") }}
      titleMetadata={<StatusBadge status={reservation.status} />}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd">Customer</Text>
              <BlockStack gap="100">
                <Text variant="bodyMd" fontWeight="bold">
                  {reservation.customerName || "Walk-in customer"}
                </Text>
                {reservation.customerEmail && (
                  <Text variant="bodySm">{reservation.customerEmail}</Text>
                )}
                {reservation.customerPhone && (
                  <Text variant="bodySm">{reservation.customerPhone}</Text>
                )}
              </BlockStack>

              <Divider />

              <Text variant="headingMd">Items</Text>
              <IndexTable
                itemCount={reservation.items?.length || 0}
                headings={[
                  { title: "Product" },
                  { title: "Dates" },
                  { title: "Duration" },
                  { title: "Qty" },
                  { title: "Price" },
                  { title: "Deposit" },
                ]}
                selectable={false}
              >
                {(reservation.items || []).map((item, i) => (
                  <IndexTable.Row id={item.id} key={item.id} position={i}>
                    <IndexTable.Cell>
                      <Text variant="bodyMd" fontWeight="bold">
                        {item.rentalProduct?.title || "Unknown"}
                      </Text>
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      {new Date(item.startDate).toLocaleDateString()} —{" "}
                      {new Date(item.endDate).toLocaleDateString()}
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      {item.duration} {item.durationUnit}
                    </IndexTable.Cell>
                    <IndexTable.Cell>{item.quantity}</IndexTable.Cell>
                    <IndexTable.Cell>
                      ${parseFloat(item.linePrice).toFixed(2)}
                    </IndexTable.Cell>
                    <IndexTable.Cell>
                      ${parseFloat(item.deposit).toFixed(2)}
                    </IndexTable.Cell>
                  </IndexTable.Row>
                ))}
              </IndexTable>

              <Divider />

              <InlineStack align="space-between">
                <Text variant="headingSm">Total</Text>
                <Text variant="headingSm">
                  ${parseFloat(reservation.totalPrice).toFixed(2)}
                </Text>
              </InlineStack>
              <InlineStack align="space-between">
                <Text variant="bodySm" tone="subdued">Deposit</Text>
                <Text variant="bodySm">
                  ${parseFloat(reservation.depositTotal).toFixed(2)}
                  {reservation.depositPaid && (
                    <Badge tone="success">Paid</Badge>
                  )}
                </Text>
              </InlineStack>

              {reservation.conditionOnReturn && (
                <>
                  <Divider />
                  <BlockStack gap="200">
                    <Text variant="headingSm">Condition on Return</Text>
                    <Text variant="bodyMd">{reservation.conditionOnReturn}</Text>
                  </BlockStack>
                </>
              )}

              {reservation.notes && (
                <>
                  <Divider />
                  <BlockStack gap="200">
                    <Text variant="headingSm">Notes</Text>
                    <Text variant="bodyMd">{reservation.notes}</Text>
                  </BlockStack>
                </>
              )}
            </BlockStack>
          </Card>

          {availableTransitions.length > 0 && (
            <div style={{ marginTop: "var(--p-space-400)" }}>
              <Card>
                <BlockStack gap="300">
                  <Text variant="headingSm">Update Status</Text>
                  <InlineStack gap="300">
                    {availableTransitions.map((status) => (
                      <Button
                        key={status}
                        onClick={() => {
                          setNewStatus(status);
                          setShowStatusModal(true);
                        }}
                        variant={status === "cancelled" ? "plain" : "primary"}
                        tone={status === "cancelled" ? "critical" : undefined}
                      >
                        {status.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                      </Button>
                    ))}
                  </InlineStack>
                </BlockStack>
              </Card>
            </div>
          )}
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="400">
              <Text variant="headingSm">Status History</Text>
              {(reservation.statusHistory || []).map((entry) => (
                <BlockStack gap="100" key={entry.id}>
                  <InlineStack gap="200" blockAlign="center">
                    <StatusBadge status={entry.toStatus} />
                    <Text variant="bodySm" tone="subdued">
                      {new Date(entry.createdAt).toLocaleString()}
                    </Text>
                  </InlineStack>
                  {entry.note && (
                    <Text variant="bodySm">{entry.note}</Text>
                  )}
                </BlockStack>
              ))}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      {showStatusModal && (
        <Modal
          open={showStatusModal}
          onClose={() => setShowStatusModal(false)}
          title={`Update to: ${newStatus.replace("_", " ")}`}
          primaryAction={{
            content: "Update",
            onAction: handleUpdateStatus,
            loading: updating,
          }}
          secondaryActions={[
            { content: "Cancel", onAction: () => setShowStatusModal(false) },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="400">
              <TextField
                label="Note (optional)"
                value={statusNote}
                onChange={setStatusNote}
                multiline={2}
                autoComplete="off"
              />
              {newStatus === "returned" && (
                <TextField
                  label="Condition on return"
                  value={conditionNote}
                  onChange={setConditionNote}
                  multiline={2}
                  placeholder="Describe the condition of the returned item(s)"
                  autoComplete="off"
                />
              )}
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}
