import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function MpCard({
  className,
  children,
  as: Tag = "div",
}: {
  className?: string;
  children: ReactNode;
  as?: "div" | "section" | "article";
}) {
  return (
    <Tag className={cn("rounded-xl border border-line bg-white shadow-card", className)}>{children}</Tag>
  );
}

export function MpCardHeader({
  title,
  description,
  action,
  className,
  headingLevel: Heading = "h3",
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  headingLevel?: "h2" | "h3";
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4",
        className,
      )}
    >
      <div className="min-w-0">
        <Heading className="font-display text-[15px] font-semibold leading-tight text-navy">{title}</Heading>
        {description ? <p className="mt-1 text-[13px] text-mp-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
