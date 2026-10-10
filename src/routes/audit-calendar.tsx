import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Plus, Repeat } from "lucide-react";

import { AppShell } from "@/components/AppShell";
import { EmptyState, PageHeader } from "@/components/design-system";
import { ErrorState } from "@/components/States";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AssignmentDetailsDrawer,
  AssignmentFilterBar,
  AssignmentRowsTable,
  EMPTY_ASSIGNMENT_FILTERS,
  OPEN_STATUSES,
  STATUS_DOT,
  STATUS_LABEL,
  STATUS_ORDER,
  assignmentFilterOptions,
  auditTitle,
  matchesAssignmentFilters,
  overviewStatus,
  toAssignmentItems,
  type AssignmentFilters,
  type AssignmentItem,
} from "@/components/assignments/assignment-overview";
import { toUserMessage } from "@/lib/api/errors";
import { fetchAssignmentsOverview, scopeSummary, type Assignment } from "@/lib/assignments";
import { fetchAuditSchedules, type AuditSchedule } from "@/lib/audit-schedules";
import { cn } from "@/lib/utils";

type CalendarView = "month" | "week" | "day";

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export const Route = createFileRoute("/audit-calendar")({
  validateSearch: (search: Record<string, unknown>): { view?: CalendarView; date?: string } => {
    const view = search["view"];
    const date = search["date"];
    return {
      ...(view === "month" || view === "week" || view === "day" ? { view } : {}),
      ...(typeof date === "string" && DATE_KEY.test(date) ? { date } : {}),
    };
  },
  head: () => ({ meta: [{ title: "Audit calendar — Aislix" }] }),
  component: AuditCalendarPage,
});

/* ---------------------------------- dates --------------------------------- */

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const HOUR_ROW_PX = 48;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** YYYY-MM-DD in the viewer's timezone (toISOString would shift by the UTC offset). */
function localDateKey(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(key: string, days: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + days);
  return localDateKey(d);
}

function startOfWeek(key: string): string {
  return addDays(key, -parseDateKey(key).getDay());
}

function shiftDate(key: string, view: CalendarView, delta: number): string {
  if (view === "day") return addDays(key, delta);
  if (view === "week") return addDays(key, delta * 7);
  const d = parseDateKey(key);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + delta);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return localDateKey(d);
}

