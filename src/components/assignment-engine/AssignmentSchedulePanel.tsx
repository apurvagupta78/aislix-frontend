import { CalendarClock } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  AssignmentMode,
  DueConfig,
  RecurrenceFrequency,
  RecurrenceRule,
} from "@/lib/assignment-engine";
import { ASSIGNMENT_MODE_LABELS, TIMEZONE_OPTIONS } from "@/lib/assignment-engine";

type Props = {
  mode: AssignmentMode;
  onModeChange: (mode: AssignmentMode) => void;
  publishAt: string;
  onPublishAtChange: (value: string) => void;
  dueConfig: DueConfig;
  onDueConfigChange: (config: DueConfig) => void;
  recurrence: RecurrenceRule;
  onRecurrenceChange: (rule: RecurrenceRule) => void;
};

const WEEKDAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

export function AssignmentSchedulePanel({
  mode,
  onModeChange,
  publishAt,
  onPublishAtChange,
  dueConfig,
  onDueConfigChange,
  recurrence,
  onRecurrenceChange,
}: Props) {
  const patchRecurrence = (patch: Partial<RecurrenceRule>) =>
    onRecurrenceChange({ ...recurrence, ...patch });

  return (
    <div className="space-y-4 rounded-xl border p-4">
      <div className="flex items-center gap-2">
        <CalendarClock className="size-4 text-brand" />
        <p className="font-semibold">When?</p>
      </div>

      <RadioGroup
        value={mode}
        onValueChange={(v) => onModeChange(v as AssignmentMode)}
        className="grid gap-2 md:grid-cols-3"
      >
        {(Object.entries(ASSIGNMENT_MODE_LABELS) as [AssignmentMode, string][]).map(
          ([key, label]) => (
            <Label
              key={key}
              className="flex cursor-pointer items-center gap-2 rounded-xl border p-3"
            >
              <RadioGroupItem value={key} />
              {label}
            </Label>
          ),
        )}
      </RadioGroup>

      {mode === "schedule_once" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Publish at</Label>
            <Input
              type="datetime-local"
              className="mt-1"
              value={publishAt}
              onChange={(e) => onPublishAtChange(e.target.value)}
            />
          </div>
        </div>
      ) : null}

      {mode === "recurring" ? (
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Frequency</Label>
            <Select
              value={recurrence.frequency}
              onValueChange={(v) => patchRecurrence({ frequency: v as RecurrenceFrequency })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekdays">Every weekday</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="custom">Custom interval</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Interval</Label>
            <Input
              type="number"
              min={1}
              className="mt-1"
              value={recurrence.interval}
              onChange={(e) => patchRecurrence({ interval: Number(e.target.value) || 1 })}
            />
          </div>
          {recurrence.frequency === "weekly" ? (
            <div className="md:col-span-2">
              <Label>Days of week</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {WEEKDAYS.map((d) => {
                  const selected = recurrence.daysOfWeek?.includes(d.value) ?? false;
                  return (
                    <button
                      key={d.value}
                      type="button"
                      className={`rounded-lg border px-3 py-1 text-xs font-medium ${
                        selected ? "border-brand bg-brand-soft/40" : "border-border"
                      }`}
                      onClick={() => {
                        const current = new Set(recurrence.daysOfWeek ?? []);
                        if (current.has(d.value)) current.delete(d.value);
                        else current.add(d.value);
                        patchRecurrence({ daysOfWeek: [...current] });
                      }}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
          <div>
            <Label>Start date</Label>
            <Input
              type="date"
              className="mt-1"
              value={recurrence.startDate}
              onChange={(e) => patchRecurrence({ startDate: e.target.value })}
            />
          </div>
          <div>
            <Label>Start time</Label>
            <Input
              type="time"
              className="mt-1"
              value={recurrence.startTime}
              onChange={(e) => patchRecurrence({ startTime: e.target.value })}
            />
          </div>
          <div>
            <Label>Timezone</Label>
            <Select
              value={recurrence.timezone}
              onValueChange={(v) => patchRecurrence({ timezone: v })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONE_OPTIONS.map((tz) => (
                  <SelectItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>End date (optional)</Label>
            <Input
              type="date"
              className="mt-1"
              value={recurrence.endDate ?? ""}
              onChange={(e) => patchRecurrence({ endDate: e.target.value || undefined })}
            />
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label>Due date</Label>
          <Input
            type="date"
            className="mt-1"
            value={dueConfig.dueDate ?? ""}
            onChange={(e) => onDueConfigChange({ ...dueConfig, dueDate: e.target.value })}
          />
        </div>
        <div>
          <Label>Due time</Label>
          <Input
            type="time"
            className="mt-1"
            value={dueConfig.dueTime ?? ""}
            onChange={(e) => onDueConfigChange({ ...dueConfig, dueTime: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
