#!/usr/bin/env python3
"""Restore pre-migration scan-named routes and revert /audit URL links."""

from __future__ import annotations

import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ROUTES = ROOT / "src" / "routes"
BASE = "8119c57"

RESTORE_FILES = (
    "src/routes/scan.tsx",
    "src/routes/my-scans.tsx",
    "src/routes/assign-scan.tsx",
    "src/routes/assigned-scans.tsx",
    "src/routes/admin.scans.tsx",
    "src/routes/admin.demo-scans.tsx",
    "src/routes/demo-scans.tsx",
    "src/routes/upload.tsx",
    "src/routeTree.gen.ts",
)

DELETE_FILES = (
    "src/routes/audit.tsx",
    "src/routes/my-audits.tsx",
    "src/routes/assign-audit.tsx",
    "src/routes/assigned-audits.tsx",
    "src/routes/admin.audits.tsx",
    "src/routes/admin.demo-audits.tsx",
)

URL_REPLACEMENTS = (
    ('to="/admin/demo-audits"', 'to="/admin/demo-scans"'),
    ('to="/admin/audits"', 'to="/admin/scans"'),
    ('to="/assigned-audits"', 'to="/assigned-scans"'),
    ('to="/assign-audit"', 'to="/assign-scan"'),
    ('to="/my-audits"', 'to="/my-scans"'),
    ('to="/audit"', 'to="/scan"'),
    ("to: '/admin/demo-audits'", "to: '/admin/demo-scans'"),
    ("to: '/admin/audits'", "to: '/admin/scans'"),
    ("to: '/assigned-audits'", "to: '/assigned-scans'"),
    ("to: '/assign-audit'", "to: '/assign-scan'"),
    ("to: '/my-audits'", "to: '/my-scans'"),
    ("to: '/audit'", "to: '/scan'"),
    ('redirect({ to: "/audit"', 'redirect({ to: "/scan"'),
)

SKIP_DIRS = {"node_modules", ".git"}
SKIP_FILES = {
    "restore-scan-routes.py",
    "replace-scan-terminology.py",
    "replace-scan-phrases.py",
    "replace-scan-jsx-text.py",
    "finish-audit-terminology.py",
    "patch-route-tree.py",
    "strip-legacy-scan-routes-from-tree.py",
}


def git_show(path: str) -> str:
    return subprocess.check_output(
        ["git", "show", f"{BASE}:{path}"],
        cwd=ROOT,
        text=True,
    ).lstrip("\ufeff")


def main() -> None:
    for rel in RESTORE_FILES:
        target = ROOT / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(git_show(rel), encoding="utf-8")
        print("restored", rel)

    for rel in DELETE_FILES:
        target = ROOT / rel
        if target.exists():
            target.unlink()
            print("deleted", rel)

    for path in (ROOT / "src").rglob("*"):
        if not path.is_file():
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.name in SKIP_FILES:
            continue
        if path.suffix not in (".tsx", ".ts", ".md"):
            continue
        rel = path.relative_to(ROOT).as_posix()
        if rel.startswith("src/routes/") and path.name in {
            "scan.tsx",
            "my-scans.tsx",
            "assign-scan.tsx",
            "assigned-scans.tsx",
            "admin.scans.tsx",
            "admin.demo-scans.tsx",
            "demo-scans.tsx",
            "upload.tsx",
        }:
            continue
        if rel == "src/routeTree.gen.ts":
            continue

        text = path.read_text(encoding="utf-8")
        original = text
        for old, new in URL_REPLACEMENTS:
            text = text.replace(old, new)
        if text != original:
            path.write_text(text, encoding="utf-8")
            print("updated links in", rel)

    print("Done — scan routes restored.")


if __name__ == "__main__":
    main()
