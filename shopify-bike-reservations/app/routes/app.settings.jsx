import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import { useState, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Select,
  Checkbox,
  Button,
  Text,
  BlockStack,
  Banner,
  Divider,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const settings = await prisma.appSettings.upsert({
    where: { shop: session.shop },
    create: { shop: session.shop },
    update: {},
  });
  return json({ settings });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  await prisma.appSettings.upsert({
    where: { shop: session.shop },
    create: {
      shop: session.shop,
      businessName: formData.get("businessName"),
      currency: formData.get("currency"),
      timezone: formData.get("timezone"),
      depositPercentage: parseFloat(formData.get("depositPercentage")),
      minBookingHours: parseFloat(formData.get("minBookingHours")),
      ownerEmail: formData.get("ownerEmail") || null,
      ownerWhatsApp: formData.get("ownerWhatsApp") || null,
      emailNotifications: formData.get("emailNotifications") === "true",
      whatsAppNotifications: formData.get("whatsAppNotifications") === "true",
      pickupLocation: formData.get("pickupLocation") || null,
      pickupInstructions: formData.get("pickupInstructions") || null,
      cancellationPolicy: formData.get("cancellationPolicy") || null,
    },
    update: {
      businessName: formData.get("businessName"),
      currency: formData.get("currency"),
      timezone: formData.get("timezone"),
      depositPercentage: parseFloat(formData.get("depositPercentage")),
      minBookingHours: parseFloat(formData.get("minBookingHours")),
      ownerEmail: formData.get("ownerEmail") || null,
      ownerWhatsApp: formData.get("ownerWhatsApp") || null,
      emailNotifications: formData.get("emailNotifications") === "true",
      whatsAppNotifications: formData.get("whatsAppNotifications") === "true",
      pickupLocation: formData.get("pickupLocation") || null,
      pickupInstructions: formData.get("pickupInstructions") || null,
      cancellationPolicy: formData.get("cancellationPolicy") || null,
    },
  });

  return json({ ok: true, saved: true });
};

