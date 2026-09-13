#!/usr/bin/env python3
"""Replace scan/scans in JSX text nodes and remaining quoted strings."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src"

REPLACEMENTS = [
    (re.compile(r"\bRe-scan\b"), "Re-audit"),
    (re.compile(r"\bre-scan\b"), "re-audit"),
    (re.compile(r"\bRescan\b"), "Re-audit"),
    (re.compile(r"\brescan\b"), "re-audit"),
    (re.compile(r"\bScanning\b"), "Auditing"),
    (re.compile(r"\bscanning\b"), "auditing"),
    (re.compile(r"\bScanned\b"), "Audited"),
    (re.compile(r"\bscanned\b"), "audited"),
    (re.compile(r"\bScans\b"), "Audits"),
    (re.compile(r"\bscans\b"), "audits"),
    (re.compile(r"\bScan\b"), "Audit"),
    (re.compile(r"\bscan\b"), "audit"),
]

SKIP = {"routeTree.gen.ts", "integrations/supabase/types.ts"}
PRESERVE = [
    r"/scan\b",
    r"/assign-scan",
    r"/assigned-scans",
    r"/my-scans",
    r"/demo-scans",
    r"/scan-history",
    r"\?scan=",
    r"scan=",
    r"scan_id",
    r"scanId",
    r"ScanLine",
    r"ScanRow",
    r"fetchScan",
    r"submitScan",
    r"validateScan",
    r"runScan",
    r"markScan",
    r"downloadScan",
    r"DemoScan",
    r"ScanResult",
    r"ScanProgress",
    r"ScanContext",
    r"ScanHistory",
    r"scan-history",
    r"scan-api",
    r"scan-results",
    r"scan-share",
    r"scan-context",
    r"scan-execution",
    r"scan-compare",
    r"scan-corrections",
    r"scan-pipeline",
    r"scan-report",
    r"landing/scan",
    r"Probe, scan or",
    r"scan mode",
    r"scan payload",
    r"scan service",
    r"scan page",
    r"scan type",
    r"scan volume",
    r"scan metrics",
    r"scan data",
    r"scan attempts",
    r"scan_attempts",
    r"scan quota",
    r"scan limits",
    r"scan pack",
    r"scan usage",
    r"scan history",
    r"scan results",
    r"scan date",
    r"scan ID",
    r"MAX_SCAN",
    r"scan\.tsx",
    r"for scan",
    r"Actions for \$\{scan",
    r"Select \$\{scan",
    r"scan\.",
    r"scan\?",
    r"scan\!",
    r"scan\)",
    r"scan,",
    r"scan;",
    r"\(scan\)",
    r" scan\]",
    r"scan\]",
    r"scan\}",
    r"\{scan\}",
    r"typeof scan",
    r"const scan",
    r"let scan",
    r" scan:",
    r"scan:",
    r"items\.map\(\(scan\)",
    r"onDelete\(scan\)",
    r"scan =>",
    r"scan\)",
    r"each scan",
    r"older scans",
    r"between scans",
    r"comparison scans",
    r"baseline and comparison",
    r"without a \?scan",
    r"\?scan= param",
    r"Viewing a scan",
    r"scan's",
    r"scan and every",
    r"scan context",
    r"scan mode",
    r"per scan",
    r"ready to scan",
    r"assigned scan",
    r"previous scan",
    r"single scan",
    r"this scan",
    r"both scans",
    r"two scans",
    r"All scans",
    r"Compare scans",
    r"Delete scan",
    r"New scan",
    r"Browse scan",
    r"Open scan",
    r"Assign scan",
    r"Scan history",
    r"Scan results",
    r"Scan date",
    r"Scan could",
    r"Scan-based",
    r"Scan \",
    r"Scan {",
    r">Scan<",
    r"Scan ·",
    r"Scan ",
    r" scan ",
    r"scan ",
    r" scan",
    r"scans ",
    r" scans",
    r"scans.",
    r"scans,",
    r"scans·",
    r"scans to",
    r"scans in",
    r"scans from",
    r"scans match",
    r"scans yet",
    r"scans without",
    r"scans —",
    r"scans a day",
    r"scans a month",
    r"Remaining scans",
    r"scan history and",
    r"scan volume",
    r"scan-based",
    r"Scan-based",
]


def transform(text: str) -> str:
    for pat in PRESERVE:
        if re.search(pat, text, re.I):
            return text
    out = text
    for pattern, repl in REPLACEMENTS:
        out = pattern.sub(repl, out)
    return out


def process_tsx(content: str) -> str:
    # JSX text between tags: >...<
    def repl_jsx(m: re.Match[str]) -> str:
        inner = m.group(1)
        if "{" in inner or "}" in inner:
            return m.group(0)
        new = transform(inner)
        if new == inner:
            return m.group(0)
        return f">{new}<"

    content = re.sub(r">([^<>{}]+)<", repl_jsx, content)

    # title/description props that might use template without braces on one line
    for prop in ("title=", "description=", "placeholder=", "aria-label="):
        pass

    return content


def main() -> None:
    changed = 0
    for path in sorted(ROOT.rglob("*.tsx")):
        if path.name in SKIP:
            continue
        original = path.read_text(encoding="utf-8")
        new = process_tsx(original)
        # Also fix common prop string literals missed
        lines = []
        for line in new.splitlines(keepends=True):
            if any(
                x in line
                for x in [
                    'title="Scan',
                    'title="No scan',
                    'description="Open a scan',
                    "Scan history",
                    "Scan results",
                    "New scan",
                    "Assign scan",
                    "Delete scan",
                    "All scans",
                    "Compare scans",
                    "Browse scan",
                    "Go to scan",
                    "Open scan",
                    "Scan date",
                    "Scan could",
                    "Scan-based",
                    "re-scan",
                    "Re-scan",
                    "Request re-scan",
                    "Remaining scans",
                    "5 scans a day",
                    "scan history and",
                ]
            ):
                line = transform(line)
            lines.append(line)
        new = "".join(lines)
        if new != original:
            path.write_text(new, encoding="utf-8")
            changed += 1
            print(path.relative_to(ROOT.parent))
    print(f"Updated {changed} tsx files")


if __name__ == "__main__":
    main()
