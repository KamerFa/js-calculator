import { json, redirect } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import { useState, useCallback } from "react";
import {
  Page, Card, Text, BlockStack, InlineStack, Button, FormLayout,
  TextField, Select, ProgressBar, Banner,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

const STEPS = [
  "Welcome & Business Info",
  "Create Rental Type",
  "Set Up Pricing",
  "Pickup Details",
  "You're All Set!",
];

const TYPE_PRESETS = [
  { name: "Bikes", slug: "bikes" },
  { name: "Kayaks", slug: "kayaks" },
  { name: "Scooters", slug: "scooters" },
  { name: "Equipment", slug: "equipment" },
  { name: "Vehicles", slug: "vehicles" },
];

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const settings = await prisma.appSettings.findUnique({
    where: { shop: session.shop },
  });

  if (settings?.onboardingComplete) {
    return redirect("/app");
  }

  return json({ settings });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "saveBusinessInfo") {
    await prisma.appSettings.upsert({
      where: { shop },
      create: {
        shop,
        businessName: formData.get("businessName"),
        currency: formData.get("currency"),
        timezone: formData.get("timezone"),
      },
      update: {
        businessName: formData.get("businessName"),
        currency: formData.get("currency"),
        timezone: formData.get("timezone"),
      },
    });
    return json({ ok: true });
  }

  if (intent === "createType") {
    const name = formData.get("name");
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

    const existing = await prisma.rentalItemType.findUnique({
      where: { shop_slug: { shop, slug } },
    });

    if (!existing) {
      await prisma.rentalItemType.create({
        data: { shop, name, slug, description: formData.get("description") || null },
      });
    }

    return json({ ok: true });
  }

  if (intent === "createPricingTier") {
    await prisma.pricingTier.create({
      data: {
        shop,
        name: formData.get("name"),
        durationHours: parseFloat(formData.get("durationHours")),
        price: parseFloat(formData.get("price")),
        isDefault: true,
      },
    });
    return json({ ok: true });
  }

  if (intent === "savePickupInfo") {
    await prisma.appSettings.upsert({
      where: { shop },
      create: {
        shop,
        pickupLocation: formData.get("pickupLocation") || null,
        pickupInstructions: formData.get("pickupInstructions") || null,
        depositPercentage: parseFloat(formData.get("depositPercentage") || "30"),
      },
      update: {
        pickupLocation: formData.get("pickupLocation") || null,
        pickupInstructions: formData.get("pickupInstructions") || null,
        depositPercentage: parseFloat(formData.get("depositPercentage") || "30"),
      },
    });
    return json({ ok: true });
  }

  if (intent === "completeOnboarding") {
    await prisma.appSettings.upsert({
      where: { shop },
      create: { shop, onboardingComplete: true },
      update: { onboardingComplete: true },
    });
    return redirect("/app");
  }

  return json({ ok: true });
};

