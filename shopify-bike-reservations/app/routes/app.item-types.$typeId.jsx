import { json, redirect } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import { useState, useCallback } from "react";
import {
  Page, Layout, Card, Text, BlockStack, InlineStack, Badge, Button,
  Modal, FormLayout, TextField, ResourceList, ResourceItem, Thumbnail,
  EmptyState, Divider, Select,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const PRODUCTS_QUERY = `
  query getProducts($first: Int!) {
    products(first: $first) {
      edges {
        node {
          id
          title
          description
          featuredImage { url altText }
        }
      }
    }
  }
`;

export const loader = async ({ request, params }) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = session.shop;
  const { typeId } = params;

  const type = await prisma.rentalItemType.findUnique({
    where: { id: typeId },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          _count: {
            select: { reservations: { where: { status: { in: ["confirmed", "pending"] } } } },
          },
        },
      },
    },
  });

  if (!type || type.shop !== shop) {
    return redirect("/app/item-types");
  }

  // Fetch Shopify products for the picker
  const response = await admin.graphql(PRODUCTS_QUERY, { variables: { first: 100 } });
  const { data } = await response.json();
  const shopifyProducts = data.products.edges.map((e) => e.node);

  // Get existing product IDs that are already rental items
  const existingProductIds = type.items.map((i) => i.shopifyProductId);

  return json({ type, shopifyProducts, existingProductIds });
};

export const action = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const { typeId } = params;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "updateType") {
    await prisma.rentalItemType.update({
      where: { id: typeId },
      data: {
        name: formData.get("name"),
        description: formData.get("description") || null,
        isActive: formData.get("isActive") === "true",
      },
    });
  }

  if (intent === "addItem") {
    const shopifyProductId = formData.get("shopifyProductId");
    const name = formData.get("name");
    const imageUrl = formData.get("imageUrl") || null;
    const description = formData.get("description") || null;

    await prisma.rentalItem.upsert({
      where: { shop_shopifyProductId: { shop, shopifyProductId } },
      create: {
        shop, rentalItemTypeId: typeId, shopifyProductId, name, imageUrl, description, isActive: true,
      },
      update: {
        rentalItemTypeId: typeId, name, imageUrl, description, isActive: true,
      },
    });
  }

  if (intent === "removeItem") {
    const itemId = formData.get("itemId");
    const activeCount = await prisma.reservation.count({
      where: { rentalItemId: itemId, status: { in: ["confirmed", "pending"] } },
    });
    if (activeCount > 0) {
      return json({ error: "Cannot remove item with active reservations." }, { status: 400 });
    }
    await prisma.rentalItem.delete({ where: { id: itemId } });
  }

  if (intent === "toggleItem") {
    const itemId = formData.get("itemId");
    const item = await prisma.rentalItem.findUnique({ where: { id: itemId } });
    if (item) {
      await prisma.rentalItem.update({
        where: { id: itemId },
        data: { isActive: !item.isActive },
      });
    }
  }

  if (intent === "updateCustomFields") {
    const itemId = formData.get("itemId");
    const customFieldValues = JSON.parse(formData.get("customFieldValues") || "{}");
    await prisma.rentalItem.update({
      where: { id: itemId },
      data: { customFieldValues },
    });
  }

  return json({ ok: true });
};

