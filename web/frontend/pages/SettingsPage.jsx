import { useState, useCallback, useEffect } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  TextField,
  FormLayout,
  Select,
  Button,
  Checkbox,
  IndexTable,
  Banner,
  Spinner,
  Divider,
  Modal,
} from "@shopify/polaris";
import { useApiQuery, useAppFetch } from "../hooks/useApi";

const TIMEZONE_OPTIONS = [
  { label: "Eastern (US)", value: "America/New_York" },
  { label: "Central (US)", value: "America/Chicago" },
  { label: "Mountain (US)", value: "America/Denver" },
  { label: "Pacific (US)", value: "America/Los_Angeles" },
  { label: "UTC", value: "UTC" },
  { label: "London", value: "Europe/London" },
  { label: "Paris", value: "Europe/Paris" },
  { label: "Tokyo", value: "Asia/Tokyo" },
  { label: "Sydney", value: "Australia/Sydney" },
];

const DAY_OPTIONS = [
  { label: "Mon", value: "1" },
  { label: "Tue", value: "2" },
  { label: "Wed", value: "3" },
  { label: "Thu", value: "4" },
  { label: "Fri", value: "5" },
  { label: "Sat", value: "6" },
  { label: "Sun", value: "0" },
];

export default function SettingsPage() {
  const { data, loading, error, refetch } = useApiQuery("/api/settings");
  const appFetch = useAppFetch();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showBlackoutModal, setShowBlackoutModal] = useState(false);
  const [blackoutStart, setBlackoutStart] = useState("");
  const [blackoutEnd, setBlackoutEnd] = useState("");
  const [blackoutReason, setBlackoutReason] = useState("");

  useEffect(() => {
    if (data?.settings && !form) {
      const s = data.settings;
      setForm({
        businessName: s.businessName || "",
        timezone: s.timezone || "America/New_York",
        businessHoursStart: s.businessHoursStart || "09:00",
        businessHoursEnd: s.businessHoursEnd || "17:00",
        businessDays: (s.businessDays || "1,2,3,4,5").split(","),
        defaultDurationUnit: s.defaultDurationUnit || "days",
        defaultMinDuration: String(s.defaultMinDuration || 1),
        defaultMaxDuration: String(s.defaultMaxDuration || 30),
        defaultBufferTime: String(s.defaultBufferTime || 2),
        defaultBufferUnit: s.defaultBufferUnit || "hours",
        depositPolicy: s.depositPolicy || "optional",
        defaultDepositPct: String(s.defaultDepositPct || 0),
        widgetInheritTheme: s.widgetInheritTheme !== false,
        widgetPrimaryColor: s.widgetPrimaryColor || "#000000",
        widgetBorderRadius: s.widgetBorderRadius || "4px",
      });
    }
  }, [data, form]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    try {
      await appFetch("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          ...form,
          businessDays: form.businessDays.join(","),
          defaultMinDuration: parseInt(form.defaultMinDuration),
          defaultMaxDuration: parseInt(form.defaultMaxDuration),
          defaultBufferTime: parseInt(form.defaultBufferTime),
          defaultDepositPct: parseInt(form.defaultDepositPct),
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  }, [appFetch, form]);

  const handleAddBlackout = useCallback(async () => {
    await appFetch("/api/settings/blackout", {
      method: "POST",
      body: JSON.stringify({
        startDate: blackoutStart,
        endDate: blackoutEnd,
        reason: blackoutReason,
      }),
    });
    setShowBlackoutModal(false);
    setBlackoutStart("");
    setBlackoutEnd("");
    setBlackoutReason("");
    setForm(null);
    refetch();
  }, [appFetch, blackoutStart, blackoutEnd, blackoutReason, refetch]);

  const handleDeleteBlackout = useCallback(
    async (id) => {
      await appFetch(`/api/settings/blackout/${id}`, { method: "DELETE" });
      setForm(null);
      refetch();
    },
    [appFetch, refetch]
  );

  const toggleDay = useCallback(
    (day) => {
      const days = form.businessDays.includes(day)
        ? form.businessDays.filter((d) => d !== day)
        : [...form.businessDays, day];
      setForm({ ...form, businessDays: days });
    },
    [form]
  );

  if (loading) {
    return (
      <Page title="Settings">
        <Card><Spinner size="large" /></Card>
      </Page>
    );
  }

  if (error) {
    return (
      <Page title="Settings">
        <Banner tone="critical">{error}</Banner>
      </Page>
    );
  }

  if (!form) return null;

  return (
    <Page title="Settings">
      <Layout>
        {saved && (
          <Layout.Section>
            <Banner tone="success" onDismiss={() => setSaved(false)}>
              Settings saved successfully.
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd">Business Hours</Text>
              <FormLayout>
                <TextField
                  label="Business name"
                  value={form.businessName}
                  onChange={(v) => setForm({ ...form, businessName: v })}
                  autoComplete="off"
                />
                <Select
                  label="Timezone"
                  options={TIMEZONE_OPTIONS}
                  value={form.timezone}
                  onChange={(v) => setForm({ ...form, timezone: v })}
                />
                <FormLayout.Group>
                  <TextField
                    label="Opening time"
                    type="time"
                    value={form.businessHoursStart}
                    onChange={(v) => setForm({ ...form, businessHoursStart: v })}
                    autoComplete="off"
                  />
                  <TextField
                    label="Closing time"
                    type="time"
                    value={form.businessHoursEnd}
                    onChange={(v) => setForm({ ...form, businessHoursEnd: v })}
                    autoComplete="off"
                  />
                </FormLayout.Group>
                <BlockStack gap="200">
                  <Text variant="bodySm">Business days</Text>
                  <InlineStack gap="300">
                    {DAY_OPTIONS.map((d) => (
                      <Checkbox
                        key={d.value}
                        label={d.label}
                        checked={form.businessDays.includes(d.value)}
                        onChange={() => toggleDay(d.value)}
                      />
                    ))}
                  </InlineStack>
                </BlockStack>
              </FormLayout>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd">Default Rental Terms</Text>
              <FormLayout>
                <FormLayout.Group>
                  <Select
                    label="Default duration unit"
                    options={[
                      { label: "Hours", value: "hours" },
                      { label: "Days", value: "days" },
                      { label: "Weeks", value: "weeks" },
                    ]}
                    value={form.defaultDurationUnit}
                    onChange={(v) => setForm({ ...form, defaultDurationUnit: v })}
                  />
                  <TextField
                    label="Default min duration"
                    type="number"
                    value={form.defaultMinDuration}
                    onChange={(v) => setForm({ ...form, defaultMinDuration: v })}
                    autoComplete="off"
                  />
                  <TextField
                    label="Default max duration"
                    type="number"
                    value={form.defaultMaxDuration}
                    onChange={(v) => setForm({ ...form, defaultMaxDuration: v })}
                    autoComplete="off"
                  />
                </FormLayout.Group>
                <FormLayout.Group>
                  <TextField
                    label="Default buffer time"
                    type="number"
                    value={form.defaultBufferTime}
                    onChange={(v) => setForm({ ...form, defaultBufferTime: v })}
                    autoComplete="off"
                  />
                  <Select
                    label="Buffer unit"
                    options={[
                      { label: "Hours", value: "hours" },
                      { label: "Days", value: "days" },
                    ]}
                    value={form.defaultBufferUnit}
                    onChange={(v) => setForm({ ...form, defaultBufferUnit: v })}
                  />
                </FormLayout.Group>
              </FormLayout>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd">Deposit Policy</Text>
              <FormLayout>
                <Select
                  label="Deposit requirement"
                  options={[
                    { label: "Optional", value: "optional" },
                    { label: "Required", value: "required" },
                    { label: "None", value: "none" },
                  ]}
                  value={form.depositPolicy}
                  onChange={(v) => setForm({ ...form, depositPolicy: v })}
                />
                {form.depositPolicy !== "none" && (
                  <TextField
                    label="Default deposit percentage"
                    type="number"
                    value={form.defaultDepositPct}
                    onChange={(v) => setForm({ ...form, defaultDepositPct: v })}
                    suffix="%"
                    autoComplete="off"
                  />
                )}
              </FormLayout>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text variant="headingMd">Widget Appearance</Text>
              <FormLayout>
                <Checkbox
                  label="Inherit theme styles"
                  helpText="When enabled, the rental widget inherits your store theme's typography, colors, and spacing."
                  checked={form.widgetInheritTheme}
                  onChange={(v) => setForm({ ...form, widgetInheritTheme: v })}
                />
                {!form.widgetInheritTheme && (
                  <FormLayout.Group>
                    <TextField
                      label="Primary color"
                      value={form.widgetPrimaryColor}
                      onChange={(v) => setForm({ ...form, widgetPrimaryColor: v })}
                      autoComplete="off"
                      prefix="#"
                    />
                    <TextField
                      label="Border radius"
                      value={form.widgetBorderRadius}
                      onChange={(v) => setForm({ ...form, widgetBorderRadius: v })}
                      autoComplete="off"
                    />
                  </FormLayout.Group>
                )}
              </FormLayout>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd">Blackout Dates</Text>
                <Button size="slim" onClick={() => setShowBlackoutModal(true)}>
                  Add blackout
                </Button>
              </InlineStack>
              {data?.blackoutDates?.length > 0 ? (
                <IndexTable
                  itemCount={data.blackoutDates.length}
                  headings={[
                    { title: "Start" },
                    { title: "End" },
                    { title: "Reason" },
                    { title: "" },
                  ]}
                  selectable={false}
                >
                  {data.blackoutDates.map((b, i) => (
                    <IndexTable.Row id={b.id} key={b.id} position={i}>
                      <IndexTable.Cell>
                        {new Date(b.startDate).toLocaleDateString()}
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        {new Date(b.endDate).toLocaleDateString()}
                      </IndexTable.Cell>
                      <IndexTable.Cell>{b.reason || "—"}</IndexTable.Cell>
                      <IndexTable.Cell>
                        <Button
                          size="slim"
                          tone="critical"
                          variant="plain"
                          onClick={() => handleDeleteBlackout(b.id)}
                        >
                          Remove
                        </Button>
                      </IndexTable.Cell>
                    </IndexTable.Row>
                  ))}
                </IndexTable>
              ) : (
                <Text variant="bodySm" tone="subdued">
                  No blackout dates configured.
                </Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <InlineStack align="end">
            <Button variant="primary" onClick={handleSave} loading={saving}>
              Save settings
            </Button>
          </InlineStack>
        </Layout.Section>
      </Layout>

      {showBlackoutModal && (
        <Modal
          open={showBlackoutModal}
          onClose={() => setShowBlackoutModal(false)}
          title="Add blackout dates"
          primaryAction={{ content: "Add", onAction: handleAddBlackout }}
          secondaryActions={[
            { content: "Cancel", onAction: () => setShowBlackoutModal(false) },
          ]}
        >
          <Modal.Section>
            <FormLayout>
              <TextField
                label="Start date"
                type="date"
                value={blackoutStart}
                onChange={setBlackoutStart}
                autoComplete="off"
              />
              <TextField
                label="End date"
                type="date"
                value={blackoutEnd}
                onChange={setBlackoutEnd}
                autoComplete="off"
              />
              <TextField
                label="Reason (optional)"
                value={blackoutReason}
                onChange={setBlackoutReason}
                autoComplete="off"
              />
            </FormLayout>
          </Modal.Section>
        </Modal>
      )}
    </Page>
  );
}