export default function SettingsPage() {
  const { settings } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isLoading = navigation.state !== "idle";

  const [form, setForm] = useState({
    businessName: settings.businessName || "",
    currency: settings.currency || "BAM",
    timezone: settings.timezone || "Europe/Sarajevo",
    depositPercentage: settings.depositPercentage?.toString() || "30",
    minBookingHours: settings.minBookingHours?.toString() || "4",
    ownerEmail: settings.ownerEmail || "",
    ownerWhatsApp: settings.ownerWhatsApp || "",
    emailNotifications: settings.emailNotifications,
    whatsAppNotifications: settings.whatsAppNotifications,
    pickupLocation: settings.pickupLocation || "",
    pickupInstructions: settings.pickupInstructions || "",
    cancellationPolicy: settings.cancellationPolicy || "",
  });

  const handleSave = useCallback(() => {
    const data = new FormData();
    Object.entries(form).forEach(([k, v]) => {
      data.set(k, typeof v === "boolean" ? v.toString() : v);
    });
    submit(data, { method: "post" });
  }, [form, submit]);

  const currencies = [
    { label: "BAM (Bosnian Convertible Mark)", value: "BAM" },
    { label: "EUR (Euro)", value: "EUR" },
    { label: "USD (US Dollar)", value: "USD" },
    { label: "GBP (British Pound)", value: "GBP" },
    { label: "HRK (Croatian Kuna)", value: "HRK" },
    { label: "RSD (Serbian Dinar)", value: "RSD" },
  ];

  return (
    <Page title="Settings">
      <BlockStack gap="500">
        <Layout>
          {/* Business Settings */}
          <Layout.AnnotatedSection
            title="Business"
            description="Your rental business details."
          >
            <Card>
              <FormLayout>
                <TextField
                  label="Business Name"
                  value={form.businessName}
                  onChange={(v) => setForm((s) => ({ ...s, businessName: v }))}
                />
                <FormLayout.Group>
                  <Select
                    label="Currency"
                    options={currencies}
                    value={form.currency}
                    onChange={(v) => setForm((s) => ({ ...s, currency: v }))}
                  />
                  <Select
                    label="Timezone"
                    options={[
                      { label: "Europe/Sarajevo (CET)", value: "Europe/Sarajevo" },
                      { label: "Europe/London (GMT)", value: "Europe/London" },
                      { label: "Europe/Berlin (CET)", value: "Europe/Berlin" },
                      { label: "America/New_York (EST)", value: "America/New_York" },
                      { label: "Asia/Bangkok (ICT)", value: "Asia/Bangkok" },
                    ]}
                    value={form.timezone}
                    onChange={(v) => setForm((s) => ({ ...s, timezone: v }))}
                  />
                </FormLayout.Group>
              </FormLayout>
            </Card>
          </Layout.AnnotatedSection>

          {/* Booking Settings */}
          <Layout.AnnotatedSection
            title="Booking Rules"
            description="Configure how reservations and payments work."
          >
            <Card>
              <FormLayout>
                <TextField
                  label="Deposit Percentage"
                  value={form.depositPercentage}
                  onChange={(v) => setForm((s) => ({ ...s, depositPercentage: v }))}
                  type="number"
                  suffix="%"
                  helpText="Percentage of total price charged as deposit at checkout. Remainder paid on pickup."
                />
                <TextField
                  label="Minimum Booking Duration (hours)"
                  value={form.minBookingHours}
                  onChange={(v) => setForm((s) => ({ ...s, minBookingHours: v }))}
                  type="number"
                  helpText="Minimum rental duration. 4 = half day."
                />
              </FormLayout>
            </Card>
          </Layout.AnnotatedSection>

          {/* Notifications */}
          <Layout.AnnotatedSection
            title="Notifications"
            description="Get notified when new reservations are made."
          >
            <Card>
              <FormLayout>
                <Checkbox
                  label="Email notifications"
                  checked={form.emailNotifications}
                  onChange={(v) => setForm((s) => ({ ...s, emailNotifications: v }))}
                />
                <TextField
                  label="Owner Email"
                  value={form.ownerEmail}
                  onChange={(v) => setForm((s) => ({ ...s, ownerEmail: v }))}
                  type="email"
                  placeholder="you@yourbusiness.com"
                  helpText="Receives notification emails for every new booking."
                />
                <Divider />
                <Checkbox
                  label="WhatsApp notifications"
                  checked={form.whatsAppNotifications}
                  onChange={(v) => setForm((s) => ({ ...s, whatsAppNotifications: v }))}
                />
                <TextField
                  label="Owner WhatsApp Number"
                  value={form.ownerWhatsApp}
                  onChange={(v) => setForm((s) => ({ ...s, ownerWhatsApp: v }))}
                  placeholder="+38761XXXXXXX"
                  helpText="Requires WhatsApp Business API setup. See .env.example for config."
                />
              </FormLayout>
            </Card>
          </Layout.AnnotatedSection>

          {/* Pickup Info */}
          <Layout.AnnotatedSection
            title="Pickup Details"
            description="Shown to customers after they complete a reservation."
          >
            <Card>
              <FormLayout>
                <TextField
                  label="Pickup Location"
                  value={form.pickupLocation}
                  onChange={(v) => setForm((s) => ({ ...s, pickupLocation: v }))}
                  placeholder="e.g. Bascarsija, Old Town Sarajevo"
                />
                <TextField
                  label="Pickup Instructions"
                  value={form.pickupInstructions}
                  onChange={(v) => setForm((s) => ({ ...s, pickupInstructions: v }))}
                  multiline={3}
                  placeholder="e.g. Meet us at the office. Bring your ID and driver's license..."
                />
                <TextField
                  label="Cancellation Policy"
                  value={form.cancellationPolicy}
                  onChange={(v) => setForm((s) => ({ ...s, cancellationPolicy: v }))}
                  multiline={3}
                  placeholder="e.g. Free cancellation up to 24 hours before pickup..."
                />
              </FormLayout>
            </Card>
          </Layout.AnnotatedSection>
        </Layout>

        <div style={{ display: "flex", justifyContent: "flex-end", padding: "16px 0" }}>
          <Button variant="primary" onClick={handleSave} loading={isLoading}>
            Save Settings
          </Button>
        </div>
      </BlockStack>
    </Page>
  );
}
