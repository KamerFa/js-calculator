import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Page,
  Layout,
  Card,
  IndexTable,
  Text,
  Filters,
  ChoiceList,
  EmptyState,
  Spinner,
  Banner,
  BlockStack,
  InlineStack,
  Pagination,
} from "@shopify/polaris";
import { useApiQuery } from "../hooks/useApi";
import StatusBadge from "../components/StatusBadge";

const STATUS_OPTIONS = [
  { label: "Reserved", value: "reserved" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Picked Up", value: "picked_up" },
  { label: "Returned", value: "returned" },
  { label: "Completed", value: "completed" },
  { label: "Overdue", value: "overdue" },
  { label: "Cancelled", value: "cancelled" },
];

export default function ReservationsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState([]);
  const [page, setPage] = useState(1);

  const queryParams = new URLSearchParams();
  queryParams.set("page", page);
  queryParams.set("limit", "25");
  if (search) queryParams.set("search", search);
  if (statusFilter.length === 1) queryParams.set("status", statusFilter[0]);

  const { data, loading, error } = useApiQuery(
    `/api/reservations?${queryParams.toString()}`
  );

  const handleSearchChange = useCallback((value) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleStatusChange = useCallback((value) => {
    setStatusFilter(value);
    setPage(1);
  }, []);

  const handleClearAll = useCallback(() => {
    setSearch("");
    setStatusFilter([]);
    setPage(1);
  }, []);

  const reservations = data?.reservations || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 25);

  if (loading) {
    return (
      <Page title="Reservations">
        <Card>
          <BlockStack align="center" inlineAlign="center">
            <Spinner size="large" />
          </BlockStack>
        </Card>
      </Page>
    );
  }

  if (error) {
    return (
      <Page title="Reservations">
        <Banner tone="critical">{error}</Banner>
      </Page>
    );
  }

  const filters = [
    {
      key: "status",
      label: "Status",
      filter: (
        <ChoiceList
          title="Status"
          titleHidden
          choices={STATUS_OPTIONS}
          selected={statusFilter}
          onChange={handleStatusChange}
        />
      ),
      shortcut: true,
    },
  ];

  const appliedFilters = statusFilter.length > 0
    ? [
        {
          key: "status",
          label: `Status: ${statusFilter.join(", ")}`,
          onRemove: () => setStatusFilter([]),
        },
      ]
    : [];

  const emptyState = (
    <EmptyState
      heading="No reservations yet"
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>Reservations will appear here when customers rent your products.</p>
    </EmptyState>
  );

  const rowMarkup = reservations.map((reservation, index) => {
    const itemNames = reservation.items
      ?.map((i) => i.rentalProduct?.title)
      .filter(Boolean)
      .join(", ");
    const startDate = reservation.items?.[0]?.startDate
      ? new Date(reservation.items[0].startDate).toLocaleDateString()
      : "—";
    const endDate = reservation.items?.[0]?.endDate
      ? new Date(reservation.items[0].endDate).toLocaleDateString()
      : "—";

    return (
      <IndexTable.Row
        id={reservation.id}
        key={reservation.id}
        position={index}
        onClick={() => navigate(`/reservations/${reservation.id}`)}
      >
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold">
            {reservation.customerName || reservation.shopifyOrderName || "Walk-in"}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text variant="bodySm">{itemNames || "—"}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>{startDate}</IndexTable.Cell>
        <IndexTable.Cell>{endDate}</IndexTable.Cell>
        <IndexTable.Cell>
          ${parseFloat(reservation.totalPrice || 0).toFixed(2)}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <StatusBadge status={reservation.status} />
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page title="Reservations">
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <div style={{ padding: "var(--p-space-400)" }}>
              <Filters
                queryValue={search}
                queryPlaceholder="Search by name, email, or order"
                onQueryChange={handleSearchChange}
                onQueryClear={() => setSearch("")}
                filters={filters}
                appliedFilters={appliedFilters}
                onClearAll={handleClearAll}
              />
            </div>
            <IndexTable
              itemCount={reservations.length}
              emptyState={emptyState}
              headings={[
                { title: "Customer" },
                { title: "Items" },
                { title: "Start" },
                { title: "End" },
                { title: "Total" },
                { title: "Status" },
              ]}
              selectable={false}
            >
              {rowMarkup}
            </IndexTable>
          </Card>
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", padding: "var(--p-space-400)" }}>
              <Pagination
                hasPrevious={page > 1}
                hasNext={page < totalPages}
                onPrevious={() => setPage(page - 1)}
                onNext={() => setPage(page + 1)}
              />
            </div>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
