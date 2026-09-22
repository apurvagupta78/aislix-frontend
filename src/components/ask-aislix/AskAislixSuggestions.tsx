import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  Camera,
  ClipboardList,
  ImageIcon,
  LineChart,
  Package,
  RefreshCw,
  Store,
  TrendingUp,
} from "lucide-react";

import { selectAskAislixSuggestions } from "@/lib/ask-aislix/ask-aislix-suggestions.select";
import type { SuggestionIcon } from "@/lib/ask-aislix/ask-aislix-suggestions.types";
import { ASK_AISLIX_SECTION } from "@/lib/aislix-theme";
import { cn } from "@/lib/utils";

const ICONS: Record<SuggestionIcon, typeof Camera> = {
  image: ImageIcon,
  trend: LineChart,
  inventory: Package,
  expiry: AlertTriangle,
  findings: AlertTriangle,
  actions: ClipboardList,
  comparison: ArrowLeftRight,
  audit: ClipboardList,
  stores: Store,
  recurring: RefreshCw,
};

function SuggestionIconGlyph({ icon, isDark }: { icon: SuggestionIcon; isDark?: boolean }) {
  const Icon = ICONS[icon] ?? TrendingUp;
  return (
    <Icon
      className={cn("h-3 w-3 shrink-0", !isDark && "opacity-70")}
      style={isDark ? { color: ASK_AISLIX_SECTION.subtitle } : undefined}
      aria-hidden
    />
  );
}

export function AskAislixSuggestions({
  onSelect,
  disabled,
  variant = "light",
  roleHint,
  accessRole,
  city,
  rotationSeed,
}: {
  onSelect: (question: string) => void;
  disabled?: boolean;
  variant?: "light" | "dark";
  roleHint?: string | null;
  accessRole?: string | null;
  city?: string | null;
  rotationSeed?: number;
}) {
  const isDark = variant === "dark";

  const suggestions = useMemo(
    () =>
      selectAskAislixSuggestions({
        roleHint,
        accessRole,
        city,
        count: 7,
        rotationSeed,
      }),
    [roleHint, accessRole, city, rotationSeed],
  );

  if (suggestions.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap gap-1.5",
        "max-h-[4.5rem] overflow-x-auto overflow-y-hidden pb-0.5",
        "[scrollbar-width:thin]",
      )}
    >
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.id}
          type="button"
          disabled={disabled}
          className={cn(
            "inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-1",
            "text-[11px] font-medium leading-tight transition-colors",
            "disabled:pointer-events-none disabled:opacity-50",
            isDark ? "hover:brightness-110" : "border-line bg-white text-ink hover:bg-surface-muted",
          )}
          style={
            isDark
              ? {
                  backgroundColor: ASK_AISLIX_SECTION.chipBackground,
                  borderColor: ASK_AISLIX_SECTION.chipBorder,
                  color: ASK_AISLIX_SECTION.chipText,
                }
              : undefined
          }
          onClick={() => onSelect(suggestion.text)}
        >
          <SuggestionIconGlyph icon={suggestion.icon} isDark={isDark} />
          <span className="truncate">{suggestion.text}</span>
        </button>
      ))}
    </div>
  );
}
