import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingsCard } from "@/components/settings/SettingsParts";
import { toUserMessage } from "@/lib/api/errors";
import {
  fetchOrgAssignmentSettings,
  REMINDER_HOUR_OPTIONS,
  saveOrgAssignmentSettings,
} from "@/lib/assignment-engine/settings";
import { fetchAssignableMembers } from "@/lib/assignments";

export function AssignmentReminderSettingsPanel() {
  const queryClient = useQueryClient();
  const [reminderHours, setReminderHours] = useState<number[]>([24, 12, 4, 1]);
  const [escalationUserId, setEscalationUserId] = useState<string>("");

  const settingsQuery = useQuery({
    queryKey: ["org-assignment-settings"],
    queryFn: fetchOrgAssignmentSettings,
  });

  const membersQuery = useQuery({
    queryKey: ["assignable-members"],
    queryFn: fetchAssignableMembers,
  });

  useEffect(() => {
    if (settingsQuery.data) {
      setReminderHours(settingsQuery.data.reminderHours);
      setEscalationUserId(settingsQuery.data.escalationUserId ?? "");
    }
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      saveOrgAssignmentSettings({
        ...settingsQuery.data!,
        reminderHours,
        escalationUserId: escalationUserId || null,
      }),
    onSuccess: () => {
      toast.success("Assignment reminder settings saved.");
      void queryClient.invalidateQueries({ queryKey: ["org-assignment-settings"] });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  const toggleHour = (hour: number) => {
    setReminderHours((prev) =>
      prev.includes(hour) ? prev.filter((h) => h !== hour) : [...prev, hour].sort((a, b) => b - a),
    );
  };

  return (
    <SettingsCard
      title="Assignment reminders & escalation"
      description="Due-soon reminders (24h, 12h, 4h, 1h), overdue notifications, and escalation recipient. Processed server-side using each org's timezone on assignments."
    >
      <div className="space-y-4">
        <div>
          <Label className="mb-2 flex items-center gap-2">
            <Bell className="size-4" />
            Due-soon reminders
          </Label>
          <div className="flex flex-wrap gap-3">
            {REMINDER_HOUR_OPTIONS.map((hour) => (
              <Label key={hour} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={reminderHours.includes(hour)}
                  onCheckedChange={() => toggleHour(hour)}
                />
                {hour}h before due
              </Label>
            ))}
          </div>
        </div>

        <div>
          <Label className="mb-2 block text-sm">Overdue escalation recipient</Label>
          <Select value={escalationUserId || "none"} onValueChange={(v) => setEscalationUserId(v === "none" ? "" : v)}>
            <SelectTrigger className="max-w-md">
              <SelectValue placeholder="Select manager for overdue escalations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No escalation</SelectItem>
              {(membersQuery.data ?? []).map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || settingsQuery.isLoading}
        >
          {saveMutation.isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save reminder settings"
          )}
        </Button>
      </div>
    </SettingsCard>
  );
}
