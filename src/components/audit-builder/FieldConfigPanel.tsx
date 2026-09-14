import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { TemplateField } from "@/lib/audit-builder/types";
import { isImageField, isNumericField } from "@/lib/audit-builder/field-library";

type Props = {
  field: TemplateField | null;
  onChange: (patch: Partial<TemplateField>) => void;
};

export function FieldConfigPanel({ field, onChange }: Props) {
  if (!field) {
    return (
      <aside className="flex h-full flex-col rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Field Configuration</h3>
        <p className="mt-2 text-xs text-muted-foreground">
          Select a field on the canvas to configure label, validation, evidence, and visibility.
        </p>
      </aside>
    );
  }

  const cfg = field.config;

  return (
    <aside className="flex h-full flex-col overflow-y-auto rounded-xl border border-border bg-card">
      <div className="border-b border-border p-4">
        <h3 className="text-sm font-semibold">Configure Field</h3>
        <p className="text-xs capitalize text-muted-foreground">{field.type.replace(/_/g, " ")}</p>
      </div>
      <div className="space-y-4 p-4">
        <div>
          <Label>Label</Label>
          <Input
            value={field.label}
            onChange={(e) => onChange({ label: e.target.value })}
          />
        </div>
        <div>
          <Label>Internal Key</Label>
          <Input
            value={field.key}
            onChange={(e) => onChange({ key: e.target.value.replace(/\s+/g, "_").toLowerCase() })}
          />
        </div>
        <div>
          <Label>Description</Label>
          <Textarea
            rows={2}
            value={field.description ?? ""}
            onChange={(e) => onChange({ description: e.target.value })}
          />
        </div>
        <div>
          <Label>Placeholder</Label>
          <Input
            value={cfg.placeholder ?? ""}
            onChange={(e) => onChange({ config: { ...cfg, placeholder: e.target.value } })}
          />
        </div>
        <div>
          <Label>Help Text</Label>
          <Input
            value={cfg.helpText ?? ""}
            onChange={(e) => onChange({ config: { ...cfg, helpText: e.target.value } })}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <Label>Required</Label>
          <Switch checked={field.required} onCheckedChange={(v) => onChange({ required: v })} />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <Label>Read only (auditor)</Label>
          <Switch
            checked={cfg.readOnly ?? field.calculated ?? false}
            onCheckedChange={(v) => onChange({ config: { ...cfg, readOnly: v } })}
          />
        </div>

        {isNumericField(field.type) ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Minimum</Label>
                <Input
                  type="number"
                  value={cfg.min ?? ""}
                  onChange={(e) =>
                    onChange({
                      config: { ...cfg, min: e.target.value ? Number(e.target.value) : undefined },
                    })
                  }
                />
              </div>
              <div>
                <Label>Maximum</Label>
                <Input
                  type="number"
                  value={cfg.max ?? ""}
                  onChange={(e) =>
                    onChange({
                      config: { ...cfg, max: e.target.value ? Number(e.target.value) : undefined },
                    })
                  }
                />
              </div>
            </div>
            <div>
              <Label>Unit</Label>
              <Input
                value={cfg.unit ?? ""}
                onChange={(e) => onChange({ config: { ...cfg, unit: e.target.value } })}
                placeholder="e.g. kg, ₹, %"
              />
            </div>
          </>
        ) : null}

        {isImageField(field.type) ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Min Images</Label>
                <Input
                  type="number"
                  min={0}
                  value={cfg.minImages ?? 1}
                  onChange={(e) =>
                    onChange({ config: { ...cfg, minImages: Number(e.target.value) } })
                  }
                />
              </div>
              <div>
                <Label>Max Images</Label>
                <Input
                  type="number"
                  min={1}
                  value={cfg.maxImages ?? 5}
                  onChange={(e) =>
                    onChange({ config: { ...cfg, maxImages: Number(e.target.value) } })
                  }
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <Label>Camera Required</Label>
              <Switch
                checked={cfg.cameraRequired ?? true}
                onCheckedChange={(v) => onChange({ config: { ...cfg, cameraRequired: v } })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <Label>Gallery Allowed</Label>
              <Switch
                checked={cfg.galleryAllowed ?? true}
                onCheckedChange={(v) => onChange({ config: { ...cfg, galleryAllowed: v } })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <Label>GPS Required</Label>
              <Switch
                checked={cfg.gpsRequired ?? false}
                onCheckedChange={(v) => onChange({ config: { ...cfg, gpsRequired: v } })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <Label>Timestamp Required</Label>
              <Switch
                checked={cfg.timestampRequired ?? true}
                onCheckedChange={(v) => onChange({ config: { ...cfg, timestampRequired: v } })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <Label>AI Analysis</Label>
              <Switch
                checked={cfg.aiAnalysisEnabled ?? false}
                onCheckedChange={(v) => onChange({ config: { ...cfg, aiAnalysisEnabled: v } })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <Label>Duplicate Detection</Label>
              <Switch
                checked={cfg.duplicateDetection ?? false}
                onCheckedChange={(v) => onChange({ config: { ...cfg, duplicateDetection: v } })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <Label>Image Quality Check</Label>
              <Switch
                checked={cfg.imageQualityCheck ?? false}
                onCheckedChange={(v) => onChange({ config: { ...cfg, imageQualityCheck: v } })}
              />
            </div>
          </>
        ) : null}

        {(field.type === "dropdown" || field.type === "qc_status") ? (
          <div>
            <Label>Options (comma-separated)</Label>
            <Input
              value={(cfg.options ?? []).join(", ")}
              onChange={(e) =>
                onChange({
                  config: {
                    ...cfg,
                    options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  },
                })
              }
            />
          </div>
        ) : null}

        {field.calculated ? (
          <div>
            <Label>Formula</Label>
            <Input
              value={field.formula ?? ""}
              onChange={(e) => onChange({ formula: e.target.value })}
              placeholder="actual_qty - expected_qty"
            />
          </div>
        ) : null}
      </div>
    </aside>
  );
}
