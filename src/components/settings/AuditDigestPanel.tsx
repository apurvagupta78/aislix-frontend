import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorState } from "@/components/States";
import { SaveBar, SettingsCard } from "@/components/settings/SettingsParts";
import { toUserMessage } from "@/lib/api/errors";
import {
  fetchAuditDigestSettings,
  markDigestSent,
  previewAuditDigest,
  updateAuditDigestSettings,
  type AuditDigestSettings,
  type DigestCadence,
} from "@/lib/audit-digest";
import { isOrgManager } from "@/lib/assignments";

export function AuditDigestPanel() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AuditDigestSettings | null>(null);

  const managerQuery = useQuery({
    queryKey: ["is-org-manager"],
    queryFn: () => isOrgManager(),
  });

  const settingsQuery = useQuery({
    queryKey: ["audit-digest-settings"],
    queryFn: fetchAuditDigestSettings,
    enabled: managerQuery.data === true,
  });

  const previewQuery = useQuery({
    queryKey: ["audit-digest-preview"],
    queryFn: previewAuditDigest,
    enabled: managerQuery.data === true,
  });

  useEffect(() => {
    if (settingsQuery.data) setForm(settingsQuery.data);
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => updateAuditDigestSettings(form!),
    onSuccess: (data) => {
      setForm(data);
      toast.success("Digest settings saved.");
      void queryClient.invalidateQueries({ queryKey: ["audit-digest-settings"] });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const preview = await previewAuditDigest();
      await markDigestSent(`preview queued · ${preview.lines.length} lines`);
      return preview;
    },
    onSuccess: () => {
      toast.success("Digest preview queued. Email/WhatsApp delivery runs on the scheduled job.");
      void queryClient.invalidateQueries({ queryKey: ["audit-digest-settings"] });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  if (managerQuery.isLoading) return null;
  if (!managerQuery.data) {
    return (
      <SettingsCard title="Audit digests" description="Manager-only scheduled summaries.">
        <p className="text-sm text-muted-foreground">Only workspace managers can configure audit digests.</p>
      </SettingsCard>
    );
  }

  if (settingsQuery.isError) {
    return <ErrorState description={toUserMessage(settingsQuery.error)} />;
  }

  if (!form) return null;

  return (
    <SettingsCard
      title="Audit digests"
      description="Scheduled email and WhatsApp summaries of exceptions, variance and pending approvals."
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Mail className="size-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Email digest</p>
              <p className="text-xs text-muted-foreground">Sent to workspace billing email and managers.</p>
            </div>
          </div>
          <Switch
            checked={form.email_enabled}
            onCheckedChange={(v) => setForm({ ...form, email_enabled: v })}
          />
        </div>

        <div className="space-y-3 rounded-xl border border-border px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="size-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">WhatsApp digest</p>
                <p className="text-xs text-muted-foreground">Requires an approved WhatsApp Business integration.</p>
              </div>
            </div>
            <Switch
              checked={form.whatsapp_enabled}
              onCheckedChange={(v) => setForm({ ...form, whatsapp_enabled: v })}
            />
          </div>
          {form.whatsapp_enabled ? (
            <div>
              <Label className="text-xs">WhatsApp number (E.164)</Label>
              <Input
                placeholder="+919876543210"
                value={form.whatsapp_number ?? ""}
                onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })}
              />
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Cadence</Label>
            <Select
              value={form.cadence}
              onValueChange={(v) => setForm({ ...form, cadence: v as DigestCadence })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly (Monday)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Send time (local)</Label>
            <Input
              type="time"
              value={form.send_time_local}
              onChange={(e) => setForm({ ...form, send_time_local: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <label className="flex items-center justify-between">
            <span>Include open exceptions</span>
            <Switch
              checked={form.include_exceptions}
              onCheckedChange={(v) => setForm({ ...form, include_exceptions: v })}
            />
          </label>
          <label className="flex items-center justify-between">
            <span>Include variance summary</span>
            <Switch
              checked={form.include_variance_summary}
              onCheckedChange={(v) => setForm({ ...form, include_variance_summary: v })}
            />
          </label>
          <label className="flex items-center justify-between">
            <span>Include pending approvals</span>
            <Switch
              checked={form.include_pending_approvals}
              onCheckedChange={(v) => setForm({ ...form, include_pending_approvals: v })}
            />
          </label>
        </div>

        {previewQuery.data ? (
          <div className="rounded-xl bg-muted/40 p-4 text-xs">
            <p className="font-medium">{previewQuery.data.subject}</p>
            <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
              {previewQuery.data.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {form.last_sent_at ? (
          <p className="text-xs text-muted-foreground">
            Last send: {new Date(form.last_sent_at).toLocaleString()} · {form.last_status ?? "—"}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={sendMutation.isPending}
            onClick={() => sendMutation.mutate()}
          >
            {sendMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : "Send preview now"}
          </Button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate();
          }}
        >
          <SaveBar
            dirty={JSON.stringify(form) !== JSON.stringify(settingsQuery.data)}
            saving={saveMutation.isPending}
            saved={saveMutation.isSuccess}
          />
        </form>
      </div>
    </SettingsCard>
  );
}
