import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function EvidencePlaceholder({ label }: { label: string }) {
  return (
    <div className="flex aspect-[4/3] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 text-muted-foreground">
      <ImageOff className="size-8 opacity-50" aria-hidden />
      <p className="mt-2 text-xs">{label}</p>
    </div>
  );
}

export function BeforeAfterEvidence({
  beforeUrl,
  afterUrl,
  beforeLabel = "Original shelf evidence",
  afterLabel = "Resolution evidence",
  beforeCaption,
  afterCaption,
  className,
}: {
  beforeUrl?: string | null;
  afterUrl?: string | null;
  beforeLabel?: string;
  afterLabel?: string;
  beforeCaption?: string;
  afterCaption?: string;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2", className)}>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          What was found?
        </p>
        <p className="mb-2 text-sm font-medium">{beforeLabel}</p>
        {beforeUrl ? (
          <img src={beforeUrl} alt={beforeLabel} className="w-full rounded-xl border border-border object-cover" />
        ) : (
          <EvidencePlaceholder label="No original evidence" />
        )}
        {beforeCaption ? <p className="mt-2 text-xs text-muted-foreground">{beforeCaption}</p> : null}
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          What was fixed?
        </p>
        <p className="mb-2 text-sm font-medium">{afterLabel}</p>
        {afterUrl ? (
          <img src={afterUrl} alt={afterLabel} className="w-full rounded-xl border border-border object-cover" />
        ) : (
          <EvidencePlaceholder label="No resolution evidence yet" />
        )}
        {afterCaption ? <p className="mt-2 text-xs text-muted-foreground">{afterCaption}</p> : null}
      </div>
    </div>
  );
}
