import { Package, ShoppingCart, Sparkles, Store, Truck, Warehouse } from "lucide-react";

import { OptionCard } from "@/components/design-system";
import type { SemanticTone } from "@/lib/design-system";
import type { OperatingModel } from "@/lib/audit-builder/types";
import { OPERATING_MODEL_CARDS } from "@/lib/audit-engine/operating-model-catalog";

const MODEL_META: Record<
  OperatingModel,
  { icon: typeof Store; tone: SemanticTone }
> = {
  local_store: { icon: Store, tone: "info" },
  supermarket: { icon: ShoppingCart, tone: "success" },
  dark_store: { icon: Package, tone: "warning" },
  warehouse: { icon: Warehouse, tone: "ai" },
  fmcg_distributor: { icon: Truck, tone: "info" },
  custom: { icon: Sparkles, tone: "neutral" },
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
          const meta = MODEL_META[card.id];
          const Icon = meta.icon;
          return (
            <OptionCard
              key={card.id}
              title={card.title}
              description={card.description}
              icon={Icon}
              tone={meta.tone}
              selected={value === card.id}
              onClick={() => onChange(card.id)}
            />
          );
        })}
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </section>
  );
}
