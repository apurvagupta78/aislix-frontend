import { useMemo, useState } from "react";

import {
  ASK_SUGGESTION_UI_GROUPS,
  ASK_SUGGESTION_UI_ITEMS,
  type AskSuggestionUiGroupId,
} from "@/lib/ask-aislix/ask-aislix-suggestion-groups";
import { cn } from "@/lib/utils";

export function AskAislixSuggestions({
  onSelect,
  disabled,
  variant: _variant = "light",
  roleHint: _roleHint,
  accessRole: _accessRole,
  city: _city,
  rotationSeed: _rotationSeed,
  dataAvailability: _dataAvailability,
}: {
  onSelect: (question: string) => void;
  disabled?: boolean;
  variant?: "light" | "dark";
  roleHint?: string | null;
  accessRole?: string | null;
  city?: string | null;
  rotationSeed?: number;
  dataAvailability?: unknown;
}) {
  void _variant;
  void _roleHint;
  void _accessRole;
  void _city;
  void _rotationSeed;
  void _dataAvailability;

  const [active, setActive] = useState<AskSuggestionUiGroupId>("Inventory");

  const items = useMemo(
    () => ASK_SUGGESTION_UI_ITEMS.filter((s) => s.category === active),
    [active],
  );

  return (
    <section aria-label="Suggested questions">
      <div
        role="tablist"
        aria-label="Suggestion categories"
        className="flex flex-wrap items-center gap-x-4 gap-y-1"
      >
        <span className="text-xs text-[#667085]">Try</span>
        {ASK_SUGGESTION_UI_GROUPS.map((group) => {
          const isActive = group === active;
          return (
            <button
              key={group}
              role="tab"
              type="button"
              aria-selected={isActive}
              disabled={disabled}
              onClick={() => setActive(group)}
              className={cn(
                "border-b-2 py-1 text-xs font-medium transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9E2E8]",
                "disabled:pointer-events-none disabled:opacity-50",
                isActive
                  ? "border-[#04203F] text-[#04203F]"
                  : "border-transparent text-[#667085] hover:text-[#04203F]",
              )}
            >
              {group}
            </button>
          );
        })}
      </div>

      <ul role="tabpanel" className="mt-2 flex flex-wrap gap-2">
        {items.map((suggestion) => (
          <li key={suggestion.id} className="max-w-full">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect(suggestion.text)}
              className={cn(
                "max-w-full rounded-full border border-[#D9E2E8] bg-white px-3 py-1.5 text-left text-[13px] text-[#04203F]",
                "transition-colors duration-150 hover:border-[#7DB7D6] hover:bg-[#F4F7F9]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9E2E8]",
                "disabled:pointer-events-none disabled:opacity-50",
              )}
            >
              {suggestion.text}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
