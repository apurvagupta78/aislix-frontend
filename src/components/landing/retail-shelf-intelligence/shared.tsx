import type { ReactNode } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trackLandingEvent, type LandingEvent } from "@/lib/landing-analytics";
import { signupUrl } from "@/lib/landing-scan-api";

/** Primary conversion CTA: always routes to /signup with UTMs + session id. */
export function SignupCta({
  children = "Start scanning free →",
  event = "cta_click",
  location,
  className,
  size = "lg",
}: {
  children?: ReactNode;
  event?: LandingEvent;
  location: string;
  className?: string;
  size?: ButtonProps["size"];
}) {
  return (
    <Button
      asChild
      variant="default"
      size={size}
      className={cn(className)}
      onClick={() => {
        trackLandingEvent(event, { location });
        trackLandingEvent("signup_started", { location });
      }}
    >
      <a href={signupUrl()}>{children}</a>
    </Button>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  className,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto max-w-2xl text-center", className)}>
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">{eyebrow}</p>
      )}
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h2>
      {subtitle && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
