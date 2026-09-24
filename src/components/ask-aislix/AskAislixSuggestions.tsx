import { useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";

import {
  ASK_SUGGESTION_UI_GROUPS,
  ASK_SUGGESTION_UI_ICONS,
  ASK_SUGGESTION_UI_ITEMS,
  ASK_SUGGESTION_UI_TINTS,
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
  const tint = ASK_SUGGESTION_UI_TINTS[active];

  return (
    <section aria-labelledby="ask-suggestions-heading" className="mt-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3
          id="ask-suggestions-heading"
          className="text-[15px] font-semibold text-[#0f2a44]"
        >
          Try asking about
        </h3>
        <div
          role="tablist"
          aria-label="Suggestion categories"
          className="flex flex-wrap gap-1.5"
        >
          {ASK_SUGGESTION_UI_GROUPS.map((group) => {
            const isActive = group === active;
            const groupTint = ASK_SUGGESTION_UI_TINTS[group];
            return (
              <button
                key={group}
                role="tab"
                type="button"
                aria-selected={isActive}
                disabled={disabled}
                onClick={() => setActive(group)}
                className={cn(
                  "rounded-full border px-3.5 py-1 text-[13px] font-medium transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C1E4F8]",
                  "disabled:pointer-events-none disabled:opacity-50",
                  !isActive &&
                    "border-[#D9E2E8] bg-white text-[#667085] hover:text-[#102A43]",
                )}
                style={
                  isActive
                    ? {
                        backgroundColor: groupTint.tabBg,
                        borderColor: groupTint.tabBorder,
                        color: groupTint.tabText,
                      }
                    : undefined
                }
              >
                {group}
              </button>
            );
          })}
        </div>
      </div>

      <ul role="tabpanel" className="mt-3 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {items.map((suggestion) => {
          const Icon = ASK_SUGGESTION_UI_ICONS[suggestion.icon];
          return (
            <li key={suggestion.id} className="flex">
              <button
                type="button"
                disabled={disabled}
                onClick={() => onSelect(suggestion.text)}
                className={cn(
                  "group flex w-full flex-col gap-3 rounded-2xl border p-4 text-left",
                  "transition-[border-color,transform,box-shadow] duration-150",
                  "hover:-translate-y-0.5 hover:shadow-[0_1px_2px_rgba(15,42,68,0.08)]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C1E4F8]",
                  "disabled:pointer-events-none disabled:opacity-50",
                )}
                style={{
                  backgroundColor: tint.cardBg,
                  borderColor: tint.cardBorder,
                }}
              >
                <span className="flex w-full items-center justify-between">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-[0_1px_2px_rgba(15,42,68,0.08)]"
                    style={{ color: tint.ink }}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <ArrowUpRight
                    className="h-4 w-4 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                    style={{ color: tint.ink }}
                    aria-hidden
                  />
                </span>
                <span className="text-[14px] font-medium leading-snug text-[#0f2a44]">
                  {suggestion.text}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
