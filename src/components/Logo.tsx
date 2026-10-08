import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export const LOGO_SRC = "/brand/aislix-logo.svg";
export const LOGO_WHITE_SRC = "/brand/aislix-logo-white.svg";
export const MARK_SRC = "/brand/aislix-mark.svg";

export function Logo({
  className,
  compact = false,
  to = "/",
}: {
  className?: string;
  compact?: boolean;
  to?: string;
}) {
  return (
    <Link
      to={to}
      aria-label="Aislix home"
      className={cn("group inline-flex items-center transition-opacity hover:opacity-80", className)}
    >
      <img
        src={compact ? MARK_SRC : LOGO_SRC}
        alt="Aislix"
        className={compact ? "h-7 w-auto" : "h-7 w-auto"}
      />
    </Link>
  );
}
