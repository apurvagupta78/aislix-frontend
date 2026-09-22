import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Circle,
  FileUp,
  KeyRound,
  Mail,
  MoreHorizontal,
  Pencil,
  Search,
  ShieldCheck,
  Store,
  Trash2,
  Upload,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/States";
import { cn } from "@/lib/utils";
import {
  activityKindLabels,
  formatCount,
  formatDate,
  formatDateTime,
  permissionLabels,
  rolePermissions,
  roleScope,
  roleSummaries,
  storeAccessLabel,
  userInitials,
  userRoleLabels,
  inviteRoles,
  userRoles,
  userStatusLabels,
  type ActivityEvent,
  type AssignedStore,
  type OrgUser,
  type PermissionKey,
  type UserInput,
  type UserRole,
  type UserStatus,
} from "@/lib/team";

const permissionOrder = Object.keys(permissionLabels) as PermissionKey[];

// ---------- badges ----------

export function RoleBadge({ role }: { role?: UserRole | undefined }) {
  if (!role) return <span className="text-sm text-muted-foreground">—</span>;
  const tone =
    role === "owner"
      ? "border-brand/30 bg-brand-soft text-brand"
      : role === "admin"
        ? "border-primary/25 bg-primary/10 text-primary"
        : "border-border bg-muted text-muted-foreground";
  return (
    <Badge variant="outline" className={cn("rounded-md font-medium", tone)}>
      {userRoleLabels[role]}
    </Badge>
  );
}

export function StatusBadge({ status }: { status?: UserStatus | undefined }) {
  if (!status) return <span className="text-sm text-muted-foreground">—</span>;
  const tone: Record<UserStatus, string> = {
    active: "border-brand/30 bg-brand-soft text-brand",
    pending: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    disabled: "border-border bg-muted text-muted-foreground",
  };
  return (
    <Badge variant="outline" className={cn("rounded-md font-medium", tone[status])}>
      <span className="mr-1.5 inline-block size-1.5 rounded-full bg-current" />
      {userStatusLabels[status]}
    </Badge>
  );
}

// ---------- roles & permissions ----------

