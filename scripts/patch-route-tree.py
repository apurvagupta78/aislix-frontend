#!/usr/bin/env python3
"""Patch routeTree.gen.ts to register new audit-named routes."""

from pathlib import Path

ROUTE_TREE = Path(__file__).resolve().parents[1] / "src" / "routeTree.gen.ts"
text = ROUTE_TREE.read_text(encoding="utf-8-sig")

IMPORTS = """
import { Route as AssignAuditRouteImport } from './routes/assign-audit'
import { Route as AssignedAuditsRouteImport } from './routes/assigned-audits'
import { Route as AuditRouteImport } from './routes/audit'
import { Route as MyAuditsRouteImport } from './routes/my-audits'
import { Route as AdminAuditsRouteImport } from './routes/admin.audits'
import { Route as AdminDemoAuditsRouteImport } from './routes/admin.demo-audits'
"""

if "AuditRouteImport" not in text:
    anchor = "import { Route as AssignScanRouteImport }"
    text = text.replace(anchor, IMPORTS + anchor)

CONST_BLOCK = """
const AssignAuditRoute = AssignAuditRouteImport.update({
  id: '/assign-audit',
  path: '/assign-audit',
  getParentRoute: () => rootRouteImport,
} as any)
const AssignedAuditsRoute = AssignedAuditsRouteImport.update({
  id: '/assigned-audits',
  path: '/assigned-audits',
  getParentRoute: () => rootRouteImport,
} as any)
const AuditRoute = AuditRouteImport.update({
  id: '/audit',
  path: '/audit',
  getParentRoute: () => rootRouteImport,
} as any)
const MyAuditsRoute = MyAuditsRouteImport.update({
  id: '/my-audits',
  path: '/my-audits',
  getParentRoute: () => rootRouteImport,
} as any)
"""

if "const AuditRoute =" not in text:
    text = text.replace("const AssignScanRoute = AssignScanRouteImport.update({", CONST_BLOCK + "const AssignScanRoute = AssignScanRouteImport.update({")

# Admin audit imports are added in IMPORTS block above — skip duplicate insertion.

if "const AdminAuditsRoute =" not in text:
    admin_block = """
const AdminAuditsRoute = AdminAuditsRouteImport.update({
  id: '/audits',
  path: '/audits',
  getParentRoute: () => AdminRoute,
} as any)
const AdminDemoAuditsRoute = AdminDemoAuditsRouteImport.update({
  id: '/demo-audits',
  path: '/demo-audits',
  getParentRoute: () => AdminRoute,
} as any)
"""
    text = text.replace("const AdminScansRoute = AdminScansRouteImport.update({", admin_block + "const AdminScansRoute = AdminScansRouteImport.update({")

# Fix broken admin scans path from prior partial edit
text = text.replace(
    """const AdminScansRoute = AdminScansRouteImport.update({
  id: '/audits',
  path: '/audits',
  getParentRoute: () => AdminRoute,
} as any)""",
    """const AdminScansRoute = AdminScansRouteImport.update({
  id: '/scans',
  path: '/scans',
  getParentRoute: () => AdminRoute,
} as any)""",
)

# Root children
for name, route in [
    ("AssignAuditRoute", "AssignAuditRoute"),
    ("AssignedAuditsRoute", "AssignedAuditsRoute"),
    ("AuditRoute", "AuditRoute"),
    ("MyAuditsRoute", "MyAuditsRoute"),
]:
    if f"  {name}: typeof {route}" not in text:
        text = text.replace(
            f"  AssignScanRoute: typeof AssignScanRoute",
            f"  AssignAuditRoute: typeof AssignAuditRoute\n  AssignScanRoute: typeof AssignScanRoute",
            1,
        )
        text = text.replace(
            f"  AssignedScansRoute: typeof AssignedScansRoute",
            f"  AssignedAuditsRoute: typeof AssignedAuditsRoute\n  AssignedScansRoute: typeof AssignedScansRoute",
            1,
        )
        text = text.replace(
            f"  MyScansRoute: typeof MyScansRoute",
            f"  MyAuditsRoute: typeof MyAuditsRoute\n  MyScansRoute: typeof MyScansRoute",
            1,
        )
        text = text.replace(
            f"  ScanRoute: typeof ScanRoute",
            f"  AuditRoute: typeof AuditRoute\n  ScanRoute: typeof ScanRoute",
            1,
        )
        break

# Admin children
if "AdminAuditsRoute: typeof AdminAuditsRoute" not in text:
    text = text.replace(
        "  AdminScansRoute: typeof AdminScansRoute",
        "  AdminAuditsRoute: typeof AdminAuditsRoute\n  AdminDemoAuditsRoute: typeof AdminDemoAuditsRoute\n  AdminScansRoute: typeof AdminScansRoute",
    )
    text = text.replace(
        "  AdminScansRoute: AdminScansRoute,",
        "  AdminAuditsRoute: AdminAuditsRoute,\n  AdminDemoAuditsRoute: AdminDemoAuditsRoute,\n  AdminScansRoute: AdminScansRoute,",
    )

# rootRouteChildren object
pairs = [
    ("AssignAuditRoute: AssignAuditRoute,", "AssignScanRoute: AssignScanRoute,"),
    ("AssignedAuditsRoute: AssignedAuditsRoute,", "AssignedScansRoute: AssignedScansRoute,"),
    ("MyAuditsRoute: MyAuditsRoute,", "MyScansRoute: MyScansRoute,"),
    ("AuditRoute: AuditRoute,", "ScanRoute: ScanRoute,"),
]
for new_line, anchor in pairs:
    if new_line not in text:
        text = text.replace(f"  {anchor}", f"  {new_line}\n  {anchor}", 1)

# Type path unions — add new paths near legacy ones
path_additions = [
    ("  | '/assign-audit'", "  | '/assign-scan'"),
    ("  | '/assigned-audits'", "  | '/assigned-scans'"),
    ("  | '/audit'", "  | '/scan'"),
    ("  | '/my-audits'", "  | '/my-scans'"),
    ("  | '/admin/audits'", "  | '/admin/scans'"),
    ("  | '/admin/demo-audits'", "  | '/admin/demo-scans'"),
]
for new_path, anchor in path_additions:
    if new_path not in text:
        text = text.replace(anchor, new_path + "\n" + anchor, 1)

ROUTE_TREE.write_text(text, encoding="utf-8")
print("Patched routeTree.gen.ts")
