import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ruleToPlainLanguage } from "@/lib/audit-builder/rules-engine";
import type { RuleOperator, TemplateField, TemplateRule } from "@/lib/audit-builder/types";

type Props = {
  rules: TemplateRule[];
  fields: TemplateField[];
  onChange: (rules: TemplateRule[]) => void;
};

const OPERATORS: { value: RuleOperator; label: string }[] = [
  { value: "eq", label: "equals" },
  { value: "neq", label: "not equals" },
  { value: "gt", label: "greater than" },
  { value: "lt", label: "less than" },
  { value: "before_today", label: "before today" },
  { value: "within_days", label: "within N days" },
  { value: "is_empty", label: "is empty" },
  { value: "is_not_empty", label: "is not empty" },
];

export function RulesBuilder({ rules, fields, onChange }: Props) {
  const addRule = () => {
    const firstField = fields[0]?.key ?? "actual_qty";
    onChange([
      ...rules,
      {
        id: crypto.randomUUID(),
        label: "",
        when: { field: firstField, operator: "neq", value: 0 },
        then: [{ action: "require_field", field: "rca" }],
      },
    ]);
  };

  const updateRule = (id: string, patch: Partial<TemplateRule>) => {
    onChange(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRule = (id: string) => onChange(rules.filter((r) => r.id !== id));

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Rules / Logic</h3>
          <p className="text-xs text-muted-foreground">Conditional requirements and auto-findings</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={addRule}>
          <Plus className="mr-1 size-3" /> Add rule
        </Button>
      </div>
      <ul className="mt-4 space-y-3">
        {rules.length === 0 ? (
          <li className="text-xs text-muted-foreground">No rules configured yet.</li>
        ) : (
          rules.map((rule) => (
            <li key={rule.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-brand">
                  {rule.label || ruleToPlainLanguage(rule)}
                </p>
                <Button type="button" size="icon" variant="ghost" className="size-7" onClick={() => removeRule(rule.id)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-3">
                <div>
                  <Label className="text-[10px]">IF field</Label>
                  <Select
                    value={rule.when.field}
                    onValueChange={(v) => updateRule(rule.id, { when: { ...rule.when, field: v } })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {fields.map((f) => (
                        <SelectItem key={f.key} value={f.key}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px]">Operator</Label>
                  <Select
                    value={rule.when.operator}
                    onValueChange={(v) =>
                      updateRule(rule.id, { when: { ...rule.when, operator: v as RuleOperator } })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATORS.map((op) => (
                        <SelectItem key={op.value} value={op.value}>
                          {op.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px]">Value</Label>
                  <Input
                    className="h-8 text-xs"
                    value={String(rule.when.value ?? "")}
                    onChange={(e) =>
                      updateRule(rule.id, { when: { ...rule.when, value: e.target.value } })
                    }
                  />
                </div>
              </div>
              <div className="mt-2">
                <Label className="text-[10px]">Plain-language label</Label>
                <Input
                  className="h-8 text-xs"
                  placeholder="e.g. QC Status = Fail → Defect required"
                  value={rule.label}
                  onChange={(e) => updateRule(rule.id, { label: e.target.value })}
                />
              </div>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
