import { useMemo, useState } from "react";
import { useSeatUsage } from "@/hooks/use-seat-usage";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, ShieldCheck, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { MpFilterCard } from "@/components/design-system/MpFilterCard";
import { PageHeader } from "@/components/design-system/PageHeader";
import { SectionCard } from "@/components/design-system/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, ErrorState } from "@/components/States";
import {
  ActivityList,
  ActivitySkeleton,
  BulkActionsBar,
  ConfirmDialog,
  MembersTable,
  MembersTableSkeleton,
  RolePermissionsGrid,
  UserFormDialog,
  UserDetailDrawer,
  type MemberAction,
  type UserFormValues,
} from "@/components/team/TeamParts";
import { fetchStoreList } from "@/lib/organization";
import {
  bulkAssignStores,
  bulkChangeRole,
  bulkDeleteUsers,
  bulkDisableUsers,
  deleteUser,
  fetchOrgActivity,
  fetchUserActivity,
  fetchUsers,
  inviteUser,
  resendInvite,
  sendPasswordReset,
  setUserEnabled,
  updateUser,
  userRoleLabels,
  userRoles,
  userStatusLabels,
  userStatuses,
  type ActivityEvent,
  type AssignedStore,
  type OrgUser,
  type UserRole,
  type UserStatus,
} from "@/lib/team";

const PAGE_SIZE = 10;

type Search = {
  q?: string | undefined;
  role?: UserRole | "all" | undefined;
  status?: UserStatus | "all" | undefined;
  page?: number | undefined;
};

