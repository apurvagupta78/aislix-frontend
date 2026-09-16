import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton, ErrorState, EmptyState } from "@/components/States";
import { toUserMessage } from "@/lib/api/errors";
import {
  createAuditSchedule,
  deleteAuditSchedule,
  fetchAuditSchedules,
  processDueAuditSchedules,
  toggleAuditSchedule,
  type ScheduleCadence,
} from "@/lib/audit-schedules";
import { fetchAssignableMembers, isOrgManager } from "@/lib/assignments";
import { fetchPlanogramStores } from "@/lib/planogram";

export const Route = createFileRoute("/audit-schedules")({
  head: () => ({ meta: [{ title: "Recurring Audits — Aislix" }] }),
  component: AuditSchedulesPage,
});

function AuditSchedulesPage() {
  const queryClient = useQueryClient();
  const [storeId, setStoreId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [cadence, setCadence] = useState<ScheduleCadence>("weekly");

  const accessQuery = useQuery({
    queryKey: ["assignment-manager"],
    queryFn: () => isOrgManager(),
  });

  const schedulesQuery = useQuery({
    queryKey: ["audit-schedules"],
    queryFn: fetchAuditSchedules,
    enabled: accessQuery.data === true,
  });

  const storesQuery = useQuery({
    queryKey: ["planogram-stores"],
    queryFn: fetchPlanogramStores,
    enabled: accessQuery.data === true,
  });

  const membersQuery = useQuery({
    queryKey: ["assignable-members"],
    queryFn: fetchAssignableMembers,
    enabled: accessQuery.data === true,
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const assignee = (membersQuery.data ?? []).find((m) => m.user_id === assigneeId);
      return createAuditSchedule({
        store_id: storeId,
        assignee_id: assigneeId,
        assignee_name: assignee?.name ?? "team member",
        cadence,
        audit_mode: "digital",
        scope_type: "planogram",
        scope_values: {},
      });
    },
    onSuccess: () => {
      toast.success("Recurring audit schedule created.");
      void queryClient.invalidateQueries({ queryKey: ["audit-schedules"] });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => toggleAuditSchedule(id, active),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["audit-schedules"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAuditSchedule,
    onSuccess: () => {
      toast.success("Schedule deleted.");
      void queryClient.invalidateQueries({ queryKey: ["audit-schedules"] });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const runNowMutation = useMutation({
    mutationFn: processDueAuditSchedules,
    onSuccess: (count) => {
      toast.success(count ? `Created ${count} assignment(s) from due schedules.` : "No schedules due.");
      void queryClient.invalidateQueries({ queryKey: ["audit-schedules"] });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  if (accessQuery.isLoading) {
    return (
      <AppShell title="Recurring Audits">
        <Skeleton className="h-40 w-full" />
      </AppShell>
    );
  }

  if (!accessQuery.data) {
    return (
      <AppShell title="Recurring Audits">
        <ErrorState title="Manager access required" description="Only managers can manage recurring audits." />
      </AppShell>
    );
  }

  const schedules = schedulesQuery.data ?? [];

  return (
    <AppShell
      title="Recurring Audits"
      description="Recurring audits generate assignments server-side (pg_cron or schedule-runner Edge Function). Use Run now for a manual idempotent trigger."
    >
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-xl border border-border bg-card p-5">
          <h3 className="flex items-center gap-2 font-semibold">
            <Plus className="size-4" /> New schedule
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Store</Label>
              <Select value={storeId} onValueChange={setStoreId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select store" />
                </SelectTrigger>
                <SelectContent>
                  {(storesQuery.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Assignee</Label>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  {(membersQuery.data ?? []).map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cadence</Label>
              <Select value={cadence} onValueChange={(v) => setCadence(v as ScheduleCadence)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="special">Special (7 days)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            className="mt-4"
            disabled={!storeId || !assigneeId || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : "Create schedule"}
          </Button>
        </section>

        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            disabled={runNowMutation.isPending}
            onClick={() => runNowMutation.mutate()}
          >
            {runNowMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CalendarClock className="size-4" />
            )}
            Run due schedules now
          </Button>
        </div>

        {schedulesQuery.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : schedules.length === 0 ? (
          <EmptyState title="No schedules yet" description="Create a recurring audit to automate assignments." />
        ) : (
          <ul className="space-y-3">
            {schedules.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
              >
                <div>
                  <p className="font-medium">
                    {s.name ?? s.store_name ?? "Scheduled audit"} · {s.cadence}
                    {s.assignment_mode ? ` · ${s.assignment_mode.replace("_", " ")}` : ""}
                    {" · "}
                    {s.audit_mode === "digital" ? "Digital" : "AI"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {s.assignee_name ?? "Unassigned"} · Next:{" "}
                    {new Date(s.next_run_at).toLocaleString()}
                    {s.status ? ` · ${s.status}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={s.active}
                      onCheckedChange={(v) => toggleMutation.mutate({ id: s.id, active: Boolean(v) })}
                    />
                    <span className="text-xs text-muted-foreground">Active</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive"
                    onClick={() => deleteMutation.mutate(s.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
