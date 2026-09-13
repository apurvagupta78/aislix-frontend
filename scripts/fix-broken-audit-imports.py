"""Fix import paths broken by terminology script (imports renamed, files were not)."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "src"
REPLACEMENTS = [
    ("@/lib/landing-audit-api", "@/lib/landing-scan-api"),
    ('from "./audit-history"', 'from "./scan-history"'),
    ('from "./audits"', 'from "./scans"'),
    ('export * from "../../audit-history"', 'export * from "../../scan-history"'),
]

for path in ROOT.rglob("*"):
    if path.suffix not in {".ts", ".tsx"}:
        continue
    text = path.read_text(encoding="utf-8")
    updated = text
    for old, new in REPLACEMENTS:
        updated = updated.replace(old, new)
    if updated != text:
        path.write_text(updated, encoding="utf-8")
        print(f"fixed {path.relative_to(ROOT.parent)}")
