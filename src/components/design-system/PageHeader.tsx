import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Accepted for compatibility; not rendered (the sidebar already shows where you are). */
  eyebrow?: string;
  /** Status pills, filter summary, etc. */
  meta?: ReactNode;
  /** Accepted for compatibility; not rendered. */
  nextStep?: ReactNode;
};

/** Consistent page header: title, one line of context, actions on the right. */
export function PageHeader({ title, description, actions, meta }: Props) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 flex-1 basis-[18rem]">
        <h1 className="text-2xl font-semibold leading-tight text-navy md:text-[28px]">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm text-mp-muted">{description}</p> : null}
        {meta ? <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
