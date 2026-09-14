import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ErrorState, Skeleton } from "@/components/States";
import { toUserMessage } from "@/lib/api/errors";
import { isOrgManager } from "@/lib/assignments";
import { FINDING_SEVERITIES } from "@/lib/findings";
import {
  ESCALATION_ROLES,
  fetchEscalationRules,
  fetchSlaDefaults,
  saveEscalationRule,
  saveSlaDefaults,
  type EscalationRule,
} from "@/lib/escalation-settings";

export const Route = createFileRoute("/escalation-settings")({
  head: () => ({ meta: [{ title: "SLA & Escalation — Aislix" }] }),
  component: EscalationSettingsPage,
});

function EscalationSettingsPage() {
  const queryClient = useQueryClient();
  const managerQuery = useQuery({ queryKey: ["is-org-manager"], queryFn: () => isOrgManager() });
  const slaQuery = useQuery({ queryKey: ["sla-defaults"], queryFn: fetchSlaDefaults, enabled: managerQuery.data === true });
  const rulesQuery = useQuery({ queryKey: ["escalation-rules"], queryFn: fetchEscalationRules, enabled: managerQuery.data === true });
  const [sla, setSla] = useState({ critical_hours: 4, high_hours: 12, medium_hours: 24, low_hours: 72 });
  const [rules, setRules] = useState<EscalationRule[]>([]);

  useEffect(() => {
    if (slaQuery.data) setSla(slaQuery.data);
  }, [slaQuery.data]);
  useEffect(() => {
    if (rulesQuery.data) setRules(rulesQuery.data);
  }, [rulesQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await saveSlaDefaults(sla);
      for (const rule of rules) await saveEscalationRule(rule);
    },
    onSuccess: () => {
      toast.success("SLA and escalation settings saved.");
      void queryClient.invalidateQueries({ queryKey: ["sla-defaults"] });
    },
    onError: (err) => toast.error(toUserMessage(err)),
  });

  return (
    <AppShell title="SLA & Escalation" description="Default response times by severity and who is notified when an SLA is missed.">
      {managerQuery.data === false ? (
        <ErrorState title="Managers only" description="Only workspace managers can configure SLA and escalation." />
      ) : slaQuery.isPending ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="space-y-8">
          <section className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold">SLA hours by severity</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              {(["critical", "high", "medium", "low"] as const).map((key) => (
                <div key={key}>
                  <Label className="capitalize">{key}</Label>
                  <Input
                    className="mt-1"
                    type="number"
                    min={1}
                    value={sla[`${key}_hours`]}
                    onChange={(e) => setSla((s) => ({ ...s, [`${key}_hours`]: Number(e.target.value) }))}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-sm font-semibold">Escalation timeline</h2>
            {rules.map((rule, index) => (
              <div key={rule.severity} className="rounded-2xl border border-border bg-card p-5">
                <p className="font-medium">{FINDING_SEVERITIES.find((s) => s.value === rule.severity)?.label} findings</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <RoleField
                    label="First owner"
                    value={rule.first_role}
                    onChange={(first_role) => setRules((rows) => rows.map((r, i) => (i === index ? { ...r, first_role } : r)))}
                  />
                  <div>
                    <Label>Escalate after (hours)</Label>
                    <Input
                      className="mt-1"
                      type="number"
                      value={rule.escalate_after_hours}
                      onChange={(e) =>
                        setRules((rows) =>
                          rows.map((r, i) => (i === index ? { ...r, escalate_after_hours: Number(e.target.value) } : r)),
                        )
                      }
                    />
                  </div>
                  <RoleField
                    label="Second escalation"
                    value={rule.second_role}
                    onChange={(second_role) => setRules((rows) => rows.map((r, i) => (i === index ? { ...r, second_role } : r)))}
                  />
                  <div>
                    <Label>Final after (hours)</Label>
                    <Input
                      className="mt-1"
                      type="number"
                      value={rule.second_after_hours}
                      onChange={(e) =>
                        setRules((rows) =>
                          rows.map((r, i) => (i === index ? { ...r, second_after_hours: Number(e.target.value) } : r)),
                        )
                      }
                    />
                  </div>
                  <RoleField
                    label="Final recipient"
                    value={rule.final_role}
                    onChange={(final_role) => setRules((rows) => rows.map((r, i) => (i === index ? { ...r, final_role } : r)))}
                  />
                  <div className="flex items-end gap-2 pb-2">
                    <Switch
                      checked={rule.notify_in_app}
                      onCheckedChange={(notify_in_app) =>
                        setRules((rows) => rows.map((r, i) => (i === index ? { ...r, notify_in_app } : r)))
                      }
                    />
                    <Label>In-app notification</Label>
                  </div>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  {rule.first_role} → after {rule.escalate_after_hours}h {rule.second_role} → after {rule.second_after_hours}h {rule.final_role}
                </p>
              </div>
            ))}
          </section>

          <Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            Save settings
          </Button>
        </div>
      )}
    </AppShell>
  );
}

function RoleField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
        <SelectContent>
          {ESCALATION_ROLES.map((role) => (
            <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
