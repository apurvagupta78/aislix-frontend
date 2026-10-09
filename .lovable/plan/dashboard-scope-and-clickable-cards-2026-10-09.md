# Dashboard scope and clickable cards

- Add resting navy chevrons beside information icons on shared corrective-action, SLA and audit-check cards. Make Action pipeline and Actions by type open the existing source-filtered action list. Keep background-only hover, existing destinations, SLA chips and issue categories.
- Split AI metric views into a Store / City / Country scope and a separate topic view, defaulting to All stores and All categories. Show geographic charts and selectable rows above the topic charts and table.
- Apply scope to existing variance, action, shelf and audit-level filters for every organization. Preserve shelf-slot Location and existing topic rules. Treat blank geography as No city / No country.
- Keep prompts, model names, KPI formulas and unrelated presentation untouched.

## Technical details
- Extend existing lens facets and scan metadata with city/country; read country alongside city.
- Feed geographic selections into existing storeId/city/country dashboard filters and apply scope before topic aggregation.
- Add the requested city/category regression test, retain existing tests, and verify shared cards and dashboard interactions.