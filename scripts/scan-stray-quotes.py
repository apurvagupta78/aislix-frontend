"""Find lines ending with stray single quote after closing punctuation."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src"
PAT = re.compile(r"^\s*[\]\);\}]+'\s*$")

for path in sorted(ROOT.rglob("*")):
    if path.suffix not in {".ts", ".tsx"}:
        continue
    for i, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if PAT.match(line):
            print(f"{path.relative_to(ROOT.parent)}:{i}:{line!r}")
