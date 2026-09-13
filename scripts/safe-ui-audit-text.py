#!/usr/bin/env python3
"""Replace scan/scans with audit/audits ONLY in JSX user-visible text — never touch imports or routes."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src"

# Text between JSX tags: >...<
JSX_TEXT = re.compile(r">([^<>{}]+)<")

REPLACEMENTS = [
    (re.compile(r"\bRe-scans\b"), "Re-audits"),
    (re.compile(r"\bRe-scan\b"), "Re-audit"),
    (re.compile(r"\bRescans\b"), "Re-audits"),
    (re.compile(r"\bRescan\b"), "Re-audit"),
    (re.compile(r"\brescans\b"), "re-audits"),
    (re.compile(r"\brescan\b"), "re-audit"),
    (re.compile(r"\bScans\b"), "Audits"),
    (re.compile(r"\bScan\b"), "Audit"),
    (re.compile(r"\bscans\b"), "audits"),
    (re.compile(r"\bscan\b"), "audit"),
]

SKIP_IN_TEXT = (
    "/scan", "/my-scans", "scan_id", "scanId", "scan-api", "scan-history",
    "scan-results", "scan-context", "scan-report", "landing/scan",
)


def transform_jsx_text(text: str) -> str:
    if any(s in text for s in SKIP_IN_TEXT):
        return text
    out = text
    for pat, repl in REPLACEMENTS:
        out = pat.sub(repl, out)
    return out


def process(content: str) -> str:
    def repl(m: re.Match[str]) -> str:
        inner = m.group(1)
        if not inner.strip() or inner.strip().startswith(("{", "//")):
            return m.group(0)
        return ">" + transform_jsx_text(inner) + "<"

    return JSX_TEXT.sub(repl, content)


def main() -> None:
    changed = 0
    for path in sorted(ROOT.rglob("*")):
        if path.suffix not in {".tsx"}:
            continue
        if "/routes/" in path.as_posix():
            continue  # never touch route files
        original = path.read_text(encoding="utf-8")
        updated = process(original)
        if updated != original:
            path.write_text(updated, encoding="utf-8")
            changed += 1
            print(f"updated: {path.relative_to(ROOT.parent)}")
    print(f"Done — {changed} component files")


if __name__ == "__main__":
    main()
