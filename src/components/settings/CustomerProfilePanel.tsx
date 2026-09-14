/**
 * Post-onboarding customer type and role family configuration.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserCog } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingsCard, Field } from "@/components/settings/SettingsParts";
import { supabase } from "@/integrations/supabase/client";
import { dbError, getUser, requireOrgId } from "@/lib/db/context";
import {
  CUSTOMER_TYPE_LABELS,
  ROLE_FAMILY_LABELS,
  type CustomerType,
  type RoleFamily,
  normalizeCustomerType,
  normalizeRoleFamily,
} from "@/lib/customer-context";

async function loadProfile() {
  const user = await getUser();
  const orgId = await requireOrgId();
  const [{ data: profile }, { data: org }] = await Promise.all([
    supabase.from("profiles").select("role_family, job_title").eq("id", user!.id).maybeSingle(),
    supabase.from("organizations").select("customer_type").eq("id", orgId).maybeSingle(),
  ]);
  return {
    roleFamily: normalizeRoleFamily(profile?.role_family),
    customerType: normalizeCustomerType(org?.customer_type),
    jobTitle: profile?.job_title ?? "",
  };
}

async function saveProfile(roleFamily: RoleFamily, customerType: CustomerType) {
  const user = await getUser();
  const orgId = await requireOrgId();
  const [{ error: profileError }, { error: orgError }] = await Promise.all([
    supabase.from("profiles").update({ role_family: roleFamily }).eq("id", user!.id),
    supabase.from("organizations").update({ customer_type: customerType }).eq("id", orgId),
  ]);
  if (profileError) dbError(profileError, "Could not update your role.");
  if (orgError) dbError(orgError, "Could not update customer type.");
}

export function CustomerProfilePanel() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["customer-profile-settings"], queryFn: loadProfile });

  const mutation = useMutation({
    mutationFn: ({
      roleFamily,
      customerType,
    }: {
      roleFamily: RoleFamily;
      customerType: CustomerType;
    }) => saveProfile(roleFamily, customerType),
    onSuccess: () => {
      toast.success("Retail profile updated");
      void queryClient.invalidateQueries({ queryKey: ["workspace-context"] });
      void queryClient.invalidateQueries({ queryKey: ["customer-profile-settings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const roleFamily = query.data?.roleFamily ?? "operations";
  const customerType = query.data?.customerType ?? "supermarket";

  return (
    <SettingsCard
      title="Retail profile"
      description="Your customer type and role family drive default result views, dashboard layout, and audit priorities."
      icon={UserCog}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Customer type">
          <Select
            value={customerType}
            onValueChange={(v) =>
              mutation.mutate({ roleFamily, customerType: v as CustomerType })
            }
            disabled={mutation.isPending || query.isLoading}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(CUSTOMER_TYPE_LABELS) as CustomerType[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {CUSTOMER_TYPE_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Role family">
          <Select
            value={roleFamily}
            onValueChange={(v) =>
              mutation.mutate({ roleFamily: v as RoleFamily, customerType })
            }
            disabled={mutation.isPending || query.isLoading}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(ROLE_FAMILY_LABELS) as RoleFamily[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {ROLE_FAMILY_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      {query.data?.jobTitle ? (
        <p className="mt-3 text-xs text-muted-foreground">Job title: {query.data.jobTitle}</p>
      ) : null}
      <p className="mt-2 text-xs text-muted-foreground">
        Audits automatically use this profile — you do not need to re-select role or customer type
        before each audit.
      </p>
      <Button
        variant="subtle"
        size="sm"
        className="mt-3 rounded-xl"
        disabled={query.isLoading}
        onClick={() => void query.refetch()}
      >
        Refresh profile
      </Button>
    </SettingsCard>
  );
}
