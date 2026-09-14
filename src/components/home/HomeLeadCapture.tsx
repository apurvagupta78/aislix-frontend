import { useEffect, useRef, useState } from "react";
import { ArrowRight, Loader2, Mail, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trackLandingEvent } from "@/lib/landing-analytics";
import { captureLandingLead, loadLandingSessionId, signupUrl } from "@/lib/landing-scan-api";
import { trackWorkspaceSignupConversion } from "@/lib/linkedin-conversion";

export function HomeLeadCapture() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [successSignupUrl, setSuccessSignupUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const conversionTracked = useRef(false);

  useEffect(() => {
    if (!done || conversionTracked.current) return;
    conversionTracked.current = true;
    trackWorkspaceSignupConversion();
  }, [done]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    setError(null);

    try {
      const sessionId = loadLandingSessionId();
      const data = await captureLandingLead({
        landing_session_id: sessionId ?? undefined,
        email: email.trim(),
        name: name.trim() || undefined,
        company: company.trim() || undefined,
        role: role.trim() || undefined,
      });
      const resolvedSignupUrl = data.signup_url || signupUrl({ email: email.trim() });
      setSuccessSignupUrl(resolvedSignupUrl);

      let managedEmailSent = false;
      try {
        const response = await fetch("/api/send-landing-onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            name: name.trim() || undefined,
            signup_url: resolvedSignupUrl,
          }),
        });
        const body = (await response.json().catch(() => ({}))) as { ok?: boolean };
        managedEmailSent = response.ok && Boolean(body.ok);
      } catch {
        /* Email is best-effort; the saved lead can still continue to signup. */
      }

      trackLandingEvent("landing_lead_captured", { has_session: Boolean(sessionId) });
      setEmailSent(Boolean(data.email_sent) || managedEmailSent);
      setDone(true);
    } catch (submitError) {
      setError((submitError as Error).message || "Could not save your details.");
    } finally {
      setSaving(false);
    }
  }

  const ctaHref = successSignupUrl ?? signupUrl({ email: email.trim() || undefined });

  return (
    <section id="lead" className="scroll-mt-20 border-b border-border bg-background py-16 sm:py-20">
      <div className="mx-auto max-w-5xl px-5 sm:px-8">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-lift sm:p-10">
          {done ? (
            <div className="text-center">
              <span className="mx-auto grid size-11 place-items-center rounded-full bg-secondary text-primary">
                {emailSent ? <Mail className="size-6" /> : <UserPlus className="size-6" />}
              </span>
              <h2 className="mt-4 text-2xl font-semibold text-foreground">
                {emailSent ? "Check your email" : "Create your account now"}
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
                {emailSent
                  ? `We sent onboarding instructions to ${email}. You can also create your account directly below.`
                  : "Your details are saved. Create your free Aislix workspace to unlock 3 shelf audits."}
              </p>
              <Button
                size="xl"
                className="mt-6 w-full sm:w-auto"
                onClick={() => {
                  trackLandingEvent("signup_started", { location: "homepage_lead_success" });
                  window.location.assign(ctaHref);
                }}
              >
                Create free account <ArrowRight className="size-4" />
              </Button>
            </div>
          ) : (
            <form onSubmit={submit}>
              <div className="text-center">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                  START FREE
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-foreground sm:text-3xl">
                  Start Turning Shelf Visits Into Retail Intelligence.
                </h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  Create your free Aislix workspace and start analysing shelves. No credit card
                  required.
                </p>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="home-email">Work email *</Label>
                  <Input
                    id="home-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@company.com"
                    className="min-h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="home-name">Full name</Label>
                  <Input
                    id="home-name"
                    autoComplete="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    className="min-h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="home-company">Company</Label>
                  <Input
                    id="home-company"
                    autoComplete="organization"
                    value={company}
                    onChange={(event) => setCompany(event.target.value)}
                    className="min-h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="home-role">Role</Label>
                  <Input
                    id="home-role"
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                    placeholder="Retail operations, field sales…"
                    className="min-h-11"
                  />
                </div>
              </div>

              {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

              <div className="mt-7 flex flex-col items-center gap-3">
                <Button type="submit" size="xl" className="w-full" disabled={saving}>
                  {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                  Create My Free Workspace <ArrowRight className="size-4" />
                </Button>
                <p className="text-xs text-muted-foreground">
                  No credit card required. Your workspace keeps your audits, results and shelf history
                  in one place.
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}