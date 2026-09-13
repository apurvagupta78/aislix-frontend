#!/usr/bin/env python3
"""Finish scan→audit terminology: user-facing strings and public URL paths."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src"

# Exact string replacements (user-facing copy and errors)
EXACT: dict[str, str] = {
    "(this scan)": "(this audit)",
    "No reports yet — run your first scan.": "No reports yet — run your first audit.",
    "Scans and reports linked to this store are removed": "Audits and reports linked to this store are removed",
    "re-scan required": "re-audit required",
    "Next scan unlocks in": "Next audit unlocks in",
    "Improved — confirm with another rescan if needed": "Improved — confirm with another re-audit if needed",
    "evidence, take action and rescan to verify the fix.": "evidence, take action and re-audit to verify the fix.",
    "corrections never block scan completion.": "corrections never block audit completion.",
    "Add at least one shelf image to scan.": "Add at least one shelf image to audit.",
    "Could not start the scan.": "Could not start the audit.",
    "Could not load scan status.": "Could not load audit status.",
    "Missing scan.": "Missing audit.",
    "This scan has no report data to export.": "This audit has no report data to export.",
    "No products returned by scan API": "No products returned by audit API",
    "The AI scan pipeline failed unexpectedly.": "The AI audit pipeline failed unexpectedly.",
}

TABLE_HEAD_SCAN = re.compile(r"(<TableHead>)Scans(</TableHead>)")
TABLE_HEAD_SCAN_SINGLE = re.compile(r"(<TableHead>)Scan(</TableHead>)")
DIALOG_SCAN = re.compile(r"(<DialogTitle>)Scan (\{)")

# Public page routes (not API)
ROUTE_MAP = {
    '"/scan"': '"/audit"',
    "'/scan'": "'/audit'",
    "`/scan`": "`/audit`",
    '"/my-scans"': '"/my-audits"',
    '"/assigned-scans"': '"/assigned-audits"',
    '"/assign-scan"': '"/assign-audit"',
    '"/admin/scans"': '"/admin/audits"',
    '"/admin/demo-scans"': '"/admin/demo-audits"',
    '"/demo-scans"': '"/admin/demo-audits"',
    '"/scan-history"': '"/history"',
}

# Path segments in template strings / hrefs
PATH_REPLACEMENTS = [
    (re.compile(r"(?<![\w/-])/scan(?!\w|/)"), "/audit"),
    (re.compile(r"(?<![\w/-])/my-scans(?!\w)"), "/my-audits"),
    (re.compile(r"(?<![\w/-])/assigned-scans(?!\w)"), "/assigned-audits"),
    (re.compile(r"(?<![\w/-])/assign-scan(?!\w)"), "/assign-audit"),
    (re.compile(r"(?<![\w/-])/admin/scans(?!\w)"), "/admin/audits"),
    (re.compile(r"(?<![\w/-])/admin/demo-scans(?!\w)"), "/admin/demo-audits"),
]

SKIP_PATH_PARTS = (
    "/api/scan",
    "/api/public/landing/scan",
    "/scan-images",
    "/scan/export",
    "/scan/",
    "scan-api",
    "scan-history.ts",
    "scan-results",
    "scan-context",
    "scan-share",
    "scan-corrections",
    "scan-pipeline",
    "scan-execution",
    "scan-compare",
    "landing-scan",
)


def should_skip_line(line: str) -> bool:
    stripped = line.strip()
    if stripped.startswith("import ") or stripped.startswith("} from "):
        return True
    if "createFileRoute(" in line and "/scan" in line:
        return True
    return False


def transform(content: str, path: Path) -> str:
    rel = path.as_posix()
    for old, new in EXACT.items():
        content = content.replace(old, new)

    content = TABLE_HEAD_SCAN.sub(r"\1Audits\2", content)
    content = TABLE_HEAD_SCAN_SINGLE.sub(r"\1Audit\2", content)
    content = DIALOG_SCAN.sub(r"\1Audit \2", content)

    # Table header in ReportsLibrary (indented Scan)
    if "ReportsLibrary" in rel:
        content = re.sub(r"(\n\s+)Scan(\n)", r"\1Audit\2", content, count=1)

    # Query param in links and navigate
    content = content.replace("search={{ scan:", "search={{ audit:")
    content = content.replace("search: { scan:", "search: { audit:")
    content = content.replace("?scan=", "?audit=")

    # formatUsageLabel return key
    content = content.replace("formatUsageLabel(usage as unknown as Record<string, unknown>).scans", "formatUsageLabel(usage as unknown as Record<string, unknown>).audits")

    lines = content.splitlines(keepends=True)
    out: list[str] = []
    for line in lines:
        if should_skip_line(line):
            out.append(line)
            continue
        if any(skip in line for skip in SKIP_PATH_PARTS):
            out.append(line)
            continue
        new_line = line
        for old, new in ROUTE_MAP.items():
            new_line = new_line.replace(old, new)
        for pattern, repl in PATH_REPLACEMENTS:
            new_line = pattern.sub(repl, new_line)
        out.append(new_line)
    return "".join(out)


def main() -> None:
    changed = 0
    for path in sorted(ROOT.rglob("*")):
        if path.suffix not in {".ts", ".tsx"}:
            continue
        if path.name == "routeTree.gen.ts":
            continue
        original = path.read_text(encoding="utf-8")
        updated = transform(original, path)
        if updated != original:
            path.write_text(updated, encoding="utf-8")
            changed += 1
            print(f"updated: {path.relative_to(ROOT.parent)}")
    print(f"Done — {changed} files updated.")


if __name__ == "__main__":
    main()
