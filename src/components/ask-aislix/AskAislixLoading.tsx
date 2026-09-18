import { Loader2 } from "lucide-react";

export function AskAislixLoading({ phase }: { phase?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-5 shadow-card">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
      <div>
        <p className="text-sm font-medium text-navy">Analyzing your audits...</p>
        {phase ? <p className="text-xs text-mp-muted">{phase}</p> : null}
      </div>
    </div>
  );
}