export const Route = createFileRoute("/team")({
  validateSearch: (search: Record<string, unknown>): Search => {
    const raw = search;
    const q = typeof raw['q'] === "string" && raw['q'] ? { q: raw['q'] as string } : {};
    const roleValue = raw['role'];
    const role =
      typeof roleValue === "string" && userRoles.includes(roleValue as UserRole)
        ? { role: roleValue as UserRole }
        : {};
    const statusValue = raw['status'];
    const status =
      typeof statusValue === "string" && userStatuses.includes(statusValue as UserStatus)
        ? { status: statusValue as UserStatus }
        : {};
    const rawPage = Number(raw['page']);
    const page = Number.isFinite(rawPage) && rawPage > 1 ? { page: Math.floor(rawPage) } : {};
    return { ...q, ...role, ...status, ...page };
  },
  head: () => ({
    meta: [
      { title: "Team & User Management — Aislix" },
      {
        name: "description",
        content:
          "Invite team members, assign roles and store access, review activity logs and manage user permissions across your Aislix organization.",
      },
      { property: "og:title", content: "Team & user management — Aislix" },
      {
        property: "og:description",
        content:
          "Role-based access for owners, admins, store managers and viewers across every retail location.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  const { q, role = "all", status = "all", page = 1 } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState(q ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"invite" | "edit">("invite");
  const [formUser, setFormUser] = useState<OrgUser | null>(null);
  const [drawerUser, setDrawerUser] = useState<OrgUser | null>(null);
  const [confirm, setConfirm] = useState<
    | { kind: "toggle"; user: OrgUser }
    | { kind: "delete"; user: OrgUser }
    | { kind: "bulk-disable"; user?: undefined }
    | { kind: "bulk-delete"; user?: undefined }
    | null
  >(null);

  const setSearch = (next: Partial<Search>) => {
    void navigate({ to: "/team", search: (prev: any) => ({ ...prev, ...next }) });
  };

  const usersQuery = useQuery({
    queryKey: ["users", { q, role, status, page }],
    queryFn: () => fetchUsers({ search: q, role, status, page, page_size: PAGE_SIZE }),
    retry: false,
  });

  const storesQuery = useQuery({
    queryKey: ["team-store-options"],
    queryFn: () => fetchStoreList({ filter: "active", page_size: 200 }),
    retry: false,
  });

  const activityQuery = useQuery({
    queryKey: ["users-activity"],
    queryFn: () => fetchOrgActivity(15),
    retry: false,
  });

  const userActivityQuery = useQuery({
    queryKey: ["user-activity", drawerUser?.id],
    queryFn: () => fetchUserActivity(drawerUser!.id, 15),
    enabled: Boolean(drawerUser?.id),
    retry: false,
  });

  const storeOptions: AssignedStore[] = useMemo(
    () => (storesQuery.data?.items ?? []).map((store) => ({ id: store.id, name: store.name })),
    [storesQuery.data],
  );

  const users = usersQuery.data?.items ?? [];
  const total = usersQuery.data?.total ?? users.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["users"] });
    void queryClient.invalidateQueries({ queryKey: ["users-activity"] });
  };

  const inviteMutation = useMutation({
    mutationFn: (values: UserFormValues) => inviteUser(values),
    onSuccess: () => {
      toast.success("Invitation queued", {
        description: "Delivery happens once the Aislix account service is connected.",
      });
      setFormOpen(false);
      refresh();
    },
    onError: (error: Error) => toast.error("Could not send invitation", { description: error.message }),
  });

  const updateMutation = useMutation({
    mutationFn: (values: UserFormValues) =>
      updateUser(formUser!.id, {
        name: values.name,
        role: values.role,
        store_ids: values.store_ids,
      }),
    onSuccess: () => {
      toast.success("Member updated");
      setFormOpen(false);
      refresh();
    },
    onError: (error: Error) => toast.error("Could not update member", { description: error.message }),
  });

  const actionMutation = useMutation({
    mutationFn: async (action: { kind: MemberAction | "bulk-disable" | "bulk-delete"; user?: OrgUser }) => {
      switch (action.kind) {
        case "toggle":
          return setUserEnabled(action.user!.id, action.user!.status === "disabled");
        case "delete":
          return deleteUser(action.user!.id);
        case "resend":
          return resendInvite(action.user!.id);
        case "reset":
          return sendPasswordReset(action.user!.id);
        case "bulk-disable":
          return bulkDisableUsers(selected);
        case "bulk-delete":
          return bulkDeleteUsers(selected);
        default:
          return undefined;
      }
    },
    onSuccess: (_data, variables) => {
      const labels: Record<string, string> = {
        toggle: "Access updated",
        delete: "Member removed",
        resend: "Invitation re-queued",
        reset: "Password reset queued",
        "bulk-disable": "Selected members disabled",
        "bulk-delete": "Selected members removed",
      };
      toast.success(labels[variables.kind] ?? "Done");
      setConfirm(null);
      setDrawerUser(null);
      setSelected([]);
      refresh();
    },
    onError: (error: Error) => toast.error("Action failed", { description: error.message }),
  });

  const bulkMutation = useMutation({
    mutationFn: (input: { storeIds?: string[]; role?: UserRole }) =>
      input.role ? bulkChangeRole(selected, input.role) : bulkAssignStores(selected, input.storeIds ?? []),
    onSuccess: () => {
      toast.success("Bulk update applied");
      setSelected([]);
      refresh();
    },
    onError: (error: Error) => toast.error("Bulk update failed", { description: error.message }),
  });

  function handleAction(action: MemberAction, user: OrgUser) {
    if (action === "edit") {
      setFormMode("edit");
      setFormUser(user);
      setFormOpen(true);
      return;
    }
    if (action === "toggle" || action === "delete") {
      setConfirm({ kind: action, user });
      return;
    }
    actionMutation.mutate({ kind: action, user });
  }

  const activityEvents: ActivityEvent[] = activityQuery.data?.items ?? [];
  const seats = useSeatUsage();
  const openInvite = () => {
    if (!seats.canInvite) {
      toast.error(
        seats.singleSeat
          ? seats.upgradeMessage
          : `All ${seats.seatLimitLabel.toLowerCase()} on your plan are in use. Upgrade to invite more people.`,
      );
      return;
    }
    setFormMode("invite");
    setFormUser(null);
    setFormOpen(true);
  };

  const inviteAction =
    seats.usage && !seats.canInvite ? (
      <Button asChild variant="brand">
        <Link to="/pricing">Upgrade to invite team members</Link>
      </Button>
    ) : (
      <Button onClick={openInvite} disabled={!seats.canInvite}>
        <UserPlus className="size-4" /> Invite user
      </Button>
    );

  return (
    <AppShell title="" hidePageHeader>
      <div className="space-y-8">
        <PageHeader
          eyebrow="Team"
          title="Team & user management"
          description="Invite members, control role-based access and audit every change across your organization."
          actions={inviteAction}
        />
        {seats.usage && !seats.canInvite ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-muted/30 p-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                Need to add team members? Upgrade to the Growth plan or higher to invite additional
                users.
              </p>
              <p className="text-xs text-muted-foreground">
                Growth includes up to 3 users · Professional up to 5 · Enterprise unlimited
              </p>
            </div>
            <Button asChild variant="brand" className="rounded-xl">
              <Link to="/pricing">View plans &amp; upgrade</Link>
            </Button>
          </div>
        ) : seats.usage ? (
          <p className="text-xs text-muted-foreground">
            Team: {seats.label}
            {seats.remaining !== null
              ? ` · ${seats.remaining} seat${seats.remaining === 1 ? "" : "s"} remaining`
              : ""}
          </p>
        ) : null}

        {/* Filters + table */}
        <section className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <form
              className="relative flex-1"
              onSubmit={(event) => {
                event.preventDefault();
                setSearch({ q: searchInput.trim() || undefined, page: undefined });
              }}
            >
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search by name or email"
                className="pl-9"
                aria-label="Search team members"
              />
            </form>
            <div className="flex flex-wrap gap-3">
              <Select
                value={role}
                onValueChange={(value) =>
                  setSearch({ role: value as UserRole | "all", page: undefined })
                }
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  {userRoles.map((option) => (
                    <SelectItem key={option} value={option}>
                      {userRoleLabels[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={status}
                onValueChange={(value) =>
                  setSearch({ status: value as UserStatus | "all", page: undefined })
                }
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {userStatuses.map((option) => (
                    <SelectItem key={option} value={option}>
                      {userStatusLabels[option]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {usersQuery.isPending ? (
            <MembersTableSkeleton />
          ) : usersQuery.isError ? (
            <ErrorState
              title="Team members unavailable"
              description="We couldn't load your organization's users. Connect the Aislix account service or try again."
              onRetry={() => void usersQuery.refetch()}
            />
          ) : users.length === 0 ? (
            <EmptyState
              icon={<Users className="size-5" />}
              title={q || role !== "all" || status !== "all" ? "No matching members" : "No team members yet"}
              description={
                q || role !== "all" || status !== "all"
                  ? "Adjust your search or filters to see more members."
                  : "Invite your first team member and assign the stores they should manage."
              }
              action={
                <Button onClick={openInvite} disabled={!seats.canInvite}>
                  <UserPlus className="size-4" /> Invite user
                </Button>
              }
            />
          ) : (
            <>
              <MembersTable
                users={users}
                selected={selected}
                onToggleSelect={(id, checked) =>
                  setSelected((prev) => (checked ? [...prev, id] : prev.filter((item) => item !== id)))
                }
                onToggleAll={(checked) => setSelected(checked ? users.map((user) => user.id) : [])}
                onOpenUser={(user) => setDrawerUser(user)}
                onAction={handleAction}
              />
              <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {pageCount}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="subtle"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setSearch({ page: page - 1 <= 1 ? undefined : page - 1 })}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="subtle"
                    size="sm"
                    disabled={page >= pageCount}
                    onClick={() => setSearch({ page: page + 1 })}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>

        {/* Roles */}
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-brand" />
            <h2 className="text-base font-semibold text-foreground">Roles & permissions</h2>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            These summaries mirror the role-based access control policy enforced by the Aislix API.
            Permissions apply organization-wide for owners and admins, and to assigned stores for
            store managers and viewers.
          </p>
          <RolePermissionsGrid />
        </section>

        {/* Activity log */}
        <section className="space-y-4">
          <h2 className="text-base font-semibold text-foreground">Activity log</h2>
          <div className="card-surface p-5">
            {activityQuery.isPending ? (
              <ActivitySkeleton />
            ) : activityQuery.isError ? (
              <ErrorState
                title="Activity log unavailable"
                description="Invitations, role changes, store assignments and login history appear here once the API is connected."
                onRetry={() => void activityQuery.refetch()}
              />
            ) : activityEvents.length === 0 ? (
              <EmptyState
                title="No activity yet"
                description="Invites, role changes, store assignments, removals, password resets and logins will be listed here."
              />
            ) : (
              <ActivityList events={activityEvents} />
            )}
          </div>
        </section>
      </div>

      <BulkActionsBar
        count={selected.length}
        stores={storeOptions}
        storesLoading={storesQuery.isPending}
        pending={bulkMutation.isPending || actionMutation.isPending}
        onClear={() => setSelected([])}
        onAssignStores={(storeIds) => bulkMutation.mutate({ storeIds })}
        onChangeRole={(nextRole) => bulkMutation.mutate({ role: nextRole })}
        onDisable={() => setConfirm({ kind: "bulk-disable" })}
        onDelete={() => setConfirm({ kind: "bulk-delete" })}
      />

      <UserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        user={formUser}
        stores={storeOptions}
        storesLoading={storesQuery.isPending}
        submitting={inviteMutation.isPending || updateMutation.isPending}
        error={
          (formMode === "invite" ? inviteMutation.error?.message : updateMutation.error?.message) ??
          null
        }
        onSubmit={(values) =>
          formMode === "invite" ? inviteMutation.mutate(values) : updateMutation.mutate(values)
        }
      />

      <UserDetailDrawer
        user={drawerUser}
        open={Boolean(drawerUser)}
        onOpenChange={(open) => !open && setDrawerUser(null)}
        activity={userActivityQuery.data?.items ?? []}
        activityLoading={userActivityQuery.isPending && Boolean(drawerUser)}
        activityError={userActivityQuery.isError}
        onAction={handleAction}
      />

      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={
          confirm?.kind === "delete"
            ? "Delete team member?"
            : confirm?.kind === "bulk-delete"
              ? `Delete ${selected.length} members?`
              : confirm?.kind === "bulk-disable"
                ? `Disable ${selected.length} members?`
                : confirm?.kind === "toggle" && confirm.user.status === "disabled"
                  ? "Enable access?"
                  : "Disable access?"
        }
        description={
          confirm?.kind === "delete" || confirm?.kind === "bulk-delete"
            ? "This removes access permanently. Audit history stays with the organization."
            : "Disabled members keep their history but cannot sign in until re-enabled."
        }
        confirmLabel={
          confirm?.kind === "delete" || confirm?.kind === "bulk-delete" ? "Delete" : "Confirm"
        }
        destructive={confirm?.kind === "delete" || confirm?.kind === "bulk-delete"}
        pending={actionMutation.isPending}
        onConfirm={() => {
          if (!confirm) return;
          if (confirm.kind === "bulk-disable" || confirm.kind === "bulk-delete") {
            actionMutation.mutate({ kind: confirm.kind });
          } else {
            actionMutation.mutate({ kind: confirm.kind, user: confirm.user });
          }
        }}
      />
    </AppShell>
  );
}