export function RolePermissionsGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {userRoles.map((role) => {
        const granted = rolePermissions[role];
        return (
          <div key={role} className="card-surface card-hover flex flex-col p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">{userRoleLabels[role]}</p>
              <ShieldCheck className="size-4 text-brand" />
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {roleSummaries[role]}
            </p>
            <Separator className="my-4" />
            <ul className="space-y-2">
              {permissionOrder.map((key) => {
                const has = granted.includes(key);
                return (
                  <li
                    key={key}
                    className={cn(
                      "flex items-start gap-2 text-xs",
                      has ? "text-foreground" : "text-muted-foreground/70",
                    )}
                  >
                    {has ? (
                      <CheckCircle2 className="mt-px size-3.5 shrink-0 text-brand" />
                    ) : (
                      <Circle className="mt-px size-3.5 shrink-0" />
                    )}
                    {permissionLabels[key]}
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-[11px] uppercase tracking-wide text-muted-foreground">
              {roleScope[role] === "organization" ? "All stores" : "Assigned stores only"}
            </p>
          </div>
        );
      })}
    </div>
  );
}

// ---------- store multi-select ----------

function StorePicker({
  stores,
  selected,
  onChange,
  loading,
  disabled,
}: {
  stores: AssignedStore[];
  selected: string[];
  onChange: (ids: string[]) => void;
  loading?: boolean | undefined;
  disabled?: boolean | undefined;
}) {
  const [filter, setFilter] = useState("");
  const visible = useMemo(
    () =>
      stores.filter((store) => store.name.toLowerCase().includes(filter.trim().toLowerCase())),
    [stores, filter],
  );

  if (loading) {
    return (
      <div className="space-y-2 rounded-xl border border-border p-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border border-border", disabled && "opacity-60")}>
      <div className="border-b border-border p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Find a store"
            className="h-8 pl-8 text-sm"
            disabled={disabled}
          />
        </div>
      </div>
      <div className="max-h-40 space-y-1 overflow-y-auto p-2">
        {stores.length === 0 && (
          <p className="px-1 py-2 text-xs text-muted-foreground">
            No stores available yet. Add stores first, then assign access.
          </p>
        )}
        {stores.length > 0 && visible.length === 0 && (
          <p className="px-1 py-2 text-xs text-muted-foreground">No stores match “{filter}”.</p>
        )}
        {visible.map((store) => (
          <label
            key={store.id}
            className="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1.5 text-sm hover:bg-muted"
          >
            <Checkbox
              checked={selected.includes(store.id)}
              disabled={disabled}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? [...selected, store.id]
                    : selected.filter((id) => id !== store.id),
                )
              }
            />
            <span className="truncate">{store.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ---------- invite / edit dialog ----------

export type UserFormValues = UserInput;

export function UserFormDialog({
  open,
  onOpenChange,
  mode,
  user,
  stores,
  storesLoading,
  members,
  submitting,
  error,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "invite" | "edit";
  user?: OrgUser | null;
  stores: AssignedStore[];
  storesLoading?: boolean | undefined;
  /** Org members for Reports To (keyed by auth user_id). */
  members?: OrgUser[] | undefined;
  submitting?: boolean | undefined;
  error?: string | null | undefined;
  onSubmit: (values: UserFormValues) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("member");
  const [storeIds, setStoreIds] = useState<string[]>([]);
  const [reportsToUserId, setReportsToUserId] = useState<string>("none");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(user?.name ?? "");
    setEmail(user?.email ?? "");
    setRole(user?.role ?? "member");
    setStoreIds((user?.assigned_stores ?? []).map((store) => store.id));
    setReportsToUserId(user?.reports_to_user_id ?? "none");
    setTouched(false);
  }, [open, user]);

  const orgWide = roleScope[role] === "organization";
  const reportsToOptions = useMemo(
    () =>
      (members ?? []).filter(
        (m) =>
          Boolean(m.user_id) &&
          m.user_id !== user?.user_id &&
          m.status !== "disabled",
      ),
    [members, user?.user_id],
  );
  const nameError = name.trim().length === 0 ? "Name is required." : name.trim().length > 120 ? "Name is too long." : null;
  const emailError = !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
    ? "Enter a valid email address."
    : email.trim().length > 255
      ? "Email is too long."
      : null;
  // Managers are NOT org-wide — always require store assignment for manager/member/etc.
  const storeError = !orgWide && storeIds.length === 0 ? "Assign at least one store." : null;
  const invalid = Boolean(nameError || emailError || storeError);

  function submit() {
    setTouched(true);
    if (invalid) return;
    onSubmit({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
      store_ids: orgWide ? [] : storeIds,
      reports_to_user_id: reportsToUserId === "none" ? null : reportsToUserId,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "invite" ? "Invite team member" : "Edit team member"}</DialogTitle>
          <DialogDescription>
            {mode === "invite"
              ? "The invitation email is sent by Aislix once the account service is connected."
              : "Update the member's details, role and store access."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="member-name">Name</Label>
            <Input
              id="member-name"
              value={name}
              maxLength={120}
              onChange={(event) => setName(event.target.value)}
              placeholder="Full name"
            />
            {touched && nameError && <p className="text-xs text-destructive">{nameError}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="member-email">Email</Label>
            <Input
              id="member-email"
              type="email"
              value={email}
              maxLength={255}
              disabled={mode === "edit"}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@company.com"
            />
            {touched && emailError && <p className="text-xs text-destructive">{emailError}</p>}
          </div>

          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(value) => setRole(value as UserRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(mode === "invite" ? inviteRoles : userRoles).map((option) => (
                  <SelectItem key={option} value={option}>
                    {userRoleLabels[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{roleSummaries[role]}</p>
          </div>

          <div className="space-y-1.5">
            <Label>Reports to</Label>
            <Select value={reportsToUserId} onValueChange={setReportsToUserId}>
              <SelectTrigger>
                <SelectValue placeholder="No manager" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No manager</SelectItem>
                {reportsToOptions.map((member) => (
                  <SelectItem key={member.user_id!} value={member.user_id!}>
                    {member.name ?? member.email}
                    {member.role ? ` · ${userRoleLabels[member.role]}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Reporting hierarchy drives inherited store access for managers.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Assigned stores</Label>
            {orgWide ? (
              <p className="rounded-xl border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
                {userRoleLabels[role]}s automatically have access to every store in the
                organization.
              </p>
            ) : (
              <>
                <StorePicker
                  stores={stores}
                  selected={storeIds}
                  onChange={setStoreIds}
                  loading={storesLoading}
                />
                {touched && storeError && <p className="text-xs text-destructive">{storeError}</p>}
                {role === "manager" && (
                  <p className="text-xs text-muted-foreground">
                    Managers need direct store assignments. Inherited stores come from their team.
                  </p>
                )}
              </>
            )}
          </div>

          {error && (
            <p className="rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="subtle" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {mode === "invite" ? (
              <>
                <Mail className="size-4" /> {submitting ? "Sending…" : "Send invitation"}
              </>
            ) : (
              <>{submitting ? "Saving…" : "Save changes"}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- confirm dialog ----------

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  onConfirm,
  pending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean | undefined;
  onConfirm: () => void;
  pending?: boolean | undefined;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
            disabled={pending}
            className={destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
          >
            {pending ? "Working…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------- members table ----------

export type MemberAction = "edit" | "toggle" | "delete" | "resend" | "reset";

export function MembersTable({
  users,
  selected,
  onToggleSelect,
  onToggleAll,
  onOpenUser,
  onAction,
}: {
  users: OrgUser[];
  selected: string[];
  onToggleSelect: (id: string, checked: boolean) => void;
  onToggleAll: (checked: boolean) => void;
  onOpenUser: (user: OrgUser) => void;
  onAction: (action: MemberAction, user: OrgUser) => void;
}) {
  const allChecked = users.length > 0 && users.every((user) => selected.includes(user.id));

  return (
    <>
      {/* Desktop */}
      <div className="hidden overflow-x-auto rounded-2xl border border-border lg:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="w-10 px-4 py-3">
                <Checkbox
                  checked={allChecked}
                  onCheckedChange={(checked) => onToggleAll(checked === true)}
                  aria-label="Select all members"
                />
              </th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Reports to</th>
              <th className="px-4 py-3 font-medium">Direct</th>
              <th className="px-4 py-3 font-medium">Inherited</th>
              <th className="px-4 py-3 font-medium">Effective</th>
              <th className="px-4 py-3 font-medium">Team</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last login</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-t border-border transition-colors hover:bg-muted/40">
                <td className="px-4 py-3">
                  <Checkbox
                    checked={selected.includes(user.id)}
                    onCheckedChange={(checked) => onToggleSelect(user.id, checked === true)}
                    aria-label={`Select ${user.name ?? user.email}`}
                  />
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onOpenUser(user)}
                    className="flex items-center gap-3 text-left"
                  >
                    <Avatar className="size-8">
                      {user.avatar_url && <AvatarImage src={user.avatar_url} alt="" />}
                      <AvatarFallback className="text-xs">{userInitials(user)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-foreground hover:text-brand">
                      {user.name ?? "Invited user"}
                    </span>
                  </button>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                <td className="px-4 py-3">
                  <RoleBadge role={user.role} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {user.reports_to_name ?? "—"}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {user.all_stores_access ? "All" : formatCount(user.direct_store_count ?? user.assigned_stores?.length)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {user.all_stores_access ? "—" : formatCount(user.inherited_store_count)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {user.all_stores_access ? "All" : formatCount(user.effective_store_count)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatCount(user.team_member_count)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={user.status} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatDateTime(user.last_login_at)}
                </td>
                <td className="px-4 py-3 text-right">
                  <RowActions user={user} onAction={onAction} onOpenUser={onOpenUser} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile / tablet */}
      <div className="space-y-3 lg:hidden">
        {users.map((user) => (
          <div key={user.id} className="card-surface p-4">
            <div className="flex items-start gap-3">
              <Checkbox
                className="mt-1"
                checked={selected.includes(user.id)}
                onCheckedChange={(checked) => onToggleSelect(user.id, checked === true)}
                aria-label={`Select ${user.name ?? user.email}`}
              />
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpenUser(user)}>
                <div className="flex items-center gap-3">
                  <Avatar className="size-9">
                    {user.avatar_url && <AvatarImage src={user.avatar_url} alt="" />}
                    <AvatarFallback className="text-xs">{userInitials(user)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {user.name ?? "Invited user"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
              </button>
              <RowActions user={user} onAction={onAction} onOpenUser={onOpenUser} />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <RoleBadge role={user.role} />
              <StatusBadge status={user.status} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-muted-foreground">Reports to</dt>
                <dd className="mt-0.5 text-foreground">{user.reports_to_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Team members</dt>
                <dd className="mt-0.5 text-foreground">{formatCount(user.team_member_count)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Direct / Inherited / Effective</dt>
                <dd className="mt-0.5 text-foreground">
                  {user.all_stores_access
                    ? "All stores"
                    : `${formatCount(user.direct_store_count)} / ${formatCount(user.inherited_store_count)} / ${formatCount(user.effective_store_count)}`}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last login</dt>
                <dd className="mt-0.5 text-foreground">{formatDateTime(user.last_login_at)}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </>
  );
}

function RowActions({
  user,
  onAction,
  onOpenUser,
}: {
  user: OrgUser;
  onAction: (action: MemberAction, user: OrgUser) => void;
  onOpenUser: (user: OrgUser) => void;
}) {
  const disabled = user.status === "disabled";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" aria-label="Member actions">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onSelect={() => onOpenUser(user)}>
          <Users className="size-4" /> View profile
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onAction("edit", user)}>
          <Pencil className="size-4" /> Edit
        </DropdownMenuItem>
        {user.status === "pending" && (
          <DropdownMenuItem onSelect={() => onAction("resend", user)}>
            <Mail className="size-4" /> Resend invitation
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={() => onAction("reset", user)}>
          <KeyRound className="size-4" /> Send password reset
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onAction("toggle", user)}>
          <UserMinus className="size-4" /> {disabled ? "Enable access" : "Disable access"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => onAction("delete", user)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="size-4" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function MembersTableSkeleton() {
  return (
    <div className="space-y-3 rounded-2xl border border-border p-4" aria-busy="true">
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="grid grid-cols-2 gap-3 lg:grid-cols-8">
          {Array.from({ length: 8 }).map((__, cell) => (
            <Skeleton key={cell} className="h-5" />
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------- bulk actions ----------

export function BulkActionsBar({
  count,
  stores,
  storesLoading,
  pending,
  onClear,
  onAssignStores,
  onChangeRole,
  onDisable,
  onDelete,
}: {
  count: number;
  stores: AssignedStore[];
  storesLoading?: boolean | undefined;
  pending?: boolean | undefined;
  onClear: () => void;
  onAssignStores: (storeIds: string[]) => void;
  onChangeRole: (role: UserRole) => void;
  onDisable: () => void;
  onDelete: () => void;
}) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [storeIds, setStoreIds] = useState<string[]>([]);

  if (count === 0) return null;

  return (
    <div className="sticky bottom-4 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface/95 p-3 shadow-lg backdrop-blur">
      <span className="pl-1 text-sm font-medium text-foreground">{count} selected</span>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="subtle" size="sm" disabled={pending} onClick={() => setAssignOpen(true)}>
          <Store className="size-4" /> Assign stores
        </Button>
        <Select disabled={pending ?? false} onValueChange={(value) => onChangeRole(value as UserRole)}>
          <SelectTrigger className="h-9 w-[150px]">
            <SelectValue placeholder="Change role" />
          </SelectTrigger>
          <SelectContent>
            {userRoles.map((role) => (
              <SelectItem key={role} value={role}>
                {userRoleLabels[role]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="subtle" size="sm" disabled={pending} onClick={onDisable}>
          <UserMinus className="size-4" /> Disable
        </Button>
        <Button variant="ghost" size="sm" disabled={pending} className="text-destructive" onClick={onDelete}>
          <Trash2 className="size-4" /> Delete
        </Button>
      </div>
      <Button variant="ghost" size="sm" className="ml-auto" onClick={onClear} disabled={pending}>
        Clear
      </Button>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign stores</DialogTitle>
            <DialogDescription>
              Selected members gain access to the stores you choose here.
            </DialogDescription>
          </DialogHeader>
          <StorePicker
            stores={stores}
            selected={storeIds}
            onChange={setStoreIds}
            loading={storesLoading}
          />
          <DialogFooter>
            <Button variant="subtle" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={storeIds.length === 0 || pending}
              onClick={() => {
                onAssignStores(storeIds);
                setAssignOpen(false);
                setStoreIds([]);
              }}
            >
              Assign to {count} member{count === 1 ? "" : "s"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- activity log ----------

export function ActivityList({ events }: { events: ActivityEvent[] }) {
  return (
    <ol className="space-y-4">
      {events.map((event) => (
        <li key={event.id} className="relative pl-7">
          <span className="absolute left-0 top-1 grid size-5 place-items-center rounded-full bg-brand-soft text-brand">
            <Activity className="size-3" />
          </span>
          <p className="text-sm font-medium text-foreground">
            {activityKindLabels[event.kind] ?? "Activity"}
          </p>
          {event.message && (
            <p className="mt-0.5 text-sm text-muted-foreground">{event.message}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDateTime(event.created_at)}
            {event.actor_name ? ` · by ${event.actor_name}` : ""}
            {event.ip_address ? ` · ${event.ip_address}` : ""}
            {event.device ? ` · ${event.device}` : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}

export function ActivitySkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
      ))}
    </div>
  );
}

// ---------- user drawer ----------

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="max-w-[60%] text-right text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

export function UserDetailDrawer({
  user,
  open,
  onOpenChange,
  activity,
  activityLoading,
  activityError,
  onAction,
}: {
  user: OrgUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: ActivityEvent[];
  activityLoading?: boolean | undefined;
  activityError?: boolean | undefined;
  onAction: (action: MemberAction, user: OrgUser) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        {user && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <Avatar className="size-11">
                  {user.avatar_url && <AvatarImage src={user.avatar_url} alt="" />}
                  <AvatarFallback>{userInitials(user)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <SheetTitle className="truncate">{user.name ?? "Invited user"}</SheetTitle>
                  <SheetDescription className="truncate">{user.email}</SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="space-y-6 px-4 pb-8">
              <div className="flex flex-wrap gap-2">
                <RoleBadge role={user.role} />
                <StatusBadge status={user.status} />
              </div>

              <dl className="divide-y divide-border rounded-2xl border border-border px-4">
                <DetailRow label="Role" value={user.role ? userRoleLabels[user.role] : "—"} />
                <DetailRow label="Reports to" value={user.reports_to_name ?? "—"} />
                <DetailRow
                  label="Direct stores"
                  value={
                    user.all_stores_access
                      ? "All stores"
                      : formatCount(user.direct_store_count ?? user.assigned_stores?.length)
                  }
                />
                <DetailRow
                  label="Inherited stores"
                  value={user.all_stores_access ? "—" : formatCount(user.inherited_store_count)}
                />
                <DetailRow
                  label="Effective stores"
                  value={
                    user.all_stores_access
                      ? "All stores"
                      : formatCount(user.effective_store_count)
                  }
                />
                <DetailRow label="Team members" value={formatCount(user.team_member_count)} />
                <DetailRow label="Assigned stores" value={storeAccessLabel(user)} />
                <DetailRow label="Created" value={formatDate(user.created_at)} />
                <DetailRow label="Last login" value={formatDateTime(user.last_login_at)} />
                <DetailRow label="Total audits" value={formatCount(user.scans_total)} />
                <DetailRow label="Audits (30 days)" value={formatCount(user.scans_last_30_days)} />
                <DetailRow label="Last audit" value={formatDateTime(user.last_scan_at)} />
              </dl>

              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="subtle" onClick={() => onAction("edit", user)}>
                  <Pencil className="size-4" /> Edit
                </Button>
                <Button size="sm" variant="subtle" onClick={() => onAction("toggle", user)}>
                  <UserMinus className="size-4" />
                  {user.status === "disabled" ? "Enable" : "Disable"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => onAction("delete", user)}
                >
                  <Trash2 className="size-4" /> Delete
                </Button>
              </div>

              <div>
                <p className="mb-3 text-sm font-semibold text-foreground">Activity</p>
                {activityLoading ? (
                  <ActivitySkeleton />
                ) : activityError ? (
                  <p className="text-sm text-muted-foreground">
                    Activity is unavailable right now.
                  </p>
                ) : activity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
                ) : (
                  <ActivityList events={activity} />
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export { UserPlus };

// ---------- bulk user import ----------

type BulkImportStep = "upload" | "preview" | "done";

export function BulkUserImportDialog({
  open,
  onOpenChange,
  stores,
  members,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stores: AssignedStore[];
  members: OrgUser[];
  onImported?: (() => void) | undefined;
}) {
  const [step, setStep] = useState<BulkImportStep>("upload");
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [validation, setValidation] = useState<import("@/lib/bulk-user-import").BulkUserValidationResult | null>(null);
  const [importResult, setImportResult] = useState<import("@/lib/bulk-user-import").BulkUserImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("upload");
      setBusy(false);
      setFileName(null);
      setValidation(null);
      setImportResult(null);
      setParseError(null);
    }
  }, [open]);

  async function handleFile(file: File) {
    setBusy(true);
    setParseError(null);
    setFileName(file.name);
    try {
      const { parseBulkUsersFile, validateBulkUsers } = await import("@/lib/bulk-user-import");
      const rows = await parseBulkUsersFile(file);
      const result = validateBulkUsers(rows, {
        existingEmails: members.map((m) => m.email),
        stores,
        members,
      });
      setValidation(result);
      setStep("preview");
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Could not read the file.");
      setValidation(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    if (!validation) return;
    const validRows = validation.previewRows.filter((r) => r.valid);
    if (validRows.length === 0) return;
    setBusy(true);
    try {
      const { importBulkUsers } = await import("@/lib/bulk-user-import");
      const result = await importBulkUsers(validRows);
      setImportResult(result);
      setStep("done");
      onImported?.();
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk invite users</DialogTitle>
          <DialogDescription>
            Upload CSV or XLSX with columns: Name, Email, Role, Reports To, Stores. Then validate,
            preview, and invite.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <label className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-muted/40 px-6 py-10 text-center transition-colors hover:border-primary/60">
              <Upload className="size-8 text-[#7DB7D6]" />
              <div>
                <p className="text-sm font-medium text-[#102A43]">
                  {busy ? "Reading file…" : "Drop a file or click to upload"}
                </p>
                <p className="mt-1 text-xs text-[#667085]">.csv or .xlsx</p>
              </div>
              <input
                type="file"
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                  e.target.value = "";
                }}
              />
            </label>
            {parseError && (
              <p className="rounded-xl border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {parseError}
              </p>
            )}
          </div>
        )}

        {step === "preview" && validation && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline" className="rounded-md">
                {fileName ?? "File"}
              </Badge>
              <span className="text-[#667085]">
                {validation.total} rows · {validation.valid} valid · {validation.duplicates}{" "}
                duplicates · {validation.errors.length} issues
              </span>
            </div>

            <div className="max-h-64 overflow-auto rounded-xl border border-[#D9E2E8]">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-[#EEF1F4] text-[#667085]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Row</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Role</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {validation.previewRows.slice(0, 50).map((row) => (
                    <tr key={row.rowNumber} className="border-t border-[#D9E2E8]">
                      <td className="px-3 py-2 text-[#667085]">{row.rowNumber}</td>
                      <td className="px-3 py-2 text-[#102A43]">{row.name || "—"}</td>
                      <td className="px-3 py-2 text-[#667085]">{row.email || "—"}</td>
                      <td className="px-3 py-2 text-[#667085]">{row.roleNormalized ?? row.role}</td>
                      <td className="px-3 py-2">
                        {row.valid ? (
                          <span className="text-[#102A43]">
                            {row.existingMemberId ? "Update" : "Invite"}
                          </span>
                        ) : (
                          <span className="text-destructive">{row.error ?? "Invalid"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {validation.errors.length > 0 && (
              <div className="max-h-24 overflow-y-auto rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                {validation.errors.slice(0, 12).map((err) => (
                  <p key={err}>{err}</p>
                ))}
                {validation.errors.length > 12 && (
                  <p>+{validation.errors.length - 12} more…</p>
                )}
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="subtle"
                disabled={busy}
                onClick={() => {
                  setStep("upload");
                  setValidation(null);
                }}
              >
                Back
              </Button>
              <Button
                disabled={busy || validation.valid === 0}
                onClick={() => void handleImport()}
              >
                <Mail className="size-4" />
                {busy ? "Importing…" : `Import ${validation.valid} user${validation.valid === 1 ? "" : "s"}`}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "done" && importResult && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[#D9E2E8] bg-white p-5">
              <p className="text-sm font-medium text-[#102A43]">Import complete</p>
              <p className="mt-2 text-sm text-[#667085]">
                {importResult.invited} invited · {importResult.updated} updated ·{" "}
                {importResult.failed} failed
              </p>
              {importResult.errors.length > 0 && (
                <div className="mt-3 max-h-32 overflow-y-auto text-xs text-destructive">
                  {importResult.errors.map((err) => (
                    <p key={err}>{err}</p>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------- my team ----------

export function MyTeamSection({
  members,
  loading,
  error,
  onRetry,
  onOpenUser,
}: {
  members: OrgUser[];
  loading?: boolean | undefined;
  error?: boolean | undefined;
  onRetry?: (() => void) | undefined;
  onOpenUser?: ((user: OrgUser) => void) | undefined;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="size-4 text-[#9B86D9]" />
        <h2 className="text-base font-semibold text-[#102A43]">My team</h2>
      </div>
      <p className="max-w-2xl text-sm text-[#667085]">
        People who report directly to you. Their store access contributes to your inherited scope.
      </p>
      <div className="rounded-2xl border border-[#D9E2E8] bg-white p-5 shadow-sm">
        {loading ? (
          <div className="space-y-3" aria-busy="true">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-64" />
          </div>
        ) : error ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Could not load your direct reports.</p>
            {onRetry && (
              <Button variant="subtle" size="sm" onClick={onRetry}>
                Retry
              </Button>
            )}
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No direct reports yet. Assign “Reports to” when inviting or editing members.
          </p>
        ) : (
          <ul className="divide-y divide-[#D9E2E8]">
            {members.map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <button
                  type="button"
                  className="flex min-w-0 items-center gap-3 text-left"
                  onClick={() => onOpenUser?.(member)}
                >
                  <Avatar className="size-8">
                    {member.avatar_url && <AvatarImage src={member.avatar_url} alt="" />}
                    <AvatarFallback className="text-xs">{userInitials(member)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[#102A43]">
                      {member.name ?? "Invited user"}
                    </p>
                    <p className="truncate text-xs text-[#667085]">{member.email}</p>
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  <RoleBadge role={member.role} />
                  <span className="text-xs text-[#667085]">
                    {formatCount(member.direct_store_count)} stores
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function BulkImportTriggerButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="subtle" onClick={onClick}>
      <FileUp className="size-4" /> Bulk invite
    </Button>
  );
}
