import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton, ErrorState } from "@/components/States";
import { fetchAuditSchedules } from "@/lib/audit-schedules";
import { fetchOrgAssignments, isOrgManager } from "@/lib/assignments";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/audit-calendar")({
  head: () => ({ meta: [{ title: "Audit Calendar — Aislix" }] }),
  component: AuditCalendarPage,
});

type CalendarView = "month" | "week" | "day";

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

  const events = useMemo(() => {
    const items: Array<{
      id: string;
      date: string;
      title: string;
      tone: "brand" | "warn" | "bad" | "neutral";
      href: string;
      kind: "assignment" | "schedule";
    }> = [];

    for (const a of assignmentsQuery.data ?? []) {
      const date = a.due_at ?? a.created_at;
      items.push({
        id: a.id,
        date: date.slice(0, 10),
        title: `${a.store_name} · ${a.assignee_name}`,
        tone:
          a.status === "completed"
            ? "neutral"
            : a.due_at && new Date(a.due_at) < new Date()
              ? "bad"
              : "brand",
        href: `/audit/${a.id}`,
        kind: "assignment",
      });
    }

    for (const s of schedulesQuery.data ?? []) {
      items.push({
        id: s.id,
        date: s.next_run_at.slice(0, 10),
        title: `Schedule · ${s.store_name ?? "Multi-store"}`,
        tone: s.active ? "warn" : "neutral",
        href: "/audit-schedules",
        kind: "schedule",
      });
    }

    return items;
  }, [assignmentsQuery.data, schedulesQuery.data]);

  const monthLabel = cursor.toLocaleString("default", { month: "long", year: "numeric" });
  const monthDays = useMemo(() => buildMonthGrid(cursor), [cursor]);

  if (accessQuery.isLoading) return <Skeleton className="h-64 w-full" />;
  if (!accessQuery.data) {
    return (
      <AppShell title="Audit Calendar" description="Manager access required.">
        <ErrorState description="You need manager permissions to view the audit calendar." />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Audit Calendar"
      description="Scheduled audits, recurring schedules, due dates, and team assignments."
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shiftCursor(setCursor, cursor, -1, view)}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => shiftCursor(setCursor, cursor, 1, view)}>
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
              onClick={() => setView(v)}
              className="capitalize"
            >
              {v}
            </Button>
          ))}
          <Button variant="outline" size="sm" asChild>
            <Link to="/audit-schedules">Recurring Schedules</Link>
          </Button>
        </div>
      </div>

      {view === "month" ? (
        <div className="grid grid-cols-7 gap-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="px-2 py-1 text-center text-xs font-semibold text-muted-foreground">
              {d}
            </div>
          ))}
          {monthDays.map((day) => {
            const dayEvents = events.filter((e) => e.date === day.iso);
            return (
              <Card
                key={day.iso}
                className={cn(
                  "min-h-[100px] border-dashed",
                  !day.inMonth && "opacity-40",
                  day.isToday && "border-brand/40 bg-brand-soft/10",
                )}
              >
                <CardHeader className="p-2 pb-1">
                  <CardTitle className="text-xs font-medium">{day.label}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 p-2 pt-0">
                  {dayEvents.slice(0, 3).map((event) => (
                    <Link
                      key={event.id}
                      to={event.href}
                      className={cn(
                        "block truncate rounded px-1.5 py-0.5 text-[10px] font-medium",
                        event.tone === "bad" && "bg-destructive/10 text-destructive",
                        event.tone === "warn" && "bg-warning/10 text-warning",
                        event.tone === "brand" && "bg-brand-soft/40 text-brand",
                        event.tone === "neutral" && "bg-muted text-muted-foreground",
                      )}
                    >
                      {event.title}
                    </Link>
                  ))}
                  {dayEvents.length > 3 ? (
                    <p className="text-[10px] text-muted-foreground">+{dayEvents.length - 3} more</p>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="size-4" />
              {view === "week" ? "This week" : "Today"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {events
              .filter((e) => isInView(e.date, cursor, view))
              .map((event) => (
                <Link
                  key={event.id}
                  to={event.href}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/30"
                >
                  <div>
                    <p className="text-sm font-medium">{event.title}</p>
                    <p className="text-xs text-muted-foreground">{event.date}</p>
                  </div>
                  <Badge variant="outline">{event.kind}</Badge>
                </Link>
              ))}
            {!events.filter((e) => isInView(e.date, cursor, view)).length ? (
              <p className="text-sm text-muted-foreground">No events in this period.</p>
            ) : null}
          </CardContent>
        </Card>
      )}
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
