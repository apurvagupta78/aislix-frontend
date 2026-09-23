/**
 * App-wide manager filter state — persists in sessionStorage across manager pages.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_DASHBOARD_FILTERS,
  type DashboardFilterOptions,
  type DashboardFilterState,
} from "@/lib/dashboard-filters";
import { fetchDashboardFilterOptions } from "@/lib/dashboard-intelligence";

const STORAGE_KEY = "aislix_global_filters_v2";

type GlobalFilterContextValue = {
  filters: DashboardFilterState;
  setFilters: (next: DashboardFilterState | ((prev: DashboardFilterState) => DashboardFilterState)) => void;
  options: DashboardFilterOptions | null;
  optionsLoading: boolean;
};

const GlobalFilterContext = createContext<GlobalFilterContextValue | null>(null);

function loadStoredFilters(): DashboardFilterState {
  if (typeof window === "undefined") return DEFAULT_DASHBOARD_FILTERS;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DASHBOARD_FILTERS;
    return { ...DEFAULT_DASHBOARD_FILTERS, ...(JSON.parse(raw) as Partial<DashboardFilterState>) };
  } catch {
    return DEFAULT_DASHBOARD_FILTERS;
  }
}

export function GlobalFilterProvider({ children }: { children: ReactNode }) {
  const [filters, setFiltersState] = useState<DashboardFilterState>(loadStoredFilters);
  const [options, setOptions] = useState<DashboardFilterOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    let cancelled = false;
    void fetchDashboardFilterOptions()
      .then((data) => {
        if (!cancelled) setOptions(data);
      })
      .finally(() => {
        if (!cancelled) setOptionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setFilters = useCallback(
    (next: DashboardFilterState | ((prev: DashboardFilterState) => DashboardFilterState)) => {
      setFiltersState(next);
    },
    [],
  );

  const value = useMemo(
    () => ({ filters, setFilters, options, optionsLoading }),
    [filters, setFilters, options, optionsLoading],
  );

  return <GlobalFilterContext.Provider value={value}>{children}</GlobalFilterContext.Provider>;
}

export function useGlobalFilters(): GlobalFilterContextValue {
  const ctx = useContext(GlobalFilterContext);
  if (!ctx) {
    throw new Error("useGlobalFilters must be used within GlobalFilterProvider");
  }
  return ctx;
}

export function useOptionalGlobalFilters(): GlobalFilterContextValue | null {
  return useContext(GlobalFilterContext);
}

/** Pages that should show the global filter bar */
export const GLOBAL_FILTER_PATHS = [
  "/dashboard",
  "/exceptions",
  "/findings",
  "/audit-intelligence",
  "/sku-intelligence",
  "/corrective-actions",
  "/assigned-scans",
  "/history",
  "/intelligence/inventory-variance",
  "/expiry-control",
  "/reports",
] as const;

export function pathUsesGlobalFilters(pathname: string): boolean {
  return GLOBAL_FILTER_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Main Control Tower and Operations Dashboard embed filters in-page (not AppShell top). */
export function pathShowsGlobalFilterBarInShell(pathname: string): boolean {
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return false;
  if (pathname === "/" || pathname === "") return false;
  return pathUsesGlobalFilters(pathname);
}
