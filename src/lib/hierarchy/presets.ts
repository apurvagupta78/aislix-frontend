import type { HierarchyLevelConfig, OperatingModel } from "@/lib/audit-builder/types";

export const DEFAULT_HIERARCHY_LEVELS: Record<
  Exclude<OperatingModel, "custom">,
  HierarchyLevelConfig[]
> = {
  local_store: [
    { key: "region", label: "Region", order: 1 },
    { key: "city", label: "City", order: 2 },
    { key: "store", label: "Store", order: 3, masterDataSource: "store" },
    { key: "department", label: "Department/Aisle", order: 4 },
    { key: "shelf", label: "Shelf", order: 5 },
    { key: "sku", label: "SKU", order: 6, masterDataSource: "product" },
  ],
  supermarket: [
    { key: "region", label: "Region", order: 1 },
    { key: "city", label: "City", order: 2 },
    { key: "store", label: "Store", order: 3, masterDataSource: "store" },
    { key: "department", label: "Department", order: 4 },
    { key: "aisle", label: "Aisle", order: 5 },
    { key: "shelf", label: "Shelf", order: 6 },
    { key: "sku", label: "SKU", order: 7, masterDataSource: "product" },
  ],
  dark_store: [
    { key: "region", label: "Region", order: 1 },
    { key: "city", label: "City", order: 2 },
    { key: "dark_store", label: "Dark Store", order: 3, masterDataSource: "store" },
    { key: "zone", label: "Zone", order: 4 },
    { key: "shelf", label: "Shelf/Pick Face", order: 5 },
    { key: "sku", label: "SKU", order: 6, masterDataSource: "product" },
    { key: "batch", label: "Batch/Unit", order: 7 },
  ],
  warehouse: [
    { key: "region", label: "Region", order: 1 },
    { key: "city", label: "City", order: 2 },
    { key: "warehouse", label: "Warehouse", order: 3, masterDataSource: "warehouse" },
    { key: "zone", label: "Zone", order: 4 },
    { key: "aisle", label: "Aisle", order: 5 },
    { key: "rack", label: "Rack", order: 6 },
    { key: "bin", label: "Bin", order: 7 },
    { key: "sku", label: "SKU/Batch", order: 8, masterDataSource: "product" },
  ],
  fmcg_distributor: [
    { key: "region", label: "Region", order: 1 },
    { key: "territory", label: "Territory", order: 2 },
    { key: "area", label: "Area", order: 3 },
    { key: "distributor", label: "Distributor", order: 4, masterDataSource: "distributor" },
    { key: "sales_rep", label: "Sales Representative", order: 5, masterDataSource: "employee" },
    { key: "beat", label: "Beat", order: 6 },
    { key: "outlet", label: "Outlet", order: 7, masterDataSource: "outlet" },
    { key: "category", label: "Category", order: 8, masterDataSource: "category" },
    { key: "brand", label: "Brand", order: 9, masterDataSource: "brand" },
    { key: "sku", label: "SKU", order: 10, masterDataSource: "product" },
  ],
};

export function getDefaultLevels(model: OperatingModel): HierarchyLevelConfig[] {
  if (model === "custom") return [];
  return DEFAULT_HIERARCHY_LEVELS[model];
}
