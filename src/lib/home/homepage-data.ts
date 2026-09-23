import {
  Store,
  ShoppingCart,
  Warehouse,
  Boxes,
  PackageSearch,
  ScanSearch,
  CircleCheck,
  LayoutGrid,
  Tag,
  BarChart3,
  Wrench,
  Camera,
  Sparkles,
  ListChecks,
  History,
  type LucideIcon,
} from "lucide-react";

export const HERO_SHELF_IMAGE = "/home-hero-shelf.jpg";
export const DEMO_SHELF_IMAGE = "/home-demo-shelf.jpg";

export type HomeTone = "sky" | "sage" | "rose" | "azure" | "mist";

export const heroAnnotations = [
  { label: "Colgate · 47% share", left: 10, top: 14, width: 15, height: 80, tone: "azure" as HomeTone },
  { label: "Empty facing", left: 45, top: 29, width: 25, height: 7, tone: "rose" as HomeTone },
  { label: "Low facings", left: 46, top: 40, width: 12, height: 6, tone: "rose" as HomeTone },
  { label: "Price tag", left: 57, top: 24, width: 6, height: 3, tone: "sage" as HomeTone },
];

export const heroInsights = [
  {
    icon: PackageSearch,
    label: "Products & brands",
    value: "16 products · 7 brands",
    tone: "sky" as HomeTone,
  },
  {
    icon: CircleCheck,
    label: "Availability",
    value: "94% on-shelf",
    tone: "sage" as HomeTone,
  },
  {
    icon: LayoutGrid,
    label: "Shelf execution",
    value: "85% compliant",
    tone: "mist" as HomeTone,
  },
  {
    icon: Tag,
    label: "Prices & promotions",
    value: "1 issue detected",
    tone: "rose" as HomeTone,
  },
];

export const retailFormats = [
  {
    icon: Store,
    title: "Local Stores",
    body: "Turn everyday store visits into measurable shelf execution.",
    tone: "sky" as HomeTone,
  },
  {
    icon: ShoppingCart,
    title: "Supermarkets",
    body: "Improve availability, assortment, pricing, promotions and shelf execution.",
    tone: "sage" as HomeTone,
  },
  {
    icon: Boxes,
    title: "Dark Stores",
    body: "Know what is available and whether products are in the right location.",
    tone: "rose" as HomeTone,
  },
  {
    icon: Warehouse,
    title: "Warehouses",
    body: "Verify receiving, bin accuracy, putaway, picking and dispatch.",
    tone: "azure" as HomeTone,
  },
  {
    icon: PackageSearch,
    title: "FMCG / Distributors",
    body: "Measure shelf presence, outlet execution, pricing and Share of Shelf.",
    tone: "mist" as HomeTone,
  },
];

export type PlatformFeature = {
  id: string;
  icon: LucideIcon;
  title: string;
  body: string;
  tone: HomeTone;
  metric: { label: string; value: string };
  rows: { name: string; value: string; status: "ok" | "warn" | "issue" }[];
};

export const platformFeatures: PlatformFeature[] = [
  {
    id: "audit",
    icon: ScanSearch,
    title: "One Photo. Full Shelf Audit.",
    body: "Upload a shelf photo and let Aislix identify products, brands, facings and visible shelf conditions.",
    tone: "sky",
    metric: { label: "Products identified", value: "16" },
    rows: [
      { name: "Colgate Total 120g", value: "6 facings", status: "ok" },
      { name: "Sensodyne Repair 75ml", value: "4 facings", status: "ok" },
      { name: "Oral-B Pro Expert", value: "2 facings", status: "warn" },
    ],
  },
  {
    id: "availability",
    icon: CircleCheck,
    title: "Know What's Actually Available.",
    body: "Measure on-shelf availability and identify products that are missing or need attention.",
    tone: "sage",
    metric: { label: "On-shelf availability", value: "94%" },
    rows: [
      { name: "In stock", value: "15 SKUs", status: "ok" },
      { name: "Low stock", value: "2 SKUs", status: "warn" },
      { name: "Out of stock", value: "1 SKU", status: "issue" },
    ],
  },
  {
    id: "execution",
    icon: LayoutGrid,
    title: "Measure Shelf Execution.",
    body: "Compare actual shelf placement and facings against the expected planogram when one is configured.",
    tone: "mist",
    metric: { label: "Planogram compliance", value: "85%" },
    rows: [
      { name: "Correct position", value: "13 of 16", status: "ok" },
      { name: "Wrong shelf row", value: "2 products", status: "warn" },
      { name: "Missing facing", value: "1 product", status: "issue" },
    ],
  },
  {
    id: "pricing",
    icon: Tag,
    title: "Check Prices & Promotions.",
    body: "Detect visible price and promotional issues and highlight where shelf execution does not match the configured requirements.",
    tone: "rose",
    metric: { label: "Price issues", value: "1" },
    rows: [
      { name: "Price tags read", value: "18", status: "ok" },
      { name: "Promo displayed", value: "3 of 3", status: "ok" },
      { name: "Price mismatch", value: "Oral-B · $4.49", status: "issue" },
    ],
  },
  {
    id: "presence",
    icon: BarChart3,
    title: "Measure Your Shelf Presence.",
    body: "For FMCG brands, measure facings and Share of Shelf against relevant competitors and planned allocation.",
    tone: "azure",
    metric: { label: "Colgate Share of Shelf", value: "47%" },
    rows: [
      { name: "Colgate", value: "47% · plan 45%", status: "ok" },
      { name: "Sensodyne", value: "24% · plan 25%", status: "ok" },
      { name: "Oral-B", value: "16% · plan 20%", status: "warn" },
    ],
  },
  {
    id: "actions",
    icon: Wrench,
    title: "Turn Issues Into Actions.",
    body: "See what needs to be fixed, review the evidence, re-audit the shelf and track whether the issue was resolved.",
    tone: "sky",
    metric: { label: "Open actions", value: "3" },
    rows: [
      { name: "Restock Oral-B Pro Expert", value: "Assigned · Priya", status: "warn" },
      { name: "Fix price tag, shelf 3", value: "Due today", status: "issue" },
      { name: "Move Sensodyne to row 2", value: "Verified closed", status: "ok" },
    ],
  },
];

export const howItWorksSteps = [
  {
    icon: Camera,
    title: "Capture",
    lead: "Take a photo.",
    body: "Capture the shelf using your phone or upload an existing shelf image.",
  },
  {
    icon: Sparkles,
    title: "Understand",
    lead: "Let Aislix read the shelf.",
    body: "Aislix identifies products, brands, facings and visible shelf conditions, then calculates the configured retail KPIs.",
  },
  {
    icon: ListChecks,
    title: "Act",
    lead: "Know what needs attention.",
    body: "Review issues, inspect the image evidence and see what needs to be fixed.",
  },
  {
    icon: History,
    title: "Track",
    lead: "Re-audit and measure improvement.",
    body: "Keep every audit, compare previous visits and verify whether the shelf improved after corrective action.",
  },
];
