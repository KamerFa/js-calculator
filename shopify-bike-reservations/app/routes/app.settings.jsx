import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import { useState, useCallback } from "react";
import {
  Page, Layout, Card, FormLayout, TextField, Select, Checkbox,
  Button, Text, BlockStack, Divider,
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

  const data = {
    businessName: formData.get("businessName"),
    currency: formData.get("currency"),
    timezone: formData.get("timezone"),
    depositPercentage: parseFloat(formData.get("depositPercentage")),
    minBookingHours: parseFloat(formData.get("minBookingHours")),
    confirmationPrefix: formData.get("confirmationPrefix") || "RN",
    ownerEmail: formData.get("ownerEmail") || null,
    ownerWhatsApp: formData.get("ownerWhatsApp") || null,
    emailNotifications: formData.get("emailNotifications") === "true",
    whatsAppNotifications: formData.get("whatsAppNotifications") === "true",
    pickupLocation: formData.get("pickupLocation") || null,
    pickupInstructions: formData.get("pickupInstructions") || null,
    cancellationPolicy: formData.get("cancellationPolicy") || null,
  };

  await prisma.appSettings.upsert({
    where: { shop: session.shop },
    create: { shop: session.shop, ...data },
    update: data,
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
    currency: settings.currency || "USD",
    timezone: settings.timezone || "America/New_York",
    depositPercentage: settings.depositPercentage?.toString() || "30",
    minBookingHours: settings.minBookingHours?.toString() || "4",
    confirmationPrefix: settings.confirmationPrefix || "RN",
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
    { label: "USD (US Dollar)", value: "USD" },
    { label: "EUR (Euro)", value: "EUR" },
    { label: "GBP (British Pound)", value: "GBP" },
    { label: "CAD (Canadian Dollar)", value: "CAD" },
    { label: "AUD (Australian Dollar)", value: "AUD" },
    { label: "JPY (Japanese Yen)", value: "JPY" },
    { label: "CHF (Swiss Franc)", value: "CHF" },
    { label: "BAM (Bosnian Mark)", value: "BAM" },
    { label: "HRK (Croatian Kuna)", value: "HRK" },
    { label: "RSD (Serbian Dinar)", value: "RSD" },
    { label: "THB (Thai Baht)", value: "THB" },
    { label: "MXN (Mexican Peso)", value: "MXN" },
    { label: "BRL (Brazilian Real)", value: "BRL" },
    { label: "INR (Indian Rupee)", value: "INR" },
  ];

  const timezones = [
    { label: "America/New_York (EST)", value: "America/New_York" },
    { label: "America/Chicago (CST)", value: "America/Chicago" },
    { label: "America/Denver (MST)", value: "America/Denver" },
    { label: "America/Los_Angeles (PST)", value: "America/Los_Angeles" },
    { label: "Europe/London (GMT)", value: "Europe/London" },
    { label: "Europe/Berlin (CET)", value: "Europe/Berlin" },
    { label: "Europe/Sarajevo (CET)", value: "Europe/Sarajevo" },
    { label: "Europe/Paris (CET)", value: "Europe/Paris" },
    { label: "Asia/Tokyo (JST)", value: "Asia/Tokyo" },
    { label: "Asia/Bangkok (ICT)", value: "Asia/Bangkok" },
    { label: "Asia/Dubai (GST)", value: "Asia/Dubai" },
    { label: "Australia/Sydney (AEST)", value: "Australia/Sydney" },
    { label: "Pacific/Auckland (NZST)", value: "Pacific/Auckland" },
  ];

  return (
    <Page title="Settings">
      <BlockStack gap="500">
        <Layout>
          <Layout.AnnotatedSection title="Business" description="Your rental business details.">
            <Card>
              <FormLayout>
                <TextField label="Business Name" value={form.businessName} onChange={(v) => setForm((s) => ({ ...s, businessName: v }))} />
                <FormLayout.Group>
                  <Select label="Currency" options={currencies} value={form.currency} onChange={(v) => setForm((s) => ({ ...s, currency: v }))} />
                  <Select label="Timezone" options={timezones} value={form.timezone} onChange={(v) => setForm((s) => ({ ...s, timezone: v }))} />
                </FormLayout.Group>
                <TextField label="Confirmation Code Prefix" value={form.confirmationPrefix} onChange={(v) => setForm((s) => ({ ...s, confirmationPrefix: v }))} helpText="e.g. RN, BK, RES — used in confirmation codes like RN-A3B4C5" maxLength={4} />
              </FormLayout>
            </Card>
          </Layout.AnnotatedSection>

          <Layout.AnnotatedSection title="Booking Rules" description="Configure how reservations and payments work.">
            <Card>
              <FormLayout>
                <TextField label="Deposit Percentage" value={form.depositPercentage} onChange={(v) => setForm((s) => ({ ...s, depositPercentage: v }))} type="number" suffix="%" helpText="Percentage of total price charged as deposit." />
                <TextField label="Minimum Booking Duration (hours)" value={form.minBookingHours} onChange={(v) => setForm((s) => ({ ...s, minBookingHours: v }))} type="number" helpText="Minimum rental duration. 4 = half day." />
              </FormLayout>
            </Card>
          </Layout.AnnotatedSection>

          <Layout.AnnotatedSection title="Notifications" description="Get notified when new reservations are made.">
            <Card>
              <FormLayout>
                <Checkbox label="Email notifications" checked={form.emailNotifications} onChange={(v) => setForm((s) => ({ ...s, emailNotifications: v }))} />
                <TextField label="Owner Email" value={form.ownerEmail} onChange={(v) => setForm((s) => ({ ...s, ownerEmail: v }))} type="email" placeholder="you@yourbusiness.com" />
                <Divider />
                <Checkbox label="WhatsApp notifications" checked={form.whatsAppNotifications} onChange={(v) => setForm((s) => ({ ...s, whatsAppNotifications: v }))} />
                <TextField label="Owner WhatsApp Number" value={form.ownerWhatsApp} onChange={(v) => setForm((s) => ({ ...s, ownerWhatsApp: v }))} placeholder="+1234567890" helpText="Requires WhatsApp Business API setup." />
              </FormLayout>
            </Card>
          </Layout.AnnotatedSection>

          <Layout.AnnotatedSection title="Pickup Details" description="Shown to customers after they complete a reservation.">
            <Card>
              <FormLayout>
                <TextField label="Pickup Location" value={form.pickupLocation} onChange={(v) => setForm((s) => ({ ...s, pickupLocation: v }))} placeholder="e.g. 123 Main St" />
                <TextField label="Pickup Instructions" value={form.pickupInstructions} onChange={(v) => setForm((s) => ({ ...s, pickupInstructions: v }))} multiline={3} placeholder="e.g. Meet at the office..." />
                <TextField label="Cancellation Policy" value={form.cancellationPolicy} onChange={(v) => setForm((s) => ({ ...s, cancellationPolicy: v }))} multiline={3} placeholder="e.g. Free cancellation up to 24 hours..." />
              </FormLayout>
            </Card>
          </Layout.AnnotatedSection>
        </Layout>

        <div style={{ display: "flex", justifyContent: "flex-end", padding: "16px 0" }}>
          <Button variant="primary" onClick={handleSave} loading={isLoading}>Save Settings</Button>
        </div>
      </BlockStack>
    </Page>
  );
}
