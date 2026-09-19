import { autoPopulateAuditPackage } from "@/lib/planogram-audit-package";
import { runScanAnalysis, submitScanImages } from "@/lib/scan-api";
import { fetchScanResult, type ScanResult } from "@/lib/scan-results";
import {
  runLandingUpload,
  type LandingScanContext,
  type LandingScanResult,
} from "@/lib/landing-scan-api";
import type { CategorySelection } from "@/lib/category-selections";
import { buildAstraVisionExtras } from "@/lib/ai-audit/astra-analysis";
import { adhocPlanogramPayload } from "@/lib/role-planogram-requirements";
import type { ScanContextState } from "@/lib/scan-context";

export type AuthenticatedAiScanInput = {
  files: File[];
  assignmentId: string;
  storeId?: string;
  scanContext: ScanContextState;
  category?: string;
  subCategory?: string;
  subCategoryLabel?: string;
  notes?: string;
  onUploadProgress?: (percent: number) => void;
};

export type LandingAiScanInput = {
  file: File;
  context?: LandingScanContext;
  landingSessionId?: string;
};

function buildScanSubmitOptions(input: AuthenticatedAiScanInput) {
  const ctx = input.scanContext;
  const category =
    input.category ?? ctx.planogramMeta?.category?.trim() ?? undefined;
  const subCategory =
    input.subCategory ?? ctx.planogramMeta?.sub_category?.trim() ?? undefined;
  const subCategoryLabel = input.subCategoryLabel ?? subCategory;
  const auditRole = ctx.auditRole ?? "supermarket";

  const categorySelections: CategorySelection[] =
    category && subCategory
      ? [
          {
            category_id: category.toLowerCase().replace(/\s+/g, "-"),
            category_name: category,
            sub_category_id: subCategory,
            sub_category_label: subCategoryLabel ?? subCategory,
          },
        ]
      : [];

  const auditPackage = autoPopulateAuditPackage(
    ctx.planogramRows,
    ctx.auditPackage ?? {},
  );
  const astraExtras = buildAstraVisionExtras({
    auditRole,
    planogramRows: ctx.planogramRows,
    location: ctx.planogramMeta?.fixture_id ?? ctx.planogramMeta?.store_outlet,
    category,
    subCategory,
    notes: input.notes,
  });
  const planogramPayload =
    ctx.planogramRows.length > 0
      ? adhocPlanogramPayload(ctx.planogramRows, auditRole, auditPackage, {
          analysisMode: astraExtras.analysis_mode,
        })
      : astraExtras.analysis_mode === "shelf_only"
        ? adhocPlanogramPayload([], auditRole, auditPackage, {
            analysisMode: astraExtras.analysis_mode,
          })
        : undefined;

  return {
    assignmentId: input.assignmentId,
    storeId: input.storeId,
    category,
    subCategory,
    subCategoryLabel,
    categorySelections,
    notes: input.notes,
    auditRole,
    planogramPayload,
    onUploadProgress: input.onUploadProgress,
  };
}

/** Upload shelf photos and create the scan record — analysis runs on /processing. */
export async function submitAuthenticatedAiAuditScan(
  input: AuthenticatedAiScanInput,
): Promise<{ scan_id: string; assignment_id: string }> {
  const response = await submitScanImages(input.files, buildScanSubmitOptions(input));
  return { scan_id: response.scan_id, assignment_id: input.assignmentId };
}

export function openScanProcessingTab(scanId: string): void {
  if (typeof window === "undefined") return;
  const url = `${window.location.origin}/processing?scan=${encodeURIComponent(scanId)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export async function runAuthenticatedAiAuditScan(
  input: AuthenticatedAiScanInput,
): Promise<ScanResult> {
  const { scan_id } = await submitAuthenticatedAiAuditScan(input);
  await runScanAnalysis(scan_id);
  const result = await fetchScanResult(scan_id);
  if (!result) throw new Error("Could not load audit results.");
  return result;
}

export async function runLandingAiAuditScan(
  input: LandingAiScanInput,
): Promise<LandingScanResult> {
  return runLandingUpload(input.file, input.landingSessionId, input.context);
}
