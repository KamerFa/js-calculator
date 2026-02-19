import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Spinner,
  Banner,
  Badge,
  Tooltip,
} from "@shopify/polaris";
import { useApiQuery } from "../hooks/useApi";
import StatusBadge from "../components/StatusBadge";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getMonthRange(year, month) {
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59);
  return { start, end };
}

function dateKey(date) {
  return date.toISOString().split("T")[0];
}

export default function CalendarPage() {
  const navigate = useNavigate();
  const [viewDate, setViewDate] = useState(new Date());
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const { start, end } = getMonthRange(year, month);
  const { data, loading, error } = useApiQuery(
    `/api/calendar?start=${start.toISOString()}&end=${end.toISOString()}`
  );

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  // Build a map of date -> items for the timeline
  const dateItemMap = useMemo(() => {
    const map = {};
    if (!data?.products) return map;

    for (const [pid, product] of Object.entries(data.products)) {
      for (const item of product.items) {
        const s = new Date(item.startDate);
        const e = new Date(item.endDate);
        const cursor = new Date(s);
        while (cursor <= e) {
          const key = dateKey(cursor);
          if (!map[key]) map[key] = [];
          map[key].push({
            ...item,
            productTitle: product.productTitle,
          });
          cursor.setDate(cursor.getDate() + 1);
        }
      }
    }

    // Add blackouts
    if (data.blackouts) {
      for (const b of data.blackouts) {
        const s = new Date(b.startDate);
        const e = new Date(b.endDate);
        const cursor = new Date(s);
        while (cursor <= e) {
          const key = dateKey(cursor);
          if (!map[key]) map[key] = [];
          map[key].push({ isBlackout: true, reason: b.reason });
          cursor.setDate(cursor.getDate() + 1);
        }
      }
    }

    return map;
  }, [data]);

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = [];
  let week = new Array(firstDay).fill(null);

  for (let day = 1; day <= daysInMonth; day++) {
    week.push(day);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  if (loading) {
    return (
      <Page title="Calendar">
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
      <Page title="Calendar">
        <Banner tone="critical">{error}</Banner>
      </Page>
    );
  }

  return (
    <Page title="Calendar">
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Button onClick={prevMonth}>&larr;</Button>
                <Text variant="headingLg">
                  {monthNames[month]} {year}
                </Text>
                <Button onClick={nextMonth}>&rarr;</Button>
              </InlineStack>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(7, 1fr)",
                  gap: "1px",
                  background: "var(--p-color-border-secondary)",
                  border: "1px solid var(--p-color-border-secondary)",
                  borderRadius: "var(--p-border-radius-200)",
                  overflow: "hidden",
                }}
              >
                {DAY_NAMES.map((d) => (
                  <div
                    key={d}
                    style={{
                      padding: "8px",
                      background: "var(--p-color-bg-surface-secondary)",
                      textAlign: "center",
                      fontWeight: 600,
                      fontSize: "12px",
                    }}
                  >
                    {d}
                  </div>
                ))}
                {weeks.flat().map((day, i) => {
                  if (day === null) {
                    return (
                      <div
                        key={`empty-${i}`}
                        style={{
                          padding: "8px",
                          background: "var(--p-color-bg-surface)",
                          minHeight: "80px",
                        }}
                      />
                    );
                  }

                  const key = dateKey(new Date(year, month, day));
                  const items = dateItemMap[key] || [];
                  const hasBlackout = items.some((it) => it.isBlackout);
                  const rentalItems = items.filter((it) => !it.isBlackout);
                  const isToday = key === dateKey(new Date());

                  return (
                    <div
                      key={key}
                      style={{
                        padding: "8px",
                        background: hasBlackout
                          ? "var(--p-color-bg-surface-critical)"
                          : "var(--p-color-bg-surface)",
                        minHeight: "80px",
                        position: "relative",
                      }}
                    >
                      <Text
                        variant="bodySm"
                        fontWeight={isToday ? "bold" : "regular"}
                        tone={isToday ? "success" : undefined}
                      >
                        {day}
                      </Text>
                      {rentalItems.slice(0, 3).map((item, j) => (
                        <div
                          key={j}
                          style={{
                            fontSize: "11px",
                            padding: "1px 4px",
                            marginTop: "2px",
                            borderRadius: "3px",
                            background:
                              item.status === "overdue"
                                ? "var(--p-color-bg-fill-critical)"
                                : item.status === "picked_up"
                                ? "var(--p-color-bg-fill-success)"
                                : "var(--p-color-bg-fill-info)",
                            color: "var(--p-color-text-inverse)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            cursor: "pointer",
                          }}
                          onClick={() =>
                            navigate(`/reservations/${item.reservationId}`)
                          }
                        >
                          {item.productTitle}
                        </div>
                      ))}
                      {rentalItems.length > 3 && (
                        <Text variant="bodySm" tone="subdued">
                          +{rentalItems.length - 3} more
                        </Text>
                      )}
                      {hasBlackout && (
                        <div style={{ fontSize: "10px", color: "var(--p-color-text-critical)", marginTop: "2px" }}>
                          Blackout
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </BlockStack>
          </Card>
        </Layout.Section>

        {data?.products && Object.keys(data.products).length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd">Product Timeline</Text>
                {Object.entries(data.products).map(([pid, product]) => (
                  <BlockStack gap="200" key={pid}>
                    <Text variant="headingSm">{product.productTitle}</Text>
                    {product.items.map((item) => (
                      <InlineStack key={item.id} gap="300" blockAlign="center">
                        <Text variant="bodySm">
                          {new Date(item.startDate).toLocaleDateString()} —{" "}
                          {new Date(item.endDate).toLocaleDateString()}
                        </Text>
                        <Text variant="bodySm" tone="subdued">
                          {item.customerName || item.orderName || "—"}
                        </Text>
                        <Text variant="bodySm">Qty: {item.quantity}</Text>
                        <StatusBadge status={item.status} />
                      </InlineStack>
                    ))}
                  </BlockStack>
                ))}
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
