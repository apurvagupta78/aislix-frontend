import type { ReactNode } from "react";
import { CircleCheck } from "lucide-react";

type Props = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function SuccessState({ title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-status-good/25 bg-status-good-soft px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-card text-status-good-strong shadow-soft">
        <CircleCheck className="size-6" aria-hidden />
      </span>
      <p className="mt-4 text-base font-semibold text-foreground">{title}</p>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
