import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AuditSubjectType } from "@/lib/audit-builder/types";
import {
  FIELD_ROLE_LABELS,
  type ColumnMapping,
  type FieldRole,
} from "@/lib/audit-builder/field-roles";
import { STANDARD_FIELD_OPTIONS } from "@/lib/audit-builder/input-schema";
import { AUDIT_DATA_TYPES, type AuditDataType } from "@/lib/audit-input-dataset";

type Props = {
  columnMappings: ColumnMapping[];
  subjectType: AuditSubjectType;
  onChange: (mappings: ColumnMapping[]) => void;
  onSubjectTypeChange: (subject: AuditSubjectType) => void;
};

const SUBJECT_OPTIONS: { value: AuditSubjectType; label: string }[] = [
  { value: "sku", label: "SKU" },
  { value: "product", label: "Product" },
  { value: "batch", label: "Batch" },
  { value: "shelf", label: "Shelf" },
  { value: "bin", label: "Bin" },
  { value: "unit", label: "Unit" },
  { value: "store", label: "Store" },
  { value: "outlet", label: "Outlet" },
  { value: "shipment", label: "Shipment" },
  { value: "custom", label: "Custom" },
];

export function ColumnConfigurationPanel({
  columnMappings,
  subjectType,
  onChange,
  onSubjectTypeChange,
}: Props) {
  const updateMapping = (columnId: string, patch: Partial<ColumnMapping>) => {
    onChange(
      columnMappings.map((m) => {
        if (m.columnId !== columnId) return m;
        const next = { ...m, ...patch };
        if (patch.fieldRole) {
          next.auditorFills =
            patch.auditorFills ??
            (patch.fieldRole === "auditor_input" || patch.fieldRole === "human_confirmed");
        }
        return next;
      }),
    );
  };

  return (
    <div className="space-y-4 rounded-xl border bg-muted/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Column configuration</p>
          <p className="text-sm text-muted-foreground">
            Assign each column a role. Reference fields are read-only for auditors; blank cells stay
            blank until execution.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Subject =</span>
          <Select value={subjectType} onValueChange={(v) => onSubjectTypeChange(v as AuditSubjectType)}>
            <SelectTrigger className="h-8 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUBJECT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Column</TableHead>
              <TableHead>Data Type</TableHead>
              <TableHead>Field Role</TableHead>
              <TableHead>Aislix Mapping</TableHead>
              <TableHead className="text-center">Auditor Fills?</TableHead>
              <TableHead className="text-center">Required?</TableHead>
              <TableHead className="text-center">Evidence?</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {columnMappings.map((mapping) => (
              <TableRow key={mapping.columnId}>
                <TableCell className="font-medium">{mapping.columnName}</TableCell>
                <TableCell>
                  <Select
                    value={mapping.dataType}
                    onValueChange={(v) => updateMapping(mapping.columnId, { dataType: v as AuditDataType })}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AUDIT_DATA_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select
                    value={mapping.fieldRole}
                    onValueChange={(v) => updateMapping(mapping.columnId, { fieldRole: v as FieldRole })}
                  >
                    <SelectTrigger className="h-8 min-w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.entries(FIELD_ROLE_LABELS) as [FieldRole, string][]).map(([role, label]) => (
                        <SelectItem key={role} value={role}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Select
                    value={String(mapping.aislixMapping)}
                    onValueChange={(v) =>
                      updateMapping(mapping.columnId, { aislixMapping: v === "custom" ? "custom" : v })
                    }
                  >
                    <SelectTrigger className="h-8 min-w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STANDARD_FIELD_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-center">
                  <Checkbox
                    checked={mapping.auditorFills}
                    disabled={
                      mapping.fieldRole === "calculated" ||
                      mapping.fieldRole === "system" ||
                      mapping.fieldRole === "reference"
                    }
                    onCheckedChange={(v) => updateMapping(mapping.columnId, { auditorFills: v === true })}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Checkbox
                    checked={mapping.required}
                    disabled={mapping.fieldRole === "calculated" || mapping.fieldRole === "system"}
                    onCheckedChange={(v) => updateMapping(mapping.columnId, { required: v === true })}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Checkbox
                    checked={mapping.evidenceRequired}
                    onCheckedChange={(v) =>
                      updateMapping(mapping.columnId, { evidenceRequired: v === true })
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary">
          {columnMappings.filter((m) => m.fieldRole === "reference").length} reference
        </Badge>
        <Badge variant="secondary">
          {columnMappings.filter((m) => m.auditorFills).length} auditor input
        </Badge>
        <Badge variant="secondary">
          {columnMappings.filter((m) => m.fieldRole === "calculated").length} calculated
        </Badge>
      </div>
    </div>
  );
}
