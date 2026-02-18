import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import { useState, useCallback } from "react";
import {
  Page, Layout, Card, DataTable, Text, BlockStack, InlineStack,
  Button, Modal, FormLayout, TextField, Select, Badge, Banner, Divider,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const [defaultTiers, typeTiers, itemTiers, seasonalRules, types, items, settings] = await Promise.all([
    prisma.pricingTier.findMany({
      where: { shop, isDefault: true, rentalItemTypeId: null, rentalItemId: null },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.pricingTier.findMany({
      where: { shop, rentalItemTypeId: { not: null }, rentalItemId: null },
      include: { rentalItemType: { select: { name: true } } },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.pricingTier.findMany({
      where: { shop, rentalItemId: { not: null } },
      include: { rentalItem: { select: { name: true } } },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.seasonalPricing.findMany({ where: { shop }, orderBy: { startDate: "asc" } }),
    prisma.rentalItemType.findMany({ where: { shop }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.rentalItem.findMany({ where: { shop }, select: { id: true, name: true, rentalItemTypeId: true }, orderBy: { name: "asc" } }),
    prisma.appSettings.findUnique({ where: { shop } }),
  ]);

  return json({ defaultTiers, typeTiers, itemTiers, seasonalRules, types, items, currency: settings?.currency || "USD" });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "createTier" || intent === "updateTier") {
    const appliesTo = formData.get("appliesTo");
    const data = {
      shop: session.shop,
      name: formData.get("name"),
      durationHours: parseFloat(formData.get("durationHours")),
      price: parseFloat(formData.get("price")),
      isDefault: appliesTo === "default",
      rentalItemTypeId: appliesTo === "type" ? formData.get("targetId") : null,
      rentalItemId: appliesTo === "item" ? formData.get("targetId") : null,
    };

    if (intent === "createTier") {
      await prisma.pricingTier.create({ data });
    } else {
      await prisma.pricingTier.update({ where: { id: formData.get("id") }, data });
    }
  }

  if (intent === "deleteTier") {
    await prisma.pricingTier.delete({ where: { id: formData.get("id") } });
  }

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
      await prisma.seasonalPricing.update({ where: { id: formData.get("id") }, data });
    }
  }

  if (intent === "deleteSeason") {
    await prisma.seasonalPricing.delete({ where: { id: formData.get("id") } });
  }

  return json({ ok: true });
};

export default function PricingPage() {
  const { defaultTiers, typeTiers, itemTiers, seasonalRules, types, items, currency } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isLoading = navigation.state !== "idle";

  const [tierModalOpen, setTierModalOpen] = useState(false);
  const [editingTier, setEditingTier] = useState(null);
  const [tierForm, setTierForm] = useState({ name: "", durationHours: "", price: "", appliesTo: "default", targetId: "" });

  const [seasonModalOpen, setSeasonModalOpen] = useState(false);
  const [editingSeason, setEditingSeason] = useState(null);
  const [seasonForm, setSeasonForm] = useState({ name: "", startDate: "", endDate: "", multiplier: "", isActive: "true" });

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

  const openTierCreate = useCallback(() => {
    setEditingTier(null);
    setTierForm({ name: "", durationHours: "", price: "", appliesTo: "default", targetId: "" });
    setTierModalOpen(true);
  }, []);

  const openTierEdit = useCallback((tier) => {
    setEditingTier(tier);
    let appliesTo = "default";
    let targetId = "";
    if (tier.rentalItemId) { appliesTo = "item"; targetId = tier.rentalItemId; }
    else if (tier.rentalItemTypeId) { appliesTo = "type"; targetId = tier.rentalItemTypeId; }
    setTierForm({ name: tier.name, durationHours: tier.durationHours.toString(), price: tier.price.toString(), appliesTo, targetId });
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

  const fmtDuration = (hours) => hours < 24 ? `${hours}h` : `${hours / 24}d`;

  const defaultRows = defaultTiers.map((t) => [
    t.name, fmtDuration(t.durationHours), `${t.price} ${currency}`,
    <InlineStack gap="200"><Button size="slim" onClick={() => openTierEdit(t)}>Edit</Button><Button size="slim" tone="critical" onClick={() => deleteTier(t.id)}>Delete</Button></InlineStack>,
  ]);

  const typeRows = typeTiers.map((t) => [
    t.rentalItemType?.name || "—", t.name, fmtDuration(t.durationHours), `${t.price} ${currency}`,
    <InlineStack gap="200"><Button size="slim" onClick={() => openTierEdit(t)}>Edit</Button><Button size="slim" tone="critical" onClick={() => deleteTier(t.id)}>Delete</Button></InlineStack>,
  ]);

  const itemRows = itemTiers.map((t) => [
    t.rentalItem?.name || "—", t.name, fmtDuration(t.durationHours), `${t.price} ${currency}`,
    <InlineStack gap="200"><Button size="slim" onClick={() => openTierEdit(t)}>Edit</Button><Button size="slim" tone="critical" onClick={() => deleteTier(t.id)}>Delete</Button></InlineStack>,
  ]);

  const seasonRows = seasonalRules.map((s) => [
    s.name, new Date(s.startDate).toLocaleDateString("en-GB"), new Date(s.endDate).toLocaleDateString("en-GB"),
    `x${s.multiplier}`, s.isActive ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>,
    <InlineStack gap="200"><Button size="slim" onClick={() => openSeasonEdit(s)}>Edit</Button><Button size="slim" tone="critical" onClick={() => deleteSeason(s.id)}>Delete</Button></InlineStack>,
  ]);

  return (
    <Page title="Pricing">
      <BlockStack gap="500">
        {defaultTiers.length === 0 && (
          <Banner title="Set up your pricing tiers" tone="warning" action={{ content: "Add Pricing Tier", onAction: openTierCreate }}>
            <p>Create default pricing tiers that apply to all rental items. You can also add type-specific or item-specific pricing.</p>
          </Banner>
        )}

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between"><Text variant="headingMd">Default Pricing Tiers</Text><Button onClick={openTierCreate}>Add Tier</Button></InlineStack>
                <Text variant="bodySm" tone="subdued">Apply to all items unless overridden by type or item-specific pricing.</Text>
                {defaultRows.length > 0 ? <DataTable columnContentTypes={["text","text","numeric","text"]} headings={["Name","Duration","Price","Actions"]} rows={defaultRows} /> : <Text tone="subdued">No default tiers.</Text>}
              </BlockStack>
            </Card>
          </Layout.Section>

          {typeRows.length > 0 && (
            <Layout.Section>
              <Card>
                <BlockStack gap="300">
                  <Text variant="headingMd">Type-Level Pricing</Text>
                  <DataTable columnContentTypes={["text","text","text","numeric","text"]} headings={["Type","Tier","Duration","Price","Actions"]} rows={typeRows} />
                </BlockStack>
              </Card>
            </Layout.Section>
          )}

          {itemRows.length > 0 && (
            <Layout.Section>
              <Card>
                <BlockStack gap="300">
                  <Text variant="headingMd">Item-Specific Pricing</Text>
                  <DataTable columnContentTypes={["text","text","text","numeric","text"]} headings={["Item","Tier","Duration","Price","Actions"]} rows={itemRows} />
                </BlockStack>
              </Card>
            </Layout.Section>
          )}

          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between"><Text variant="headingMd">Seasonal Pricing</Text><Button onClick={openSeasonCreate}>Add Season</Button></InlineStack>
                <Text variant="bodySm" tone="subdued">Seasonal rules multiply the base price. e.g. x1.3 = 30% markup, x0.8 = 20% discount.</Text>
                {seasonRows.length > 0 ? <DataTable columnContentTypes={["text","text","text","text","text","text"]} headings={["Name","Start","End","Multiplier","Status","Actions"]} rows={seasonRows} /> : <Text tone="subdued">No seasonal rules.</Text>}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>

      <Modal open={tierModalOpen} onClose={() => setTierModalOpen(false)} title={editingTier ? "Edit Pricing Tier" : "Add Pricing Tier"} primaryAction={{ content: "Save", onAction: saveTier, loading: isLoading }} secondaryActions={[{ content: "Cancel", onAction: () => setTierModalOpen(false) }]}>
        <Modal.Section>
          <FormLayout>
            <TextField label="Tier Name" value={tierForm.name} onChange={(v) => setTierForm((s) => ({ ...s, name: v }))} placeholder="e.g. Half Day, 1.5 Days" requiredIndicator />
            <Select label="Duration Preset" options={durationPresets} value={durationPresets.find((p) => p.value === tierForm.durationHours) ? tierForm.durationHours : ""} onChange={(v) => setTierForm((s) => ({ ...s, durationHours: v }))} />
            <TextField label="Duration (hours)" value={tierForm.durationHours} onChange={(v) => setTierForm((s) => ({ ...s, durationHours: v }))} type="number" helpText="4 = half day, 36 = 1.5 days" requiredIndicator />
            <TextField label={`Price (${currency})`} value={tierForm.price} onChange={(v) => setTierForm((s) => ({ ...s, price: v }))} type="number" requiredIndicator />
            <Select label="Applies to" options={[{ label: "All items (default)", value: "default" }, { label: "Specific type", value: "type" }, { label: "Specific item", value: "item" }]} value={tierForm.appliesTo} onChange={(v) => setTierForm((s) => ({ ...s, appliesTo: v, targetId: "" }))} />
            {tierForm.appliesTo === "type" && <Select label="Type" options={[{ label: "Select a type", value: "" }, ...types.map((t) => ({ label: t.name, value: t.id }))]} value={tierForm.targetId} onChange={(v) => setTierForm((s) => ({ ...s, targetId: v }))} />}
            {tierForm.appliesTo === "item" && <Select label="Item" options={[{ label: "Select an item", value: "" }, ...items.map((i) => ({ label: i.name, value: i.id }))]} value={tierForm.targetId} onChange={(v) => setTierForm((s) => ({ ...s, targetId: v }))} />}
          </FormLayout>
        </Modal.Section>
      </Modal>

      <Modal open={seasonModalOpen} onClose={() => setSeasonModalOpen(false)} title={editingSeason ? "Edit Seasonal Pricing" : "Add Seasonal Pricing"} primaryAction={{ content: "Save", onAction: saveSeason, loading: isLoading }} secondaryActions={[{ content: "Cancel", onAction: () => setSeasonModalOpen(false) }]}>
        <Modal.Section>
          <FormLayout>
            <TextField label="Season Name" value={seasonForm.name} onChange={(v) => setSeasonForm((s) => ({ ...s, name: v }))} placeholder="e.g. Summer Peak" requiredIndicator />
            <FormLayout.Group>
              <TextField label="Start Date" value={seasonForm.startDate} onChange={(v) => setSeasonForm((s) => ({ ...s, startDate: v }))} type="date" requiredIndicator />
              <TextField label="End Date" value={seasonForm.endDate} onChange={(v) => setSeasonForm((s) => ({ ...s, endDate: v }))} type="date" requiredIndicator />
            </FormLayout.Group>
            <TextField label="Price Multiplier" value={seasonForm.multiplier} onChange={(v) => setSeasonForm((s) => ({ ...s, multiplier: v }))} type="number" step="0.1" helpText="1.0 = no change, 1.3 = 30% more, 0.8 = 20% less" requiredIndicator />
            <Select label="Status" options={[{ label: "Active", value: "true" }, { label: "Inactive", value: "false" }]} value={seasonForm.isActive} onChange={(v) => setSeasonForm((s) => ({ ...s, isActive: v }))} />
          </FormLayout>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
