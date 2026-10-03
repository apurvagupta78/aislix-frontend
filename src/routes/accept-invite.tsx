import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, KeyRound, Loader2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/AuthLayout";
import { supabase } from "@/integrations/supabase/client";
import { acceptInvite } from "@/lib/team-invite.functions";

export const Route = createFileRoute("/accept-invite")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { org?: string; email?: string; setup?: boolean } => ({
    ...(typeof search["org"] === "string" && search["org"] ? { org: search["org"] as string } : {}),
    ...(typeof search["email"] === "string" && search["email"]
      ? { email: search["email"] as string }
      : {}),
    ...(search["setup"] === 1 || search["setup"] === "1" || search["setup"] === true
      ? { setup: true }
      : {}),
  }),
  head: () => ({
    meta: [
      { title: "Accept your Aislix invitation" },
      {
        name: "description",
        content:
          "Accept your invitation and join your team's Aislix workspace for AI-powered retail shelf intelligence.",
      },
      { property: "og:title", content: "Accept your Aislix invitation" },
      {
        property: "og:description",
        content: "Join your team's Aislix workspace and start running shelf audits.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AcceptInvitePage,
});

type State =
  | { kind: "checking" }
  | { kind: "signed_out" }
  | { kind: "accepting" }
  | { kind: "done"; orgs: string[] }
  | { kind: "none" }
  | { kind: "error"; message: string };

function AcceptInvitePage() {
  const navigate = useNavigate();
  const { email, setup } = Route.useSearch();
  const [state, setState] = useState<State>({ kind: "checking" });
  const [passwordSaved, setPasswordSaved] = useState(!setup);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!data.session) {
        setState({ kind: "signed_out" });
        return;
      }
      setState({ kind: "accepting" });
      try {
        const result = await acceptInvite({ data: {} } as never);
        if (cancelled) return;
        setState(
          result.accepted > 0 ? { kind: "done", orgs: result.org_names } : { kind: "none" },
        );
      } catch (error) {
        if (cancelled) return;
        setState({ kind: "error", message: (error as Error).message });
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthLayout
      title="Team invitation"
      subtitle="Accept your invitation to join the workspace."
      footer={
        <Link to="/login" className="hover:text-foreground">
          Use a different account
        </Link>
      }
    >
      {state.kind === "checking" || state.kind === "accepting" ? (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Confirming your invitation…
        </div>
      ) : state.kind === "signed_out" ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Sign in with the email address that received this invitation to join the workspace. New
            to Aislix? Create an account, confirm your email, and you&apos;ll join automatically.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="brand" className="rounded-xl">
              <Link to="/login" search={(email ? { email } : {}) as never}>
                Sign in
              </Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/signup" search={(email ? { email } : {}) as never}>
                Create an account
              </Link>
            </Button>
          </div>
        </div>
      ) : (state.kind === "done" || state.kind === "none") && !passwordSaved ? (
        <SetPasswordForm onSaved={() => setPasswordSaved(true)} />
      ) : state.kind === "done" ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4">
            <CheckCircle2 className="mt-0.5 size-5 text-brand" />
            <div>
              <p className="text-sm font-medium">You&apos;re in</p>
              <p className="text-sm text-muted-foreground">
                Joined {state.orgs.join(", ")}.
              </p>
            </div>
          </div>
          <Button
            variant="brand"
            className="rounded-xl"
            onClick={() => void navigate({ to: "/my-scans", replace: true })}
          >
            Go to My Work
          </Button>
        </div>
      ) : state.kind === "none" ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4">
            <MailCheck className="mt-0.5 size-5 text-brand" />
            <p className="text-sm text-muted-foreground">
              There are no pending invitations for this account. It may already be accepted.
            </p>
          </div>
          <Button
            variant="brand"
            className="rounded-xl"
            onClick={() => void navigate({ to: "/my-scans", replace: true })}
          >
            Continue
          </Button>
        </div>

      ) : (
        <div className="space-y-4">
          <p className="text-sm text-destructive">{state.message}</p>
          <Button variant="outline" className="rounded-xl" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </div>
      )}
    </AuthLayout>
  );
}

function SetPasswordForm({ onSaved }: { onSaved: () => void }) {
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id;
      if (!uid) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", uid)
        .maybeSingle();
      if (!cancelled && profile?.full_name) setFullName(profile.full_name);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const tooShort = password.length > 0 && password.length < 8;
  const mismatch = confirm.length > 0 && confirm !== password;

  const save = async () => {
    setSaving(true);
    setError(null);
    const name = fullName.trim();
    const { data, error: updateError } = await supabase.auth.updateUser({
      password,
      ...(name ? { data: { full_name: name } } : {}),
    });
    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }
    if (name && data.user?.id) {
      await supabase.from("profiles").update({ full_name: name }).eq("id", data.user.id);
    }
    setSaving(false);
    onSaved();
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!tooShort && !mismatch && password) void save();
      }}
    >
      <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4">
        <KeyRound className="mt-0.5 size-5 text-brand" />
        <p className="text-sm text-muted-foreground">
          You&apos;ve joined the workspace. Set a password so you can sign in again later.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="invite-name">Your name</Label>
        <Input
          id="invite-name"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="h-11 rounded-xl"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="invite-password">Password</Label>
        <Input
          id="invite-password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="h-11 rounded-xl"
        />
        {tooShort && <p className="text-xs text-destructive">Use at least 8 characters.</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="invite-confirm">Confirm password</Label>
        <Input
          id="invite-confirm"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="h-11 rounded-xl"
        />
        {mismatch && <p className="text-xs text-destructive">Passwords do not match.</p>}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button
        type="submit"
        variant="brand"
        className="w-full rounded-xl"
        disabled={saving || tooShort || mismatch || !password}
      >
        {saving ? "Saving…" : "Save password and continue"}
      </Button>
    </form>
  );
}
