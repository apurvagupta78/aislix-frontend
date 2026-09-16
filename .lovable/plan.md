# Aislix Product-Wide UI/UX Redesign

## Goal
Redesign Aislix as one calm, visual Retail Audit & Intelligence Platform while preserving every existing route, permission, calculation, workflow, API, and data contract.

The product-wide mental model will be:

```text
Configure → Assign → Audit → Capture proof → Understand → Fix → Verify → Learn
```

## Locked design direction
- **Composition:** Refined enterprise workspace with a compact collapsible sidebar, quiet global header, broad work area, and clear contextual actions.
- **Palette:** Soft Enterprise — `#F3F7FA` canvas, `#173B53` primary navy, `#27966A` positive/accent green, `#E76F62` urgent/coral, expanded through semantic OKLCH tokens.
- **Typography:** Sora for headings and Manrope for interface/body text.
- **Character:** Premium, colorful, calm, approachable, and consumer-simple; never dense traditional enterprise software.
- **Interaction:** Fast subtle transitions, clear selected states, gentle elevation, progressive disclosure, reduced-motion support.

## Product findings that shape the redesign
- The full operational loop already exists across templates, assignments, execution, evidence, review, findings, corrective actions, SLA, and intelligence.
- `AppShell` is the shared authenticated shell and must remain the single source for navigation, search, workspace switching, notifications, filters, and account controls.
- `AuthGate` remains the only authentication redirect authority.
- Control Tower already supports operating-model switching, URL-based drilldowns, filtered exports, and global filters; these contracts will be retained.
- New Audit already contains the requested WHAT / WHERE / HOW / WHAT TO CHECK flow plus advanced evidence, assignment, schedule, reviewer, and rule configuration.
- Manager and auditor views differ intentionally; the redesign will clarify those roles without changing permissions.
- Existing template status compatibility, review rejection paths, evidence policy, corrective-action lifecycle, SLA math, KPI calculations, subscription limits, and planogram logic are protected behavior.
- Duplicate visual implementations exist for cards, headers, badges, filters, tables, skeletons, and SLA indicators. They will be consolidated visually, not behaviorally.
- Some routes are intentional compatibility redirects or unfinished shells. They remain functional and receive an honest empty/coming-data state rather than invented data.

## Implementation plan

### 1. Foundation and safety baseline
- Create a route/workflow inventory and a lean implementation roadmap covering every public and authenticated screen.
- Record current desktop and mobile visual baselines for representative routes.
- Establish validation checkpoints for route integrity, type/build health, keyboard behavior, and responsive layout.
- Make no database, API, auth, RLS, calculation, permission, or workflow changes.

### 2. Global Aislix design system
- Replace fragmented visual values with semantic tokens for canvas, surfaces, text, borders, focus, success, warning, danger, info, AI, evidence, and charts.
- Add Sora and Manrope through the root document head and expose consistent typography roles.
- Standardize spacing, control heights, 8px card radius, shadows, focus rings, transitions, and responsive container widths.
- Create or refine shared variants for page/section headers, action bars, cards, status badges, KPI cards, filters, tables, mobile data cards, progress, empty/error/success states, and skeletons.
- Keep important status communication as icon + text + color.

### 3. Authenticated shell and navigation
- Decompose the large shell internally while preserving its queries and behavior.
- Keep one grouped navigation location per feature; remove the duplicate Audit Templates entry while preserving its canonical route.
- Retain manager-only visibility, active-route behavior, workspace switching, notification actions, pending-task count, and collapse persistence.
- Refine the desktop mini rail, expanded sidebar, mobile drawer, global search, account area, and primary New Audit action.
- Add a clear breadcrumb/context treatment and ensure every touch target is at least 44px on mobile.

### 4. Global context and page framework
- Restyle the existing persistent filter state rather than replacing it.
- Present date, location, operating model, store, and category first; keep secondary filters behind “More filters.”
- Preserve filters and drilldown URL state across Control Tower and intelligence journeys.
- Standardize page titles, descriptions, primary actions, loading/error/empty states, and responsive content widths.

### 5. Control Tower
- Recompose the existing data into an action-first control center: greeting/context, operating-model switcher, priority KPIs, what needs attention, trends, risk, queues, and recent activity.
- Preserve KPI catalogs, calculations, role-based presentation, drilldowns, and CSV exports.
- Replace illustrative or absent values with honest “No data yet” states where real data is unavailable.
- Give every KPI an accessible information popover covering meaning, formula, data, filters, and period.
- Standardize charts through semantic chart tokens and one chart container/tooltip treatment.

