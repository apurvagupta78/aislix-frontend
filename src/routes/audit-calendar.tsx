import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { EmptyState, PageHeader, SectionCard } from "@/components/design-system";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton, ErrorState } from "@/components/States";
import { fetchAuditSchedules } from "@/lib/audit-schedules";
import { fetchOrgAssignments, isOrgManager } from "@/lib/assignments";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/audit-calendar")({
  head: () => ({ meta: [{ title: "Audit Calendar — Aislix" }] }),
  component: AuditCalendarPage,
});

type CalendarView = "month" | "week" | "day";
type EventTone = "scheduled" | "assigned" | "due_today" | "overdue" | "recurring" | "done";

const LEGEND: { tone: EventTone; label: string; className: string }[] = [
  { tone: "scheduled", label: "Scheduled", className: "bg-sky-50 text-sky-900" },
  { tone: "assigned", label: "Assigned", className: "bg-brand-soft text-brand" },
  { tone: "due_today", label: "Due today", className: "bg-status-evidence-soft text-status-evidence-strong" },
  { tone: "overdue", label: "Overdue", className: "bg-status-danger-soft text-status-danger-strong" },
  { tone: "recurring", label: "Recurring", className: "bg-status-good-soft text-status-good-strong" },
  { tone: "done", label: "Completed", className: "bg-slate-100 text-slate-600" },
];

function toneClasses(tone: EventTone) {
  return LEGEND.find((l) => l.tone === tone)?.className ?? "bg-muted text-muted-foreground";
}

