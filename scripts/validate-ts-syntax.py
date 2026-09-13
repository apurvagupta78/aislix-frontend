"""Basic syntax sanity checks for TS/TSX files."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src"
STRAY = re.compile(r"^(\s*[\]\);}]+)'(\s*)$")
issues: list[str] = []

for path in sorted(ROOT.rglob("*")):
    if path.suffix not in {".ts", ".tsx"}:
        continue
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    for i, line in enumerate(lines, 1):
        if STRAY.match(line):
            issues.append(f"STRAY_QUOTE {path.relative_to(ROOT.parent)}:{i}: {line.strip()!r}")
    # crude brace balance (ignore strings/comments — catches gross corruption)
    stripped = re.sub(r"(['\"]).*?\1", "", text, flags=re.S)
    stripped = re.sub(r"//.*", "", stripped)
    stripped = re.sub(r"/\*.*?\*/", "", stripped, flags=re.S)
    opens = stripped.count("{") + stripped.count("(") + stripped.count("[")
    closes = stripped.count("}") + stripped.count(")") + stripped.count("]")
    if opens != closes:
        issues.append(f"UNBALANCED {path.relative_to(ROOT.parent)}: ({opens} vs {closes})")

if issues:
    print("\n".join(issues))
    print(f"\n{len(issues)} issue(s)")
else:
    print("No issues found")
