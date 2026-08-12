import { useMemo, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { formatAssignmentId } from "@/components/AssignmentId";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/States";
import { toUserMessage } from "@/lib/api/errors";
import { fetchShelfCategories } from "@/lib/categories.functions";
import { FALLBACK_CATEGORIES, type ShelfCategory } from "@/lib/categories.data";
import { fetchPlanogramSnapshot, fetchPlanogramStores } from "@/lib/planogram";
import { dominantScope } from "@/components/planogram/AssignScanDialog";
import {
  createScanAssignment,
  fetchAssignableMembers,
  isOrgManager,
  type ScopeType,
} from "@/lib/assignments";


export const Route = createFileRoute("/assign-scan")({
  validateSearch: (search: Record<string, unknown>) => ({
    store: typeof search.store === "string" ? search.store : undefined,
  }),

  head: () => ({
    meta: [
      { title: "Assign Scan — Delegate a shelf audit | Aislix" },
      {
        name: "description",
        content:
          "Assign a shelf audit to a team member by category, sub-category or shelf location, with a due date and instructions.",
      },
      { property: "og:title", content: "Assign Scan — Aislix" },
      {
        property: "og:description",
        content: "Delegate shelf audits to your store team and track them to completion in Aislix.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AssignScanPage,
});

const card = "rounded-2xl border border-border bg-card p-5 shadow-sm";

function AssignScanPage() {
  const navigate = useNavigate();
  const { store: storeFromSearch } = Route.useSearch();
  const [storeId, setStoreId] = useState(storeFromSearch ?? "");

  const [scopeType, setScopeType] = useState<ScopeType>("category");
  const [category, setCategory] = useState("");
  const [subCategory, setSubCategory] = useState("");
  const [location, setLocation] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [instructions, setInstructions] = useState("");

  const accessQuery = useQuery({
    queryKey: ["assignment-manager"],
    queryFn: () => isOrgManager(),
    retry: false,
  });
  const storesQuery = useQuery({
    queryKey: ["planogram-stores"],
    queryFn: () => fetchPlanogramStores(),
    retry: false,
  });
  const membersQuery = useQuery({
    queryKey: ["assignable-members"],
    queryFn: () => fetchAssignableMembers(),
    retry: false,
  });
  const categoriesQuery = useQuery({
    queryKey: ["shelf-categories"],
    queryFn: () => fetchShelfCategories(),
    staleTime: 10 * 60_000,
  });
  const categories: ShelfCategory[] = categoriesQuery.data?.length
    ? categoriesQuery.data
    : FALLBACK_CATEGORIES;
  const subCategories = useMemo(
    () => categories.find((item) => item.name === category)?.subcategories ?? [],
    [categories, category],
  );

  const members = membersQuery.data ?? [];
  const assignee = members.find((member) => member.user_id === assigneeId);

  const assignMutation = useMutation({
    mutationFn: () =>
      createScanAssignment({
        storeId,
        scopeType,
        scopeValues:
          scopeType === "location"
            ? { location: location.trim() }
            : scopeType === "sub_category"
              ? { category, sub_category: subCategory }
              : { category },
        assigneeId,
        assigneeName: assignee?.name ?? "team member",
        dueAt: dueAt || null,
        instructions,
      }),
    onSuccess: (assignmentId) => {
      toast.success(
        `Scan assigned to ${assignee?.name ?? "team member"} — ID: ${formatAssignmentId(assignmentId)}`,
      );
      void navigate({ to: "/assigned-scans" });
    },
    onError: (error) => toast.error(toUserMessage(error)),
  });

  function submit(): void {
    if (!storeId) {
      toast.error("Select a store first.");
      return;
    }
    if (!assigneeId) {
      toast.error("Select a team member to assign to.");
      return;
    }
    if (scopeType === "location" && !location.trim()) {
      toast.error("Enter the location or shelf label.");
      return;
    }
    if (scopeType !== "location" && !category) {
      toast.error("Select a category.");
      return;
    }
    if (scopeType === "sub_category" && !subCategory) {
      toast.error("Select a sub-category.");
      return;
    }
    assignMutation.mutate();
  }

  if (accessQuery.data === false) {
    return (
      <AppShell title="Assign Scan" description="Delegate a shelf audit to your team.">
        <EmptyState
          title="Manager access required"
          description="Only owners, admins and managers can assign scans. Ask your workspace owner for access."
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Assign Scan"
      description="Send a scoped shelf audit to a team member and track it through to completion."
    >
      <div className="max-w-3xl space-y-6">
        <section className={card}>
          <h2 className="text-sm font-semibold text-foreground">Step 1 · Select store</h2>
          <div className="mt-3 max-w-xs">
            {storesQuery.isLoading ? (
              <Skeleton className="h-10 w-full rounded-xl" />
            ) : (
              <Select value={storeId} onValueChange={setStoreId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Choose a store" />
                </SelectTrigger>
                <SelectContent>
                  {(storesQuery.data ?? []).map((store) => (
                    <SelectItem key={store.id} value={store.id}>
                      {store.name}
                      {store.code ? ` · ${store.code}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </section>

        <section className={card}>
          <h2 className="text-sm font-semibold text-foreground">Step 2 · Scope</h2>
          <Tabs
            value={scopeType}
            onValueChange={(value) => setScopeType(value as ScopeType)}
            className="mt-3"
          >
            <TabsList className="rounded-xl">
              <TabsTrigger value="category">By category</TabsTrigger>
              <TabsTrigger value="sub_category">By sub-category</TabsTrigger>
              <TabsTrigger value="location">By location</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {scopeType !== "location" && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Category</Label>
                <Select
                  value={category}
                  onValueChange={(value) => {
                    setCategory(value);
                    setSubCategory("");
                  }}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((item) => (
                      <SelectItem key={item.name} value={item.name}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {scopeType === "sub_category" && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Sub-category</Label>
                <Select
                  value={subCategory}
                  onValueChange={setSubCategory}
                  disabled={!subCategories.length}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue
                      placeholder={
                        subCategories.length ? "Select sub-category" : "Select a category first"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {subCategories.map((sub) => (
                      <SelectItem key={sub.id} value={sub.label}>
                        {sub.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {scopeType === "location" && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground" htmlFor="location">
                  Location / shelf label
                </Label>
                <Input
                  id="location"
                  className="rounded-xl"
                  placeholder="e.g. A-1-Z"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                />
              </div>
            )}
          </div>
        </section>

        <section className={card}>
          <h2 className="text-sm font-semibold text-foreground">Step 3 · Assign to team member</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Assign to team member</Label>
              {membersQuery.isLoading ? (
                <Skeleton className="h-10 w-full rounded-xl" />
              ) : members.length ? (
                <Select value={assigneeId} onValueChange={setAssigneeId}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Select a team member" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((member) => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        {member.name}
                        {member.email ? ` · ${member.email}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Invite a team member first —{" "}
                  <Link to="/team" className="font-medium text-brand underline">
                    go to Team
                  </Link>
                  .
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground" htmlFor="due">
                Due date (optional)
              </Label>
              <Input
                id="due"
                type="date"
                className="rounded-xl"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs text-muted-foreground" htmlFor="instructions">
                Instructions (optional)
              </Label>
              <Textarea
                id="instructions"
                className="rounded-xl"
                rows={3}
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="brand"
              className="rounded-xl"
              disabled={assignMutation.isPending || !members.length}
              onClick={submit}
            >
              {assignMutation.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 size-4" />
              )}
              Assign scan
            </Button>
            <Button variant="outline" className="rounded-xl" asChild>
              <Link to="/assigned-scans">View assigned scans</Link>
            </Button>
          </div>
          {membersQuery.isError && (
            <p className="mt-3 text-sm text-destructive">{toUserMessage(membersQuery.error)}</p>
          )}
        </section>
      </div>
    </AppShell>
  );
}