export default function Onboarding() {
  const { settings } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isLoading = navigation.state !== "idle";

  const [step, setStep] = useState(0);
  const [businessForm, setBusinessForm] = useState({
    businessName: settings?.businessName || "",
    currency: settings?.currency || "USD",
    timezone: settings?.timezone || "America/New_York",
  });
  const [typeForm, setTypeForm] = useState({ name: "", description: "" });
  const [typesCreated, setTypesCreated] = useState([]);
  const [pricingForm, setPricingForm] = useState({ name: "", durationHours: "", price: "" });
  const [tiersCreated, setTiersCreated] = useState([]);
  const [pickupForm, setPickupForm] = useState({
    pickupLocation: settings?.pickupLocation || "",
    pickupInstructions: settings?.pickupInstructions || "",
    depositPercentage: settings?.depositPercentage?.toString() || "30",
  });

  const progress = ((step + 1) / STEPS.length) * 100;

  const handleSaveBusiness = useCallback(() => {
    const data = new FormData();
    data.set("intent", "saveBusinessInfo");
    Object.entries(businessForm).forEach(([k, v]) => data.set(k, v));
    submit(data, { method: "post" });
    setStep(1);
  }, [businessForm, submit]);

  const handleCreateType = useCallback((name, desc = "") => {
    const data = new FormData();
    data.set("intent", "createType");
    data.set("name", name);
    data.set("description", desc);
    submit(data, { method: "post" });
    setTypesCreated((prev) => [...prev, name]);
    setTypeForm({ name: "", description: "" });
  }, [submit]);

  const handleCreateTier = useCallback(() => {
    const data = new FormData();
    data.set("intent", "createPricingTier");
    Object.entries(pricingForm).forEach(([k, v]) => data.set(k, v));
    submit(data, { method: "post" });
    setTiersCreated((prev) => [...prev, pricingForm.name]);
    setPricingForm({ name: "", durationHours: "", price: "" });
  }, [pricingForm, submit]);

  const handleSavePickup = useCallback(() => {
    const data = new FormData();
    data.set("intent", "savePickupInfo");
    Object.entries(pickupForm).forEach(([k, v]) => data.set(k, v));
    submit(data, { method: "post" });
    setStep(4);
  }, [pickupForm, submit]);

  const handleComplete = useCallback(() => {
    const data = new FormData();
    data.set("intent", "completeOnboarding");
    submit(data, { method: "post" });
  }, [submit]);

  const currencies = [
    { label: "USD (US Dollar)", value: "USD" },
    { label: "EUR (Euro)", value: "EUR" },
    { label: "GBP (British Pound)", value: "GBP" },
    { label: "CAD (Canadian Dollar)", value: "CAD" },
    { label: "BAM (Bosnian Mark)", value: "BAM" },
  ];

  const timezones = [
    { label: "America/New_York", value: "America/New_York" },
    { label: "America/Los_Angeles", value: "America/Los_Angeles" },
    { label: "Europe/London", value: "Europe/London" },
    { label: "Europe/Berlin", value: "Europe/Berlin" },
    { label: "Europe/Sarajevo", value: "Europe/Sarajevo" },
    { label: "Asia/Tokyo", value: "Asia/Tokyo" },
    { label: "Asia/Bangkok", value: "Asia/Bangkok" },
    { label: "Australia/Sydney", value: "Australia/Sydney" },
  ];

  return (
    <Page title="Setup Wizard" narrowWidth>
      <BlockStack gap="500">
        <Card>
          <BlockStack gap="300">
            <InlineStack align="space-between">
              <Text variant="headingSm">Step {step + 1} of {STEPS.length}</Text>
              <Text variant="bodySm" tone="subdued">{STEPS[step]}</Text>
            </InlineStack>
            <ProgressBar progress={progress} size="small" />
          </BlockStack>
        </Card>

        {/* Step 0: Business Info */}
        {step === 0 && (
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingLg">Welcome to Rental Reservations</Text>
              <Text tone="subdued">Let's get your rental business set up in a few quick steps.</Text>
              <FormLayout>
                <TextField
                  label="Business Name"
                  value={businessForm.businessName}
                  onChange={(v) => setBusinessForm((s) => ({ ...s, businessName: v }))}
                  placeholder="Your Rental Business"
                  requiredIndicator
                />
                <FormLayout.Group>
                  <Select
                    label="Currency"
                    options={currencies}
                    value={businessForm.currency}
                    onChange={(v) => setBusinessForm((s) => ({ ...s, currency: v }))}
                  />
                  <Select
                    label="Timezone"
                    options={timezones}
                    value={businessForm.timezone}
                    onChange={(v) => setBusinessForm((s) => ({ ...s, timezone: v }))}
                  />
                </FormLayout.Group>
              </FormLayout>
              <InlineStack align="end">
                <Button variant="primary" onClick={handleSaveBusiness} loading={isLoading}>Continue</Button>
              </InlineStack>
            </BlockStack>
          </Card>
        )}

        {/* Step 1: Create Rental Type */}
        {step === 1 && (
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingLg">Create a Rental Type</Text>
              <Text tone="subdued">
                Rental types are categories for your products. Choose a preset or create your own.
              </Text>

              <Text variant="headingSm">Quick Presets</Text>
              <InlineStack gap="200" wrap>
                {TYPE_PRESETS.map((preset) => (
                  <Button
                    key={preset.slug}
                    onClick={() => handleCreateType(preset.name)}
                    disabled={typesCreated.includes(preset.name)}
                  >
                    {typesCreated.includes(preset.name) ? `${preset.name} (Added)` : preset.name}
                  </Button>
                ))}
              </InlineStack>

              <Text variant="headingSm">Or Create Custom</Text>
              <FormLayout>
                <TextField
                  label="Type Name"
                  value={typeForm.name}
                  onChange={(v) => setTypeForm((s) => ({ ...s, name: v }))}
                  placeholder="e.g. Surfboards, Camera Kits"
                />
                <TextField
                  label="Description (optional)"
                  value={typeForm.description}
                  onChange={(v) => setTypeForm((s) => ({ ...s, description: v }))}
                  multiline={2}
                />
                <Button onClick={() => handleCreateType(typeForm.name, typeForm.description)} disabled={!typeForm.name}>
                  Add Type
                </Button>
              </FormLayout>

              {typesCreated.length > 0 && (
                <Banner tone="success">
                  <p>Created: {typesCreated.join(", ")}</p>
                </Banner>
              )}

              <InlineStack align="space-between">
                <Button onClick={() => setStep(0)}>Back</Button>
                <Button variant="primary" onClick={() => setStep(2)} disabled={typesCreated.length === 0}>
                  Continue
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        )}

        {/* Step 2: Pricing */}
        {step === 2 && (
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingLg">Set Up Pricing</Text>
              <Text tone="subdued">
                Create default pricing tiers. You can customize per-type and per-item later.
              </Text>

              <FormLayout>
                <TextField
                  label="Tier Name"
                  value={pricingForm.name}
                  onChange={(v) => setPricingForm((s) => ({ ...s, name: v }))}
                  placeholder="e.g. Half Day, Full Day, 3 Days"
                />
                <FormLayout.Group>
                  <Select
                    label="Duration"
                    options={[
                      { label: "Choose duration", value: "" },
                      { label: "Half Day (4h)", value: "4" },
                      { label: "1 Day (24h)", value: "24" },
                      { label: "2 Days (48h)", value: "48" },
                      { label: "3 Days (72h)", value: "72" },
                      { label: "1 Week (168h)", value: "168" },
                    ]}
                    value={pricingForm.durationHours}
                    onChange={(v) => setPricingForm((s) => ({ ...s, durationHours: v }))}
                  />
                  <TextField
                    label="Price"
                    value={pricingForm.price}
                    onChange={(v) => setPricingForm((s) => ({ ...s, price: v }))}
                    type="number"
                    placeholder="0.00"
                  />
                </FormLayout.Group>
                <Button
                  onClick={handleCreateTier}
                  disabled={!pricingForm.name || !pricingForm.durationHours || !pricingForm.price}
                >
                  Add Tier
                </Button>
              </FormLayout>

              {tiersCreated.length > 0 && (
                <Banner tone="success">
                  <p>Created: {tiersCreated.join(", ")}</p>
                </Banner>
              )}

              <InlineStack align="space-between">
                <Button onClick={() => setStep(1)}>Back</Button>
                <Button variant="primary" onClick={() => setStep(3)} disabled={tiersCreated.length === 0}>
                  Continue
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        )}

        {/* Step 3: Pickup Details */}
        {step === 3 && (
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingLg">Pickup Details</Text>
              <Text tone="subdued">
                These details are shown to customers after they book.
              </Text>

              <FormLayout>
                <TextField
                  label="Pickup Location"
                  value={pickupForm.pickupLocation}
                  onChange={(v) => setPickupForm((s) => ({ ...s, pickupLocation: v }))}
                  placeholder="e.g. 123 Main St, Downtown"
                />
                <TextField
                  label="Pickup Instructions"
                  value={pickupForm.pickupInstructions}
                  onChange={(v) => setPickupForm((s) => ({ ...s, pickupInstructions: v }))}
                  multiline={3}
                  placeholder="e.g. Meet at the front desk. Bring ID."
                />
                <TextField
                  label="Deposit Percentage"
                  value={pickupForm.depositPercentage}
                  onChange={(v) => setPickupForm((s) => ({ ...s, depositPercentage: v }))}
                  type="number"
                  suffix="%"
                />
              </FormLayout>

              <InlineStack align="space-between">
                <Button onClick={() => setStep(2)}>Back</Button>
                <Button variant="primary" onClick={handleSavePickup} loading={isLoading}>Continue</Button>
              </InlineStack>
            </BlockStack>
          </Card>
        )}

        {/* Step 4: Complete */}
        {step === 4 && (
          <Card>
            <BlockStack gap="400" inlineAlign="center">
              <div style={{ fontSize: 48, textAlign: "center" }}>&#10003;</div>
              <Text as="h2" variant="headingLg" alignment="center">You're All Set!</Text>
              <Text alignment="center" tone="subdued">
                Your rental system is configured. Next steps:
              </Text>
              <BlockStack gap="200">
                <Text>1. Go to <strong>Rental Items</strong> and add Shopify products to your types</Text>
                <Text>2. Add the <strong>theme block</strong> to your storefront in the Theme Editor</Text>
                <Text>3. Start accepting reservations!</Text>
              </BlockStack>
              <Button variant="primary" onClick={handleComplete} loading={isLoading} size="large">
                Go to Dashboard
              </Button>
            </BlockStack>
          </Card>
        )}
      </BlockStack>
    </Page>
  );
}
