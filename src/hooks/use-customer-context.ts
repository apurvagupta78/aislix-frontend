import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getUser, requireOrgId } from "@/lib/db/context";
import {
  defaultViewMode,
  inferRoleFamily,
  normalizeCustomerType,
  normalizeRoleFamily,
  type CustomerContext,
  type CustomerType,
  type ResultViewMode,
  type RoleFamily,
} from "@/lib/customer-context";
import { fetchBrandConfig, type BrandConfig } from "@/lib/brand-intel";

export type WorkspaceContext = CustomerContext & {
  brandConfig: BrandConfig;
  hasBrandConfig: boolean;
};

async function loadWorkspaceContext(): Promise<WorkspaceContext> {
  const user = await getUser();
  if (!user) {
    return {
      customerType: "supermarket",
      roleFamily: "operations",
      jobTitle: "",
      viewMode: "execution",
      brandConfig: { primary_brand: "", competitor_brands: [] },
      hasBrandConfig: false,
    };
  }

  const orgId = await requireOrgId();
  const [{ data: profile }, { data: org }, brandConfig] = await Promise.all([
    supabase
      .from("profiles")
      .select("job_title, role_family")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("organizations")
      .select("customer_type, industry")
      .eq("id", orgId)
      .maybeSingle(),
    fetchBrandConfig(),
  ]);

  const customerType = normalizeCustomerType(
    (org as { customer_type?: string | null })?.customer_type ?? org?.industry,
  );
  const jobTitle = profile?.job_title ?? "";
  const roleFamily: RoleFamily =
    profile?.role_family != null && String(profile.role_family).trim()
      ? normalizeRoleFamily(profile.role_family)
      : inferRoleFamily(jobTitle, customerType);
  const viewMode = defaultViewMode(roleFamily, customerType);
  const hasBrandConfig = Boolean(brandConfig.primary_brand.trim());

  return {
    customerType,
    roleFamily,
    jobTitle,
    viewMode,
    brandConfig,
    hasBrandConfig,
  };
}

export function useWorkspaceContext() {
  return useQuery({
    queryKey: ["workspace-context"],
    queryFn: loadWorkspaceContext,
    staleTime: 60_000,
  });
}

export function useResultViewMode(
  override?: ResultViewMode,
): ResultViewMode | undefined {
  const query = useWorkspaceContext();
  return override ?? query.data?.viewMode;
}

export { type CustomerType, type RoleFamily, type ResultViewMode };
