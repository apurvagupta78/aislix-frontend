# Aislix Official Visual System Rollout

## Goal
Redesign Aislix into one calm, modern enterprise SaaS product using only the official palette, while preserving every route, feature, workflow, calculation, API, database query, permission, and state transition.

## Locked visual direction
- **Canvas:** `#F2F6F9` across public and authenticated pages.
- **Typography:** dark navy `#102A43` for primary text and `#557187` for supporting text.
- **Surfaces:** white and `#EFF4F7`, separated by `#E7EDF0` borders and the subtle navy shadow specified in the brief.
- **Navigation:** light sidebar and header; active items use `#CFEEFF` or `#EAF6FD` with navy icons and labels.
- **Shape:** restrained, consistent radii; no oversized pill-like containers or excessive rounded cards.
- **Color discipline:** no gradients, rainbow charts, default chart-library colors, or unrelated hues. Transparency may only derive from approved colors.
- **Status meaning:** icons and words carry meaning; pink means attention, olive means healthy, sky means active/primary, grey means neutral.

## Official tokens
Create the exact requested `--aislix-*` variables and map every existing semantic token to them:
- Canvas, primary text, secondary text, border, surface.
- Local Store, Supermarket, Dark Store, Warehouse, FMCG / Distributor, and Custom backgrounds and borders.
- Chart series, positive, attention, active, neutral, focus, overlay, and shadow tokens derived only from the official palette.
- Keep compatibility aliases for existing semantic utilities, but remove aliases that render forbidden hues.

## Implementation

### 1. Foundation and enforcement
- Replace the current mixed OKLCH/saturated theme and gradient utilities with the official token set.
- Remove the dark gradient navigation and saturated KPI tile treatments.
- Add shared visual roles for cards, sections, KPI cards, badges, filters, insights, operating models, charts, and tables.
- Update semantic status mappings so critical/attention, active, completed/healthy, and neutral use pink, sky, olive, and grey respectively.
- Add an automated source scan that fails QA when visible UI code introduces unapproved direct colors or gradients.

### 2. Shared interface primitives
- Restyle buttons, cards, inputs, selects, tabs, dialogs, sheets, alerts, tooltips, progress, skeletons, empty/error states, and tables.
- Use navy primary buttons, light-surface secondary buttons, and sky-tint subtle actions.
- Standardize spacing, hierarchy, control height, focus states, table headers/rows, dialog composition, and light elevation.
- Consolidate duplicated status, severity, priority, SLA, workflow, and classification badges onto shared semantic treatments.

### 3. Operating-model identity
- Add one reusable operating-model style map and badge/card treatment.
- Apply the exact Local Store, Supermarket, Dark Store, Warehouse, FMCG / Distributor, and Custom colors everywhere those models appear.
- Update New Audit choices, template cards, audit cards, filters, legends, dashboard switches, and small indicators to use that same map.

### 4. Navigation and page framework
- Recompose the authenticated shell as a clean light workspace with a calm sidebar, subtle active state, quiet header, clear page context, and consistent content width.
- Preserve collapse, mobile drawer, workspace switcher, search, notifications, profile controls, global filters, and all permission-driven navigation.
- Align public navigation and acquisition pages to the same visual language.

### 5. Homepage and public pages
- Recompose the homepage hierarchy rather than only recoloring it: spacious navy-led hero, clearly grouped proof/demo sections, restrained feature modules, and operating-model industry cards.
- Remove decorative gradients and visual noise while preserving live demo behavior, uploads, attribution, analytics, pricing, and lead capture.
- Carry the same surfaces, buttons, typography, forms, and states through product, pricing, contact, authentication, and campaign pages.

### 6. Dashboard and Control Tower
- Recompose the dashboard into a calm analytics workspace with a primary KPI tier, supporting KPI tier, question-led visual modules, rankings, risk, queues, and detail tables.
- Keep all existing demo/real data boundaries, KPI values, formulas, drilldowns, exports, and filters unchanged.
- Replace saturated tiles with legible navy/soft-surface KPI compositions and small purposeful trend/progress visuals.

### 7. Charts and visualizations
- Centralize chart styling and remove page-specific/default colors.
- Use the approved sequence only: navy, secondary text, warehouse sky, local/FMCG sky, supermarket olive, dark-store pink, custom grey.
- Standardize axes, grids, tooltips, legends, active states, reference lines, and chart containers.
- Retain the existing area, line, bar, composed, pie/donut, radial, radar, heatmap, ranking, and sparkline forms only where each answers a business question.
- Use pattern, label, icon, line style, and opacity differences when color alone would be ambiguous.

### 8. Audits, findings, and actions
- Apply the system to New Audit, templates, assignments, calendar, execution, review, evidence, and results without changing any workflow behavior.
- Use the operating-model treatment for audit/template cards and improve step hierarchy, summaries, upload zones, progress, and review workspaces.
- Convert Findings and Corrective Actions from conventional red/amber/green to the approved pink/sky/olive/grey semantics, including KPI cards, rows, timelines, alerts, and SLA indicators.
- Standardize dense data into consistent desktop tables and readable mobile cards without removing information.

### 9. Remaining product areas
- Apply the shared system to intelligence, expiry, planogram, stores, warehouses, distributors, SKUs, master data, reports, team, manage, settings, billing, and all visible dialogs/empty states.
- Preserve image-first analysis where evidence or shelf imagery is the subject.
- Remove one-off page palettes and duplicated visual wrappers as each family is migrated.

### 10. QA and release gate
- Inspect representative desktop and mobile states for homepage, dashboard, Control Tower, New Audit, template detail, execution, review, results, Findings, Corrective Actions, tables, filters, forms, modals, alerts, and empty states.
- Verify keyboard focus, contrast, touch targets, text fitting, responsive tables/cards, chart labels, and reduced-motion behavior.
- Run type/build checks and targeted interaction checks for existing workflows.
- Run the approved-color audit across all visible frontend files and resolve every random color or gradient before completion.

## Protected behavior
No changes to database schema, database queries, APIs, authentication, RLS, routes, state management, calculations, KPI formulas, permissions, uploads, exports, audit logic, scan logic, or data contracts.

## Delivery order
Implement shared tokens and primitives first, then shell and homepage, then analytics/chart surfaces, then audit and operational page families. This order ensures every page inherits one system instead of receiving isolated styling.
