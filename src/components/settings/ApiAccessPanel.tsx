import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Check, Copy, KeySquare, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/alert-dialog";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/States";
import { SettingsCard } from "@/components/settings/SettingsParts";
import { createApiKey, fetchApiKeys, formatDateTime, revokeApiKey, type ApiKey } from "@/lib/account";

export function ApiAccessPanel() {
  const queryClient = useQueryClient();
  const [freshKey, setFreshKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<ApiKey | null>(null);

  const keysQuery = useQuery({
    queryKey: ["account", "api-keys"],
    queryFn: ({ signal }) => fetchApiKeys(signal),
    retry: false,
  });

  const generate = useMutation({
    mutationFn: () => createApiKey(),
    onSuccess: (key) => {
      if (key.key) setFreshKey(key.key);
      void queryClient.invalidateQueries({ queryKey: ["account", "api-keys"] });
      toast.success("New API key generated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeApiKey(id),
    onSuccess: () => {
      setPendingRevoke(null);
      void queryClient.invalidateQueries({ queryKey: ["account", "api-keys"] });
      toast.success("API key revoked");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const copy = async (value: string, id: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(id);
      toast.success("Copied to clipboard");
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Couldn't copy — copy it manually.");
    }
  };

  const keys = keysQuery.data?.items ?? [];

  return (
    <div className="space-y-4">
      <SettingsCard
        title="API keys"
        description="Authenticate server-to-server audit requests against the Aislix API."
        icon={KeySquare}
        action={
          <div className="flex gap-2">
            <Button variant="subtle" size="sm" className="rounded-xl" asChild>
              <a href="https://docs.lovable.dev" target="_blank" rel="noreferrer">
                <BookOpen className="size-4" /> API docs
              </a>
            </Button>
            <Button
              variant="brand"
              size="sm"
              className="rounded-xl"
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
            >
              {generate.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Generate new key
            </Button>
          </div>
        }
      >
        {freshKey && (
          <div className="mb-5 rounded-2xl border border-accent-green/30 bg-accent-green/8 p-4">
            <p className="text-xs font-medium text-accent-green">
              Copy this key now — it won't be shown again.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-xl border border-border bg-surface px-3 py-2 font-mono text-xs">
                {freshKey}
              </code>
              <Button
                variant="subtle"
                size="sm"
                className="rounded-xl"
                onClick={() => void copy(freshKey, "fresh")}
              >
                {copied === "fresh" ? <Check className="size-4" /> : <Copy className="size-4" />} Copy
              </Button>
            </div>
          </div>
        )}

        {keysQuery.isLoading ? (
          <TableSkeleton rows={2} cols={3} />
        ) : keysQuery.isError ? (
          <ErrorState
            title="Couldn't load API keys"
            description={(keysQuery.error as Error).message}
            onRetry={() => void keysQuery.refetch()}
          />
        ) : keys.length === 0 ? (
          <EmptyState
            icon={<KeySquare className="size-5" />}
            title="No API keys yet"
            description="Generate a key to submit shelf images from your own POS or ERP system."
            action={
              <Button variant="brand" size="sm" className="rounded-xl" onClick={() => generate.mutate()}>
                <Plus className="size-4" /> Generate new key
              </Button>
            }
          />
        ) : (
          <ul className="space-y-3">
            {keys.map((key) => (
              <li
                key={key.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3.5"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    {key.name || "Default key"}
                    {key.revoked && (
                      <Badge variant="secondary" className="rounded-full">
                        Revoked
                      </Badge>
                    )}
                  </p>
                  <code className="mt-1 block truncate font-mono text-xs text-muted-foreground">
                    {key.masked_key}
                  </code>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Created {formatDateTime(key.created_at)} · Last used {formatDateTime(key.last_used_at)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="subtle"
                    size="sm"
                    className="rounded-xl"
                    onClick={() => void copy(key.masked_key, key.id)}
                  >
                    {copied === key.id ? <Check className="size-4" /> : <Copy className="size-4" />} Copy
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive"
                    disabled={key.revoked}
                    onClick={() => setPendingRevoke(key)}
                  >
                    <Trash2 className="size-4" /> Revoke
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SettingsCard>

      <AlertDialog open={Boolean(pendingRevoke)} onOpenChange={(open) => !open && setPendingRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this API key?</AlertDialogTitle>
            <AlertDialogDescription>
              Any integration using {pendingRevoke?.masked_key} will stop working immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingRevoke && revoke.mutate(pendingRevoke.id)}
              disabled={revoke.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Revoke key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