export default function ItemTypeDetail() {
  const { type, shopifyProducts, existingProductIds } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isLoading = navigation.state !== "idle";

  const [editModal, setEditModal] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [typeForm, setTypeForm] = useState({
    name: type.name,
    description: type.description || "",
    isActive: type.isActive ? "true" : "false",
  });

  const availableProducts = shopifyProducts.filter(
    (p) => !existingProductIds.includes(p.id)
  );

  const handleSaveType = useCallback(() => {
    const data = new FormData();
    data.set("intent", "updateType");
    Object.entries(typeForm).forEach(([k, v]) => data.set(k, v));
    submit(data, { method: "post" });
    setEditModal(false);
  }, [typeForm, submit]);

  const handleAddProduct = useCallback((product) => {
    const data = new FormData();
    data.set("intent", "addItem");
    data.set("shopifyProductId", product.id);
    data.set("name", product.title);
    data.set("imageUrl", product.featuredImage?.url || "");
    data.set("description", product.description || "");
    submit(data, { method: "post" });
  }, [submit]);

  const handleRemoveItem = useCallback((itemId) => {
    if (!confirm("Remove this item from rentals?")) return;
    const data = new FormData();
    data.set("intent", "removeItem");
    data.set("itemId", itemId);
    submit(data, { method: "post" });
  }, [submit]);

  const handleToggleItem = useCallback((itemId) => {
    const data = new FormData();
    data.set("intent", "toggleItem");
    data.set("itemId", itemId);
    submit(data, { method: "post" });
  }, [submit]);

  const customFields = (() => {
    try { return JSON.parse(type.customFields || "[]"); }
    catch { return []; }
  })();

  return (
    <Page
      title={type.name}
      backAction={{ url: "/app/item-types" }}
      titleMetadata={
        <Badge tone={type.isActive ? "success" : undefined}>
          {type.isActive ? "Active" : "Inactive"}
        </Badge>
      }
      primaryAction={{ content: "Edit Type", onAction: () => setEditModal(true) }}
      secondaryActions={[{ content: "Add Products", onAction: () => setAddModal(true) }]}
    >
      <BlockStack gap="500">
        <Layout>
          <Layout.AnnotatedSection
            title="Type Settings"
            description="Basic configuration for this rental category."
          >
            <Card>
              <BlockStack gap="200">
                <Text variant="bodyMd"><strong>Name:</strong> {type.name}</Text>
                <Text variant="bodyMd"><strong>Slug:</strong> {type.slug}</Text>
                {type.description && <Text variant="bodySm" tone="subdued">{type.description}</Text>}
                {customFields.length > 0 && (
                  <>
                    <Divider />
                    <Text variant="headingSm">Custom Fields</Text>
                    <BlockStack gap="100">
                      {customFields.map((f, i) => (
                        <Text key={i} variant="bodySm">{f.label} ({f.type})</Text>
                      ))}
                    </BlockStack>
                  </>
                )}
              </BlockStack>
            </Card>
          </Layout.AnnotatedSection>
        </Layout>

        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <Text as="h2" variant="headingMd">
                Rental Items ({type.items.length})
              </Text>
              <Button onClick={() => setAddModal(true)}>Add Products</Button>
            </InlineStack>

            {type.items.length > 0 ? (
              <ResourceList
                resourceName={{ singular: "item", plural: "items" }}
                items={type.items}
                renderItem={(item) => {
                  const activeRes = item._count?.reservations || 0;
                  return (
                    <ResourceItem
                      id={item.id}
                      media={
                        item.imageUrl ? (
                          <Thumbnail source={item.imageUrl} alt={item.name} size="medium" />
                        ) : undefined
                      }
                      shortcutActions={[
                        {
                          content: item.isActive ? "Deactivate" : "Activate",
                          onAction: () => handleToggleItem(item.id),
                        },
                        {
                          content: "Remove",
                          destructive: true,
                          onAction: () => handleRemoveItem(item.id),
                        },
                      ]}
                    >
                      <InlineStack align="space-between" blockAlign="center">
                        <BlockStack gap="100">
                          <Text variant="bodyMd" fontWeight="bold">{item.name}</Text>
                          {item.description && (
                            <Text variant="bodySm" tone="subdued">
                              {item.description.substring(0, 100)}
                            </Text>
                          )}
                        </BlockStack>
                        <InlineStack gap="200">
                          {activeRes > 0 && <Badge tone="info">{activeRes} active</Badge>}
                          <Badge tone={item.isActive ? "success" : undefined}>
                            {item.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </InlineStack>
                      </InlineStack>
                    </ResourceItem>
                  );
                }}
              />
            ) : (
              <EmptyState
                heading="No items in this type"
                action={{ content: "Add Products", onAction: () => setAddModal(true) }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Add Shopify products to this rental type to make them rentable.</p>
              </EmptyState>
            )}
          </BlockStack>
        </Card>
      </BlockStack>

      {/* Edit Type Modal */}
      <Modal
        open={editModal}
        onClose={() => setEditModal(false)}
        title="Edit Rental Type"
        primaryAction={{ content: "Save", onAction: handleSaveType, loading: isLoading }}
        secondaryActions={[{ content: "Cancel", onAction: () => setEditModal(false) }]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Name"
              value={typeForm.name}
              onChange={(v) => setTypeForm((s) => ({ ...s, name: v }))}
              requiredIndicator
            />
            <TextField
              label="Description"
              value={typeForm.description}
              onChange={(v) => setTypeForm((s) => ({ ...s, description: v }))}
              multiline={2}
            />
            <Select
              label="Status"
              options={[
                { label: "Active", value: "true" },
                { label: "Inactive", value: "false" },
              ]}
              value={typeForm.isActive}
              onChange={(v) => setTypeForm((s) => ({ ...s, isActive: v }))}
            />
          </FormLayout>
        </Modal.Section>
      </Modal>

      {/* Add Products Modal */}
      <Modal
        open={addModal}
        onClose={() => setAddModal(false)}
        title="Add Products to Rental"
      >
        <Modal.Section>
          {availableProducts.length > 0 ? (
            <ResourceList
              resourceName={{ singular: "product", plural: "products" }}
              items={availableProducts}
              renderItem={(product) => (
                <ResourceItem
                  id={product.id}
                  media={
                    product.featuredImage ? (
                      <Thumbnail source={product.featuredImage.url} alt={product.title} size="small" />
                    ) : undefined
                  }
                  shortcutActions={[
                    { content: "Add to Rentals", onAction: () => handleAddProduct(product) },
                  ]}
                >
                  <Text variant="bodyMd" fontWeight="bold">{product.title}</Text>
                </ResourceItem>
              )}
            />
          ) : (
            <Text tone="subdued">
              All products are already added to rental types.
            </Text>
          )}
        </Modal.Section>
      </Modal>
    </Page>
  );
}
