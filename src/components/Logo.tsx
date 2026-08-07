import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import logoAsset from "@/assets/aislix-logo.png.asset.json";
import markAsset from "@/assets/aislix-mark.png.asset.json";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link
      to="/"
      aria-label="Aislix home"
      className={cn("group inline-flex items-center transition-opacity hover:opacity-80", className)}
    >
      <img
        src={compact ? markAsset.url : logoAsset.url}
        alt="Aislix"
        className={compact ? "h-8 w-auto" : "h-8 w-auto"}
      />
    </Link>
  );
}
