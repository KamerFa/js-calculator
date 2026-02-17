import { json, redirect } from "@remix-run/node";
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
  Banner,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const bikes = await prisma.bike.findMany({
    where: { shop: session.shop },
    orderBy: { sortOrder: "asc" },
    include: {
      _count: {
        select: {
          reservations: {
            where: { status: { in: ["confirmed", "pending"] } },
          },
        },
      },
    },
  });

  return json({ bikes });
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
      category: formData.get("category") || null,
      imageUrl: formData.get("imageUrl") || null,
      engineSize: formData.get("engineSize") || null,
      year: formData.get("year") ? parseInt(formData.get("year")) : null,
      plateNumber: formData.get("plateNumber") || null,
      isActive: formData.get("isActive") === "true",
    };

    if (intent === "create") {
      const maxOrder = await prisma.bike.findFirst({
        where: { shop: session.shop },
        orderBy: { sortOrder: "desc" },
        select: { sortOrder: true },
      });
      data.sortOrder = (maxOrder?.sortOrder ?? -1) + 1;
      await prisma.bike.create({ data });
    } else {
      const id = formData.get("id");
      await prisma.bike.update({ where: { id }, data });
    }
  }

  if (intent === "delete") {
    const id = formData.get("id");
    // Check for active reservations
    const activeReservations = await prisma.reservation.count({
      where: { bikeId: id, status: { in: ["confirmed", "pending"] } },
    });
    if (activeReservations > 0) {
      return json(
        { error: "Cannot delete a bike with active reservations. Cancel them first." },
        { status: 400 }
      );
    }
    await prisma.bike.delete({ where: { id } });
  }

  if (intent === "toggle") {
    const id = formData.get("id");
    const bike = await prisma.bike.findUnique({ where: { id } });
    await prisma.bike.update({
      where: { id },
      data: { isActive: !bike.isActive },
    });
  }

  return json({ ok: true });
};

