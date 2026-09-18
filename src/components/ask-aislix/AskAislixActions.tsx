import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import type { AskAislixResponse } from "@/lib/ask-aislix/ask-aislix.types";

export function AskAislixActions({ actions }: { actions: AskAislixResponse["actions"] }) {
  if (!actions?.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button key={`${action.route}-${action.label}`} variant="outline" size="sm" asChild>
          <Link to={action.route} search={action.params}>
            {action.label}
          </Link>
        </Button>
      ))}
    </div>
  );
}
