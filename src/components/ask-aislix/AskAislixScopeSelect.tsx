import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";

import { ASK_AISLIX_SECTION } from "@/lib/aislix-theme";
import { cn } from "@/lib/utils";

export function AskAislixScopeSelect({
  icon: Icon,
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        className={cn(
          "flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-[13px] font-medium transition-colors",
          "hover:bg-[#EAF6FD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C1E4F8]",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
        style={{
          backgroundColor: ASK_AISLIX_SECTION.scopeBg,
          borderColor: ASK_AISLIX_SECTION.scopeBorder,
          color: ASK_AISLIX_SECTION.scopeText,
        }}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
        {value}
        <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
      </button>
      {open ? (
        <ul
          role="listbox"
          className="absolute bottom-full left-0 z-20 mb-2 w-48 origin-bottom-left rounded-xl border border-[#dde5ec] bg-white p-1 shadow-card"
        >
          {options.map((opt) => (
            <li key={opt}>
              <button
                type="button"
                role="option"
                aria-selected={opt === value}
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-[13px] text-[#0f2a44] transition-colors hover:bg-[#eef3f7]"
              >
                {opt}
                {opt === value ? (
                  <Check className="h-3.5 w-3.5 text-[#1f7ac2]" aria-hidden />
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
