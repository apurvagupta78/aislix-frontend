#!/usr/bin/env python3
"""Replace user-facing scan/scans terminology with audit/audits in TS/TSX string literals."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src"

# Skip files that are mostly code identifiers / generated
SKIP_FILES = {
    "integrations/supabase/types.ts",
}

# Substrings to preserve even inside strings (URLs, query keys, technical)
PRESERVE_PATTERNS = [
    r"\?scan=",
    r"scan=",
    r"/scan\b",
    r"/scan-history",
    r"/my-scans",
    r"/assigned-scans",
    r"/assign-scan",
    r"/admin/scans",
    r"/admin/demo-scans",
    r"/demo-scans",
    r"scan-report",
    r"scan_id",
    r"scanId",
    r"scan-metrics",
    r"landing/scan",
    r"Probe, scan or disrupt",  # security scanning
    r"network scan",
]

# Order matters: longer / compound forms first
REPLACEMENTS = [
    (re.compile(r"\bRe-scan\b", re.I), lambda m: "Re-audit" if m.group(0)[0].isupper() else "re-audit"),
    (re.compile(r"\bRescan\b", re.I), lambda m: "Re-audit" if m.group(0)[0].isupper() else "re-audit"),
    (re.compile(r"\brescan\b"), "re-audit"),
    (re.compile(r"\bRescans\b"), "Re-audits"),
    (re.compile(r"\brescans\b"), "re-audits"),
    (re.compile(r"\bScanning\b"), "Auditing"),
    (re.compile(r"\bscanning\b"), "auditing"),
    (re.compile(r"\bScanned\b"), "Audited"),
    (re.compile(r"\bscanned\b"), "audited"),
    (re.compile(r"\bScans\b"), "Audits"),
    (re.compile(r"\bscans\b"), "audits"),
    (re.compile(r"\bScan\b"), "Audit"),
    (re.compile(r"\bscan\b"), "audit"),
]


def should_preserve(text: str) -> bool:
    for pat in PRESERVE_PATTERNS:
        if re.search(pat, text, re.I):
            return True
    return False


def transform_string_content(content: str) -> str:
    if should_preserve(content):
        return content
    out = content
    for pattern, repl in REPLACEMENTS:
        if callable(repl):
            out = pattern.sub(repl, out)
        else:
            out = pattern.sub(repl, out)
    return out


def process_file(path: Path) -> bool:
    rel = path.relative_to(ROOT.parent).as_posix()
    if rel.replace("\\", "/") in SKIP_FILES:
        return False

    original = path.read_text(encoding="utf-8")
    result: list[str] = []
    i = 0
    n = len(original)
    changed = False

    while i < n:
        ch = original[i]

        # Single-quoted string
        if ch == "'":
            j = i + 1
            while j < n:
                if original[j] == "\\":
                    j += 2
                    continue
                if original[j] == "'":
                    j += 1
                    break
                j += 1
            raw = original[i:j]
            inner = raw[1:-1]
            new_inner = transform_string_content(inner)
            if new_inner != inner:
                changed = True
            result.append("'" + new_inner + "'")
            i = j
            continue

        # Double-quoted string
        if ch == '"':
            j = i + 1
            while j < n:
                if original[j] == "\\":
                    j += 2
                    continue
                if original[j] == '"':
                    j += 1
                    break
                j += 1
            raw = original[i:j]
            inner = raw[1:-1]
            new_inner = transform_string_content(inner)
            if new_inner != inner:
                changed = True
            result.append('"' + new_inner + '"')
            i = j
            continue

        # Template literal - only replace in static text segments
        if ch == "`":
            j = i + 1
            segments: list[str] = []
            seg_start = j
            while j < n:
                if original[j] == "\\":
                    j += 2
                    continue
                if original[j] == "$" and j + 1 < n and original[j + 1] == "{":
                    # flush static segment
                    seg = original[seg_start:j]
                    new_seg = transform_string_content(seg)
                    if new_seg != seg:
                        changed = True
                    segments.append(new_seg)
                    # skip expression
                    depth = 0
                    j += 2
                    expr_start = j
                    while j < n:
                        if original[j] == "{":
                            depth += 1
                        elif original[j] == "}":
                            if depth == 0:
                                segments.append("${" + original[expr_start:j] + "}")
                                j += 1
                                seg_start = j
                                break
                            depth -= 1
                        j += 1
                    continue
                if original[j] == "`":
                    seg = original[seg_start:j]
                    new_seg = transform_string_content(seg)
                    if new_seg != seg:
                        changed = True
                    segments.append(new_seg)
                    j += 1
                    break
                j += 1
            result.append("`" + "".join(segments) + "`")
            i = j
            continue

        result.append(ch)
        i += 1

    new_content = "".join(result)
    if changed and new_content != original:
        path.write_text(new_content, encoding="utf-8")
        return True
    return False


def main() -> int:
    changed_files: list[str] = []
    for path in sorted(ROOT.rglob("*")):
        if path.suffix not in {".ts", ".tsx"}:
            continue
        if process_file(path):
            changed_files.append(str(path.relative_to(ROOT.parent)))

    print(f"Updated {len(changed_files)} files")
    for f in changed_files:
        print(f"  {f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
