import { Badge } from "@shopify/polaris";

const STATUS_MAP = {
  reserved: { tone: "attention", label: "Reserved" },
  confirmed: { tone: "info", label: "Confirmed" },
  picked_up: { tone: "success", label: "Picked Up" },
  returned: { tone: "info", label: "Returned" },
  completed: { tone: "success", label: "Completed" },
  cancelled: { tone: undefined, label: "Cancelled" },
  overdue: { tone: "critical", label: "Overdue" },
};

export default function StatusBadge({ status }) {
  const config = STATUS_MAP[status] || { tone: undefined, label: status };
  return <Badge tone={config.tone}>{config.label}</Badge>;
}
