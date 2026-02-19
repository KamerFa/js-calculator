import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Page,
  Layout,
  Card,
  IndexTable,
  Text,
  Thumbnail,
  Badge,
  TextField,
  Filters,
  EmptyState,
  Spinner,
  Banner,
  BlockStack,
  InlineStack,
  Button,
  Modal,
  FormLayout,
  Select,
} from "@shopify/polaris";
import { ImageIcon } from "@shopify/polaris-icons";
import { useApiQuery, useAppFetch } from "../hooks/useApi";
import { ResourcePicker } from "@shopify/app-bridge-react";

export default function ProductsPage() {
  const { data, loading, error, refetch } = useApiQuery("/api/products");
  const appFetch = useAppFetch();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configProduct, setConfigProduct] = useState(null);
  const [saving, setSaving] = useState(false);
  const [configForm, setConfigForm] = useState({
    dailyRate: "",
    weeklyRate: "",
    hourlyRate: "",
    depositAmount: "0",
    quantityTotal: "1",
    minDuration: "1",
    maxDuration: "30",
    durationUnit: "days",
    bufferTime: "0",
    bufferUnit: "hours",
  });

  const handleProductSelected = useCallback(
    async (selection) => {
      setShowPicker(false);
      if (!selection?.selection?.length) return;

      const product = selection.selection[0];
      setConfigProduct({
        shopifyProductId: String(product.id).replace("gid://shopify/Product/", ""),
        title: product.title,
        imageUrl: product.images?.[0]?.originalSrc || null,
        shopifyVariantId: product.variants?.[0]?.id
          ? String(product.variants[0].id).replace("gid://shopify/ProductVariant/", "")
          : null,
      });
      setConfigForm({
        dailyRate: "",
        weeklyRate: "",
        hourlyRate: "",
        depositAmount: "0",
        quantityTotal: "1",
        minDuration: "1",
        maxDuration: "30",
        durationUnit: "days",
        bufferTime: "0",
        bufferUnit: "hours",
      });
      setShowConfigModal(true);
    },
    []
  );

  const handleSaveConfig = useCallback(async () => {
    setSaving(true);
    try {
      await appFetch("/api/products", {
        method: "POST",
        body: JSON.stringify({
          ...configProduct,
          dailyRate: configForm.dailyRate ? parseFloat(configForm.dailyRate) : null,
          weeklyRate: configForm.weeklyRate ? parseFloat(configForm.weeklyRate) : null,
          hourlyRate: configForm.hourlyRate ? parseFloat(configForm.hourlyRate) : null,
          depositAmount: parseFloat(configForm.depositAmount) || 0,
          quantityTotal: parseInt(configForm.quantityTotal) || 1,
          minDuration: parseInt(configForm.minDuration) || 1,
          maxDuration: parseInt(configForm.maxDuration) || 30,
          durationUnit: configForm.durationUnit,
          bufferTime: parseInt(configForm.bufferTime) || 0,
          bufferUnit: configForm.bufferUnit,
        }),
      });
      setShowConfigModal(false);
      refetch();
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  }, [appFetch, configProduct, configForm, refetch]);

  const handleToggle = useCallback(
    async (id) => {
      await appFetch(`/api/products/${id}/toggle`, { method: "PUT" });
      refetch();
    },
    [appFetch, refetch]
  );

  const products = (data?.products || []).filter(
    (p) => !search || p.title.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <Page title="Rental Products">
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
      <Page title="Rental Products">
        <Banner tone="critical">{error}</Banner>
      </Page>
    );
  }

  const emptyState = (
    <EmptyState
      heading="No rental products configured"
      action={{
        content: "Add rental product",
        onAction: () => setShowPicker(true),
      }}
      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
    >
      <p>Select products from your Shopify catalog to make them rentable.</p>
    </EmptyState>
  );

  const rowMarkup = products.map((product, index) => (
    <IndexTable.Row
      id={product.id}
      key={product.id}
      position={index}
      onClick={() => navigate(`/products/${product.id}`)}
    >
      <IndexTable.Cell>
        <InlineStack gap="300" blockAlign="center">
          <Thumbnail
            source={product.imageUrl || ImageIcon}
            alt={product.title}
            size="small"
          />
          <Text variant="bodyMd" fontWeight="bold">
            {product.title}
          </Text>
        </InlineStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {product.dailyRate ? `$${parseFloat(product.dailyRate).toFixed(2)}/day` : "—"}
      </IndexTable.Cell>
      <IndexTable.Cell>
        {product.weeklyRate ? `$${parseFloat(product.weeklyRate).toFixed(2)}/week` : "—"}
      </IndexTable.Cell>
      <IndexTable.Cell>{product.quantityTotal}</IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={product.active ? "success" : undefined}>
          {product.active ? "Active" : "Inactive"}
        </Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {product._count?.reservationItems || 0}
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Rental Products"
      primaryAction={{
        content: "Add product",
        onAction: () => setShowPicker(true),
      }}
    >
      <Layout>
        <Layout.Section>
          <Card padding="0">
            <IndexTable
              itemCount={products.length}
              emptyState={emptyState}
              headings={[
                { title: "Product" },
                { title: "Daily Rate" },
                { title: "Weekly Rate" },
                { title: "Quantity" },
                { title: "Status" },
                { title: "Reservations" },
              ]}
              selectable={false}
            >
              {rowMarkup}
            </IndexTable>
          </Card>
        </Layout.Section>
      </Layout>

      {showPicker && (
        <ResourcePicker
          resourceType="Product"
          open={showPicker}
          onSelection={handleProductSelected}
          onCancel={() => setShowPicker(false)}
          showVariants={false}
          allowMultiple={false}
        />
      )}

      {showConfigModal && (
        <Modal
          open={showConfigModal}
          onClose={() => setShowConfigModal(false)}
          title={`Configure rental: ${configProduct?.title}`}
          primaryAction={{
            content: "Save",
            onAction: handleSaveConfig,
            loading: saving,
          }}
          secondaryActions={[
            { content: "Cancel", onAction: () => setShowConfigModal(false) },
          ]}
        >
          <Modal.Section>
            <FormLayout>
              <FormLayout.Group>
                <TextField
                  label="Hourly rate ($)"
                  type="number"
                  value={configForm.hourlyRate}
                  onChange={(v) => setConfigForm({ ...configForm, hourlyRate: v })}
                  autoComplete="off"
                />
                <TextField
                  label="Daily rate ($)"
                  type="number"
                  value={configForm.dailyRate}
                  onChange={(v) => setConfigForm({ ...configForm, dailyRate: v })}
                  autoComplete="off"
                />
                <TextField
                  label="Weekly rate ($)"
                  type="number"
                  value={configForm.weeklyRate}
                  onChange={(v) => setConfigForm({ ...configForm, weeklyRate: v })}
                  autoComplete="off"
                />
              </FormLayout.Group>
              <FormLayout.Group>
                <TextField
                  label="Deposit amount ($)"
                  type="number"
                  value={configForm.depositAmount}
                  onChange={(v) => setConfigForm({ ...configForm, depositAmount: v })}
                  autoComplete="off"
                />
                <TextField
                  label="Quantity available"
                  type="number"
                  value={configForm.quantityTotal}
                  onChange={(v) => setConfigForm({ ...configForm, quantityTotal: v })}
                  autoComplete="off"
                />
              </FormLayout.Group>
              <FormLayout.Group>
                <TextField
                  label="Min duration"
                  type="number"
                  value={configForm.minDuration}
                  onChange={(v) => setConfigForm({ ...configForm, minDuration: v })}
                  autoComplete="off"
                />
                <TextField
                  label="Max duration"
                  type="number"
                  value={configForm.maxDuration}
                  onChange={(v) => setConfigForm({ ...configForm, maxDuration: v })}
                  autoComplete="off"
                />
                <Select
                  label="Duration unit"
                  options={[
                    { label: "Hours", value: "hours" },
                    { label: "Days", value: "days" },
                    { label: "Weeks", value: "weeks" },
                  ]}
                  value={configForm.durationUnit}
                  onChange={(v) => setConfigForm({ ...configForm, durationUnit: v })}
                />
              </FormLayout.Group>
              <FormLayout.Group>
                <TextField
                  label="Buffer time between rentals"
                  type="number"
                  value={configForm.bufferTime}
                  onChange={(v) => setConfigForm({ ...configForm, bufferTime: v })}
                  autoComplete="off"
                />
                <Select
                  label="Buffer unit"
                  options={[
                    { label: "Hours", value: "hours" },
                    { label: "Days", value: "days" },
                  ]}
                  value={configForm.bufferUnit}
                  onChange={(v) => setConfigForm({ ...configForm, bufferUnit: v })}
                />
              </FormLayout.Group>
            </FormLayout>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}
