import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import { useState, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  ResourceList,
  ResourceItem,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Button,
  Modal,
  FormLayout,
  TextField,
  Select,
  Thumbnail,
  EmptyState,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const [addons, settings] = await Promise.all([
    prisma.addon.findMany({
      where: { shop: session.shop },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.appSettings.findUnique({ where: { shop: session.shop } }),
  ]);
  return json({ addons, currency: settings?.currency || "USD" });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create" || intent === "update") {
    const data = {
      shop: session.shop,
      name: formData.get("name"),
      description: formData.get("description") || null,
      price: parseFloat(formData.get("price")),
      priceType: formData.get("priceType"),
      imageUrl: formData.get("imageUrl") || null,
      isActive: formData.get("isActive") === "true",
    };

    if (intent === "create") {
      const maxOrder = await prisma.addon.findFirst({
        where: { shop: session.shop },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      data.sortOrder = (maxOrder?.sortOrder ?? -1) + 1;
      await prisma.addon.create({ data });
    } else {
      await prisma.addon.update({
        where: { id: formData.get("id") },
        data,
      });
    }
  }

  if (intent === "delete") {
    await prisma.addon.delete({ where: { id: formData.get("id") } });
  }

  if (intent === "toggle") {
    const id = formData.get("id");
    const addon = await prisma.addon.findUnique({ where: { id } });
    await prisma.addon.update({
      where: { id },
      data: { isActive: !addon.isActive },
    });
  }

  return json({ ok: true });
};

export default function AddonsPage() {
  const { addons, currency } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isLoading = navigation.state !== "idle";

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    name: "", description: "", price: "", priceType: "per_rental",
    imageUrl: "", isActive: "true",
  });

  const openCreate = useCallback(() => {
    setEditing(null);
    setForm({
      name: "", description: "", price: "", priceType: "per_rental",
      imageUrl: "", isActive: "true",
    });
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((addon) => {
    setEditing(addon);
    setForm({
      name: addon.name,
      description: addon.description || "",
      price: addon.price.toString(),
      priceType: addon.priceType,
      imageUrl: addon.imageUrl || "",
      isActive: addon.isActive ? "true" : "false",
    });
    setModalOpen(true);
  }, []);

  const handleSave = useCallback(() => {
    const data = new FormData();
    data.set("intent", editing ? "update" : "create");
    if (editing) data.set("id", editing.id);
    Object.entries(form).forEach(([k, v]) => data.set(k, v));
    submit(data, { method: "post" });
    setModalOpen(false);
  }, [form, editing, submit]);

  const handleDelete = useCallback((id) => {
    if (!confirm("Delete this add-on?")) return;
    const data = new FormData();
    data.set("intent", "delete");
    data.set("id", id);
    submit(data, { method: "post" });
  }, [submit]);

  const handleToggle = useCallback((id) => {
    const data = new FormData();
    data.set("intent", "toggle");
    data.set("id", id);
    submit(data, { method: "post" });
  }, [submit]);

  return (
    <Page
      title="Add-ons"
      primaryAction={{ content: "Add Extra", onAction: openCreate }}
    >
      <Layout>
        <Layout.Section>
          <Card padding="0">
            {addons.length > 0 ? (
              <ResourceList
                resourceName={{ singular: "add-on", plural: "add-ons" }}
                items={addons}
                renderItem={(addon) => (
                  <ResourceItem
                    id={addon.id}
                    onClick={() => openEdit(addon)}
                    shortcutActions={[
                      {
                        content: addon.isActive ? "Deactivate" : "Activate",
                        onAction: () => handleToggle(addon.id),
                      },
                      {
                        content: "Delete",
                        destructive: true,
                        onAction: () => handleDelete(addon.id),
                      },
                    ]}
                  >
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="100">
                        <Text variant="bodyMd" fontWeight="bold">
                          {addon.name}
                        </Text>
                        {addon.description && (
                          <Text variant="bodySm" tone="subdued">
                            {addon.description}
                          </Text>
                        )}
                      </BlockStack>
                      <InlineStack gap="200">
                        <Text variant="bodyMd">
                          {addon.price} {currency}
                          {addon.priceType === "per_day" ? "/day" : "/rental"}
                        </Text>
                        <Badge tone={addon.isActive ? "success" : undefined}>
                          {addon.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </InlineStack>
                    </InlineStack>
                  </ResourceItem>
                )}
              />
            ) : (
              <EmptyState
                heading="Add rental extras"
                action={{ content: "Add Extra", onAction: openCreate }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>
                  Create add-ons like helmets, GPS, insurance, or phone holders
                  that customers can include with their reservation.
                </p>
              </EmptyState>
            )}
          </Card>
        </Layout.Section>
      </Layout>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${editing.name}` : "Add New Extra"}
        primaryAction={{ content: "Save", onAction: handleSave, loading: isLoading }}
        secondaryActions={[{ content: "Cancel", onAction: () => setModalOpen(false) }]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Name"
              value={form.name}
              onChange={(v) => setForm((s) => ({ ...s, name: v }))}
              placeholder="e.g. Helmet, GPS, Insurance"
              requiredIndicator
            />
            <TextField
              label="Description"
              value={form.description}
              onChange={(v) => setForm((s) => ({ ...s, description: v }))}
              multiline={2}
              placeholder="Brief description..."
            />
            <FormLayout.Group>
              <TextField
                label="Price"
                value={form.price}
                onChange={(v) => setForm((s) => ({ ...s, price: v }))}
                type="number"
                requiredIndicator
              />
              <Select
                label="Pricing Type"
                options={[
                  { label: "Per rental (flat fee)", value: "per_rental" },
                  { label: "Per day", value: "per_day" },
                ]}
                value={form.priceType}
                onChange={(v) => setForm((s) => ({ ...s, priceType: v }))}
              />
            </FormLayout.Group>
            <TextField
              label="Image URL"
              value={form.imageUrl}
              onChange={(v) => setForm((s) => ({ ...s, imageUrl: v }))}
              placeholder="https://..."
            />
            <Select
              label="Status"
              options={[
                { label: "Active", value: "true" },
                { label: "Inactive", value: "false" },
              ]}
              value={form.isActive}
              onChange={(v) => setForm((s) => ({ ...s, isActive: v }))}
            />
          </FormLayout>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
