import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { ErrorState } from "@/components/States";
import { SaveBar, SettingsCard, ToggleRow } from "@/components/settings/SettingsParts";
import {
  fetchNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from "@/lib/account";

const empty: NotificationPreferences = {
  email_notifications: false,
  low_stock_alerts: false,
  weekly_reports: false,
  monthly_reports: false,
  billing_notifications: false,
  product_updates: false,
};

const rows: { key: keyof NotificationPreferences; title: string; description: string }[] = [
  {
    key: "email_notifications",
    title: "Email notifications",
    description: "Master switch for all Aislix emails sent to your address.",
  },
  {
    key: "low_stock_alerts",
    title: "Low stock alerts",
    description: "Notify me as soon as a scan detects out-of-stock or depleted facings.",
  },
  {
    key: "weekly_reports",
    title: "Weekly reports",
    description: "A Monday digest of shelf health, share of shelf and scan volume.",
  },
  {
    key: "monthly_reports",
    title: "Monthly reports",
    description: "Month-end performance summary across all stores.",
  },
  {
    key: "billing_notifications",
    title: "Billing notifications",
    description: "Invoices, renewals, failed payments and quota warnings.",
  },
  {
    key: "product_updates",
    title: "Product updates",
    description: "New detection models, features and platform announcements.",
  },
];

export function NotificationsPanel() {
  const prefsQuery = useQuery({
    queryKey: ["account", "notifications"],
    queryFn: ({ signal }) => fetchNotificationPreferences(signal),
    retry: false,
  });

  const [form, setForm] = useState<NotificationPreferences>(empty);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (prefsQuery.data) setForm({ ...empty, ...prefsQuery.data });
  }, [prefsQuery.data]);

  const dirty = useMemo(() => {
    const source = prefsQuery.data ? { ...empty, ...prefsQuery.data } : empty;
    return JSON.stringify(source) !== JSON.stringify(form);
  }, [form, prefsQuery.data]);

  const save = useMutation({
    mutationFn: () => updateNotificationPreferences(form),
    onSuccess: (data) => {
      setForm({ ...empty, ...data });
      setSaved(true);
      toast.success("Notification preferences saved");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <SettingsCard
      title="Notification preferences"
      description="Choose what Aislix emails you about."
      icon={Bell}
    >
      {prefsQuery.isLoading ? (
        <div className="space-y-3" aria-busy="true">
          {rows.map((row) => (
            <div key={row.key} className="h-[68px] animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : prefsQuery.isError ? (
        <ErrorState
          title="Couldn't load preferences"
          description={(prefsQuery.error as Error).message}
          onRetry={() => void prefsQuery.refetch()}
        />
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-3">
            {rows.map((row) => (
              <ToggleRow key={row.key} title={row.title} description={row.description}>
                <Switch
                  checked={form[row.key]}
                  aria-label={row.title}
                  onCheckedChange={(checked) => {
                    setSaved(false);
                    setForm((prev) => ({ ...prev, [row.key]: checked }));
                  }}
                />
              </ToggleRow>
            ))}
          </div>
          <SaveBar
            dirty={dirty}
            saving={save.isPending}
            saved={saved}
            onReset={() => setForm(prefsQuery.data ? { ...empty, ...prefsQuery.data } : empty)}
            error={save.isError ? (save.error as Error).message : null}
            label="Save preferences"
          />
        </form>
      )}
    </SettingsCard>
  );
}
