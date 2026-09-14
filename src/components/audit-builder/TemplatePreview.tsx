import { Smartphone, Monitor } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { isFieldVisible } from "@/lib/audit-builder/rules-engine";
import type { TemplateDefinition } from "@/lib/audit-builder/types";

type Props = {
  templateName: string;
  definition: TemplateDefinition;
  viewMode?: "employee" | "manager";
};

export function TemplatePreview({ templateName, definition, viewMode: initialView }: Props) {
  const [view, setView] = useState<"desktop" | "mobile">("mobile");
  const [role, setRole] = useState<"employee" | "manager">(initialView ?? "employee");

  const sampleValues: Record<string, unknown> = {
    qc_status: "Pass",
    expected_qty: 4,
    actual_qty: 4,
  };

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold">Preview Audit</h3>
          <p className="text-xs text-muted-foreground">{templateName}</p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={role === "employee" ? "brand" : "outline"}
            onClick={() => setRole("employee")}
          >
            Employee View
          </Button>
          <Button
            type="button"
            size="sm"
            variant={role === "manager" ? "brand" : "outline"}
            onClick={() => setRole("manager")}
          >
            Manager View
          </Button>
          <Button
            type="button"
            size="icon"
            variant={view === "desktop" ? "brand" : "outline"}
            onClick={() => setView("desktop")}
          >
            <Monitor className="size-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant={view === "mobile" ? "brand" : "outline"}
            onClick={() => setView("mobile")}
          >
            <Smartphone className="size-4" />
          </Button>
        </div>
      </div>
      <div className="flex justify-center bg-muted/30 p-6">
        <div
          className={`rounded-xl border border-border bg-background shadow-sm ${
            view === "mobile" ? "w-full max-w-sm" : "w-full max-w-2xl"
          }`}
        >
          <div className="border-b border-border px-4 py-3">
            <p className="font-semibold">{templateName}</p>
            <p className="text-xs text-muted-foreground">Store #102 · Due today 5:00 PM</p>
          </div>
          <div className="space-y-4 p-4">
            {definition.sections
              .sort((a, b) => a.order - b.order)
              .map((section) => {
                const fields = definition.fields
                  .filter((f) => f.section === section.key)
                  .filter((f) => !f.system || role === "manager")
                  .filter((f) => isFieldVisible(f, sampleValues as Record<string, string | number>))
                  .sort((a, b) => a.order - b.order);

                if (!fields.length) return null;

                return (
                  <section key={section.key}>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {section.title}
                      {section.repeatable ? " (per SKU)" : ""}
                    </h4>
                    <ul className="space-y-3">
                      {fields.map((field) => (
                        <li key={field.id}>
                          <Label className="text-xs">
                            {field.label}
                            {field.required ? (
                              <span className="ml-1 text-destructive">*</span>
                            ) : null}
                          </Label>
                          <div className="mt-1 rounded-md border border-dashed border-muted-foreground/30 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                            {field.type.replace(/_/g, " ")}
                            {field.calculated ? " (auto-calculated)" : ""}
                          </div>
                          {field.config.helpText ? (
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              {field.config.helpText}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            <div className="flex flex-wrap gap-2 pt-2">
              <Badge variant="outline">Progress: 0%</Badge>
              {definition.scoring.enabled ? (
                <Badge variant="secondary">Scoring enabled</Badge>
              ) : null}
              {definition.ai.enabled ? (
                <Badge variant="secondary">AI assisted</Badge>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