### 6. Audits, templates, assignments, and schedules
- Rebuild New Audit visually around four clear steps: What, Where, How, What to check.
- Preserve template hydration, operating models, CSV/manual inputs, evidence policy, assignment distribution, recurrence, reviewer, conflicts, and publishing behavior.
- Keep advanced settings collapsed until needed and maintain the persistent setup summary.
- Present template discovery as a visual library while retaining ownership, visibility, status, duplicate, preview, version, intelligence, share, archive, and assignment actions.
- Reframe assignments as task management with Today, Upcoming, Overdue, and Recurring views; retain existing bulk and manager actions.
- Improve calendar and schedule presentation only where current interactions already support changes.

### 7. Auditor execution, evidence, and review
- Make the shared executor mobile-first and checklist-led, with one clear task at a time, visible progress, large evidence controls, autosave feedback, and plain-language validation.
- Preserve execution routing between digital, AI, AI-assisted, custom, expiry, and planogram flows.
- Treat evidence as a first-class visual section with proof counts, thumbnails, metadata, and requirements.
- Restyle review around evidence, exceptions, approval, and the existing reject/reopen/new-assignment choices.

### 8. Findings, corrective actions, recurring issues, and SLA
- Present findings as a priority inbox with clear severity, location, owner, due state, and “Fix this” action.
- Present corrective actions as accountable tasks with the existing lifecycle shown as a visual timeline.
- Unify SLA display around On time, Due soon, and Overdue while preserving existing due-date and escalation calculations.
- Keep recurring issues distinct as grouped patterns, not duplicate findings.

### 9. Intelligence
- Give Inventory & Variance an honest visual shell using available data only; do not fabricate metrics for its currently incomplete backend state.
- Redesign Expiry Control around units checked, proof coverage, remaining work, risk, and its existing inspection/review/quarantine/policy workflows.
- Make Shelf Intelligence and Planogram image-first, preserving existing overlays, comparison, compliance, correction, and rescan behavior.
- Rework analytics and SKU intelligence into question-led charts, rankings, timelines, and clickable detail rows using existing KPI/data services.

### 10. Operations and master data
- Present stores, warehouses, and distributors as visual health/location collections with responsive list alternatives for dense management work.
- Redesign store detail around health, recent audits, findings, inventory, expiry, shelf, and activity using current data.
- Reframe Master Data as understandable building blocks while preserving import, hierarchy, planogram, activation, and role restrictions.

### 11. Reports, team, manage, settings, and billing
- Turn Reports into a visual report library while exposing only exports already supported.
- Simplify Team into people, roles, locations, workload, invitations, and performance without changing invite or permission logic.
- Group settings into Workspace, Users & Roles, Rules, SLA, Notifications, Master Data, Audit Settings, Billing, and Security using existing routes/panels.
- Preserve plan entitlements, quotas, checkout, and legacy plan compatibility.

### 12. Public website and acquisition pages
- Apply the same typography, palette, spacing, buttons, status language, and visual storytelling to public pages.
- Recompose the homepage around the operational loop and real product imagery/UI previews, with Book a Demo primary and Explore Aislix secondary.
- Consolidate shared presentation across the homepage and campaign landing pages without breaking campaign-specific attribution, lead capture, anonymous scans, GA4, or LinkedIn tracking.
- Keep pricing, auth, legal, share, and contact flows functional; remove contradictory presentation by reading from existing entitlement sources where available.
- Preserve campaign URLs and compatibility redirects.

### 13. Responsive and accessibility pass
- Verify 1440px, 1920px, 1280px, tablet, and mobile layouts.
- Convert dense tables to priority cards or controlled horizontal scrolling where appropriate.
- Audit landmarks, heading order, labels, alt text, keyboard access, focus visibility, dialogs, icon-button names, contrast, status redundancy, and reduced motion.
- Ensure the auditor journey is the simplest mobile experience.

### 14. Consistency and release verification
- Review every route against the shared system and the seven role perspectives: store manager, dark-store manager, warehouse manager, FMCG sales manager, auditor, executive, and first-time user.
- Verify no route, permission, calculation, mutation, export, upload, assignment, review, evidence, or analytics behavior regressed.
- Run targeted interaction checks for core end-to-end journeys and confirm the latest preview build is clean before release.

## Delivery approach
This is a product-wide redesign, so implementation will proceed in controlled milestones. Each milestone will update shared foundations first, then representative workflows, then all sibling routes using the same pattern. This avoids isolated page styling and prevents visual or behavioral drift.

## Explicitly out of scope
- Database/schema/RLS/storage changes
- API or backend workflow changes
- Authentication changes
- New KPI formulas or audit calculations
- Permission or role-policy changes
- Fake data added to incomplete pages
- Parallel dashboards, engines, or operating-model products