function AuditCalendarPage() {
  const [view, setView] = useState<CalendarView>("month");
  const [cursor, setCursor] = useState(() => new Date());

  const accessQuery = useQuery({
    queryKey: ["assignment-manager"],
    queryFn: () => isOrgManager(),
  });

  const assignmentsQuery = useQuery({
    queryKey: ["org-assignments", "calendar"],
    queryFn: fetchOrgAssignments,
    enabled: accessQuery.data === true,
  });

  const schedulesQuery = useQuery({
    queryKey: ["audit-schedules", "calendar"],
    queryFn: fetchAuditSchedules,
    enabled: accessQuery.data === true,
  });

  const today = new Date().toISOString().slice(0, 10);

  const events = useMemo(() => {
    const items: Array<{
      id: string;
      date: string;
      title: string;
      tone: EventTone;
      href: string;
      kind: "assignment" | "schedule";
    }> = [];

    for (const a of assignmentsQuery.data ?? []) {
      const date = (a.due_at ?? a.created_at).slice(0, 10);
      let tone: EventTone = "assigned";
      if (a.status === "completed" || a.status === "cancelled") tone = "done";
      else if (a.due_at && a.due_at.slice(0, 10) < today) tone = "overdue";
      else if (a.due_at && a.due_at.slice(0, 10) === today) tone = "due_today";
      else if (a.status === "pending") tone = "scheduled";

      items.push({
        id: a.id,
        date,
        title: `${a.store_name} · ${a.assignee_name}`,
        tone,
        href: `/audit/${a.id}`,
        kind: "assignment",
      });
    }

    for (const s of schedulesQuery.data ?? []) {
      items.push({
        id: s.id,
        date: s.next_run_at.slice(0, 10),
        title: `Recurring · ${s.store_name ?? "Multi-store"}`,
        tone: s.active ? "recurring" : "done",
        href: "/audit-schedules",
        kind: "schedule",
      });
    }

    return items;
  }, [assignmentsQuery.data, schedulesQuery.data, today]);

  const monthLabel = cursor.toLocaleString("default", { month: "long", year: "numeric" });
  const monthDays = useMemo(() => buildMonthGrid(cursor), [cursor]);

  if (accessQuery.isLoading) return <Skeleton className="h-64 w-full" />;
  if (!accessQuery.data) {
    return (
      <AppShell title="" hidePageHeader>
        <ErrorState description="You need manager permissions to view the audit calendar." />
      </AppShell>
    );
  }

  return (
    <AppShell title="" hidePageHeader>
      <div className="play-canvas space-y-5">
        <PageHeader
          title="Audit Calendar"
          description="See what's scheduled, assigned, due today, or overdue."
          actions={
            <Button variant="outline" size="sm" className="rounded-xl" asChild>
              <Link to="/audit-schedules">Recurring Schedules</Link>
            </Button>
          }
        />

        <div className="flex flex-wrap gap-2">
          {LEGEND.map((item) => (
            <span
              key={item.tone}
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                item.className,
              )}
            >
              {item.label}
            </span>
          ))}
        </div>

        <SectionCard padded={false}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 p-4">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="rounded-xl"
                onClick={() => shiftCursor(setCursor, cursor, -1, view)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="rounded-xl"
                onClick={() => shiftCursor(setCursor, cursor, 1, view)}
              >
                <ChevronRight className="size-4" />
              </Button>
              <p className="font-semibold">{monthLabel}</p>
            </div>
            <div className="flex gap-2">
              {(["month", "week", "day"] as CalendarView[]).map((v) => (
                <Button
                  key={v}
                  variant={view === v ? "default" : "outline"}
                  size="sm"
                  className="rounded-xl capitalize"
                  onClick={() => setView(v)}
                >
                  {v}
                </Button>
              ))}
            </div>
          </div>

          {view === "month" ? (
            <div className="grid grid-cols-7 gap-2 p-4">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div
                  key={d}
                  className="px-2 py-1 text-center text-xs font-semibold text-muted-foreground"
                >
                  {d}
                </div>
              ))}
              {monthDays.map((day) => {
                const dayEvents = events.filter((e) => e.date === day.iso);
                return (
                  <div
                    key={day.iso}
                    className={cn(
                      "play-card min-h-[100px] rounded-xl p-2",
                      !day.inMonth && "opacity-40",
                      day.isToday && "ring-2 ring-brand/25",
                    )}
                  >
                    <p className="mb-1 text-xs font-medium">{day.label}</p>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((event) => (
                        <Link
                          key={event.id}
                          to={event.href}
                          className={cn(
                            "block truncate rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                            toneClasses(event.tone),
                          )}
                        >
                          {event.title}
                        </Link>
                      ))}
                      {dayEvents.length > 3 ? (
                        <p className="text-[10px] text-muted-foreground">
                          +{dayEvents.length - 3} more
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2 p-4">
              {events.filter((e) => isInView(e.date, cursor, view)).length === 0 ? (
                <EmptyState title="No events in this period" description="Try another week or day." />
              ) : (
                events
                  .filter((e) => isInView(e.date, cursor, view))
                  .map((event) => (
                    <Link
                      key={event.id}
                      to={event.href}
                      className="flex items-center justify-between rounded-xl border border-border/60 p-3 hover:bg-muted/30"
                    >
                      <div>
                        <p className="text-sm font-medium">{event.title}</p>
                        <p className="text-xs text-muted-foreground">{event.date}</p>
                      </div>
                      <Badge variant="secondary" className={cn("border-0", toneClasses(event.tone))}>
                        {LEGEND.find((l) => l.tone === event.tone)?.label ?? event.kind}
                      </Badge>
                    </Link>
                  ))
              )}
            </div>
          )}
        </SectionCard>
      </div>
    </AppShell>
  );
}

function buildMonthGrid(cursor: Date) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const today = new Date().toISOString().slice(0, 10);
  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    days.push({
      iso,
      label: d.getDate(),
      inMonth: d.getMonth() === month,
      isToday: iso === today,
    });
  }
  return days;
}

function shiftCursor(
  setCursor: (d: Date) => void,
  cursor: Date,
  delta: number,
  view: CalendarView,
) {
  const next = new Date(cursor);
  if (view === "month") next.setMonth(next.getMonth() + delta);
  else if (view === "week") next.setDate(next.getDate() + delta * 7);
  else next.setDate(next.getDate() + delta);
  setCursor(next);
}

function isInView(date: string, cursor: Date, view: CalendarView) {
  if (view === "day") return date === cursor.toISOString().slice(0, 10);
  const start = new Date(cursor);
  start.setDate(cursor.getDate() - cursor.getDay());
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const d = new Date(date);
  return d >= start && d <= end;
}
