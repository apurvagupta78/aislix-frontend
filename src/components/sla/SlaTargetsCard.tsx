import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { MpCard } from "@/components/design-system/MpCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toUserMessage } from "@/lib/api/errors";
import {
  deleteSlaPolicy,
  effectiveSlaTarget,
  fetchOrgStores,
  fetchSlaPolicies,
  saveSlaPolicy,
  type SlaPolicy,
} from "@/lib/escalation-settings";
import { SLA_TYPES, formatMinutes, type SlaType } from "@/lib/sla-insights";

type Unit = "min" | "h" | "days";
const UNIT_MINUTES: Record<Unit, number> = { min: 1, h: 60, days: 1440 };

function splitMinutes(minutes: number): { value: string; unit: Unit } {
  if (minutes % 1440 === 0) return { value: String(minutes / 1440), unit: "days" };
  if (minutes % 60 === 0) return { value: String(minutes / 60), unit: "h" };
  return { value: String(minutes), unit: "min" };
}

function toMinutes(value: string, unit: Unit): number {
  return Math.round(Number(value) * UNIT_MINUTES[unit]);
}

function DurationInput({
  value,
  unit,
  onChange,
  id,
}: {
  value: string;
  unit: Unit;
  onChange: (next: { value: string; unit: Unit }) => void;
  id?: string;
}) {
  return (
    <div className="flex gap-2">
      <Input
        id={id}
        type="number"
        min={1}
        step="any"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange({ value: e.target.value, unit })}
        className="h-9 w-24 rounded-lg"
      />
      <Select value={unit} onValueChange={(u) => onChange({ value, unit: u as Unit })}>
        <SelectTrigger className="h-9 w-24 rounded-lg">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="min">minutes</SelectItem>
          <SelectItem value="h">hours</SelectItem>
          <SelectItem value="days">days</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

/** Target time per SLA type for the whole workspace, with optional per-store overrides. */
export function SlaTargetsCard() {
  const queryClient = useQueryClient();
  const policiesQuery = useQuery({ queryKey: ["sla-policies"], queryFn: fetchSlaPolicies });
  const storesQuery = useQuery({ queryKey: ["org-stores-list"], queryFn: fetchOrgStores, staleTime: 300_000 });
  const policies = useMemo(() => policiesQuery.data ?? [], [policiesQuery.data]);
  const [draft, setDraft] = useState<Record<SlaType, { value: string; unit: Unit }>>(
    () => Object.fromEntries(SLA_TYPES.map((t) => [t.value, splitMinutes(t.defaultMinutes)])) as Record<
      SlaType,
      { value: string; unit: Unit }
    >,
  );
  const [overrideStore, setOverrideStore] = useState("");
  const [overrideType, setOverrideType] = useState<SlaType>("replenishment");
  const [overrideTime, setOverrideTime] = useState<{ value: string; unit: Unit }>({ value: "15", unit: "min" });

  useEffect(() => {
    if (!policiesQuery.data) return;
    setDraft(
      Object.fromEntries(
        SLA_TYPES.map((t) => [t.value, splitMinutes(effectiveSlaTarget(policiesQuery.data, t.value))]),
      ) as Record<SlaType, { value: string; unit: Unit }>,
    );
  }, [policiesQuery.data]);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["sla-policies"] });

  const saveDefaults = useMutation({
    mutationFn: async () => {
      for (const t of SLA_TYPES) {
        const d = draft[t.value];
        await saveSlaPolicy({ store_id: null, sla_type: t.value, target_minutes: toMinutes(d.value, d.unit) });
      }
    },
    onSuccess: () => {
      toast.success("SLA targets saved. New actions use them from now on.");
      refresh();
    },
    onError: (err) => toast.error(toUserMessage(err)),
  });

  const addOverride = useMutation({
    mutationFn: () =>
      saveSlaPolicy({
        store_id: overrideStore,
        sla_type: overrideType,
        target_minutes: toMinutes(overrideTime.value, overrideTime.unit),
      }),
    onSuccess: () => {
      toast.success("Store target saved.");
      refresh();
    },
    onError: (err) => toast.error(toUserMessage(err)),
  });

  const removeOverride = useMutation({
    mutationFn: (p: SlaPolicy) => deleteSlaPolicy(p.store_id as string, p.sla_type),
    onSuccess: refresh,
    onError: (err) => toast.error(toUserMessage(err)),
  });

  const storeNames = new Map((storesQuery.data ?? []).map((s) => [s.id, s.name]));
  const overrides = policies.filter((p) => p.store_id);

  return (
    <MpCard className="p-5">
      <h2 className="font-display text-[15px] font-semibold text-navy">SLA targets</h2>
      <p className="mt-0.5 text-[13px] text-mp-muted">
        How fast each kind of issue must be fixed after an audit raises it. The clock starts when the action is created
        and stops when the store team submits the fix.
      </p>
      {policiesQuery.isPending ? (
        <Skeleton className="mt-4 h-40 rounded-lg" />
      ) : (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {SLA_TYPES.map((t) => (
              <div key={t.value} className="rounded-lg border border-line p-3">
                <Label htmlFor={`sla-${t.value}`} className="text-sm font-semibold text-navy">
                  {t.label}
                </Label>
                <p className="mb-2 mt-0.5 text-xs text-mp-muted">{t.description}</p>
                <DurationInput
                  id={`sla-${t.value}`}
                  value={draft[t.value].value}
                  unit={draft[t.value].unit}
                  onChange={(next) => setDraft((d) => ({ ...d, [t.value]: next }))}
                />
              </div>
            ))}
          </div>
          <Button className="mt-4" disabled={saveDefaults.isPending} onClick={() => saveDefaults.mutate()}>
            {saveDefaults.isPending ? <Loader2 className="size-4 animate-spin" /> : null} Save SLA targets
          </Button>

          <div className="mt-6 border-t border-line pt-4">
            <h3 className="text-sm font-semibold text-navy">Store overrides</h3>
            <p className="mt-0.5 text-xs text-mp-muted">Give a store its own target, for example a dark store with a faster refill.</p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div>
                <Label className="text-xs">Store</Label>
                <Select value={overrideStore} onValueChange={setOverrideStore}>
                  <SelectTrigger className="mt-1 h-9 w-52 rounded-lg">
                    <SelectValue placeholder="Pick a store" />
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
              <div>
                <Label className="text-xs">SLA type</Label>
                <Select value={overrideType} onValueChange={(v) => setOverrideType(v as SlaType)}>
                  <SelectTrigger className="mt-1 h-9 w-48 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SLA_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.short}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Target</Label>
                <div className="mt-1">
                  <DurationInput value={overrideTime.value} unit={overrideTime.unit} onChange={setOverrideTime} />
                </div>
              </div>
              <Button
                variant="outline"
                disabled={!overrideStore || addOverride.isPending}
                onClick={() => addOverride.mutate()}
              >
                Add override
              </Button>
            </div>
            {overrides.length ? (
              <ul className="mt-3 divide-y divide-[#EEF1F4] rounded-lg border border-line">
                {overrides.map((p) => (
                  <li key={`${p.store_id}-${p.sla_type}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="text-navy">
                      {storeNames.get(p.store_id as string) ?? "Store"} ·{" "}
                      {SLA_TYPES.find((t) => t.value === p.sla_type)?.short}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="tabular-nums text-navy">{formatMinutes(p.target_minutes)}</span>
                      <button
                        type="button"
                        onClick={() => removeOverride.mutate(p)}
                        className="rounded-md p-1 text-mp-muted hover:bg-[#F4F7F9] hover:text-navy"
                        aria-label="Remove store override"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-mp-muted">No store overrides. Every store uses the targets above.</p>
            )}
          </div>
        </>
      )}
    </MpCard>
  );
}
