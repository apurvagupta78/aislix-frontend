import type { ReactNode } from "react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  side?: "left" | "right";
  className?: string;
};

/** Side drawer for previews — same shell everywhere. */
export function PreviewDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  side = "right",
  className,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className={cn("w-full overflow-y-auto sm:max-w-lg", className)}
      >
        <SheetHeader>
          <SheetTitle className="font-display text-[var(--aislix-primary)]">{title}</SheetTitle>
          {description ? (
            <SheetDescription className="text-[var(--aislix-secondary)]">{description}</SheetDescription>
          ) : null}
        </SheetHeader>
        <div className="mt-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