export default function BikesPage() {
  const { bikes } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isLoading = navigation.state !== "idle";

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBike, setEditingBike] = useState(null);
  const [formState, setFormState] = useState({
    name: "",
    description: "",
    category: "",
    imageUrl: "",
    engineSize: "",
    year: "",
    plateNumber: "",
    isActive: "true",
  });

  const categories = [
    { label: "Select category", value: "" },
    { label: "Scooter", value: "scooter" },
    { label: "Sport", value: "sport" },
    { label: "Cruiser", value: "cruiser" },
    { label: "Adventure", value: "adventure" },
    { label: "Naked", value: "naked" },
    { label: "Enduro", value: "enduro" },
    { label: "Other", value: "other" },
  ];

  const openCreateModal = useCallback(() => {
    setEditingBike(null);
    setFormState({
      name: "", description: "", category: "", imageUrl: "",
      engineSize: "", year: "", plateNumber: "", isActive: "true",
    });
    setModalOpen(true);
  }, []);

  const openEditModal = useCallback((bike) => {
    setEditingBike(bike);
    setFormState({
      name: bike.name,
      description: bike.description || "",
      category: bike.category || "",
      imageUrl: bike.imageUrl || "",
      engineSize: bike.engineSize || "",
      year: bike.year?.toString() || "",
      plateNumber: bike.plateNumber || "",
      isActive: bike.isActive ? "true" : "false",
    });
    setModalOpen(true);
  }, []);

  const handleSave = useCallback(() => {
    const data = new FormData();
    data.set("intent", editingBike ? "update" : "create");
    if (editingBike) data.set("id", editingBike.id);
    Object.entries(formState).forEach(([key, value]) => data.set(key, value));
    submit(data, { method: "post" });
    setModalOpen(false);
  }, [formState, editingBike, submit]);

  const handleDelete = useCallback((id) => {
    if (!confirm("Are you sure you want to delete this bike?")) return;
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
      title="Fleet Management"
      primaryAction={{ content: "Add Bike", onAction: openCreateModal }}
    >
      <Layout>
        <Layout.Section>
          <Card padding="0">
            {bikes.length > 0 ? (
              <ResourceList
                resourceName={{ singular: "bike", plural: "bikes" }}
                items={bikes}
                renderItem={(bike) => (
                  <ResourceItem
                    id={bike.id}
                    media={
                      bike.imageUrl ? (
                        <Thumbnail source={bike.imageUrl} alt={bike.name} size="medium" />
                      ) : (
                        <Thumbnail
                          source="https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png"
                          alt={bike.name}
                          size="medium"
                        />
                      )
                    }
                    onClick={() => openEditModal(bike)}
                    shortcutActions={[
                      {
                        content: bike.isActive ? "Deactivate" : "Activate",
                        onAction: () => handleToggle(bike.id),
                      },
                      {
                        content: "Delete",
                        destructive: true,
                        onAction: () => handleDelete(bike.id),
                      },
                    ]}
                  >
                    <InlineStack align="space-between" blockAlign="center">
                      <BlockStack gap="100">
                        <Text variant="bodyMd" fontWeight="bold">
                          {bike.name}
                        </Text>
                        <Text variant="bodySm" tone="subdued">
                          {[bike.category, bike.engineSize, bike.year]
                            .filter(Boolean)
                            .join(" | ")}
                        </Text>
                        {bike.plateNumber && (
                          <Text variant="bodySm" tone="subdued">
                            Plate: {bike.plateNumber}
                          </Text>
                        )}
                      </BlockStack>
                      <InlineStack gap="200">
                        {bike._count.reservations > 0 && (
                          <Badge tone="info">
                            {bike._count.reservations} active
                          </Badge>
                        )}
                        <Badge tone={bike.isActive ? "success" : undefined}>
                          {bike.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </InlineStack>
                    </InlineStack>
                  </ResourceItem>
                )}
              />
            ) : (
              <EmptyState
                heading="Add your first motorbike"
                action={{ content: "Add Bike", onAction: openCreateModal }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>
                  Start building your fleet by adding the motorbikes available for rent.
                </p>
              </EmptyState>
            )}
          </Card>
        </Layout.Section>
      </Layout>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingBike ? `Edit ${editingBike.name}` : "Add New Bike"}
        primaryAction={{
          content: "Save",
          onAction: handleSave,
          loading: isLoading,
        }}
        secondaryActions={[{ content: "Cancel", onAction: () => setModalOpen(false) }]}
      >
        <Modal.Section>
          <FormLayout>
            <TextField
              label="Bike Name"
              value={formState.name}
              onChange={(v) => setFormState((s) => ({ ...s, name: v }))}
              autoComplete="off"
              requiredIndicator
              placeholder="e.g. Honda PCX 125"
            />
            <TextField
              label="Description"
              value={formState.description}
              onChange={(v) => setFormState((s) => ({ ...s, description: v }))}
              autoComplete="off"
              multiline={3}
              placeholder="Brief description for customers..."
            />
            <FormLayout.Group>
              <Select
                label="Category"
                options={categories}
                value={formState.category}
                onChange={(v) => setFormState((s) => ({ ...s, category: v }))}
              />
              <TextField
                label="Engine Size"
                value={formState.engineSize}
                onChange={(v) => setFormState((s) => ({ ...s, engineSize: v }))}
                autoComplete="off"
                placeholder="e.g. 125cc"
              />
            </FormLayout.Group>
            <FormLayout.Group>
              <TextField
                label="Year"
                value={formState.year}
                onChange={(v) => setFormState((s) => ({ ...s, year: v }))}
                autoComplete="off"
                type="number"
                placeholder="e.g. 2023"
              />
              <TextField
                label="Plate Number"
                value={formState.plateNumber}
                onChange={(v) => setFormState((s) => ({ ...s, plateNumber: v }))}
                autoComplete="off"
                placeholder="e.g. A12-B-345"
              />
            </FormLayout.Group>
            <TextField
              label="Image URL"
              value={formState.imageUrl}
              onChange={(v) => setFormState((s) => ({ ...s, imageUrl: v }))}
              autoComplete="off"
              placeholder="https://..."
              helpText="Paste a direct image URL or upload to Shopify Files first"
            />
            <Select
              label="Status"
              options={[
                { label: "Active (available for booking)", value: "true" },
                { label: "Inactive (hidden from customers)", value: "false" },
              ]}
              value={formState.isActive}
              onChange={(v) => setFormState((s) => ({ ...s, isActive: v }))}
            />
          </FormLayout>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
