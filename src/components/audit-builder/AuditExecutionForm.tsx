import { useMemo, useRef, useState } from "react";
import { Camera, Loader2, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { computeCalculatedValues } from "@/lib/audit-builder/calculated-fields";
import { isFieldVisible } from "@/lib/audit-builder/rules-engine";
import { isImageField } from "@/lib/audit-builder/field-library";
import { computeCompletion } from "@/lib/audit-builder/validation";
import type { AuditResponseValue, TemplateDefinition, TemplateField } from "@/lib/audit-builder/types";
import type { ResponseMap } from "@/lib/custom-audit";
import { RCA_OPTIONS } from "@/lib/digital-audit";

type Props = {
  definition: TemplateDefinition;
  templateName: string;
  storeName: string | null;
  dueAt: string | null;
  responses: ResponseMap;
  onChange: (responses: ResponseMap) => void;
  onSaveField: (
    sectionKey: string,
    recordIndex: number,
    field: TemplateField,
    value: AuditResponseValue,
  ) => Promise<void>;
  onUploadImage: (file: File) => Promise<string>;
  readOnly?: boolean;
};

export function AuditExecutionForm({
  definition,
  templateName,
  storeName,
  dueAt,
  responses,
  onChange,
  onSaveField,
  onUploadImage,
  readOnly,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<{
    sectionKey: string;
    recordIndex: number;
    field: TemplateField;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [activeRecord, setActiveRecord] = useState(0);

  const repeatableSection = definition.sections.find((s) => s.repeatable);
  const sectionKey = repeatableSection?.key ?? definition.sections[0]?.key ?? "default";

  const records = useMemo(() => {
    const sectionData = responses[sectionKey] ?? { 0: {} };
    const indices = Object.keys(sectionData).map(Number).sort((a, b) => a - b);
    return indices.length ? indices : [0];
  }, [responses, sectionKey]);

  const recordContexts = records.map((idx) => ({
    sectionKey,
    recordIndex: idx,
    values: responses[sectionKey]?.[idx] ?? {},
  }));

  const completion = computeCompletion(definition, [
    ...recordContexts,
    ...definition.sections
      .filter((s) => !s.repeatable)
      .map((s) => ({
        sectionKey: s.key,
        recordIndex: 0,
        values: responses[s.key]?.[0] ?? {},
      })),
  ]);

  const setValue = async (
    sec: string,
    idx: number,
    field: TemplateField,
    value: AuditResponseValue,
  ) => {
    const next: ResponseMap = {
      ...responses,
      [sec]: {
        ...responses[sec],
        [idx]: {
          ...(responses[sec]?.[idx] ?? {}),
          [field.key]: value,
        },
      },
    };
    onChange(next);
    if (!readOnly) await onSaveField(sec, idx, field, value);
  };

  const addSkuRecord = () => {
    const nextIdx = Math.max(...records, -1) + 1;
    onChange({
      ...responses,
      [sectionKey]: {
        ...responses[sectionKey],
        [nextIdx]: {},
      },
    });
    setActiveRecord(nextIdx);
  };

  const handleImageUpload = async (file: File) => {
    if (!uploadTarget) return;
    setUploading(true);
    try {
      const url = await onUploadImage(file);
      const { sectionKey: sec, recordIndex, field } = uploadTarget;
      const existing = responses[sec]?.[recordIndex]?.[field.key];
      const list = Array.isArray(existing) ? [...existing, url] : [url];
      await setValue(sec, recordIndex, field, list);
    } finally {
      setUploading(false);
      setUploadTarget(null);
    }
  };

  const currentValues = {
    ...(responses[sectionKey]?.[activeRecord] ?? {}),
    ...computeCalculatedValues(definition, responses[sectionKey]?.[activeRecord] ?? {}),
  };

  const renderField = (field: TemplateField, sec: string, idx: number) => {
    if (field.system) return null;
    if (!isFieldVisible(field, currentValues as Record<string, string | number>)) return null;

    const val = responses[sec]?.[idx]?.[field.key];

    if (field.calculated) {
      const computed = computeCalculatedValues(definition, responses[sec]?.[idx] ?? {});
      return (
        <div key={field.id}>
          <Label className="text-sm">
            {field.label}
            <Badge variant="outline" className="ml-2 text-[9px]">
              Auto
            </Badge>
          </Label>
          <Input
            readOnly
            className="mt-1 bg-muted/40"
            value={String(computed[field.key] ?? "—")}
          />
        </div>
      );
    }

    if (field.type === "qc_status" || field.type === "dropdown") {
      const options = field.config.options ?? ["Pass", "Fail"];
      return (
        <div key={field.id}>
          <Label className="text-sm">
            {field.label}
            {field.required ? <span className="text-destructive"> *</span> : null}
          </Label>
          <Select
            disabled={readOnly}
            value={String(val ?? "")}
            onValueChange={(v) => void setValue(sec, idx, field, v)}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (field.type === "rca") {
      return (
        <div key={field.id}>
          <Label className="text-sm">
            {field.label}
            {field.required ? <span className="text-destructive"> *</span> : null}
          </Label>
          <Select
            disabled={readOnly}
            value={String(val ?? "")}
            onValueChange={(v) => void setValue(sec, idx, field, v)}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Select RCA…" />
            </SelectTrigger>
            <SelectContent>
              {RCA_OPTIONS.map((o) => (
                <SelectItem key={o.code} value={o.code}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (isImageField(field.type)) {
      const images = Array.isArray(val) ? val : val ? [String(val)] : [];
      const min = field.config.minImages ?? 1;
      const max = field.config.maxImages ?? 8;
      return (
        <div key={field.id}>
          <Label className="text-sm">
            {field.label}
            {field.required ? <span className="text-destructive"> *</span> : null}
          </Label>
          <p className="text-xs text-muted-foreground">
            {images.length} / {min} minimum · max {max}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {images.map((url, i) => (
              <img
                key={i}
                src={url}
                alt=""
                className="size-16 rounded-md border border-border object-cover"
              />
            ))}
            {!readOnly && images.length < max ? (
              <Button
                type="button"
                variant="outline"
                className="size-16"
                disabled={uploading}
                onClick={() => {
                  setUploadTarget({ sectionKey: sec, recordIndex: idx, field });
                  fileRef.current?.click();
                }}
              >
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
              </Button>
            ) : null}
          </div>
        </div>
      );
    }

    if (field.type === "long_text" || field.type === "notes" || field.type === "remarks") {
      return (
        <div key={field.id}>
          <Label className="text-sm">
            {field.label}
            {field.required ? <span className="text-destructive"> *</span> : null}
          </Label>
          <Textarea
            disabled={readOnly}
            className="mt-1"
            rows={3}
            value={String(val ?? "")}
            onChange={(e) => void setValue(sec, idx, field, e.target.value)}
          />
        </div>
      );
    }

    const inputType =
      field.type.includes("date") || field.type === "mfg_date" || field.type === "expiry_date"
        ? "date"
        : field.type.includes("qty") || field.type === "number"
          ? "number"
          : "text";

    return (
      <div key={field.id}>
        <Label className="text-sm">
          {field.label}
          {field.required ? <span className="text-destructive"> *</span> : null}
        </Label>
        <Input
          disabled={readOnly}
          type={inputType}
          className="mt-1"
          placeholder={field.config.placeholder}
          value={String(val ?? "")}
          onChange={(e) =>
            void setValue(
              sec,
              idx,
              field,
              inputType === "number" ? Number(e.target.value) : e.target.value,
            )
          }
        />
        {field.config.helpText ? (
          <p className="mt-0.5 text-[10px] text-muted-foreground">{field.config.helpText}</p>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">{templateName}</h2>
            <p className="text-sm text-muted-foreground">
              {storeName ? `Store: ${storeName}` : null}
              {dueAt ? ` · Due: ${new Date(dueAt).toLocaleString()}` : null}
            </p>
          </div>
          <Badge variant={completion.complete ? "secondary" : "outline"}>
            Completion: {completion.percent}%
          </Badge>
        </div>
        {!completion.complete ? (
          <ul className="mt-2 space-y-1 text-xs text-amber-700 dark:text-amber-400">
            {completion.missing.slice(0, 5).map((m) => (
              <li key={`${m.sectionKey}-${m.recordIndex}-${m.fieldKey}`}>Missing: {m.label}</li>
            ))}
            {completion.missing.length > 5 ? (
              <li>+ {completion.missing.length - 5} more</li>
            ) : null}
          </ul>
        ) : null}
      </div>

      {repeatableSection ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            SKU {activeRecord + 1} / {records.length}
          </Badge>
          {records.map((idx) => (
            <Button
              key={idx}
              type="button"
              size="sm"
              variant={idx === activeRecord ? "brand" : "outline"}
              onClick={() => setActiveRecord(idx)}
            >
              SKU {idx + 1}
            </Button>
          ))}
          {!readOnly ? (
            <Button type="button" size="sm" variant="outline" onClick={addSkuRecord}>
              <Plus className="mr-1 size-3" /> Add Another SKU
            </Button>
          ) : null}
        </div>
      ) : null}

      {definition.sections
        .sort((a, b) => a.order - b.order)
        .map((section) => {
          const idx = section.repeatable ? activeRecord : 0;
          const fields = definition.fields
            .filter((f) => f.section === section.key)
            .sort((a, b) => a.order - b.order);

          return (
            <section key={section.key} className="rounded-xl border border-border bg-card p-4">
              <h3 className="mb-4 font-semibold">{section.title}</h3>
              <div className="space-y-4">
                {fields.map((f) => renderField(f, section.key, idx))}
              </div>
            </section>
          );
        })}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImageUpload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
