"""One-off script to apply Magic Patterns reskin patches."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def patch_app_shell() -> None:
    p = ROOT / "src/components/AppShell.tsx"
    t = p.read_text(encoding="utf-8")
    t = t.replace(
        '"nav-dark nav-panel fixed inset-y-0 left-0 z-40 hidden h-screen flex-col border-y-0 border-l-0 py-5 lg:flex"',
        '"fixed inset-y-0 left-0 z-40 hidden h-screen flex-col border-r border-line bg-white lg:flex"',
    )
    t = t.replace(
        'sidebarCollapsed ? "w-16 items-center px-2" : "w-64 px-4"',
        'sidebarCollapsed ? "w-[68px] items-center px-2 py-4" : "w-[248px] px-3 py-4"',
    )
    t = t.replace(
        "sticky top-0 z-30 border-b border-border bg-background/92 px-3 backdrop-blur-xl sm:px-5",
        "sticky top-0 z-30 border-b border-line bg-white px-3 sm:px-5",
    )
    t = t.replace(
        'className="h-9 rounded-xl border-border bg-surface pl-9"',
        'className="h-10 rounded-lg border-line bg-canvas pl-9"',
    )
    t = t.replace(
        "bg-[var(--aislix-warehouse-bg)] font-semibold text-[var(--aislix-primary)]",
        "bg-local-bg font-semibold text-navy",
    )
    t = t.replace(
        "bg-[var(--aislix-local-bg)] text-[var(--aislix-primary)]",
        "bg-local-bg text-navy",
    )
    p.write_text(t, encoding="utf-8")


def patch_dashboard() -> None:
    p = ROOT / "src/routes/dashboard.tsx"
    t = p.read_text(encoding="utf-8")
    t = t.replace(
        """  return (
    <AppShell
      title="Control Tower"
      description="See what needs attention, drill in, and assign fixes — at a glance."
      actions={
        <Button asChild variant="outline" size="sm" className={NEW_AUDIT_BUTTON_CLASS}>
          <Link to="/new-audit">
            <Plus className="size-4" /> New Audit
          </Link>
        </Button>
      }
    >
      <ControlTowerShell search={search} />
    </AppShell>
  );""",
        """  return (
    <AppShell title="" hidePageHeader>
      <ControlTowerShell search={search} />
    </AppShell>
  );""",
    )
    t = t.replace('import { Link, createFileRoute } from "@tanstack/react-router";\nimport { Plus } from "lucide-react";\n\n', 'import { createFileRoute } from "@tanstack/react-router";\n\n')
    t = t.replace('import { Button } from "@/components/ui/button";\nimport { NEW_AUDIT_BUTTON_CLASS } from "@/lib/aislix-theme";\n', '')
    p.write_text(t, encoding="utf-8")


def patch_control_tower_shell() -> None:
    p = ROOT / "src/components/control-tower/ControlTowerShell.tsx"
    t = p.read_text(encoding="utf-8")
    if "ControlTowerDashboardHeader" not in t:
        t = t.replace(
            'import { WorkspaceFilterBar } from "@/components/filters/GlobalFilterBarShell";',
            'import { WorkspaceFilterBar } from "@/components/filters/GlobalFilterBarShell";\nimport { ControlTowerDashboardHeader } from "./ControlTowerDashboardHeader";',
        )
    operating = """  const operatingModelSection = (
    <section className="overflow-hidden rounded-xl border border-line bg-white shadow-card">
      <div className="border-b border-line px-4 py-3 md:px-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-mp-muted">Operating Model</p>
      </div>
      <div className="p-4 md:p-5">
        <OperatingModelSwitcher value={model} onChange={setModel} />
        {query.data ? (
          <p className="mt-2 text-xs text-mp-muted">
            {query.data.terminology.locationPlural}: contextual labels · {query.data.templateCount}{" "}
            org templates in scope
          </p>
        ) : null}
      </div>
    </section>
  );"""
    import re
    t = re.sub(
        r"  const operatingModelSection = \([\s\S]*?\n  \);\n\n  if \(query\.isLoading\)",
        operating + "\n\n  if (query.isLoading)",
        t,
        count=1,
    )
    if "ControlTowerDashboardHeader" in t and "exportAuditExecutionCsv(data, filters)" in t:
        t = t.replace(
            "  return (\n    <div className=\"space-y-8\">\n      {operatingModelSection}",
            "  return (\n    <div className=\"space-y-8\">\n      <ControlTowerDashboardHeader\n        data={data}\n        filters={filters}\n        onExport={() => exportAuditExecutionCsv(data, filters)}\n      />\n      {operatingModelSection}",
        )
    t = t.replace(
        '<div className="mt-2 flex flex-wrap gap-1.5 rounded-xl border border-border bg-muted/20 p-1.5">',
        '<div className="mt-1 flex flex-wrap gap-1.5 rounded-xl border border-line bg-white p-1.5">',
    )
    p.write_text(t, encoding="utf-8")


def patch_design_index() -> None:
    p = ROOT / "src/components/design-system/index.ts"
    t = p.read_text(encoding="utf-8")
    if "MpCard" not in t:
        t = t.replace(
            'export { PageHeader } from "./PageHeader";',
            'export { PageHeader } from "./PageHeader";\nexport { MpCard, MpCardHeader } from "./MpCard";\nexport { MpBadge, mpStageTone, type MpBadgeTone } from "./MpBadge";',
        )
        p.write_text(t, encoding="utf-8")


if __name__ == "__main__":
    patch_app_shell()
    patch_dashboard()
    patch_control_tower_shell()
    patch_design_index()
    print("Patches applied")
