import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Pause, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { requireOrgId } from "@/lib/db/context";
import { REPORT_KIND_INFO, type ReportDays, type ReportKind } from "@/lib/reports/report-document";
import {
  DEFAULT_SCHEDULE_TIMEZONE,
  WEEKDAY_LABELS,
  hourLabel,
  scheduleLabel,
  scheduleStatusLabel,
  type ScheduleFrequency,
} from "@/lib/reports/report-schedule";
import {
  createReportSchedule,
  deleteReportSchedule,
  listReportSchedules,
  setReportScheduleEnabled,
} from "@/lib/reports/report-schedule.functions";
import type { SegmentId } from "@/lib/segments/segment-config";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 24 }, (_, h) => h);

function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_SCHEDULE_TIMEZONE;
  } catch {
    return DEFAULT_SCHEDULE_TIMEZONE;
  }
}

function nextRunLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ScheduleReportDialog({
  open,
  onOpenChange,
  request,
  storeName,
  storeNames,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: { kind: ReportKind; days: ReportDays; segment: SegmentId; storeId: string | null; previewDemo: boolean };
  storeName: string | null;
  storeNames: Record<string, string>;
}) {
  const queryClient = useQueryClient();
  const [frequency, setFrequency] = useState<ScheduleFrequency>("weekly");
  const [weekday, setWeekday] = useState(1);
  const [sendHour, setSendHour] = useState(9);
  const [to, setTo] = useState("");

  const schedules = useQuery({
    queryKey: ["report-schedules"],
    queryFn: async () => listReportSchedules({ data: { activeOrgId: await requireOrgId() } }),
    enabled: open,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["report-schedules"] });

  const create = useMutation({
    mutationFn: async () =>
      createReportSchedule({
        data: {
          ...request,
          activeOrgId: await requireOrgId(),
          frequency,
          weekday: frequency === "weekly" ? weekday : null,
          sendHour,
          timeZone: browserTimeZone(),
          recipients: to
            .split(/[\s,;]+/)
            .map((s) => s.trim())
            .filter(Boolean),
        },
      }),
    onSuccess: (row) => {
      toast.success(`Scheduled. First email ${nextRunLabel(row.next_run_at)}.`);
      setTo("");
      void refresh();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not save the schedule."),
  });

  const toggle = useMutation({
    mutationFn: (v: { id: string; enabled: boolean }) => setReportScheduleEnabled({ data: v }),
    onSuccess: () => void refresh(),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not update the schedule."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteReportSchedule({ data: { id } }),
    onSuccess: () => {
      toast.success("Schedule deleted");
      void refresh();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not delete the schedule."),
  });

  const info = REPORT_KIND_INFO[request.kind];
  const scopeText = request.storeId ? storeName ?? "the selected store" : "all stores in your access";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule this report</DialogTitle>
          <DialogDescription>
            Emails the {info.label.toLowerCase()} for {scopeText}, last {request.days} days, with a link to the full
            report. Numbers are rebuilt from the latest audits each time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div role="radiogroup" aria-label="How often" className="flex gap-1.5">
            {(["daily", "weekly"] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={frequency === f}
                onClick={() => setFrequency(f)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors duration-150",
                  frequency === f
                    ? "border-[#102A43] bg-[#102A43] text-white"
                    : "border-[#D9E2E8] bg-white text-[#667085] hover:bg-[#F4F7F9]",
                )}
              >
                {f === "daily" ? "Every day" : "Every week"}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {frequency === "weekly" ? (
              <Select value={String(weekday)} onValueChange={(v) => setWeekday(Number(v))}>
                <SelectTrigger className="h-9 w-[150px] rounded-xl" aria-label="Day of the week">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAY_LABELS.map((label, i) => (
                    <SelectItem key={label} value={String(i)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Select value={String(sendHour)} onValueChange={(v) => setSendHour(Number(v))}>
              <SelectTrigger className="h-9 w-[130px] rounded-xl" aria-label="Send time">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((h) => (
                  <SelectItem key={h} value={String(h)}>
                    {hourLabel(h)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            type="text"
            inputMode="email"
            placeholder="name@company.com, other@company.com"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            aria-label="Email addresses"
          />
          <p className="text-xs text-[#667085]">Up to 5 addresses. Times use your device time zone ({browserTimeZone()}).</p>
        </div>

        <DialogFooter>
          <Button variant="subtle" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button variant="brand" disabled={!to.trim() || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? "Saving…" : "Save schedule"}
          </Button>
        </DialogFooter>

        <div className="border-t border-[#D9E2E8] pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#667085]">Your scheduled reports</p>
          {schedules.isPending ? (
            <p className="mt-2 text-sm text-[#667085]">Loading…</p>
          ) : schedules.isError ? (
            <p className="mt-2 text-sm text-[#667085]">Could not load your schedules.</p>
          ) : !schedules.data?.length ? (
            <p className="mt-2 text-sm text-[#667085]">None yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {schedules.data.map((s) => {
                const status = scheduleStatusLabel(s.last_status);
                const where = s.store_id ? storeNames[s.store_id] ?? "One store" : "All stores";
                return (
                  <li key={s.id} className="flex items-start justify-between gap-3 rounded-xl border border-[#D9E2E8] p-3">
                    <div className="min-w-0 text-sm">
                      <p className="flex items-center gap-1.5 font-medium text-[#102A43]">
                        <CalendarClock className="size-3.5 shrink-0 text-[#667085]" aria-hidden />
                        {REPORT_KIND_INFO[s.kind]?.label ?? "Report"} · {where}
                        {s.preview_demo ? (
                          <span className="rounded-full bg-[#EEF1F4] px-1.5 text-[10px] font-semibold uppercase text-[#667085]">
                            Demo
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 text-xs text-[#667085]">
                        {scheduleLabel({ frequency: s.frequency, weekday: s.weekday, sendHour: s.send_hour })} · last{" "}
                        {s.days} days · {s.recipients.join(", ")}
                      </p>
                      <p className="mt-0.5 text-xs text-[#667085]">
                        {s.enabled ? `Next: ${nextRunLabel(s.next_run_at)}` : "Paused"}
                        {status ? ` · ${status}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="subtle"
                        size="sm"
                        className="h-8 rounded-lg px-2"
                        aria-label={s.enabled ? "Pause schedule" : "Resume schedule"}
                        disabled={toggle.isPending}
                        onClick={() => toggle.mutate({ id: s.id, enabled: !s.enabled })}
                      >
                        {s.enabled ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                      </Button>
                      <Button
                        variant="subtle"
                        size="sm"
                        className="h-8 rounded-lg px-2"
                        aria-label="Delete schedule"
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(s.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
