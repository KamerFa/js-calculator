import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import { useState, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  DataTable,
  Text,
  BlockStack,
  InlineStack,
  Button,
  Modal,
  FormLayout,
  TextField,
  Select,
  Badge,
  Checkbox,
  Banner,
  Divider,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const [defaultTiers, bikeTiers, seasonalRules, bikes] = await Promise.all([
    prisma.pricingTier.findMany({
      where: { shop, isDefault: true, bikeId: null },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.pricingTier.findMany({
      where: { shop, isDefault: false, bikeId: { not: null } },
      include: { bike: { select: { name: true } } },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.seasonalPricing.findMany({
      where: { shop },
      orderBy: { startDate: "asc" },
    }),
    prisma.bike.findMany({
      where: { shop },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return json({ defaultTiers, bikeTiers, seasonalRules, bikes });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  // Pricing Tier CRUD
  if (intent === "createTier" || intent === "updateTier") {
    const data = {
      shop: session.shop,
      name: formData.get("name"),
      durationHours: parseFloat(formData.get("durationHours")),
      price: parseFloat(formData.get("price")),
      isDefault: formData.get("isDefault") === "true",
      bikeId: formData.get("bikeId") || null,
    };

    if (data.isDefault) data.bikeId = null;

    if (intent === "createTier") {
      await prisma.pricingTier.create({ data });
    } else {
      await prisma.pricingTier.update({
        where: { id: formData.get("id") },
        data,
      });
    }
  }

  if (intent === "deleteTier") {
    await prisma.pricingTier.delete({ where: { id: formData.get("id") } });
  }

  // Seasonal Pricing CRUD
  if (intent === "createSeason" || intent === "updateSeason") {
    const data = {
      shop: session.shop,
      name: formData.get("name"),
      startDate: new Date(formData.get("startDate")),
      endDate: new Date(formData.get("endDate")),
      multiplier: parseFloat(formData.get("multiplier")),
      isActive: formData.get("isActive") === "true",
    };

    if (intent === "createSeason") {
      await prisma.seasonalPricing.create({ data });
    } else {
      await prisma.seasonalPricing.update({
        where: { id: formData.get("id") },
        data,
      });
    }
  }

  if (intent === "deleteSeason") {
    await prisma.seasonalPricing.delete({ where: { id: formData.get("id") } });
  }

  return json({ ok: true });
};

export default function PricingPage() {
  const { defaultTiers, bikeTiers, seasonalRules, bikes } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isLoading = navigation.state !== "idle";

  // Tier modal state
  const [tierModalOpen, setTierModalOpen] = useState(false);
  const [editingTier, setEditingTier] = useState(null);
  const [tierForm, setTierForm] = useState({
    name: "", durationHours: "", price: "", isDefault: "true", bikeId: "",
  });

  // Season modal state
  const [seasonModalOpen, setSeasonModalOpen] = useState(false);
  const [editingSeason, setEditingSeason] = useState(null);
  const [seasonForm, setSeasonForm] = useState({
    name: "", startDate: "", endDate: "", multiplier: "", isActive: "true",
  });

  const durationPresets = [
    { label: "Custom", value: "" },
    { label: "Half Day (4h)", value: "4" },
    { label: "1 Day (24h)", value: "24" },
    { label: "1.5 Days (36h)", value: "36" },
    { label: "2 Days (48h)", value: "48" },
    { label: "3 Days (72h)", value: "72" },
    { label: "4 Days (96h)", value: "96" },
    { label: "1 Week (168h)", value: "168" },
  ];

  // Tier handlers
  const openTierCreate = useCallback(() => {
    setEditingTier(null);
    setTierForm({ name: "", durationHours: "", price: "", isDefault: "true", bikeId: "" });
    setTierModalOpen(true);
  }, []);

  const openTierEdit = useCallback((tier) => {
    setEditingTier(tier);
    setTierForm({
      name: tier.name,
      durationHours: tier.durationHours.toString(),
      price: tier.price.toString(),
      isDefault: tier.isDefault ? "true" : "false",
      bikeId: tier.bikeId || "",
    });
    setTierModalOpen(true);
  }, []);

  const saveTier = useCallback(() => {
    const data = new FormData();
    data.set("intent", editingTier ? "updateTier" : "createTier");
    if (editingTier) data.set("id", editingTier.id);
    Object.entries(tierForm).forEach(([k, v]) => data.set(k, v));
    submit(data, { method: "post" });
    setTierModalOpen(false);
  }, [tierForm, editingTier, submit]);

  const deleteTier = useCallback((id) => {
    if (!confirm("Delete this pricing tier?")) return;
    const data = new FormData();
    data.set("intent", "deleteTier");
    data.set("id", id);
    submit(data, { method: "post" });
  }, [submit]);

  // Season handlers
  const openSeasonCreate = useCallback(() => {
    setEditingSeason(null);
    setSeasonForm({ name: "", startDate: "", endDate: "", multiplier: "", isActive: "true" });
    setSeasonModalOpen(true);
  }, []);

  const openSeasonEdit = useCallback((season) => {
    setEditingSeason(season);
    setSeasonForm({
      name: season.name,
      startDate: season.startDate.split("T")[0],
      endDate: season.endDate.split("T")[0],
      multiplier: season.multiplier.toString(),
      isActive: season.isActive ? "true" : "false",
    });
    setSeasonModalOpen(true);
  }, []);

  const saveSeason = useCallback(() => {
    const data = new FormData();
    data.set("intent", editingSeason ? "updateSeason" : "createSeason");
    if (editingSeason) data.set("id", editingSeason.id);
    Object.entries(seasonForm).forEach(([k, v]) => data.set(k, v));
    submit(data, { method: "post" });
    setSeasonModalOpen(false);
  }, [seasonForm, editingSeason, submit]);

  const deleteSeason = useCallback((id) => {
    if (!confirm("Delete this seasonal rule?")) return;
    const data = new FormData();
    data.set("intent", "deleteSeason");
    data.set("id", id);
    submit(data, { method: "post" });
  }, [submit]);

  // Format duration for display
  const fmtDuration = (hours) => {
    if (hours < 24) return `${hours}h`;
    const days = hours / 24;
    return days === Math.floor(days) ? `${days}d` : `${days}d`;
  };

  const defaultTierRows = defaultTiers.map((t) => [
    t.name,
    fmtDuration(t.durationHours),
    `${t.price} BAM`,
    <InlineStack gap="200">
      <Button size="slim" onClick={() => openTierEdit(t)}>Edit</Button>
      <Button size="slim" tone="critical" onClick={() => deleteTier(t.id)}>Delete</Button>
    </InlineStack>,
  ]);

  const bikeTierRows = bikeTiers.map((t) => [
    t.bike?.name || "—",
    t.name,
    fmtDuration(t.durationHours),
    `${t.price} BAM`,
    <InlineStack gap="200">
      <Button size="slim" onClick={() => openTierEdit(t)}>Edit</Button>
      <Button size="slim" tone="critical" onClick={() => deleteTier(t.id)}>Delete</Button>
    </InlineStack>,
  ]);

  const seasonRows = seasonalRules.map((s) => [
    s.name,
    new Date(s.startDate).toLocaleDateString("en-GB"),
    new Date(s.endDate).toLocaleDateString("en-GB"),
    `x${s.multiplier}`,
    s.isActive ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>,
    <InlineStack gap="200">
      <Button size="slim" onClick={() => openSeasonEdit(s)}>Edit</Button>
      <Button size="slim" tone="critical" onClick={() => deleteSeason(s.id)}>Delete</Button>
    </InlineStack>,
  ]);

  return (
    <Page title="Pricing">
      <BlockStack gap="500">
        {defaultTiers.length === 0 && (
          <Banner
            title="Set up your pricing tiers"
            tone="warning"
            action={{ content: "Add Pricing Tier", onAction: openTierCreate }}
          >
            <p>
              Create default pricing tiers (e.g. Half Day, 1.5 Days, 4 Days) that apply
              to all bikes. You can also add custom pricing for individual bikes.
            </p>
          </Banner>
        )}

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text variant="headingMd">Default Pricing Tiers</Text>
                  <Button onClick={openTierCreate}>Add Tier</Button>
                </InlineStack>
                <Text variant="bodySm" tone="subdued">
                  These apply to all bikes unless overridden with bike-specific pricing.
                </Text>
                {defaultTierRows.length > 0 ? (
                  <DataTable
                    columnContentTypes={["text", "text", "numeric", "text"]}
                    headings={["Name", "Duration", "Price", "Actions"]}
                    rows={defaultTierRows}
                  />
                ) : (
                  <Text tone="subdued">No default tiers configured.</Text>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          {bikeTierRows.length > 0 && (
            <Layout.Section>
              <Card>
                <BlockStack gap="300">
                  <Text variant="headingMd">Bike-Specific Pricing</Text>
                  <DataTable
                    columnContentTypes={["text", "text", "text", "numeric", "text"]}
                    headings={["Bike", "Tier", "Duration", "Price", "Actions"]}
                    rows={bikeTierRows}
                  />
                </BlockStack>
              </Card>
            </Layout.Section>
          )}

          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text variant="headingMd">Seasonal Pricing</Text>
                  <Button onClick={openSeasonCreate}>Add Season</Button>
                </InlineStack>
                <Text variant="bodySm" tone="subdued">
                  Seasonal rules multiply the base price during specific date ranges.
                  For example, x1.3 = 30% markup, x0.8 = 20% discount.
                </Text>
                {seasonRows.length > 0 ? (
                  <DataTable
                    columnContentTypes={["text", "text", "text", "text", "text", "text"]}
                    headings={["Name", "Start", "End", "Multiplier", "Status", "Actions"]}
                    rows={seasonRows}
                  />
                ) : (
                  <Text tone="subdued">No seasonal rules configured.</Text>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>

      {/* Pricing Tier Modal */}
      <Modal
        open={tierModalOpen}
        onClose={() => setTierModalOpen(false)}
        title={editingTier ? "Edit Pricing Tier" : "Add Pricing Tier"}
        primaryAction={{ content: "Save", onAction: saveTier, loading: isLoading }}
        secondaryActions={[{ content: "Cancel", onAction: () => setTierModalOpen(false) }]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Tier Name"
              value={tierForm.name}
              onChange={(v) => setTierForm((s) => ({ ...s, name: v }))}
              placeholder="e.g. Half Day, 1.5 Days, 4 Days"
              requiredIndicator
            />
            <Select
              label="Duration Preset"
              options={durationPresets}
              value={durationPresets.find((p) => p.value === tierForm.durationHours)
                ? tierForm.durationHours : ""}
              onChange={(v) => setTierForm((s) => ({ ...s, durationHours: v }))}
            />
            <TextField
              label="Duration (hours)"
              value={tierForm.durationHours}
              onChange={(v) => setTierForm((s) => ({ ...s, durationHours: v }))}
              type="number"
              helpText="4 = half day, 36 = 1.5 days, 96 = 4 days"
              requiredIndicator
            />
            <TextField
              label="Price (BAM)"
              value={tierForm.price}
              onChange={(v) => setTierForm((s) => ({ ...s, price: v }))}
              type="number"
              requiredIndicator
            />
            <Select
              label="Applies to"
              options={[
                { label: "All bikes (default)", value: "true" },
                { label: "Specific bike", value: "false" },
              ]}
              value={tierForm.isDefault}
              onChange={(v) => setTierForm((s) => ({ ...s, isDefault: v }))}
            />
            {tierForm.isDefault === "false" && (
              <Select
                label="Bike"
                options={[
                  { label: "Select a bike", value: "" },
                  ...bikes.map((b) => ({ label: b.name, value: b.id })),
                ]}
                value={tierForm.bikeId}
                onChange={(v) => setTierForm((s) => ({ ...s, bikeId: v }))}
              />
            )}
          </FormLayout>
        </Modal.Section>
      </Modal>

      {/* Seasonal Pricing Modal */}
      <Modal
        open={seasonModalOpen}
        onClose={() => setSeasonModalOpen(false)}
        title={editingSeason ? "Edit Seasonal Pricing" : "Add Seasonal Pricing"}
        primaryAction={{ content: "Save", onAction: saveSeason, loading: isLoading }}
        secondaryActions={[{ content: "Cancel", onAction: () => setSeasonModalOpen(false) }]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Season Name"
              value={seasonForm.name}
              onChange={(v) => setSeasonForm((s) => ({ ...s, name: v }))}
              placeholder="e.g. Summer Peak, Winter Low"
              requiredIndicator
            />
            <FormLayout.Group>
              <TextField
                label="Start Date"
                value={seasonForm.startDate}
                onChange={(v) => setSeasonForm((s) => ({ ...s, startDate: v }))}
                type="date"
                requiredIndicator
              />
              <TextField
                label="End Date"
                value={seasonForm.endDate}
                onChange={(v) => setSeasonForm((s) => ({ ...s, endDate: v }))}
                type="date"
                requiredIndicator
              />
            </FormLayout.Group>
            <TextField
              label="Price Multiplier"
              value={seasonForm.multiplier}
              onChange={(v) => setSeasonForm((s) => ({ ...s, multiplier: v }))}
              type="number"
              step="0.1"
              helpText="1.0 = no change, 1.3 = 30% more, 0.8 = 20% less"
              requiredIndicator
            />
            <Select
              label="Status"
              options={[
                { label: "Active", value: "true" },
                { label: "Inactive", value: "false" },
              ]}
              value={seasonForm.isActive}
              onChange={(v) => setSeasonForm((s) => ({ ...s, isActive: v }))}
            />
          </FormLayout>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
