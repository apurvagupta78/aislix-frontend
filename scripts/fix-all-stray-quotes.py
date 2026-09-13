"""Fix stray trailing single quotes after closing punctuation from bulk rename."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src"
# Line ends with ];' or }' or );' etc — not inside strings (heuristic: only closing punct + quote)
PAT = re.compile(r"^(\s*(?:\]|}|\\)|;)+)'(\s*)$")

fixed = 0
for path in sorted(ROOT.rglob("*")):
    if path.suffix not in {".ts", ".tsx"}:
        continue
    lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
    out: list[str] = []
    changed = False
    for i, line in enumerate(lines, 1):
        m = PAT.match(line.rstrip("\n\r"))
        if m:
            newline = m.group(1) + m.group(2) + ("\n" if line.endswith("\n") else "")
            if line.endswith("\r\n"):
                newline = m.group(1) + m.group(2) + "\r\n"
            print(f"fix {path.relative_to(ROOT.parent)}:{i}: {line.rstrip()!r} -> {newline.rstrip()!r}")
            out.append(newline)
            changed = True
            fixed += 1
        else:
            out.append(line)
    if changed:
        path.write_text("".join(out), encoding="utf-8")

print(f"Done — fixed {fixed} lines")
