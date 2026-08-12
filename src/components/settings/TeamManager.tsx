import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { Field, SettingsCard } from "@/components/settings/SettingsParts";
import { useSeatUsage } from "@/hooks/use-seat-usage";
import {
  fetchTeam,
  formatDateTime,
  inviteMember,
  removeMember,
  roleDescriptions,
  roleLabels,
  updateMemberRole,
  type TeamMember,
  type TeamRole,
} from "@/lib/account";

const roles: TeamRole[] = ["owner", "admin", "manager", "viewer"];

export function TeamManager() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("manager");
  const [pendingRemove, setPendingRemove] = useState<TeamMember | null>(null);

  const teamQuery = useQuery({
    queryKey: ["team", "members"],
    queryFn: ({ signal }) => fetchTeam(signal),
    retry: false,
  });

  const seats = useSeatUsage();

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["team", "members"] });

  const invite = useMutation({
    mutationFn: () => inviteMember({ email: email.trim(), role }),
    onSuccess: () => {
      setEmail("");
      invalidate();
      toast.success("Invitation sent");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const changeRole = useMutation({
    mutationFn: ({ id, next }: { id: string; next: TeamRole }) => updateMemberRole(id, next),
    onSuccess: () => {
      invalidate();
      toast.success("Role updated");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeMember(id),
    onSuccess: () => {
      setPendingRemove(null);
      invalidate();
      toast.success("Member removed");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const members = teamQuery.data?.items ?? [];

  return (
    <div className="space-y-4">
      <SettingsCard
        title="Invite a team member"
        description={
          seats.usage
            ? seats.singleSeat
              ? seats.upgradeMessage
              : `Team: ${seats.label}${seats.remaining !== null ? ` · ${seats.remaining} seat${seats.remaining === 1 ? "" : "s"} remaining` : ""}`
            : "They receive an email invitation to join this workspace."
        }
        icon={UserPlus}
      >
        {seats.singleSeat || !seats.canInvite ? (
          <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-border bg-muted/30 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Need to add team members? Upgrade to the <strong>Growth plan</strong> or a higher plan
              to invite additional users.
            </p>
            <Button asChild variant="brand" size="lg" className="rounded-xl">
              <Link to="/pricing">Upgrade to invite team members</Link>
            </Button>
            <p className="text-xs text-muted-foreground">
              Growth includes up to 3 users · Professional up to 5 · Enterprise unlimited
            </p>
          </div>
        ) : (
        <form
          className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            invite.mutate();
          }}
        >
          <Field label="Work email" htmlFor="invite-email">
            <Input
              id="invite-email"
              type="email"
              required
              maxLength={255}
              value={email}
              placeholder="name@company.com"
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          <Field label="Role" hint={roleDescriptions[role]}>
            <Select value={role} onValueChange={(value) => setRole(value as TeamRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {roleLabels[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Button type="submit" variant="brand" className="rounded-xl sm:mb-6" disabled={invite.isPending || !seats.canInvite}>
            {invite.isPending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
            Send invite
          </Button>
        </form>
        )}
      </SettingsCard>

      <SettingsCard title="Team members" description="Roles control access to scans, stores, billing and settings." icon={Users}>
        {teamQuery.isLoading ? (
          <TableSkeleton rows={4} cols={4} />
        ) : teamQuery.isError ? (
          <ErrorState
            title="Couldn't load your team"
            description={(teamQuery.error as Error).message}
            onRetry={() => void teamQuery.refetch()}
          />
        ) : members.length === 0 ? (
          <EmptyState
            icon={<Users className="size-5" />}
            title="No team members yet"
            description="Invite colleagues so they can run audits and view reports for your stores."
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Last login</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        {member.name || "Pending invite"}
                        {member.status === "invited" && (
                          <Badge className="ml-2 rounded-full bg-brand-soft text-brand hover:bg-brand-soft">
                            Invited
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{member.email}</TableCell>
                      <TableCell>
                        <RoleSelect
                          value={member.role}
                          disabled={member.role === "owner" || changeRole.isPending}
                          onChange={(next) => changeRole.mutate({ id: member.id, next })}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateTime(member.last_login_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Remove ${member.email}`}
                          disabled={member.role === "owner"}
                          onClick={() => setPendingRemove(member)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ul className="space-y-3 md:hidden">
              {members.map((member) => (
                <li key={member.id} className="rounded-2xl border border-border bg-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{member.name || "Pending invite"}</p>
                      <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                      aria-label={`Remove ${member.email}`}
                      disabled={member.role === "owner"}
                      onClick={() => setPendingRemove(member)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <RoleSelect
                      value={member.role}
                      disabled={member.role === "owner" || changeRole.isPending}
                      onChange={(next) => changeRole.mutate({ id: member.id, next })}
                    />
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(member.last_login_at)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </SettingsCard>

      <AlertDialog open={Boolean(pendingRemove)} onOpenChange={(open) => !open && setPendingRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {pendingRemove?.email}?</AlertDialogTitle>
            <AlertDialogDescription>
              They immediately lose access to this workspace, its stores and reports.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingRemove && remove.mutate(pendingRemove.id)}
              disabled={remove.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RoleSelect({
  value,
  disabled,
  onChange,
}: {
  value: TeamRole;
  disabled: boolean;
  onChange: (role: TeamRole) => void;
}) {
  return (
    <Select value={value} disabled={disabled} onValueChange={(next) => onChange(next as TeamRole)}>
      <SelectTrigger className="h-9 w-[140px] rounded-xl text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {roles.map((role) => (
          <SelectItem key={role} value={role}>
            {roleLabels[role]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