function monthGrid(key: string): string[] {
  const d = parseDateKey(key);
  const first = localDateKey(new Date(d.getFullYear(), d.getMonth(), 1));
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

function viewLabel(key: string, view: CalendarView): string {
  const d = parseDateKey(key);
  if (view === "month") return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  if (view === "day") {
    return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  }
  const start = parseDateKey(startOfWeek(key));
  const end = parseDateKey(addDays(startOfWeek(key), 6));
  const sameMonth = start.getMonth() === end.getMonth();
  const startLabel = start.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  const endLabel = end.toLocaleDateString(undefined, sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" });
  return `${startLabel} – ${endLabel}, ${end.getFullYear()}`;
}

function hourLabel(hour: number): string {
  return new Date(2000, 0, 1, hour).toLocaleTimeString(undefined, { hour: "numeric" });
}

function timeLabel(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Next quarter hour from now as HH:MM, or null when that rolls past midnight. */
function nextQuarterHour(): string | null {
  const now = new Date();
  const next = new Date(now);
  next.setMinutes(Math.ceil((now.getMinutes() + 1) / 15) * 15, 0, 0);
  if (localDateKey(next) !== localDateKey(now)) return null;
  return `${pad(next.getHours())}:${pad(next.getMinutes())}`;
}

/** Due time to suggest for a new audit on a day: 5 PM, or soon if that has passed today. */
function defaultDueTime(dateKey: string): string | null {
  const today = localDateKey(new Date());
  if (dateKey < today) return null;
  if (dateKey > today) return "17:00";
  return new Date().getHours() < 17 ? "17:00" : nextQuarterHour();
}

/** Due time for a clicked hour slot, or null when the slot is already over. */
function slotDueTime(dateKey: string, hour: number): string | null {
  const start = parseDateKey(dateKey);
  start.setHours(hour);
  const now = Date.now();
  if (start.getTime() + 60 * 60 * 1000 <= now) return null;
  if (start.getTime() < now) return nextQuarterHour();
  return `${pad(hour)}:00`;
}

/* --------------------------------- events --------------------------------- */

type CalEvent = {
  key: string;
  start: Date;
  dateKey: string;
  allDay: boolean;
  title: string;
  subtitle: string;
  dot: string;
  statusLabel: string;
  item?: AssignmentItem;
  schedule?: AuditSchedule;
};

const RECURRING_DOT = "bg-[#8EC9E8]";

function assignmentEvent(item: AssignmentItem): CalEvent {
  const { row, status } = item;
  const when = row.due_at ?? row.scheduled_at ?? row.created_at;
  const start = new Date(when);
  return {
    key: `a:${row.id}`,
    start,
    dateKey: localDateKey(start),
    allDay: !row.due_at && !row.scheduled_at,
    title: auditTitle(row),
    subtitle: [row.store_name, row.assignee_name].filter(Boolean).join(" · "),
    dot: STATUS_DOT[status],
    statusLabel: STATUS_LABEL[status],
    item,
  };
}

function scheduleEvent(schedule: AuditSchedule): CalEvent {
  const start = new Date(schedule.next_run_at);
  return {
    key: `s:${schedule.id}`,
    start,
    dateKey: localDateKey(start),
    allDay: false,
    title: schedule.name?.trim() || scopeSummary(schedule.scope_type, schedule.scope_values),
    subtitle: [schedule.store_name, schedule.assignee_name].filter(Boolean).join(" · "),
    dot: RECURRING_DOT,
    statusLabel: "Recurring",
    schedule,
  };
}

function scheduleMatches(schedule: AuditSchedule, filters: AssignmentFilters): boolean {
  if (filters.status !== "all" || filters.assigner !== "all") return false;
  if (filters.store !== "all" && schedule.store_id !== filters.store) return false;
  if (filters.assignee !== "all" && schedule.assignee_id !== filters.assignee) return false;
  if (filters.mode !== "all" && (schedule.audit_mode === "digital" ? "digital" : "ai") !== filters.mode) return false;
  const q = filters.q.trim().toLowerCase();
  if (q) {
    const haystack = [schedule.name, schedule.store_name, schedule.assignee_name, "recurring"]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    if (!haystack.includes(q)) return false;
  }
  return true;
}

function sortEvents(a: CalEvent, b: CalEvent): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  return a.start.getTime() - b.start.getTime() || a.title.localeCompare(b.title);
}

/* ------------------------------- components ------------------------------- */

function EventChip({ event, onOpen }: { event: CalEvent; onOpen: (event: CalEvent) => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(event);
      }}
      title={`${event.title} · ${event.statusLabel}${event.subtitle ? ` · ${event.subtitle}` : ""}`}
      className="flex w-full min-w-0 items-center gap-1.5 rounded-md border border-[#D9E2E8] bg-white px-1.5 py-0.5 text-left text-[11px] leading-4 text-[#04203F] transition-colors hover:border-[#04203F]/40"
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", event.dot)} aria-hidden />
      {event.allDay ? null : <span className="shrink-0 tabular-nums text-[#667085]">{timeLabel(event.start)}</span>}
      <span className="truncate font-medium">{event.title}</span>
    </button>
  );
}

function slotKeyDown(action: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      action();
    }
  };
}

