import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useSearchParams } from "@remix-run/react";
import { useState, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  DataTable,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Button,
  Modal,
  Select,
  TextField,
  Filters,
  ChoiceList,
  EmptyState,
  Divider,
  Box,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "";
  const search = url.searchParams.get("search") || "";

  const where = { shop: session.shop };
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { confirmationCode: { contains: search } },
      { customerInfo: { firstName: { contains: search } } },
      { customerInfo: { lastName: { contains: search } } },
      { customerInfo: { email: { contains: search } } },
      { bike: { name: { contains: search } } },
    ];
  }

  const reservations = await prisma.reservation.findMany({
    where,
    include: {
      bike: true,
      customerInfo: true,
      addons: { include: { addon: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return json({ reservations });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "updateStatus") {
    const id = formData.get("id");
    const status = formData.get("status");
    await prisma.reservation.update({
      where: { id },
      data: { status },
    });
  }

  if (intent === "addNote") {
    const id = formData.get("id");
    const notes = formData.get("notes");
    await prisma.reservation.update({
      where: { id },
      data: { notes },
    });
  }

  return json({ ok: true });
};

export default function BookingsPage() {
  const { reservations } = useLoaderData();
  const submit = useSubmit();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [queryValue, setQueryValue] = useState(searchParams.get("search") || "");
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get("status") ? [searchParams.get("status")] : []
  );

  const handleStatusChange = useCallback(
    (id, status) => {
      const data = new FormData();
      data.set("intent", "updateStatus");
      data.set("id", id);
      data.set("status", status);
      submit(data, { method: "post" });
      setSelectedBooking(null);
    },
    [submit]
  );

  const handleSearch = useCallback(() => {
    const params = new URLSearchParams();
    if (queryValue) params.set("search", queryValue);
    if (statusFilter.length) params.set("status", statusFilter[0]);
    setSearchParams(params);
  }, [queryValue, statusFilter, setSearchParams]);

  const statusBadge = (status) => {
    const tones = {
      confirmed: "success",
      completed: "info",
      cancelled: "critical",
      no_show: "warning",
    };
    return <Badge tone={tones[status] || undefined}>{status}</Badge>;
  };

  const rows = reservations.map((r) => [
    <Button variant="plain" onClick={() => setSelectedBooking(r)}>
      {r.confirmationCode}
    </Button>,
    r.bike?.name || "—",
    r.customerInfo
      ? `${r.customerInfo.firstName} ${r.customerInfo.lastName}`
      : "—",
    r.customerInfo?.phone || "—",
    new Date(r.startDate).toLocaleDateString("en-GB"),
    new Date(r.endDate).toLocaleDateString("en-GB"),
    `${r.totalPrice} BAM`,
    r.depositPaid ? (
      <Badge tone="success">Paid</Badge>
    ) : (
      <Badge tone="warning">Pending</Badge>
    ),
    statusBadge(r.status),
  ]);

  return (
    <Page title="Bookings">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack gap="300" align="start">
                <div style={{ flex: 1 }}>
                  <TextField
                    value={queryValue}
                    onChange={setQueryValue}
                    placeholder="Search by code, name, email, bike..."
                    autoComplete="off"
                    clearButton
                    onClearButtonClick={() => {
                      setQueryValue("");
                      setSearchParams(new URLSearchParams());
                    }}
                  />
                </div>
                <Select
                  label=""
                  labelHidden
                  options={[
                    { label: "All statuses", value: "" },
                    { label: "Confirmed", value: "confirmed" },
                    { label: "Completed", value: "completed" },
                    { label: "Cancelled", value: "cancelled" },
                    { label: "No Show", value: "no_show" },
                  ]}
                  value={statusFilter[0] || ""}
                  onChange={(v) => setStatusFilter(v ? [v] : [])}
                />
                <Button onClick={handleSearch}>Filter</Button>
              </InlineStack>

              {rows.length > 0 ? (
                <DataTable
                  columnContentTypes={[
                    "text", "text", "text", "text", "text", "text", "numeric", "text", "text",
                  ]}
                  headings={[
                    "Code", "Bike", "Customer", "Phone", "Pickup", "Return",
                    "Total", "Deposit", "Status",
                  ]}
                  rows={rows}
                />
              ) : (
                <EmptyState
                  heading="No bookings found"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <p>
                    {queryValue || statusFilter.length
                      ? "Try adjusting your filters."
                      : "Bookings will appear here once customers start reserving."}
                  </p>
                </EmptyState>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      {/* Booking Detail Modal */}
      {selectedBooking && (
        <Modal
          open={true}
          onClose={() => setSelectedBooking(null)}
          title={`Reservation ${selectedBooking.confirmationCode}`}
          secondaryActions={[
            { content: "Close", onAction: () => setSelectedBooking(null) },
          ]}
        >
          <Modal.Section>
            <BlockStack gap="400">
              <Text variant="headingSm">Bike</Text>
              <Text>
                {selectedBooking.bike?.name} ({selectedBooking.pricingTierName || "Custom"})
              </Text>

              <Divider />
              <Text variant="headingSm">Dates</Text>
              <Text>
                {new Date(selectedBooking.startDate).toLocaleDateString("en-GB", {
                  weekday: "short", year: "numeric", month: "short", day: "numeric",
                })}
                {" — "}
                {new Date(selectedBooking.endDate).toLocaleDateString("en-GB", {
                  weekday: "short", year: "numeric", month: "short", day: "numeric",
                })}
              </Text>

              <Divider />
              <Text variant="headingSm">Customer</Text>
              {selectedBooking.customerInfo && (
                <BlockStack gap="100">
                  <Text>
                    {selectedBooking.customerInfo.firstName}{" "}
                    {selectedBooking.customerInfo.lastName}
                  </Text>
                  <Text>{selectedBooking.customerInfo.email}</Text>
                  <Text>{selectedBooking.customerInfo.phone}</Text>
                  {selectedBooking.customerInfo.licenseNumber && (
                    <Text>License: {selectedBooking.customerInfo.licenseNumber}</Text>
                  )}
                  {selectedBooking.customerInfo.idNumber && (
                    <Text>ID: {selectedBooking.customerInfo.idNumber}</Text>
                  )}
                </BlockStack>
              )}

              {selectedBooking.addons.length > 0 && (
                <>
                  <Divider />
                  <Text variant="headingSm">Add-ons</Text>
                  <BlockStack gap="100">
                    {selectedBooking.addons.map((a) => (
                      <Text key={a.id}>
                        {a.addon.name} — {a.priceCharged} BAM
                      </Text>
                    ))}
                  </BlockStack>
                </>
              )}

              <Divider />
              <Text variant="headingSm">Payment</Text>
              <BlockStack gap="100">
                <Text>Subtotal: {selectedBooking.subtotal} BAM</Text>
                <Text>Add-ons: {selectedBooking.addonTotal} BAM</Text>
                {selectedBooking.seasonalMultiplier !== 1 && (
                  <Text>Seasonal: x{selectedBooking.seasonalMultiplier}</Text>
                )}
                <Text fontWeight="bold">
                  Total: {selectedBooking.totalPrice} BAM
                </Text>
                <Text>
                  Deposit: {selectedBooking.depositAmount} BAM{" "}
                  {selectedBooking.depositPaid ? "(Paid)" : "(Pending)"}
                </Text>
                <Text>
                  Remaining:{" "}
                  {(selectedBooking.totalPrice - selectedBooking.depositAmount).toFixed(2)}{" "}
                  BAM
                </Text>
              </BlockStack>

              <Divider />
              <Text variant="headingSm">Actions</Text>
              <InlineStack gap="200">
                {selectedBooking.status === "confirmed" && (
                  <>
                    <Button
                      onClick={() =>
                        handleStatusChange(selectedBooking.id, "completed")
                      }
                    >
                      Mark Completed
                    </Button>
                    <Button
                      tone="critical"
                      onClick={() =>
                        handleStatusChange(selectedBooking.id, "cancelled")
                      }
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() =>
                        handleStatusChange(selectedBooking.id, "no_show")
                      }
                    >
                      No Show
                    </Button>
                  </>
                )}
                {selectedBooking.status === "cancelled" && (
                  <Button
                    onClick={() =>
                      handleStatusChange(selectedBooking.id, "confirmed")
                    }
                  >
                    Re-confirm
                  </Button>
                )}
              </InlineStack>
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}
