import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { KeyRound, Loader2, LogOut, MonitorSmartphone, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/States";
import { Field, SettingsCard, ToggleRow } from "@/components/settings/SettingsParts";
import { changePassword, fetchSessions, formatDateTime, signOutOtherDevices } from "@/lib/account";

export function SecurityPanel() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  const sessionsQuery = useQuery({
    queryKey: ["account", "sessions"],
    queryFn: ({ signal }) => fetchSessions(signal),
    retry: false,
  });

  const password = useMutation({
    mutationFn: () => changePassword({ current_password: current, new_password: next }),
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setConfirm("");
      toast.success("Password updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revokeOthers = useMutation({
    mutationFn: signOutOtherDevices,
    onSuccess: (data) => {
      void sessionsQuery.refetch();
      toast.success(
        typeof data.revoked === "number" ? `Signed out ${data.revoked} other device(s)` : "Other devices signed out",
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (next.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setError("New passwords don't match.");
      return;
    }
    setError(null);
    password.mutate();
  };

  const sessions = sessionsQuery.data?.items ?? [];

  return (
    <div className="space-y-4">
      <SettingsCard title="Change password" description="Choose a strong password you don't reuse elsewhere." icon={KeyRound}>
        <form className="max-w-xl space-y-4" onSubmit={submit}>
          <Field label="Current password" htmlFor="current-password">
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              required
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="New password" htmlFor="new-password" hint="Minimum 8 characters.">
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={next}
                onChange={(event) => setNext(event.target.value)}
              />
            </Field>
            <Field label="Confirm new password" htmlFor="confirm-password" error={error ?? undefined}>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
              />
            </Field>
          </div>
          <Button type="submit" variant="brand" size="sm" className="rounded-xl" disabled={password.isPending}>
            {password.isPending && <Loader2 className="size-4 animate-spin" />} Update password
          </Button>
        </form>
      </SettingsCard>

      <SettingsCard title="Two-factor authentication" description="An extra verification step at sign-in." icon={ShieldCheck}>
        <ToggleRow
          title="Authenticator app (TOTP)"
          description="Time-based one-time codes from Google Authenticator, Authy or 1Password."
        >
          <Badge className="rounded-full bg-brand-soft text-brand hover:bg-brand-soft">
            <Sparkles className="mr-1 size-3" /> Coming soon
          </Badge>
        </ToggleRow>
      </SettingsCard>

      <SettingsCard
        title="Login sessions"
        description="Devices currently signed in to your Aislix account."
        icon={MonitorSmartphone}
        action={
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="subtle" size="sm" className="rounded-xl" disabled={revokeOthers.isPending}>
                <LogOut className="size-4" /> Sign out other devices
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sign out from other devices?</AlertDialogTitle>
                <AlertDialogDescription>
                  All sessions except this one will be ended. Anyone using those devices must sign in again.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => revokeOthers.mutate()}>Sign out others</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        }
      >
        {sessionsQuery.isLoading ? (
          <TableSkeleton rows={3} cols={3} />
        ) : sessionsQuery.isError ? (
          <ErrorState
            title="Couldn't load sessions"
            description={(sessionsQuery.error as Error).message}
            onRetry={() => void sessionsQuery.refetch()}
          />
        ) : sessions.length === 0 ? (
          <EmptyState
            icon={<MonitorSmartphone className="size-5" />}
            title="No active sessions"
            description="Sessions appear here once you sign in from a device."
          />
        ) : (
          <ul className="space-y-3">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3.5"
              >
                <div>
                  <p className="text-sm font-medium">
                    {[session.device, session.browser].filter(Boolean).join(" · ") || "Unknown device"}
                    {session.current && (
                      <Badge className="ml-2 rounded-full bg-accent-green/12 text-accent-green hover:bg-accent-green/12">
                        This device
                      </Badge>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[session.location, session.ip_address].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(session.last_active_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SettingsCard>
    </div>
  );
}
