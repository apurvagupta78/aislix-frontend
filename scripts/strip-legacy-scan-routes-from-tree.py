#!/usr/bin/env python3
"""Remove deleted legacy /scan redirect routes from routeTree.gen.ts."""

from __future__ import annotations

import re
from pathlib import Path

ROUTE_TREE = Path(__file__).resolve().parents[1] / "src" / "routeTree.gen.ts"

# Route files deleted in 252b3ef — Nitro handles redirects now.
REMOVED_IMPORT_PATHS = (
    "./routes/assign-scan",
    "./routes/assigned-scans",
    "./routes/my-scans",
    "./routes/scan",
    "./routes/demo-scans",
    "./routes/admin.demo-scans",
    "./routes/admin.scans",
)

REMOVED_ROUTE_NAMES = (
    "AssignScanRoute",
    "AssignedScansRoute",
    "MyScansRoute",
    "ScanRoute",
    "DemoScansRoute",
    "AdminScansRoute",
    "AdminDemoScansRoute",
)

REMOVED_PATHS = (
    "/assign-scan",
    "/assigned-scans",
    "/my-scans",
    "/scan",
    "/demo-scans",
    "/admin/scans",
    "/admin/demo-scans",
)


def main() -> None:
    text = ROUTE_TREE.read_text(encoding="utf-8-sig")
    lines = text.splitlines(keepends=True)
    out: list[str] = []

    for line in lines:
        if line.startswith("import { Route as ") and any(
            f"from '{path}'" in line for path in REMOVED_IMPORT_PATHS
        ):
            continue
        out.append(line)

    text = "".join(out)

    for name in REMOVED_ROUTE_NAMES:
        pattern = rf"const {name} = {name}Import\.update\(\{{.*?\}} as any\)\n"
        text = re.sub(pattern, "", text, flags=re.DOTALL)

    for name in REMOVED_ROUTE_NAMES:
        text = re.sub(rf"  {name}: typeof {name}\n", "", text)
        text = re.sub(rf"  {name}: {name},\n", "", text)

    for path in REMOVED_PATHS:
        text = re.sub(rf"  '{re.escape(path)}': typeof \w+\n", "", text)
        text = re.sub(rf"    \| '{re.escape(path)}'\n", "", text)
        text = re.sub(
            rf"    '{re.escape(path)}': \{{\n.*?\n    \}}\n",
            "",
            text,
            flags=re.DOTALL,
        )

    # Clean up excessive blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)

    ROUTE_TREE.write_text(text, encoding="utf-8")
    print("Stripped legacy scan routes from routeTree.gen.ts")


if __name__ == "__main__":
    main()
