import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  TextField,
  FormLayout,
  Select,
  Button,
  Badge,
  Spinner,
  Banner,
  Thumbnail,
  IndexTable,
  Modal,
  Divider,
} from "@shopify/polaris";
import { ImageIcon } from "@shopify/polaris-icons";
import { useApiQuery, useAppFetch } from "../hooks/useApi";

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useApiQuery(`/api/products/${id}`);
  const appFetch = useAppFetch();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [unitLabel, setUnitLabel] = useState("");

  const product = data?.product;

  // Initialize form when data loads
  if (product && !form) {
    setForm({
      hourlyRate: product.hourlyRate ? String(product.hourlyRate) : "",
      dailyRate: product.dailyRate ? String(product.dailyRate) : "",
      weeklyRate: product.weeklyRate ? String(product.weeklyRate) : "",
      depositAmount: String(product.depositAmount || "0"),
      quantityTotal: String(product.quantityTotal || "1"),
      minDuration: String(product.minDuration || "1"),
      maxDuration: String(product.maxDuration || "30"),
      durationUnit: product.durationUnit || "days",
      bufferTime: String(product.bufferTime || "0"),
      bufferUnit: product.bufferUnit || "hours",
    });
  }

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await appFetch("/api/products", {
        method: "POST",
        body: JSON.stringify({
          shopifyProductId: product.shopifyProductId,
          shopifyVariantId: product.shopifyVariantId,
          title: product.title,
          imageUrl: product.imageUrl,
          active: product.active,
          hourlyRate: form.hourlyRate ? parseFloat(form.hourlyRate) : null,
          dailyRate: form.dailyRate ? parseFloat(form.dailyRate) : null,
          weeklyRate: form.weeklyRate ? parseFloat(form.weeklyRate) : null,
          depositAmount: parseFloat(form.depositAmount) || 0,
          quantityTotal: parseInt(form.quantityTotal) || 1,
          minDuration: parseInt(form.minDuration) || 1,
          maxDuration: parseInt(form.maxDuration) || 30,
          durationUnit: form.durationUnit,
          bufferTime: parseInt(form.bufferTime) || 0,
          bufferUnit: form.bufferUnit,
        }),
      });
      refetch();
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  }, [appFetch, product, form, refetch]);

  const handleToggle = useCallback(async () => {
    await appFetch(`/api/products/${id}/toggle`, { method: "PUT" });
    setForm(null);
    refetch();
  }, [appFetch, id, refetch]);

  const handleDelete = useCallback(async () => {
    if (!confirm("Remove rental configuration for this product?")) return;
    await appFetch(`/api/products/${id}`, { method: "DELETE" });
    navigate("/products");
  }, [appFetch, id, navigate]);

  const handleAddUnit = useCallback(async () => {
    await appFetch(`/api/products/${id}/inventory`, {
      method: "POST",
      body: JSON.stringify({ label: unitLabel }),
    });
    setShowAddUnit(false);
    setUnitLabel("");
    setForm(null);
    refetch();
  }, [appFetch, id, unitLabel, refetch]);

  if (loading) {
    return (
      <Page title="Product Details" backAction={{ onAction: () => navigate("/products") }}>
        <Card><Spinner size="large" /></Card>
      </Page>
    );
  }

  if (error || !product) {
    return (
      <Page title="Product Details" backAction={{ onAction: () => navigate("/products") }}>
        <Banner tone="critical">{error || "Product not found"}</Banner>
      </Page>
    );
  }

  return (
    <Page
      title={product.title}
      backAction={{ onAction: () => navigate("/products") }}
      titleMetadata={
        <Badge tone={product.active ? "success" : undefined}>
          {product.active ? "Active" : "Inactive"}
        </Badge>
      }
      secondaryActions={[
        {
          content: product.active ? "Deactivate" : "Activate",
          onAction: handleToggle,
        },
        {
          content: "Remove rental config",
          destructive: true,
          onAction: handleDelete,
        },
      ]}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack gap="400" blockAlign="center">
                <Thumbnail
                  source={product.imageUrl || ImageIcon}
                  alt={product.title}
                  size="large"
                />
                <BlockStack gap="100">
                  <Text variant="headingMd">{product.title}</Text>
                  <Text variant="bodySm" tone="subdued">
                    Shopify Product ID: {product.shopifyProductId}
                  </Text>
                </BlockStack>
              </InlineStack>

              <Divider />

              {form && (
                <FormLayout>
                  <Text variant="headingSm">Rental Rates</Text>
                  <FormLayout.Group>
                    <TextField
                      label="Hourly rate ($)"
                      type="number"
                      value={form.hourlyRate}
                      onChange={(v) => setForm({ ...form, hourlyRate: v })}
                      autoComplete="off"
                    />
                    <TextField
                      label="Daily rate ($)"
                      type="number"
                      value={form.dailyRate}
                      onChange={(v) => setForm({ ...form, dailyRate: v })}
                      autoComplete="off"
                    />
                    <TextField
                      label="Weekly rate ($)"
                      type="number"
                      value={form.weeklyRate}
                      onChange={(v) => setForm({ ...form, weeklyRate: v })}
                      autoComplete="off"
                    />
                  </FormLayout.Group>

                  <Text variant="headingSm">Inventory & Deposit</Text>
                  <FormLayout.Group>
                    <TextField
                      label="Deposit amount ($)"
                      type="number"
                      value={form.depositAmount}
                      onChange={(v) => setForm({ ...form, depositAmount: v })}
                      autoComplete="off"
                    />
                    <TextField
                      label="Quantity available"
                      type="number"
                      value={form.quantityTotal}
                      onChange={(v) => setForm({ ...form, quantityTotal: v })}
                      autoComplete="off"
                    />
                  </FormLayout.Group>

                  <Text variant="headingSm">Duration & Buffer</Text>
                  <FormLayout.Group>
                    <TextField
                      label="Min duration"
                      type="number"
                      value={form.minDuration}
                      onChange={(v) => setForm({ ...form, minDuration: v })}
                      autoComplete="off"
                    />
                    <TextField
                      label="Max duration"
                      type="number"
                      value={form.maxDuration}
                      onChange={(v) => setForm({ ...form, maxDuration: v })}
                      autoComplete="off"
                    />
                    <Select
                      label="Duration unit"
                      options={[
                        { label: "Hours", value: "hours" },
                        { label: "Days", value: "days" },
                        { label: "Weeks", value: "weeks" },
                      ]}
                      value={form.durationUnit}
                      onChange={(v) => setForm({ ...form, durationUnit: v })}
                    />
                  </FormLayout.Group>
                  <FormLayout.Group>
                    <TextField
                      label="Buffer time"
                      type="number"
                      value={form.bufferTime}
                      onChange={(v) => setForm({ ...form, bufferTime: v })}
                      autoComplete="off"
                    />
                    <Select
                      label="Buffer unit"
                      options={[
                        { label: "Hours", value: "hours" },
                        { label: "Days", value: "days" },
                      ]}
                      value={form.bufferUnit}
                      onChange={(v) => setForm({ ...form, bufferUnit: v })}
                    />
                  </FormLayout.Group>

                  <Button variant="primary" onClick={handleSave} loading={saving}>
                    Save changes
                  </Button>
                </FormLayout>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text variant="headingSm">Inventory Units</Text>
                <Button size="slim" onClick={() => setShowAddUnit(true)}>
                  Add unit
                </Button>
              </InlineStack>
              {product.inventoryUnits?.length > 0 ? (
                <IndexTable
                  itemCount={product.inventoryUnits.length}
                  headings={[
                    { title: "Label" },
                    { title: "Status" },
                  ]}
                  selectable={false}
                >
                  {product.inventoryUnits.map((unit, i) => (
                    <IndexTable.Row id={unit.id} key={unit.id} position={i}>
                      <IndexTable.Cell>
                        <Text variant="bodyMd">{unit.label}</Text>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Badge tone={unit.status === "available" ? "success" : undefined}>
                          {unit.status}
                        </Badge>
                      </IndexTable.Cell>
                    </IndexTable.Row>
                  ))}
                </IndexTable>
              ) : (
                <Text variant="bodySm" tone="subdued">
                  No individual units tracked. Availability is based on quantity.
                </Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      {showAddUnit && (
        <Modal
          open={showAddUnit}
          onClose={() => setShowAddUnit(false)}
          title="Add inventory unit"
          primaryAction={{ content: "Add", onAction: handleAddUnit }}
          secondaryActions={[
            { content: "Cancel", onAction: () => setShowAddUnit(false) },
          ]}
        >
          <Modal.Section>
            <TextField
              label="Unit label"
              value={unitLabel}
              onChange={setUnitLabel}
              placeholder="e.g. Bike #3, Camera SN-1234"
              autoComplete="off"
            />
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}
