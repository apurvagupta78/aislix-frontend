import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
  /** Short plain-English answer to "what should I do next?" */
  nextStep?: ReactNode;
};

/**
 * Consistent page header. Answers three questions at a glance:
 * where am I (eyebrow + title), what is happening (description), what next (actions/nextStep).
 */
export function PageHeader({ title, description, actions, eyebrow, nextStep }: Props) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-1">
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-brand">{eyebrow}</p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-[1.75rem]">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
        {nextStep ? (
          <p className="mt-2 inline-flex flex-wrap items-center gap-1.5 rounded-full bg-status-info-soft px-3 py-1 text-xs font-medium text-status-info-strong">
            {nextStep}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
