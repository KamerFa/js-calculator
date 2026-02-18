import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, Link, useNavigation } from "@remix-run/react";
import { useState, useCallback } from "react";
import {
  Page, Layout, Card, ResourceList, ResourceItem, Text, BlockStack,
  InlineStack, Badge, Button, Modal, FormLayout, TextField, Thumbnail,
  EmptyState,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const types = await prisma.rentalItemType.findMany({
    where: { shop },
    include: {
      _count: { select: { items: true } },
    },
    orderBy: { sortOrder: "asc" },
  });

  return json({ types });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "createType") {
    const name = formData.get("name");
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const description = formData.get("description") || null;

    await prisma.rentalItemType.create({
      data: { shop, name, slug, description },
    });
  }

  if (intent === "deleteType") {
    const id = formData.get("id");
    const itemCount = await prisma.rentalItem.count({ where: { rentalItemTypeId: id } });
    if (itemCount > 0) {
      return json({ error: "Cannot delete type with items. Remove items first." }, { status: 400 });
    }
    await prisma.rentalItemType.delete({ where: { id } });
  }

  if (intent === "cloneType") {
    const id = formData.get("id");
    const original = await prisma.rentalItemType.findUnique({ where: { id } });
    if (original) {
      const newSlug = `${original.slug}-copy-${Date.now().toString(36)}`;
      const cloned = await prisma.rentalItemType.create({
        data: {
          shop, name: `${original.name} (Copy)`, slug: newSlug,
          description: original.description, customFields: original.customFields,
        },
      });
      // Clone type-level pricing tiers
      const typeTiers = await prisma.pricingTier.findMany({
        where: { rentalItemTypeId: id, rentalItemId: null },
      });
      for (const tier of typeTiers) {
        await prisma.pricingTier.create({
          data: {
            shop, rentalItemTypeId: cloned.id, name: tier.name,
            durationHours: tier.durationHours, price: tier.price,
            isDefault: false, sortOrder: tier.sortOrder,
          },
        });
      }
    }
  }

  return json({ ok: true });
};

export default function ItemTypesIndex() {
  const { types } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isLoading = navigation.state !== "idle";

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });

  const openCreate = useCallback(() => {
    setForm({ name: "", description: "" });
    setModalOpen(true);
  }, []);

  const handleCreate = useCallback(() => {
    const data = new FormData();
    data.set("intent", "createType");
    data.set("name", form.name);
    data.set("description", form.description);
    submit(data, { method: "post" });
    setModalOpen(false);
  }, [form, submit]);

  const handleDelete = useCallback((id) => {
    if (!confirm("Delete this rental type?")) return;
    const data = new FormData();
    data.set("intent", "deleteType");
    data.set("id", id);
    submit(data, { method: "post" });
  }, [submit]);

  const handleClone = useCallback((id) => {
    const data = new FormData();
    data.set("intent", "cloneType");
    data.set("id", id);
    submit(data, { method: "post" });
  }, [submit]);

  return (
    <Page
      title="Rental Item Types"
      primaryAction={{ content: "Create Type", onAction: openCreate }}
    >
      <Layout>
        <Layout.Section>
          <Card padding="0">
            {types.length > 0 ? (
              <ResourceList
                resourceName={{ singular: "type", plural: "types" }}
                items={types}
                renderItem={(type) => (
                  <ResourceItem
                    id={type.id}
                    url={`/app/item-types/${type.id}`}
                    shortcutActions={[
                      { content: "Clone", onAction: () => handleClone(type.id) },
                      { content: "Delete", destructive: true, onAction: () => handleDelete(type.id) },
                    ]}
                    media={
                      type.imageUrl ? (
                        <Thumbnail source={type.imageUrl} alt={type.name} size="medium" />
                      ) : undefined
                    }
                  >
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="100">
                        <Text variant="bodyMd" fontWeight="bold">{type.name}</Text>
                        {type.description && (
                          <Text variant="bodySm" tone="subdued">{type.description}</Text>
                        )}
                      </BlockStack>
                      <InlineStack gap="200">
                        <Badge>{type._count.items} items</Badge>
                        <Badge tone={type.isActive ? "success" : undefined}>
                          {type.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </InlineStack>
                    </InlineStack>
                  </ResourceItem>
                )}
              />
            ) : (
              <EmptyState
                heading="Create your first rental type"
                action={{ content: "Create Type", onAction: openCreate }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>
                  Rental types are categories like "Bikes", "Kayaks", or "Camera Kits".
                  Create a type, then add products to it.
                </p>
              </EmptyState>
            )}
          </Card>
        </Layout.Section>
      </Layout>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Create Rental Type"
        primaryAction={{ content: "Create", onAction: handleCreate, loading: isLoading }}
        secondaryActions={[{ content: "Cancel", onAction: () => setModalOpen(false) }]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Type Name"
              value={form.name}
              onChange={(v) => setForm((s) => ({ ...s, name: v }))}
              placeholder="e.g. Mountain Bikes, Kayaks, Camera Kits"
              requiredIndicator
              autoComplete="off"
            />
            <TextField
              label="Description"
              value={form.description}
              onChange={(v) => setForm((s) => ({ ...s, description: v }))}
              multiline={2}
              placeholder="Brief description of this rental category..."
            />
          </FormLayout>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
