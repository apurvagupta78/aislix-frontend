import { useState } from "react";
import { Monitor, Smartphone } from "lucide-react";

import { AuditExecutionForm } from "@/components/audit-builder/AuditExecutionForm";
import { Button } from "@/components/ui/button";
import type { TemplateDefinition } from "@/lib/audit-builder/types";
import type { ResponseMap } from "@/lib/custom-audit";

type Props = {
  templateName: string;
  definition: TemplateDefinition;
};

const SAMPLE_RESPONSES: ResponseMap = {
  store_info: {
    0: {
      store: "Store #102",
      auditor: "hello@aislix.com",
      audit_date: new Date().toISOString().slice(0, 10),
    },
  },
  product: {
    0: {
      sku_id: "SKU-MAGGI-70",
      item_code: "MAG70",
      item_name: "MAGGI 70g",
      category: "Noodles",
      batch_number: "BATCH-4421",
      expected_qty: 4,
      actual_qty: 4,
      mfg_date: "2026-01-15",
      expiry_date: "2026-10-15",
      qc_status: "Pass",
    },
  },
};

export function EmployeePreviewForm({ templateName, definition }: Props) {
  const [view, setView] = useState<"desktop" | "mobile">("mobile");
  const [role, setRole] = useState<"employee" | "manager">("employee");
  const [responses, setResponses] = useState<ResponseMap>(SAMPLE_RESPONSES);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
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
      <div className={`mx-auto ${view === "mobile" ? "max-w-lg" : "max-w-3xl"}`}>
        <AuditExecutionForm
          definition={definition}
          templateName={templateName}
          storeName="Store #102"
          dueAt={new Date().toISOString()}
          responses={responses}
          onChange={setResponses}
          onSaveField={async () => {}}
          onUploadImage={async () => "https://placehold.co/120x120?text=Photo"}
          readOnly={role === "manager"}
          previewMode
        />
      </div>
    </div>
  );
}
