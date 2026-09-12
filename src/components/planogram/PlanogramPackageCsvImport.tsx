/**
 * Shared CSV import panel for planogram audit package sections
 * (assortment/MSL, prices, promotions).
 */

import { useRef, useState } from "react";
import { Download, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { fetchPackageCsvTemplate, parsePackageCsv } from "@/lib/planogram-audit-package";

export type PackageCsvKind = "assortment" | "prices" | "promotions";

export function PlanogramPackageCsvImport({
  label,
  kind,
  onImport,
  description,
  templateButtonLabel = "Template",
  uploadButtonLabel = "Upload CSV",
}: {
  label: string;
  kind: PackageCsvKind;
  onImport: (rows: unknown[]) => void;
  description?: string;
  templateButtonLabel?: string;
  uploadButtonLabel?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const download = async () => {
    const text = await fetchPackageCsvTemplate(kind);
    const blob = new Blob([text], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `planogram-${kind}-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = async (file: File) => {
    setBusy(true);
    setErrors([]);
    try {
      const content = await file.text();
      const result = await parsePackageCsv(kind, content);
      if (result.errors.length) {
        setErrors(result.errors.slice(0, 6));
        toast.error(`Could not import ${label}`, { description: result.errors[0] });
        return;
      }
      const data = result.rows.filter((r) => r.valid && r.data).map((r) => r.data);
      onImport(data);
      toast.success(`${label} imported`, { description: `${data.length} row(s) added.` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-brand/15 bg-brand-soft/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          {description ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg border-brand/20"
            onClick={() => void download()}
          >
            <Download className="mr-1.5 size-4" /> {templateButtonLabel}
          </Button>
          <Button
            type="button"
            variant="brand"
            size="sm"
            className="rounded-lg"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? (
              <Loader2 className="mr-1.5 size-4 animate-spin" />
            ) : (
              <Upload className="mr-1.5 size-4" />
            )}
            {uploadButtonLabel}
          </Button>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />
      {errors.length > 0 && (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription className="text-xs">{errors.join(" · ")}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
