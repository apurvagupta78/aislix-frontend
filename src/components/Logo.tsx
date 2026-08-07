import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link to="/" className={cn("group inline-flex items-center gap-2.5", className)}>
      <span className="grid size-8 place-items-center rounded-xl bg-gradient-brand shadow-soft transition-transform duration-200 group-hover:scale-105">
        <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
          <path d="M4 6h16M4 12h16" stroke="currentColor" className="text-brand-foreground" strokeWidth="2.2" strokeLinecap="round" />
          <path d="M4 18h10" stroke="currentColor" className="text-accent-green" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </span>

      {!compact && (
        <span className="text-[1.05rem] font-semibold tracking-tight text-foreground">Aislix</span>
      )}
    </Link>
  );
}
