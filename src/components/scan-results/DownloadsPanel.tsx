import { FileSpreadsheet, FileText, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/States";
import { ResultSection } from "@/components/scan-results/ResultParts";
import { PrintReportButton } from "@/components/scan-results/ResultHeader";
import { GENERIC_EXPORT, networkErrorMessage } from "@/lib/api-errors";
import {
  buildFullScanReportExcel,
  downloadBlob,
  downloadBlobBytes,
  downloadScanAnnotatedImage,
  downloadScanExcel,
  downloadScanPdf,
  type ScanResult,
} from "@/lib/scan-results";

export function DownloadsPanel({
  data,
  loading,
}: {
  data?: ScanResult | undefined;
  loading?: boolean | undefined;
}) {
  const imageUrl = data?.downloads?.annotated_image_url ?? data?.annotated_image_url;

  const downloadExcel = async () => {
    if (!data) return;
    if (data.summary || data.inventory?.length) {
      downloadBlobBytes(
        buildFullScanReportExcel(data),
        `aislix-${data.scan_id || "scan"}-report.xlsx`,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      toast.success("Excel report downloaded");
      return;
    }
    if (data.scan_id) {
      try {
        await downloadScanExcel(data.scan_id, data.downloads?.csv_url);
        toast.success("Excel report downloaded");
      } catch {
        toast.error("This scan has no report data to export.");
      }
    }
  };

  const downloadImage = async () => {
    if (!data?.scan_id) return;
    try {
      await downloadScanAnnotatedImage(data.scan_id, imageUrl, data.original_image_url);
      toast.success("Annotated image downloaded");
    } catch (e) {
      toast.error(networkErrorMessage(e, GENERIC_EXPORT));
    }
  };

  const downloadPdf = async () => {
    if (!data?.scan_id) return;
    try {
      await downloadScanPdf(data.scan_id, data.downloads?.pdf_url);
      toast.success("PDF report downloaded");
    } catch (e) {
      toast.error(networkErrorMessage(e, GENERIC_EXPORT));
    }
  };

  return (
    <ResultSection title="Downloads" description="Export this scan for sharing or analysis.">
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Button
            variant="brand"
            size="lg"
            className="w-full rounded-xl"
            disabled={!data?.scan_id}
            onClick={() => void downloadPdf()}
          >
            <FileText className="size-4" /> PDF report
          </Button>

          <Button
            variant="subtle"
            size="lg"
            className="w-full rounded-xl"
            onClick={() => void downloadExcel()}
            disabled={!data}
          >
            <FileSpreadsheet className="size-4" /> Excel report
          </Button>

          <Button
            variant="subtle"
            size="lg"
            className="w-full rounded-xl"
            disabled={!data?.scan_id}
            onClick={() => void downloadImage()}
          >
            <ImageIcon className="size-4" /> Annotated image
          </Button>

          <PrintReportButton disabled={!data} />
        </div>
      )}
      {!loading && !data?.downloads?.pdf_url && (
        <p className="mt-3 text-xs text-muted-foreground">
          PDF reports become available once the Aislix reporting service returns a document URL for
          this scan.
        </p>
      )}
    </ResultSection>
  );
}
