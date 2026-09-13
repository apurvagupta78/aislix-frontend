import { useState } from "react";
import { ArrowRight, Loader2, Mail, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trackLandingEvent } from "@/lib/landing-analytics";
import { captureLandingLead, loadLandingSessionId, signupUrl } from "@/lib/landing-scan-api";

export function WideLeadCapture({ landingSessionId }: { landingSessionId: string | null }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [successSignupUrl, setSuccessSignupUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    setError(null);
    const sessionId = landingSessionId ?? loadLandingSessionId();
    try {
      const data = await captureLandingLead({
        landing_session_id: sessionId ?? undefined,
        email: email.trim(),
        name: name.trim() || undefined,
        company: company.trim() || undefined,
        role: role.trim() || undefined,
      });
      trackLandingEvent("landing_lead_captured", { has_session: Boolean(sessionId) });
      const resolvedSignupUrl = data.signup_url || signupUrl({ email: email.trim() });
      setSuccessSignupUrl(resolvedSignupUrl);
      // Always attempt the onboarding email through our server route; the
      // backend may also have sent one (data.email_sent).
      let routeSent = false;
      try {
        const res = await fetch("/api/send-landing-onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            name: name.trim() || undefined,
            signup_url: resolvedSignupUrl,
          }),
        });
        const body = (await res.json().catch(() => ({}))) as { ok?: boolean };
        routeSent = res.ok && Boolean(body.ok);
      } catch {
        /* onboarding email is best-effort */
      }
      setEmailSent(Boolean(data.email_sent) || routeSent);
      setDone(true);
    } catch (err) {
      setError((err as Error).message || "Could not save your details.");
    } finally {
      setSaving(false);
    }
  }

  const ctaHref = successSignupUrl ?? signupUrl({ email: email.trim() || undefined });

  return (
    <section id="lead" className="scroll-mt-16 bg-surface py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-lift sm:p-10">
          {done ? (
            <div className="text-center">
              <span className="mx-auto grid size-11 place-items-center rounded-full bg-secondary text-primary">
                {emailSent ? <Mail className="size-6" /> : <UserPlus className="size-6" />}
              </span>
              {emailSent ? (
                <>
                  <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
                    Check your email
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    We sent onboarding instructions to {email}. Open the email and click the link to
                    create your free Aislix workspace and unlock 3 shelf audits.
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Didn&apos;t receive it? Check spam or wait a minute — or create your account
                    directly below.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
                    Create your account now
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Your details are saved. Create your free Aislix workspace to unlock 3 shelf
                    audits.
                  </p>
                </>
              )}
              <Button
                size="xl"
                variant="default"
                className="mt-6 min-h-11 w-full sm:w-auto"
                onClick={() => {
                  trackLandingEvent("signup_started", { location: "lead_success" });
                  window.location.assign(ctaHref);
                }}
              >
                Create free account <ArrowRight className="size-4" />
              </Button>
            </div>
          ) : (
            <form onSubmit={submit}>
              <div className="text-center">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  Get Your Free Shelf Intelligence Access
                </h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  Enter your work email to start auditing. No credit card required.
                </p>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="rsi-email">Work email *</Label>
                  <Input
                    id="rsi-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="min-h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rsi-name">Full name</Label>
                  <Input
                    id="rsi-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="min-h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rsi-company">Company</Label>
                  <Input
                    id="rsi-company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className="min-h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rsi-role">Role</Label>
                  <Input
                    id="rsi-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="Retail ops, brand, field sales…"
                    className="min-h-11"
                  />
                </div>
              </div>

              {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

              <div className="mt-7 flex flex-col items-center gap-3">
                <Button
                  type="submit"
                  size="xl"
                  variant="default"
                  className="min-h-11 w-full"
                  disabled={saving}
                >
                  {saving ? <Loader2 className="size-4 animate-spin" /> : null}
                  Get more free audits
                </Button>
                <p className="text-xs text-muted-foreground">
                  We only use your email to set up your Aislix workspace.
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
