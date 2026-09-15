import type { HierarchyLevelConfig, OperatingModel } from "@/lib/audit-builder/types";

export type HierarchyProfile = {
  id: string;
  org_id: string;
  operating_model: OperatingModel;
  name: string;
  description: string | null;
  levels: HierarchyLevelConfig[];
  is_default: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
};

export type HierarchyNode = {
  id: string;
  org_id: string;
  profile_id: string;
  level_key: string;
  parent_id: string | null;
  name: string;
  code: string | null;
  external_id: string | null;
  external_type: string | null;
  metadata: Record<string, unknown>;
  active: boolean;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
};

export type HierarchyNodeInput = {
  profile_id: string;
  level_key: string;
  parent_id?: string | null;
  name: string;
  code?: string | null;
  external_id?: string | null;
  external_type?: string | null;
  metadata?: Record<string, unknown>;
  active?: boolean;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type HierarchySearchParams = {
  profileId: string;
  levelKey?: string;
  parentId?: string | null;
  query?: string;
  activeOnly?: boolean;
  limit?: number;
};
