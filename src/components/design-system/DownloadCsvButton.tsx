import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
  loading?: boolean;
};

/** Standard CSV export action — same look everywhere. */
export function DownloadCsvButton({
  onClick,
  disabled,
  label = "Download CSV",
  loading,
}: Props) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="rounded-xl"
      disabled={disabled || loading}
      onClick={onClick}
    >
      <Download className="size-3.5" />
      {loading ? "Exporting…" : label}
    </Button>
  );
}
