import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-6 text-sm text-muted-foreground">{footer}</div>
        </div>
        <p className="text-xs text-muted-foreground">
          © 2026 Aislix ·{" "}
          <Link to="/" className="hover:text-foreground">
            Back to home
          </Link>
        </p>
      </div>

      <div className="relative hidden overflow-hidden border-l border-border bg-surface lg:block">
        <div className="absolute inset-0 grid-lines opacity-50" />
        <div className="absolute inset-0 bg-hero-glow" />
        <div className="relative flex h-full flex-col justify-center px-14">
          <p className="text-xs font-medium uppercase tracking-widest text-brand">
            Retail shelf intelligence
          </p>
          <p className="mt-4 max-w-md text-2xl font-semibold leading-snug tracking-tight">
            “Aislix cut our shelf audit cycle from three days to twenty minutes across 42 stores.”
          </p>
          <p className="mt-5 text-sm text-muted-foreground">
            Meera Iyer · Head of Retail Ops, MoreMart
          </p>
          <div className="mt-12 grid max-w-md grid-cols-3 gap-3">
            {[
              { l: "Audits run", v: "1.2M+" },
              { l: "Avg. accuracy", v: "94.6%" },
              { l: "Audit time saved", v: "90%" },
            ].map((k) => (
              <div key={k.l} className="rounded-2xl border border-border bg-card p-4">
                <p className="text-lg font-semibold tracking-tight">{k.v}</p>
                <p className="mt-1 text-xs text-muted-foreground">{k.l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
