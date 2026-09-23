/**
 * Anonymous Guest mode — real AppShell routes without a Supabase session.
 * Homepage CTAs set the flag; AuthGate allows AppShell paths when Guest.
 */

import { APP_NAV_SECTIONS } from "@/lib/navigation/app-nav";

export const GUEST_STORAGE_KEY = "aislix:guest-mode";

/** Paths guests may use without signing in (AppShell + scan entry). */
const EXTRA_GUEST_PATHS = new Set([
  "/dashboard",
  "/new-audit",
  "/scan",
  "/guest",
  "/my-scans",
  "/history",
  "/assigned-scans",
  "/audit-calendar",
  "/audit-schedules",
  "/audit-templates",
  "/findings",
  "/corrective-actions",
  "/escalation-settings",
  "/exceptions",
  "/intelligence/inventory-variance",
  "/expiry-control",
  "/audit-intelligence",
  "/stores",
  "/operations/warehouses",
  "/operations/distributors",
  "/sku-intelligence",
  "/store-master",
  "/report",
  "/team",
  "/settings",
]);

function collectNavPaths(): Set<string> {
  const paths = new Set(EXTRA_GUEST_PATHS);
  for (const section of APP_NAV_SECTIONS) {
    for (const item of section.items) {
      if (item.kind === "leaf") paths.add(item.to);
      else for (const child of item.children) paths.add(child.to);
    }
  }
  return paths;
}

const APP_SHELL_PATHS = collectNavPaths();

export function isAppShellGuestPath(path: string): boolean {
  if (APP_SHELL_PATHS.has(path)) return true;
  if (path.startsWith("/dashboard")) return true;
  if (path.startsWith("/stores")) return true;
  if (path.startsWith("/operations/")) return true;
  if (path.startsWith("/intelligence/")) return true;
  if (path.startsWith("/expiry-control")) return true;
  if (path.startsWith("/corrective-actions")) return true;
  if (path.startsWith("/findings")) return true;
  if (path.startsWith("/exceptions")) return true;
  if (path.startsWith("/audit-templates")) return true;
  if (path.startsWith("/manage")) return true;
  return false;
}

export function markGuestMode(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(GUEST_STORAGE_KEY, "1");
}

export function clearGuestMode(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(GUEST_STORAGE_KEY);
}

export function hasGuestFlag(): boolean {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(GUEST_STORAGE_KEY) === "1";
}

/** Sync check for UI (prefer after confirming no session). */
export function readGuestPreference(): boolean {
  return hasGuestFlag();
}
