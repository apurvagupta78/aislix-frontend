import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
  /** Status pills, filter summary, etc. — Magic Patterns meta row */
  meta?: ReactNode;
  /** Short plain-English answer to "what should I do next?" */
  nextStep?: ReactNode;
};

/**
 * Consistent page header. Answers three questions at a glance:
 * where am I (eyebrow + title), what is happening (description), what next (actions/nextStep).
 */
export function PageHeader({ title, description, actions, eyebrow, meta, nextStep }: Props) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-mp-muted">{eyebrow}</p>
        ) : null}
        <h1 className="mt-1.5 font-display text-[26px] font-semibold leading-tight tracking-tight text-navy md:text-[30px]">
          {title}
        </h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm text-mp-muted">{description}</p> : null}
        {meta ? <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div> : null}
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
