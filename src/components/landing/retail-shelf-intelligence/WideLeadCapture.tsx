import { useState } from "react";
import { ArrowRight, Loader2, Mail } from "lucide-react";
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
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setSaving(true);
    setError(null);
    const sessionId = landingSessionId ?? loadLandingSessionId();
    try {
      await captureLandingLead({
        landing_session_id: sessionId ?? undefined,
        email: email.trim(),
        name: name.trim() || undefined,
        company: company.trim() || undefined,
        role: role.trim() || undefined,
      });
      trackLandingEvent("landing_lead_captured", { has_session: Boolean(sessionId) });
      setDone(true);
    } catch (err) {
      setError((err as Error).message || "Could not save your details.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section id="lead" className="scroll-mt-16 bg-surface py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-lift sm:p-10">
          {done ? (
            <div className="text-center">
              <span className="mx-auto grid size-11 place-items-center rounded-full bg-secondary text-primary">
                <Mail className="size-6" />
              </span>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
                Check your email
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                We sent onboarding instructions to {email}. Open the email and click the link to
                create your free Aislix workspace and unlock 3 shelf scans.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Didn&apos;t receive it? Check spam or wait a minute.
              </p>
              <Button
                size="xl"
                variant="link"
                className="mt-6 min-h-11 w-full sm:w-auto"
                onClick={() => {
                  trackLandingEvent("signup_started", { location: "lead_success" });
                  window.location.assign(signupUrl({ email }));
                }}
              >
                Continue to signup <ArrowRight className="size-4" />
              </Button>
            </div>
          ) : (
            <form onSubmit={submit}>
              <div className="text-center">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  Get Your Free Shelf Intelligence Access
                </h2>
                <p className="mt-3 text-sm text-muted-foreground">
                  Enter your work email to start scanning. No credit card required.
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
                  Get more free scans
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
