import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CalculatedFieldDef } from "@/lib/audit-builder/types";

const PRESETS: { label: string; formula: string }[] = [
  { label: "Quantity Variance", formula: "actual_qty - expected_qty" },
  { label: "Variance %", formula: "((actual_qty - expected_qty) / expected_qty) * 100" },
  { label: "Expiry Days Remaining", formula: "expiry_date - audit_date" },
  { label: "Inventory Value Variance", formula: "(actual_qty - expected_qty) * mrp" },
];

type Props = {
  fields: CalculatedFieldDef[];
  onChange: (fields: CalculatedFieldDef[]) => void;
};

export function CalculatedFieldsPanel({ fields, onChange }: Props) {
  const addField = (preset?: { label: string; formula: string }) => {
    const id = crypto.randomUUID().slice(0, 8);
    onChange([
      ...fields,
      {
        key: preset ? preset.formula.split(" ")[0] ?? `calc_${id}` : `calc_${id}`,
        label: preset?.label ?? "Calculated Field",
        formula: preset?.formula ?? "actual_qty - expected_qty",
      },
    ]);
  };

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Calculated Fields</h3>
          <p className="text-xs text-muted-foreground">Read-only for auditors — computed automatically</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => addField()}>
          <Plus className="mr-1 size-3" /> Add
        </Button>
      </div>
      {fields.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-border p-4 text-center">
          <p className="text-xs text-muted-foreground">No calculated fields yet.</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {PRESETS.map((p) => (
              <Button key={p.label} type="button" size="sm" variant="outline" onClick={() => addField(p)}>
                + {p.label}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {fields.map((f, idx) => (
            <li key={`${f.key}-${idx}`} className="rounded-lg border border-border p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label className="text-[10px]">Label</Label>
                  <Input
                    className="h-8 text-xs"
                    value={f.label}
                    onChange={(e) =>
                      onChange(fields.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))
                    }
                  />
                </div>
                <div>
                  <Label className="text-[10px]">Key</Label>
                  <Input
                    className="h-8 text-xs"
                    value={f.key}
                    onChange={(e) =>
                      onChange(fields.map((x, i) => (i === idx ? { ...x, key: e.target.value } : x)))
                    }
                  />
                </div>
              </div>
              <div className="mt-2">
                <Label className="text-[10px]">Formula</Label>
                <Input
                  className="h-8 font-mono text-xs"
                  value={f.formula}
                  onChange={(e) =>
                    onChange(fields.map((x, i) => (i === idx ? { ...x, formula: e.target.value } : x)))
                  }
                />
              </div>
              <div className="mt-2 flex justify-end">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7 text-destructive"
                  onClick={() => onChange(fields.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
