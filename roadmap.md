# Aislix redesign roadmap

## Non-negotiable UX principles
1. Feels exceptionally simple and visually obvious; usable with almost no training.
2. 8-year-old test on every screen: one obvious primary action, plain-English labels, large controls,
   icons + text, clear progress, clear status, minimal jargon, obvious next step.
3. New Audit screen is the visual reference: colourful cards, generous whitespace, rounded surfaces,
   simple navigation, strong hierarchy.
4. Same visual language on every page, public and authenticated.
5. Visual components used with purpose only — every chart answers a business question.
6. Drag-and-drop only where it genuinely helps (CSV upload, field mapping, template config,
   assignment/calendar, hierarchy).
7. Pattern per workflow inside one product: command center, guided flow, focused workspace,
   visual modules.
8. Apple-like = simplicity, polish, clarity, whitespace, hierarchy, delight. Not Apple branding.
9. Playful = approachable and colourful, never childish.
10. Keep professional information density behind progressive disclosure.
11. Every major page answers: Where am I? What is happening? What should I do next?
12. Shared design system first, then consistent application.
13. Route/workflow inventory is the source of truth (complete).
14. UI/UX only — no schema, API, auth, RLS, logic, calculation, permission or data-contract changes.
15. Approved palette only: white, sky blue, navy blue, dark grey, light grey, olive green,
    light pink and black. The result must feel elegant and modern SaaS, never lavender or purple.

## Implementation
- [x] Architecture and route/workflow inventory
- [x] Foundation: tokens, Sora/Manrope, status colours, touch targets, shared primitives
- [x] Shell: grouped navigation, header, section eyebrow + next-step line, mobile behaviour
- [x] Page framework (PageHeader / SectionCard / KpiCard with icons + tone / states)
- [x] Control Tower and dashboard (inherit KPI + status language)
- [ ] Audits, templates, assignments, calendar, execution, review
- [x] Findings (plain-English KPIs, priority language, grouped filter bar)
- [ ] Corrective actions, SLA, recurring issues
- [ ] Intelligence, operations, master data
- [ ] Reports, team, manage, settings, billing
- [ ] Public site, product pages, login/signup
- [ ] Responsive, accessibility, route metadata, release verification
