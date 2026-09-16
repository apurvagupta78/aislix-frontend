import { Check, Package, Sparkles, Store, Truck, Warehouse, ShoppingCart } from "lucide-react";

import { cn } from "@/lib/utils";
import type { OperatingModel } from "@/lib/audit-builder/types";
import { OPERATING_MODEL_CARDS } from "@/lib/audit-engine/operating-model-catalog";

const MODEL_VISUAL: Record<
  OperatingModel,
  { icon: typeof Store; card: string; selected: string }
> = {
  local_store: {
    icon: Store,
    card: "border-sky-200 bg-sky-50/80 hover:border-sky-300",
    selected: "border-sky-500 bg-sky-50 ring-2 ring-sky-200",
  },
  supermarket: {
    icon: ShoppingCart,
    card: "border-emerald-200 bg-emerald-50/80 hover:border-emerald-300",
    selected: "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200",
  },
  dark_store: {
    icon: Package,
    card: "border-orange-200 bg-orange-50/80 hover:border-orange-300",
    selected: "border-orange-500 bg-orange-50 ring-2 ring-orange-200",
  },
  warehouse: {
    icon: Warehouse,
    card: "border-violet-200 bg-violet-50/80 hover:border-violet-300",
    selected: "border-violet-500 bg-violet-50 ring-2 ring-violet-200",
  },
  fmcg_distributor: {
    icon: Truck,
    card: "border-teal-200 bg-teal-50/80 hover:border-teal-300",
    selected: "border-teal-500 bg-teal-50 ring-2 ring-teal-200",
  },
  custom: {
    icon: Sparkles,
    card: "border-slate-200 bg-slate-50/80 hover:border-slate-300",
    selected: "border-slate-500 bg-slate-50 ring-2 ring-slate-200",
  },
};

type Props = {
  value: OperatingModel;
  onChange: (model: OperatingModel) => void;
  error?: string | null;
};

export function OperatingModelCards({ value, onChange, error }: Props) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">What are you auditing?</h2>
        <p className="text-sm text-muted-foreground">
          Choose the type of operation you want to audit.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {OPERATING_MODEL_CARDS.map((card) => {
          const visual = MODEL_VISUAL[card.id];
          const Icon = visual.icon;
          const selected = value === card.id;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onChange(card.id)}
              className={cn(
                "relative rounded-2xl border p-4 text-left transition-all",
                selected ? visual.selected : visual.card,
              )}
            >
              {selected ? (
                <span className="absolute right-3 top-3 flex size-6 items-center justify-center rounded-full bg-brand text-brand-foreground">
                  <Check className="size-3.5" />
                </span>
              ) : null}
              <Icon className="mb-3 size-6 text-foreground/80" />
              <p className="font-semibold">{card.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {card.description}
              </p>
            </button>
          );
        })}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