function MonthView({
  dateKey,
  eventsByDay,
  onOpenDay,
  onOpenEvent,
  onCreate,
}: {
  dateKey: string;
  eventsByDay: Map<string, CalEvent[]>;
  onOpenDay: (key: string) => void;
  onOpenEvent: (event: CalEvent) => void;
  onCreate: (key: string, time: string) => void;
}) {
  const days = monthGrid(dateKey);
  const month = parseDateKey(dateKey).getMonth();
  const today = localDateKey(new Date());

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-[#D9E2E8]">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-2 text-center text-xs font-medium text-[#667085]">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((key, index) => {
          const events = eventsByDay.get(key) ?? [];
          const inMonth = parseDateKey(key).getMonth() === month;
          const isToday = key === today;
          const createTime = defaultDueTime(key);
          const label = parseDateKey(key).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
          return (
            <div
              key={key}
              role="button"
              tabIndex={0}
              aria-label={`${label}: ${events.length} audit${events.length === 1 ? "" : "s"}. Open day`}
              onClick={() => onOpenDay(key)}
              onKeyDown={slotKeyDown(() => onOpenDay(key))}
              className={cn(
                "group relative flex min-h-[64px] cursor-pointer flex-col gap-1 border-[#D9E2E8] p-1.5 transition-colors hover:bg-[#F4F7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#04203F] sm:min-h-[112px]",
                index % 7 !== 6 && "border-r",
                index < 35 && "border-b",
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "inline-flex size-6 items-center justify-center rounded-full text-xs font-medium tabular-nums",
                    isToday ? "bg-[#04203F] text-white" : inMonth ? "text-[#04203F]" : "text-[#667085]/60",
                  )}
                >
                  {parseDateKey(key).getDate()}
                </span>
                {createTime ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onCreate(key, createTime);
                    }}
                    aria-label={`New audit due ${label}`}
                    className="hidden size-6 items-center justify-center rounded-md text-[#667085] opacity-0 transition-opacity hover:bg-white hover:text-[#04203F] focus-visible:opacity-100 group-hover:opacity-100 sm:inline-flex"
                  >
                    <Plus className="size-3.5" />
                  </button>
                ) : null}
              </div>

              <div className="hidden min-w-0 space-y-1 sm:block">
                {events.slice(0, 3).map((event) => (
                  <EventChip key={event.key} event={event} onOpen={onOpenEvent} />
                ))}
                {events.length > 3 ? (
                  <p className="px-1 text-[11px] font-medium text-[#667085]">+{events.length - 3} more</p>
                ) : null}
              </div>

              {events.length ? (
                <div className="flex flex-wrap items-center gap-0.5 sm:hidden" aria-hidden>
                  {events.slice(0, 4).map((event) => (
                    <span key={event.key} className={cn("size-1.5 rounded-full", event.dot)} />
                  ))}
                  {events.length > 4 ? <span className="text-[10px] text-[#667085]">+{events.length - 4}</span> : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Hourly grid for one (day view) or seven (week view) days. */
function TimeGrid({
  days,
  eventsByDay,
  onOpenDay,
  onOpenEvent,
  onCreate,
  showDayHeaders,
}: {
  days: string[];
  eventsByDay: Map<string, CalEvent[]>;
  onOpenDay: (key: string) => void;
  onOpenEvent: (event: CalEvent) => void;
  onCreate: (key: string, time: string) => void;
  showDayHeaders: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = localDateKey(new Date());
  const cols = { gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` };

  const allDay = days.map((key) => (eventsByDay.get(key) ?? []).filter((e) => e.allDay));
  const hasAllDay = allDay.some((list) => list.length > 0);
  const timedByDayHour = days.map((key) => {
    const byHour = new Map<number, CalEvent[]>();
    for (const event of eventsByDay.get(key) ?? []) {
      if (event.allDay) continue;
      const hour = event.start.getHours();
      byHour.set(hour, [...(byHour.get(hour) ?? []), event]);
    }
    return byHour;
  });

  const nowHour = new Date().getHours();
  const daysKey = days.join(",");
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let anchor: number | null = null;
    for (const byHour of timedByDayHour) {
      for (const hour of byHour.keys()) anchor = anchor === null ? hour : Math.min(anchor, hour);
    }
    if (anchor === null) anchor = days.includes(today) ? nowHour : 8;
    el.scrollTop = Math.max(0, anchor - 1) * HOUR_ROW_PX;
    // Only re-anchor when the visible days change, not on every refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daysKey]);

  return (
    <div className={cn(days.length > 1 && "overflow-x-auto")}>
      <div
        ref={scrollRef}
        className={cn("overflow-y-auto", days.length > 1 ? "max-h-[640px] min-w-[720px]" : "max-h-[336px]")}
      >
        <div className="sticky top-0 z-10 bg-white">
          {showDayHeaders ? (
            <div className="grid border-b border-[#D9E2E8]" style={cols}>
              <div />
              {days.map((key) => {
                const d = parseDateKey(key);
                const isToday = key === today;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onOpenDay(key)}
                    className="flex flex-col items-center gap-0.5 border-l border-[#D9E2E8] py-2 transition-colors hover:bg-[#F4F7F9]"
                    aria-label={`Open ${d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}`}
                  >
                    <span className="text-xs text-[#667085]">{WEEKDAYS[d.getDay()]}</span>
                    <span
                      className={cn(
                        "inline-flex size-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                        isToday ? "bg-[#04203F] text-white" : "text-[#04203F]",
                      )}
                    >
                      {d.getDate()}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {hasAllDay ? (
            <div className="grid border-b border-[#D9E2E8]" style={cols}>
              <div className="px-2 py-1.5 text-right text-[11px] leading-4 text-[#667085]">No set time</div>
              {allDay.map((events, i) => (
                <div key={days[i]} className="min-w-0 space-y-1 border-l border-[#D9E2E8] p-1">
                  {events.map((event) => (
                    <EventChip key={event.key} event={event} onOpen={onOpenEvent} />
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {HOURS.map((hour) => (
          <div key={hour} className="grid" style={cols}>
            <div className="relative pr-2 text-right text-[11px] tabular-nums text-[#667085]" style={{ height: HOUR_ROW_PX }}>
              {hour === 0 ? null : <span className="relative -top-2">{hourLabel(hour)}</span>}
            </div>
            {days.map((key, i) => {
              const events = timedByDayHour[i].get(hour) ?? [];
              const createTime = slotDueTime(key, hour);
              const isNow = key === today && hour === nowHour;
              const slotLabel = `${parseDateKey(key).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })} ${hourLabel(hour)}`;
              return (
                <div
                  key={key}
                  role={createTime ? "button" : undefined}
                  tabIndex={createTime ? 0 : undefined}
                  aria-label={createTime ? `New audit due ${slotLabel}` : undefined}
                  onClick={createTime ? () => onCreate(key, createTime) : undefined}
                  onKeyDown={createTime ? slotKeyDown(() => onCreate(key, createTime)) : undefined}
                  style={{ height: HOUR_ROW_PX }}
                  className={cn(
                    "group/slot relative min-w-0 space-y-0.5 overflow-hidden border-l border-t border-[#D9E2E8] p-0.5",
                    createTime
                      ? "cursor-pointer transition-colors hover:bg-[#F4F7F9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#04203F]"
                      : "bg-[#F4F7F9]/50",
                    isNow && "border-t-[#04203F]",
                  )}
                >
                  {events.slice(0, events.length > 2 ? 1 : 2).map((event) => (
                    <EventChip key={event.key} event={event} onOpen={onOpenEvent} />
                  ))}
                  {events.length > 2 ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDay(key);
                      }}
                      className="px-1 text-[11px] font-medium text-[#667085] hover:text-[#04203F]"
                    >
                      +{events.length - 1} more
                    </button>
                  ) : null}
                  {createTime && events.length === 0 ? (
                    <span className="pointer-events-none absolute inset-0 hidden items-center justify-center text-[11px] font-medium text-[#667085] group-hover/slot:flex">
                      <Plus className="mr-1 size-3" aria-hidden /> New audit
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function NewAuditAtDialog({
  slot,
  onClose,
}: {
  slot: { date: string; time: string } | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  useEffect(() => {
    if (slot) {
      setDate(slot.date);
      setTime(slot.time);
    }
  }, [slot]);

  const today = localDateKey(new Date());
  const due = date && time ? new Date(`${date}T${time}:00`) : null;
  const error = !date || !time ? "Pick a date and time." : due && due.getTime() <= Date.now() ? "Pick a time in the future." : null;

  return (
    <Dialog open={slot !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="rounded-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New audit</DialogTitle>
          <DialogDescription>
            The audit will be due at this date and time. You choose the store, team member and checklist next.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-xs text-[#667085]">
            Due date
            <Input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} className="h-10 rounded-lg" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-[#667085]">
            Due time
            <Input type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} className="h-10 rounded-lg" />
          </label>
        </div>
        {error && date && time ? <p className="text-xs text-[#04203F]">{error}</p> : null}
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" className="rounded-lg" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="brand"
            className="rounded-lg"
            disabled={Boolean(error)}
            onClick={() => {
              onClose();
              void navigate({ to: "/new-audit", search: { dueDate: date, dueTime: time.slice(0, 5) } });
            }}
          >
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------- page ---------------------------------- */

function AuditCalendarPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const view: CalendarView = search.view ?? "month";
  const dateKey = search.date ?? localDateKey(new Date());

  const [filters, setFiltersState] = useState<AssignmentFilters>(EMPTY_ASSIGNMENT_FILTERS);
  const [viewing, setViewing] = useState<Assignment | null>(null);
  const [createSlot, setCreateSlot] = useState<{ date: string; time: string } | null>(null);

  const query = useQuery({
    queryKey: ["assignments-overview"],
    queryFn: fetchAssignmentsOverview,
    retry: false,
  });
  const isManager = query.data?.isManager ?? false;
  const userId = query.data?.userId ?? "";

  const schedulesQuery = useQuery({
    queryKey: ["audit-schedules", "calendar"],
    queryFn: fetchAuditSchedules,
    enabled: isManager,
  });

  const rows = useMemo(() => query.data?.rows ?? [], [query.data]);
  const items = useMemo(() => toAssignmentItems(rows), [rows]);
  const options = useMemo(() => assignmentFilterOptions(rows), [rows]);

  const filteredItems = useMemo(
    () =>
      items.filter(
        (item) =>
          matchesAssignmentFilters(item, filters) && (filters.status === "cancelled" || item.status !== "cancelled"),
      ),
    [items, filters],
  );

  const eventsByDay = useMemo(() => {
    const events = filteredItems.map(assignmentEvent);
    for (const schedule of schedulesQuery.data ?? []) {
      if (schedule.active && scheduleMatches(schedule, filters)) events.push(scheduleEvent(schedule));
    }
    const byDay = new Map<string, CalEvent[]>();
    for (const event of events) byDay.set(event.dateKey, [...(byDay.get(event.dateKey) ?? []), event]);
    for (const list of byDay.values()) list.sort(sortEvents);
    return byDay;
  }, [filteredItems, schedulesQuery.data, filters]);

  const visibleDays = useMemo(() => {
    if (view === "day") return [dateKey];
    if (view === "week") return Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(dateKey), i));
    const month = parseDateKey(dateKey).getMonth();
    return monthGrid(dateKey).filter((key) => parseDateKey(key).getMonth() === month);
  }, [view, dateKey]);
  const countInView = visibleDays.reduce((sum, key) => sum + (eventsByDay.get(key)?.length ?? 0), 0);

  const dayItems = useMemo(
    () =>
      (eventsByDay.get(dateKey) ?? [])
        .filter((event): event is CalEvent & { item: AssignmentItem } => Boolean(event.item))
        .map((event) => event.item),
    [eventsByDay, dateKey],
  );
  const daySchedules = (eventsByDay.get(dateKey) ?? []).filter((event) => event.schedule);

  const go = (next: { view?: CalendarView; date?: string }) =>
    void navigate({ search: (prev) => ({ ...prev, view: next.view ?? view, date: next.date ?? dateKey }) });
  const openDay = (key: string) => go({ view: "day", date: key });
  const openEvent = (event: CalEvent) => {
    if (event.item) setViewing(event.item.row);
    else void navigate({ to: "/audit-schedules" });
  };
  const openCreate = (key: string, time: string) => setCreateSlot({ date: key, time });

  const setFilters = (patch: Partial<AssignmentFilters>) => setFiltersState((prev) => ({ ...prev, ...patch }));
  const today = localDateKey(new Date());
  const dayCreateTime = defaultDueTime(dateKey);

  const viewingStatus = viewing ? overviewStatus(viewing) : null;
  const drawerFooter =
    viewing && viewingStatus ? (
      viewingStatus === "pending_review" && viewing.scan_id && isManager ? (
        <Button variant="brand" className="w-full rounded-lg" asChild>
          <Link to="/audit-review/$scanId" params={{ scanId: viewing.scan_id }}>
            Review
          </Link>
        </Button>
      ) : !viewing.scan_id && viewing.assignee_id === userId && OPEN_STATUSES.includes(viewingStatus) ? (
        <Button variant="brand" className="w-full rounded-lg" asChild>
          <Link to="/my-scans">Start in My work</Link>
        </Button>
      ) : null
    ) : null;

  return (
    <AppShell title="" hidePageHeader>
      <div className="play-canvas space-y-5">
        <PageHeader
          title="Audit calendar"
          description={
            !query.data || isManager
              ? "Audits assigned to you, by you and to your team, on the day they are due. Click a day to act on its audits."
              : "Audits assigned to you or by you, on the day they are due. Click a day to act on its audits."
          }
          actions={
            <>
              {isManager ? (
                <Button variant="outline" size="sm" className="rounded-lg" asChild>
                  <Link to="/audit-schedules">
                    <Repeat className="mr-2 size-4" /> Recurring schedules
                  </Link>
                </Button>
              ) : null}
              <Button
                variant="brand"
                size="sm"
                className="rounded-lg"
                onClick={() => {
                  const key = view === "day" && dateKey >= today ? dateKey : today;
                  setCreateSlot({ date: key, time: defaultDueTime(key) ?? "17:00" });
                }}
              >
                <CalendarPlus className="mr-2 size-4" /> New audit
              </Button>
            </>
          }
        />

        {query.isPending ? (
          <Skeleton className="h-[520px] w-full rounded-xl" aria-label="Loading calendar" />
        ) : query.isError ? (
          <ErrorState description={toUserMessage(query.error)} onRetry={() => void query.refetch()} />
        ) : (
          <>
            <AssignmentFilterBar
              filters={filters}
              onChange={setFilters}
              onClear={() => setFiltersState(EMPTY_ASSIGNMENT_FILTERS)}
              options={options}
              showStatus
              showDueRange={false}
              matchCount={filteredItems.length}
              totalCount={items.filter((item) => item.status !== "cancelled").length}
            />

            <section className="rounded-xl border border-[#D9E2E8] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D9E2E8] p-3 sm:p-4">
                <div className="flex min-w-0 items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    onClick={() => go({ date: today })}
                    disabled={visibleDays.includes(today) && (view !== "day" || dateKey === today)}
                  >
                    Today
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-lg"
                    aria-label={`Previous ${view}`}
                    onClick={() => go({ date: shiftDate(dateKey, view, -1) })}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-lg"
                    aria-label={`Next ${view}`}
                    onClick={() => go({ date: shiftDate(dateKey, view, 1) })}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#04203F] sm:text-base">{viewLabel(dateKey, view)}</p>
                    <p className="text-xs text-[#667085]">
                      {countInView} audit{countInView === 1 ? "" : "s"}
                      {view === "month" ? " this month" : view === "week" ? " this week" : " on this day"}
                    </p>
                  </div>
                </div>
                <div className="inline-flex rounded-lg border border-[#D9E2E8] p-0.5" role="tablist" aria-label="Calendar view">
                  {(["month", "week", "day"] as CalendarView[]).map((v) => (
                    <button
                      key={v}
                      type="button"
                      role="tab"
                      aria-selected={view === v}
                      onClick={() => go({ view: v })}
                      className={cn(
                        "rounded-md px-3 py-1 text-sm font-medium capitalize transition-colors",
                        view === v ? "bg-[#04203F] text-white" : "text-[#667085] hover:bg-[#F4F7F9] hover:text-[#04203F]",
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {view === "day" ? (
                <div className="border-b border-[#D9E2E8]">
                  <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-[#04203F]">
                        Audits on{" "}
                        {parseDateKey(dateKey).toLocaleDateString(undefined, { day: "numeric", month: "long" })} (
                        {dayItems.length})
                      </p>
                      <p className="mt-0.5 text-xs text-[#667085]">
                        Due this day, or assigned this day when there is no due date.
                      </p>
                    </div>
                    {dayCreateTime ? (
                      <Button
                        variant="subtle"
                        size="sm"
                        className="rounded-lg"
                        onClick={() => openCreate(dateKey, dayCreateTime)}
                      >
                        <Plus className="mr-1.5 size-4" /> New audit on this day
                      </Button>
                    ) : null}
                  </div>
                  {dayItems.length ? (
                    <div className="border-t border-[#D9E2E8]">
                      <AssignmentRowsTable
                        items={dayItems}
                        userId={userId}
                        isManager={isManager}
                        onView={setViewing}
                        showTime
                      />
                    </div>
                  ) : (
                    <div className="px-4 pb-4">
                      <EmptyState
                        icon={<CalendarDays className="size-5" />}
                        title="No audits on this day"
                        description={
                          dayCreateTime
                            ? "Click an hour below or use New audit to plan one."
                            : "Nothing was due on this day with the current filters."
                        }
                      />
                    </div>
                  )}

                  {daySchedules.length ? (
                    <div className="border-t border-[#D9E2E8] px-4 py-3">
                      <p className="text-xs text-[#667085]">Recurring schedules running this day</p>
                      <ul className="mt-2 divide-y divide-[#D9E2E8] rounded-lg border border-[#D9E2E8]">
                        {daySchedules.map((event) => (
                          <li key={event.key}>
                            <Link
                              to="/audit-schedules"
                              className="flex items-center justify-between gap-3 px-3 py-2 text-sm transition-colors hover:bg-[#F4F7F9]"
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <span className={cn("size-1.5 shrink-0 rounded-full", RECURRING_DOT)} aria-hidden />
                                <span className="truncate font-medium text-[#04203F]">{event.title}</span>
                                <span className="hidden truncate text-[#667085] sm:inline">{event.subtitle}</span>
                              </span>
                              <span className="shrink-0 tabular-nums text-[#667085]">{timeLabel(event.start)}</span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <p className="border-t border-[#D9E2E8] px-4 py-2 text-xs text-[#667085]">
                    Timeline{dayCreateTime ? " · click an open hour to plan a new audit due then" : ""}
                  </p>
                </div>
              ) : null}

              {view === "month" ? (
                <MonthView
                  dateKey={dateKey}
                  eventsByDay={eventsByDay}
                  onOpenDay={openDay}
                  onOpenEvent={openEvent}
                  onCreate={openCreate}
                />
              ) : (
                <TimeGrid
                  days={visibleDays}
                  eventsByDay={eventsByDay}
                  onOpenDay={openDay}
                  onOpenEvent={openEvent}
                  onCreate={openCreate}
                  showDayHeaders={view === "week"}
                />
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[#D9E2E8] px-4 py-2.5 text-xs text-[#667085]">
                {STATUS_ORDER.filter((s) => s !== "cancelled").map((status) => (
                  <span key={status} className="inline-flex items-center gap-1.5">
                    <span className={cn("size-1.5 rounded-full", STATUS_DOT[status])} aria-hidden />
                    {STATUS_LABEL[status]}
                  </span>
                ))}
                {isManager ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className={cn("size-1.5 rounded-full", RECURRING_DOT)} aria-hidden />
                    Recurring
                  </span>
                ) : null}
              </div>
            </section>
          </>
        )}
      </div>

      <AssignmentDetailsDrawer row={viewing} onClose={() => setViewing(null)} footer={drawerFooter} />
      <NewAuditAtDialog slot={createSlot} onClose={() => setCreateSlot(null)} />
    </AppShell>
  );
}
