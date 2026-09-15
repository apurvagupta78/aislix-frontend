import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export function WorkspaceLinkCard({
  title,
  description,
  to,
  icon,
  badge,
}: {
  title: string;
  description: string;
  to: string;
  icon: ReactNode;
  badge?: string;
}) {
  return (
    <Link
      to={to}
      className="group card-surface card-hover flex min-h-36 flex-col justify-between p-5"
    >
      <div>
        <div className="mb-4 flex items-center justify-between">
          <span className="grid size-9 place-items-center rounded-xl bg-brand-soft text-brand">
            {icon}
          </span>
          {badge ? (
            <span className="rounded-full bg-muted px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
              {badge}
            </span>
          ) : null}
        </div>
        <h3 className="font-semibold">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <span className="mt-4 flex items-center gap-1 text-xs font-semibold text-brand">
        Open <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" />
      </span>
    </Link>
  );
}
