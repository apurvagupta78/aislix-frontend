/**
 * Deterministic Ask Aislix answers for Demo Data mode (guest + signed-in preview).
 * Numbers mirror the showcase dashboard fixtures so answers never contradict the KPIs on screen.
 * Only used when the workspace is labeled demo — never for live customer data.
 */

import type { AskAislixResponse } from "@/lib/ask-aislix/ask-aislix.types";

const PERIOD = "Last 30 days (demo)";
const CITIES = ["Bengaluru", "Mumbai", "Hyderabad", "Pune", "Delhi"];

const STORES = {
  koramangala: "More Mart — Koramangala",
  hsr: "DMart — HSR Layout",
  whitefield: "Big Bazaar — Whitefield",
  jayanagar: "Reliance Smart — Jayanagar",
  indiranagar: "More Mart — Indiranagar",
} as const;

type StoreKey = keyof typeof STORES;
type CategoryKey = "oral_care" | "beverages" | "snacks" | "biscuits" | "confectionery" | "personal_care";

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  oral_care: "Oral Care",
  beverages: "Beverages & Cereal",
  snacks: "Snacks",
  biscuits: "Biscuits",
  confectionery: "Confectionery",
  personal_care: "Personal & Baby Care",
};

type EvidencePhoto = {
  id: string;
  url: string;
  store: StoreKey;
  category: CategoryKey;
  caption: string;
  status: "Issue" | "Compliant";
  daysAgo: number;
};

/** Public shelf photos shipped with the app, captioned to match what is visible in each image. */
const EVIDENCE_LIBRARY: EvidencePhoto[] = [
  {
    id: "oral",
    url: "/home-hero-shelf.jpg",
    store: "whitefield",
    category: "oral_care",
    caption: "Oral care · Oral-B & Colgate gaps on shelves 2 and 5",
    status: "Issue",
    daysAgo: 0,
  },
  {
    id: "aisle",
    url: "/home-demo-shelf.jpg",
    store: "koramangala",
    category: "beverages",
    caption: "Beverages & cereal aisle · 1 empty slot on shelf 3",
    status: "Issue",
    daysAgo: 1,
  },
  {
    id: "snacks",
    url: "/demo-shelf/demo-2.jpg",
    store: "whitefield",
    category: "snacks",
    caption: "Snacks · Pringles & potato crackers, missing price tags",
    status: "Issue",
    daysAgo: 1,
  },
  {
    id: "candy",
    url: "/demo-shelf/demo-1.jpg",
    store: "jayanagar",
    category: "confectionery",
    caption: "Confectionery · empty candy cartons on top shelf",
    status: "Issue",
    daysAgo: 2,
  },
  {
    id: "chocopie",
    url: "/demo-shelf/demo-3.jpg",
    store: "hsr",
    category: "biscuits",
    caption: "Biscuits · Orion Choco Pie full facings",
    status: "Compliant",
    daysAgo: 2,
  },
  {
    id: "dreamlite",
    url: "/demo-shelf/demo-4.jpg",
    store: "indiranagar",
    category: "biscuits",
    caption: "Biscuits · Dream Lite & Hide & Seek blocked correctly",
    status: "Compliant",
    daysAgo: 3,
  },
  {
    id: "babycare",
    url: "/demo-shelf/demo-5.jpg",
    store: "koramangala",
    category: "personal_care",
    caption: "Personal care · Johnson's baby range & Savlon",
    status: "Compliant",
    daysAgo: 3,
  },
  {
    id: "diapers",
    url: "/demo-shelf/demo-6.jpg",
    store: "jayanagar",
    category: "personal_care",
    caption: "Baby care · Doobidoo pants over-faced vs planogram",
    status: "Issue",
    daysAgo: 4,
  },
];

const STORE_PATTERNS: Array<[StoreKey, RegExp]> = [
  ["koramangala", /koramangala/i],
  ["hsr", /\bhsr\b|dmart/i],
  ["whitefield", /whitefield|big bazaar/i],
  ["jayanagar", /jayanagar|reliance/i],
  ["indiranagar", /indiranagar/i],
];

const CATEGORY_PATTERNS: Array<[CategoryKey, RegExp]> = [
  ["oral_care", /oral|toothpaste|colgate|sensodyne|oral-?b|dental/i],
  ["beverages", /beverage|drink|juice|water|cereal|coke/i],
  ["snacks", /snack|chips|crisps|pringles|lays/i],
  ["biscuits", /biscuit|cookie|choco ?pie/i],
  ["confectionery", /confection|candy|gum|chocolate|sweets/i],
  ["personal_care", /personal|baby|diaper|hygiene|johnson/i],
];

function galleryItem(photo: EvidencePhoto) {
  return {
    url: photo.url,
    caption: `${photo.status === "Issue" ? "⚠ " : "✓ "}${photo.caption}`,
    store_name: STORES[photo.store],
    captured_at: new Date(Date.now() - photo.daysAgo * 86_400_000 - 3_600_000 * (photo.daysAgo + 2)).toISOString(),
  };
}

function photosById(ids: string[]): EvidencePhoto[] {
  return ids.map((id) => EVIDENCE_LIBRARY.find((p) => p.id === id)).filter((p): p is EvidencePhoto => Boolean(p));
}

/** Supporting shelf photos attached under charts for non-gallery demo answers. */
const INTENT_EVIDENCE: Record<string, string[]> = {
  sku_shortages: ["oral", "snacks", "candy"],
  city_variance: ["aisle", "snacks", "oral"],
  inventory_variance: ["snacks", "aisle", "oral"],
  compliance_change: ["oral", "chocopie", "babycare"],
  store_compliance: ["oral", "candy", "chocopie"],
  recurring: ["oral", "snacks", "diapers"],
  managers_team: ["oral", "candy", "dreamlite"],
  corrective_actions: ["oral", "snacks", "candy"],
  findings: ["oral", "aisle", "diapers"],
  expiry: ["babycare", "aisle", "chocopie"],
  stockout_risk: ["oral", "snacks", "aisle"],
  brand_share: ["oral", "chocopie", "babycare"],
  completion_trend: ["aisle", "dreamlite", "babycare"],
  comparison: ["oral", "chocopie", "snacks"],
  overview: ["oral", "snacks", "candy"],
};

type DemoIntent = {
  id: string;
  /** Every group must match at least one keyword (AND of ORs). */
  match: RegExp[];
  weight?: number;
  build: (question: string) => AskAislixResponse;
};

function response(partial: Partial<AskAislixResponse> & { answer: string }): AskAislixResponse {
  return {
    summary: "",
    metrics: [],
    visual: { type: "none", title: "", data: [] },
    table: { columns: [], rows: [] },
    insights: [],
    actions: [],
    source_context: { period: PERIOD, locations: ["Bengaluru"], operating_model: "Supermarket" },
    follow_up_questions: [],
    ...partial,
  };
}

const EVIDENCE_METRICS: AskAislixResponse["metrics"] = [
  { label: "Evidence coverage", value: "91", unit: "%", trend: "up" },
  { label: "Photos captured", value: "126", unit: "", trend: "up" },
  { label: "Photos with issues", value: "38", unit: "", trend: "down" },
  { label: "Needs review", value: "4", unit: "audits", trend: "down" },
];

const EVIDENCE_FOLLOW_UPS = [
  "Show evidence store-wise",
  "Show evidence category-wise",
  "Show oral care evidence from Whitefield",
];

function evidenceTable(photos: EvidencePhoto[]): AskAislixResponse["table"] {
  return {
    columns: ["Store", "Category", "What the photo shows", "Status"],
    rows: photos.map((p) => {
      const detail = p.caption.split(" · ")[1] ?? p.caption;
      return [STORES[p.store], CATEGORY_LABELS[p.category], detail.charAt(0).toUpperCase() + detail.slice(1), p.status];
    }),
  };
}

function evidenceAnswer(
  answer: string,
  title: string,
  photos: EvidencePhoto[],
  insights: string[],
  followUps: string[] = EVIDENCE_FOLLOW_UPS,
): AskAislixResponse {
  return response({
    answer,
    metrics: EVIDENCE_METRICS,
    visual: { type: "image_gallery", title, data: photos.map(galleryItem) },
    table: evidenceTable(photos),
    insights,
    actions: [
      { label: "View Audit History", route: "/history", params: {} },
      { label: "View Findings", route: "/findings", params: {} },
    ],
    follow_up_questions: followUps,
  });
}

function buildEvidenceResponse(question: string): AskAislixResponse {
  const q = question.replace(/\(Scope:[^)]*\)/gi, "");
  const store = STORE_PATTERNS.find(([, re]) => re.test(q))?.[0];
  const category = CATEGORY_PATTERNS.find(([, re]) => re.test(q))?.[0];
  const storeWise = /(store|outlet|location)[\s-]*(wise|by|each|per)|(by|each|per|every) (store|outlet|location)/i.test(q);
  const categoryWise = /categor(y|ies)[\s-]*(wise|by|each|per)|(by|each|per|every) categor/i.test(q);

  if (/(before|after|corrective|fixed|resolved)/i.test(q)) {
    const photos = photosById(["oral", "chocopie", "snacks", "dreamlite", "candy", "babycare"]);
    return evidenceAnswer(
      "Here is before/after evidence for the 3 most recent corrective actions: Oral-B restock at Big Bazaar — Whitefield, Snacks price tags at Whitefield, and the candy top shelf at Reliance Smart — Jayanagar. Each issue photo is paired with a compliant re-audit shelf.",
      "Before / after — corrective actions (demo)",
      photos,
      [
        "2 of 3 corrective actions are verified closed by re-audit photos.",
        "The Jayanagar candy shelf is still awaiting its re-audit photo.",
      ],
    );
  }

  if (/(fail|failed|failing|worst|lowest|non.?compliant|issues?)/i.test(q)) {
    const photos = EVIDENCE_LIBRARY.filter((p) => p.status === "Issue");
    return evidenceAnswer(
      "Here are shelf photos with open issues, mostly from the 2 lowest-scoring stores: Big Bazaar — Whitefield (74% compliance) and Reliance Smart — Jayanagar (79%). Empty slots, missing price tags and over-facing are visible.",
      "Shelf photos with open issues (demo)",
      photos,
      [
        "Whitefield oral care has the biggest visible gaps — Oral-B and Colgate facings are below planogram.",
        "Jayanagar issues are presentation-related: empty candy cartons and over-faced baby care.",
      ],
    );
  }

  if (storeWise) {
    const photos = (Object.keys(STORES) as StoreKey[])
      .map((key) => EVIDENCE_LIBRARY.find((p) => p.store === key && p.status === "Issue") ?? EVIDENCE_LIBRARY.find((p) => p.store === key))
      .filter((p): p is EvidencePhoto => Boolean(p));
    return evidenceAnswer(
      "Here is the latest shelf evidence for each of the 5 demo stores. Big Bazaar — Whitefield and Reliance Smart — Jayanagar show open issues; DMart — HSR Layout and More Mart — Indiranagar are compliant.",
      "Evidence by store (demo)",
      photos,
      [
        "Whitefield: 2 issue photos this week (oral care, snacks).",
        "Koramangala: 1 empty slot in the beverages aisle, otherwise compliant.",
        "HSR Layout and Indiranagar biscuit shelves match planogram.",
      ],
    );
  }

  if (categoryWise) {
    const photos = (Object.keys(CATEGORY_LABELS) as CategoryKey[])
      .map((key) => EVIDENCE_LIBRARY.find((p) => p.category === key))
      .filter((p): p is EvidencePhoto => Boolean(p));
    return evidenceAnswer(
      "Here is the latest shelf evidence for each category. Oral Care and Snacks have the most visible issues; Biscuits and Personal Care are largely compliant.",
      "Evidence by category (demo)",
      photos,
      [
        "Oral Care: facing gaps on Oral-B and Colgate at Whitefield.",
        "Snacks: price tags missing on crackers at Whitefield.",
        "Biscuits: full facings at HSR Layout and Indiranagar.",
      ],
    );
  }

  if (store || category) {
    let photos = EVIDENCE_LIBRARY.filter(
      (p) => (!store || p.store === store) && (!category || p.category === category),
    );
    if (!photos.length) {
      photos = EVIDENCE_LIBRARY.filter((p) => (store && p.store === store) || (category && p.category === category));
    }
    const where = [category ? CATEGORY_LABELS[category] : null, store ? STORES[store] : null]
      .filter(Boolean)
      .join(" at ");
    const issues = photos.filter((p) => p.status === "Issue").length;
    return evidenceAnswer(
      `Here ${photos.length === 1 ? "is the latest shelf photo" : `are the latest ${photos.length} shelf photos`} for ${where}. ${
        issues === 1
          ? `${photos.length === 1 ? "It shows" : "1 shows"} an open issue that needs action.`
          : issues
            ? `${issues} show open issues that need action.`
            : "All shelves shown are compliant with the planogram."
      }`,
      `Evidence — ${where} (demo)`,
      photos,
      photos.map((p) => `${STORES[p.store]}: ${p.caption.split(" · ")[1] ?? p.caption} (${p.status.toLowerCase()}).`),
    );
  }

  return evidenceAnswer(
    "Here is the latest shelf evidence from demo audits across 5 stores and 6 categories. 91% of completed audits have verified photo evidence; 5 of these photos show open issues.",
    "Latest audit evidence (demo)",
    EVIDENCE_LIBRARY,
    [
      "Whitefield oral care and snacks shelves need restocking and price tags.",
      "Biscuit and personal care shelves at HSR, Indiranagar and Koramangala are compliant.",
      "4 audits have low-confidence images and are queued for human review.",
    ],
  );
}

const INTENTS: DemoIntent[] = [
  {
    id: "sku_shortages",
    match: [/\b(sku|skus|product|products|item|items)\b/i, /(shortage|short|out of stock|oos|stock.?out|missing|repeated|repeatedly)/i],
    weight: 3,
    build: () =>
      response({
        answer:
          "5 SKUs showed repeated shortages across 42 demo audits. Oral-B Pro Expert is the most frequent — short in 7 audits across 3 stores, mostly at Big Bazaar — Whitefield.",
        summary: "Repeated shortages = SKU found below expected facings in 3+ audits in the period.",
        metrics: [
          { label: "SKUs with repeat shortages", value: "5", unit: "", trend: "up" },
          { label: "Shortage events", value: "23", unit: "", trend: "up" },
          { label: "Stores affected", value: "4", unit: "", trend: "flat" },
          { label: "Potential weekly value at risk", value: "₹18,400", unit: "", trend: "up" },
        ],
        visual: {
          type: "ranking",
          title: "Shortage occurrences by SKU (demo)",
          data: [
            { label: "Oral-B Pro Expert", value: 7 },
            { label: "Sensodyne Repair 75ml", value: 5 },
            { label: "Lays Classic 52g", value: 4 },
            { label: "Coke 750ml", value: 4 },
            { label: "Pepsodent 150g", value: 3 },
          ],
        },
        table: {
          columns: ["SKU", "Shortage audits", "Stores affected", "Avg facing gap", "Worst store"],
          rows: [
            ["Oral-B Pro Expert", 7, 3, "−2.4", STORES.whitefield],
            ["Sensodyne Repair 75ml", 5, 3, "−1.8", STORES.jayanagar],
            ["Lays Classic 52g", 4, 2, "−3.1", STORES.whitefield],
            ["Coke 750ml", 4, 2, "−2.0", STORES.indiranagar],
            ["Pepsodent 150g", 3, 2, "−1.2", STORES.jayanagar],
          ],
        },
        insights: [
          "Big Bazaar — Whitefield accounts for 9 of 23 shortage events — replenishment timing is the likely cause.",
          "Oral-B Pro Expert shortages cluster on weekends, suggesting shelf refill lags peak demand.",
          "Next action: raise a restock corrective action for Oral-B and Lays at Whitefield and re-audit in 7 days.",
        ],
        actions: [
          { label: "View Findings", route: "/findings", params: {} },
          { label: "View Corrective Actions", route: "/corrective-actions", params: {} },
        ],
        follow_up_questions: [
          "Where is stockout risk highest right now?",
          "What was inventory variance over the last 30 days?",
          "Which corrective actions are overdue?",
        ],
      }),
  },
  {
    id: "city_variance",
    match: [/\b(city|cities|region|regions)\b/i],
    weight: 3,
    build: () =>
      response({
        answer:
          "Mumbai has the highest inventory variance at −12.4%, followed by Bengaluru at −10.0%. Pune is the most accurate city at −3.1%.",
        summary: "Variance = (actual − expected units) ÷ expected units across completed inventory audits.",
        metrics: [
          { label: "Highest variance city", value: "Mumbai", unit: "", trend: "down" },
          { label: "Network variance", value: "−8.6", unit: "%", trend: "down" },
          { label: "Cities audited", value: "5", unit: "", trend: "flat" },
        ],
        visual: {
          type: "ranking",
          title: "Inventory variance by city, % (demo)",
          data: [
            { label: "Mumbai", value: 12.4 },
            { label: "Bengaluru", value: 10.0 },
            { label: "Delhi", value: 8.2 },
            { label: "Hyderabad", value: 6.7 },
            { label: "Pune", value: 3.1 },
          ],
        },
        table: {
          columns: ["City", "Stores", "Expected units", "Actual units", "Variance %"],
          rows: [
            ["Mumbai", 6, 1840, 1612, "−12.4%"],
            ["Bengaluru", 5, 380, 342, "−10.0%"],
            ["Delhi", 4, 1210, 1111, "−8.2%"],
            ["Hyderabad", 3, 920, 858, "−6.7%"],
            ["Pune", 3, 760, 736, "−3.1%"],
          ],
        },
        insights: [
          "Mumbai's gap is concentrated in Snacks and Beverages — high-velocity categories.",
          "Bengaluru variance is driven by Big Bazaar — Whitefield (−14 units).",
          "Next action: schedule a recount in the top 2 Mumbai stores this week.",
        ],
        source_context: { period: PERIOD, locations: CITIES, operating_model: "Supermarket" },
        follow_up_questions: [
          "Which of my stores had the highest inventory variance this month?",
          "Which SKUs repeatedly showed shortages?",
          "Compare this month with last month",
        ],
      }),
  },
  {
    id: "inventory_variance",
    match: [/(variance|inventory|stock accuracy|discrepanc)/i],
    weight: 2,
    build: () =>
      response({
        answer:
          "Net inventory variance over the last 30 days is −38 units (−10.0%) across 380 expected units. Variance improved from −14% in week 1 to −7% in week 4.",
        summary: "Expected 380 · Actual 342 · Absolute variance 52 units.",
        metrics: [
          { label: "Net variance", value: "−38", unit: "units", trend: "up" },
          { label: "Variance", value: "−10.0", unit: "%", trend: "up" },
          { label: "Absolute variance", value: "52", unit: "units", trend: "flat" },
          { label: "Potential weekly value at risk", value: "₹18,400", unit: "", trend: "down" },
        ],
        visual: {
          type: "line",
          title: "Inventory variance % by week (demo)",
          data: [
            { date: "W1", value: -14 },
            { date: "W2", value: -12 },
            { date: "W3", value: -9 },
            { date: "W4", value: -7 },
          ],
        },
        table: {
          columns: ["Store", "Expected", "Actual", "Variance"],
          rows: [
            [STORES.whitefield, 110, 96, -14],
            [STORES.koramangala, 95, 87, -8],
            [STORES.jayanagar, 90, 83, -7],
            [STORES.hsr, 85, 81, -4],
          ],
        },
        insights: [
          "Snacks is the worst category at −11 units; Oral Care at −6 units.",
          "Big Bazaar — Whitefield alone contributes 37% of the net gap.",
          "Next action: focus recounts on Snacks at Whitefield.",
        ],
        follow_up_questions: [
          "Which cities have the highest inventory variance?",
          "Which SKUs repeatedly showed shortages?",
          "Where is stockout risk highest right now?",
        ],
      }),
  },
  {
    id: "compliance_change",
    match: [/(compliance|planogram)/i, /(why|change|changed|drop|dropped|improve|trend|month)/i],
    weight: 3,
    build: () =>
      response({
        answer:
          "Planogram compliance rose 3.1 points this month to 84%. The gain came from Koramangala (+6 pts) and HSR (+4 pts); Whitefield fell 5 points to 74% after two missed restock cycles.",
        metrics: [
          { label: "Planogram compliance", value: "84", unit: "%", trend: "up" },
          { label: "Change vs last month", value: "+3.1", unit: "pts", trend: "up" },
          { label: "Stores improved", value: "3", unit: "", trend: "up" },
          { label: "Stores declined", value: "1", unit: "", trend: "down" },
        ],
        visual: {
          type: "line",
          title: "Planogram compliance % by week (demo)",
          data: [
            { date: "W1", value: 80 },
            { date: "W2", value: 81 },
            { date: "W3", value: 83 },
            { date: "W4", value: 84 },
          ],
        },
        table: {
          columns: ["Store", "Last month", "This month", "Change"],
          rows: [
            [STORES.koramangala, "85%", "91%", "+6"],
            [STORES.hsr, "84%", "88%", "+4"],
            [STORES.jayanagar, "77%", "79%", "+2"],
            [STORES.whitefield, "79%", "74%", "−5"],
          ],
        },
        insights: [
          "Corrective actions closed at Koramangala drove most of the improvement.",
          "Whitefield's drop is linked to Oral-B and Lays facing gaps.",
          "Next action: prioritize a manager visit at Whitefield this week.",
        ],
        follow_up_questions: [
          "Which stores have the lowest planogram compliance?",
          "Which SKUs repeatedly showed shortages?",
          "Which corrective actions are overdue?",
        ],
      }),
  },
  {
    id: "store_compliance",
    match: [/(compliance|planogram|execution|lowest|worst|best|top|perform)/i, /(store|stores|outlet|outlets|location|locations)/i],
    weight: 2,
    build: () =>
      response({
        answer:
          "Big Bazaar — Whitefield has the lowest planogram compliance at 74%, followed by Reliance Smart — Jayanagar at 79%. More Mart — Koramangala leads at 91%.",
        metrics: [
          { label: "Network compliance", value: "84", unit: "%", trend: "up" },
          { label: "Below 80% target", value: "2", unit: "stores", trend: "down" },
          { label: "Best store", value: "91", unit: "%", trend: "up" },
        ],
        visual: {
          type: "ranking",
          title: "Planogram compliance by store, % (demo)",
          data: [
            { label: "Koramangala", value: 91 },
            { label: "HSR Layout", value: 88 },
            { label: "Jayanagar", value: 79 },
            { label: "Whitefield", value: 74 },
          ],
        },
        table: {
          columns: ["Store", "Compliance", "Audits", "Open findings"],
          rows: [
            [STORES.koramangala, "91%", 12, 2],
            [STORES.hsr, "88%", 12, 3],
            [STORES.jayanagar, "79%", 10, 4],
            [STORES.whitefield, "74%", 8, 5],
          ],
        },
        insights: [
          "Whitefield has the largest facing shortfall: 82 actual vs 100 expected facings.",
          "Jayanagar's gap is mostly price-tag and promo execution, not stock.",
          "Next action: assign a re-audit for Whitefield and Jayanagar.",
        ],
        actions: [{ label: "View Findings", route: "/findings", params: {} }],
        follow_up_questions: [
          "Why did compliance change this month?",
          "Which locations have the highest recurring issues?",
          "Show me the latest audit evidence images",
        ],
      }),
  },
  {
    id: "recurring",
    match: [/(recurring|repeat|repeating|keep appearing|reappear|reopened|again)/i],
    weight: 2,
    build: () =>
      response({
        answer:
          "Big Bazaar — Whitefield has the most recurring issues: 5 findings repeated in 2+ consecutive audits. The top repeat issue across stores is low facings on Oral-B Pro Expert.",
        metrics: [
          { label: "Recurring issue rate", value: "18", unit: "%", trend: "down" },
          { label: "Repeat findings", value: "11", unit: "", trend: "flat" },
          { label: "Stores with repeats", value: "4", unit: "", trend: "flat" },
        ],
        visual: {
          type: "ranking",
          title: "Repeat findings by store (demo)",
          data: [
            { label: "Whitefield", value: 5 },
            { label: "Jayanagar", value: 3 },
            { label: "HSR Layout", value: 2 },
            { label: "Koramangala", value: 1 },
          ],
        },
        table: {
          columns: ["Issue", "Repeats", "Stores", "Severity"],
          rows: [
            ["Low facings — Oral-B Pro Expert", 4, 3, "High"],
            ["Missing price tag — Sensodyne", 3, 2, "Medium"],
            ["Empty slot — Snacks end-cap", 2, 2, "High"],
            ["Promo not executed — Beverages", 2, 1, "Medium"],
          ],
        },
        insights: [
          "Repeat rate fell from 24% to 18% after corrective actions were introduced.",
          "Whitefield repeats point to a replenishment process gap, not one-off misses.",
          "Next action: escalate Whitefield repeats to the area manager.",
        ],
        actions: [{ label: "View Findings", route: "/findings", params: {} }],
        follow_up_questions: [
          "Which of my managers has the highest repeat finding rate?",
          "Which corrective actions are overdue?",
          "Which SKUs repeatedly showed shortages?",
        ],
      }),
  },
  {
    id: "managers_team",
    match: [/(manager|managers|team|assignee|assignees|owner|owners|auditor|auditors|workload|people|staff|sla|behind)/i],
    weight: 4,
    build: () =>
      response({
        answer:
          "Rahul Mehta (North area manager) has the highest repeat finding rate at 27%, covering Whitefield and Jayanagar. Priya Nair (South) is lowest at 9%.",
        metrics: [
          { label: "Team members", value: "6", unit: "", trend: "flat" },
          { label: "Avg repeat finding rate", value: "18", unit: "%", trend: "down" },
          { label: "Corrective action SLA", value: "78", unit: "%", trend: "up" },
        ],
        visual: {
          type: "ranking",
          title: "Repeat finding rate by manager, % (demo)",
          data: [
            { label: "Rahul Mehta", value: 27 },
            { label: "Ankit Sharma", value: 19 },
            { label: "Sneha Rao", value: 14 },
            { label: "Priya Nair", value: 9 },
          ],
        },
        table: {
          columns: ["Manager", "Stores", "Audits", "Repeat rate", "Overdue actions"],
          rows: [
            ["Rahul Mehta", "Whitefield, Jayanagar", 18, "27%", 2],
            ["Ankit Sharma", "Indiranagar", 8, "19%", 1],
            ["Sneha Rao", "HSR Layout", 12, "14%", 0],
            ["Priya Nair", "Koramangala", 12, "9%", 0],
          ],
        },
        insights: [
          "Rahul owns 2 of the 3 overdue corrective actions.",
          "Stores under Priya closed 100% of actions within SLA.",
          "Next action: pair Rahul's stores with a follow-up re-audit this week.",
        ],
        actions: [
          { label: "View Team", route: "/team", params: {} },
          { label: "View Corrective Actions", route: "/corrective-actions", params: {} },
        ],
        follow_up_questions: [
          "Which corrective actions are overdue?",
          "Which locations have the highest recurring issues?",
          "Show audit completion trend over the last 30 days",
        ],
      }),
  },
  {
    id: "corrective_actions",
    match: [/(corrective|action|actions|overdue|pending|open task)/i],
    weight: 2,
    build: () =>
      response({
        answer:
          "3 of 22 corrective actions are overdue, and 9 are still open. The oldest overdue action is the Oral-B restock at Big Bazaar — Whitefield, 6 days past due.",
        metrics: [
          { label: "Open actions", value: "9", unit: "", trend: "flat" },
          { label: "Overdue", value: "3", unit: "", trend: "down" },
          { label: "SLA met", value: "78", unit: "%", trend: "up" },
          { label: "Closure rate", value: "22.7", unit: "%", trend: "up" },
        ],
        visual: {
          type: "donut",
          title: "Corrective action status (demo)",
          data: [
            { label: "Open", value: 9 },
            { label: "In progress", value: 5 },
            { label: "Overdue", value: 3 },
            { label: "Closed", value: 5 },
          ],
        },
        table: {
          columns: ["Action", "Store", "Owner", "Days overdue"],
          rows: [
            ["Restock Oral-B Pro Expert", STORES.whitefield, "Rahul Mehta", 6],
            ["Fix Sensodyne price tag", STORES.jayanagar, "Rahul Mehta", 3],
            ["Refill Snacks end-cap", STORES.indiranagar, "Ankit Sharma", 2],
          ],
        },
        insights: [
          "All 3 overdue actions are in North-region stores.",
          "Next action: escalate the Whitefield restock and verify with a photo re-audit.",
        ],
        actions: [{ label: "View Corrective Actions", route: "/corrective-actions", params: {} }],
        follow_up_questions: [
          "Which of my managers has the highest repeat finding rate?",
          "Show before/after evidence for recent corrective actions",
          "Which stores have the most open findings?",
        ],
      }),
  },
  {
    id: "findings",
    match: [/(finding|findings|critical|issue|issues|exception|exceptions|risk)/i],
    weight: 1,
    build: () =>
      response({
        answer:
          "There are 14 open findings, including 3 critical. Big Bazaar — Whitefield has the most (5 open, 2 critical).",
        metrics: [
          { label: "Open findings", value: "14", unit: "", trend: "down" },
          { label: "Critical", value: "3", unit: "", trend: "down" },
          { label: "Stores with findings", value: "4", unit: "", trend: "flat" },
        ],
        visual: {
          type: "ranking",
          title: "Open findings by store (demo)",
          data: [
            { label: "Whitefield", value: 5 },
            { label: "Jayanagar", value: 4 },
            { label: "HSR Layout", value: 3 },
            { label: "Koramangala", value: 2 },
          ],
        },
        table: {
          columns: ["Finding", "Store", "Severity", "Age (days)"],
          rows: [
            ["Empty slot — shelf 3, Oral care", STORES.whitefield, "Critical", 4],
            ["Low facings — Lays Classic", STORES.whitefield, "Critical", 3],
            ["Expired stock on display", STORES.jayanagar, "Critical", 1],
            ["Missing price tag — Sensodyne", STORES.jayanagar, "Medium", 5],
          ],
        },
        insights: [
          "Critical findings are all stock/expiry related — resolving them lifts compliance fastest.",
          "Next action: close the 3 critical findings within 48 hours.",
        ],
        actions: [{ label: "View Findings", route: "/findings", params: {} }],
        follow_up_questions: [
          "Which corrective actions are overdue?",
          "Which locations have the highest recurring issues?",
          "Show me the latest audit evidence images",
        ],
      }),
  },
  {
    id: "evidence",
    match: [/\b(images?|photos?|pictures?|pics?|evidence|before|after|proof|shelf shots?)\b|show me the shelf/i],
    weight: 15,
    build: buildEvidenceResponse,
  },
  {
    id: "expiry",
    match: [/(expiry|expire|expired|expiring|fresh|fnv|damaged|near.?expiry|shelf life)/i],
    weight: 3,
    build: () =>
      response({
        answer:
          "18 units are nearing expiry within 7 days across 3 stores. Reliance Smart — Jayanagar has the highest expiry risk (8 units, mostly dairy and bakery).",
        metrics: [
          { label: "Units nearing expiry", value: "18", unit: "", trend: "down" },
          { label: "Sellable rate (F&V)", value: "87.5", unit: "%", trend: "up" },
          { label: "Damage rate", value: "7.5", unit: "%", trend: "down" },
        ],
        visual: {
          type: "ranking",
          title: "Units nearing expiry by store (demo)",
          data: [
            { label: "Jayanagar", value: 8 },
            { label: "Whitefield", value: 6 },
            { label: "HSR Layout", value: 4 },
          ],
        },
        table: {
          columns: ["Product", "Store", "Units", "Days to expiry"],
          rows: [
            ["Amul Taaza 500ml", STORES.jayanagar, 5, 2],
            ["Britannia Brown Bread", STORES.jayanagar, 3, 1],
            ["Epigamia Greek Yogurt", STORES.whitefield, 6, 4],
            ["Nestlé a+ Dahi", STORES.hsr, 4, 5],
          ],
        },
        insights: ["Next action: mark down or rotate Jayanagar dairy stock today."],
        actions: [{ label: "Open Expiry Control", route: "/expiry-control", params: {} }],
        follow_up_questions: [
          "Show critical findings that need attention",
          "Which SKUs repeatedly showed shortages?",
          "Where is stockout risk highest right now?",
        ],
      }),
  },
  {
    id: "stockout_risk",
    match: [/(stockout risk|stock.?out risk|risk|dark store|dark stores|warehouse|warehouses)/i, /(stock|highest|where|risk)/i],
    weight: 1,
    build: () =>
      response({
        answer:
          "Stockout risk is highest at Big Bazaar — Whitefield: 4 SKUs are below 2 facings, led by Oral-B Pro Expert and Lays Classic 52g.",
        metrics: [
          { label: "At-risk SKUs", value: "9", unit: "", trend: "up" },
          { label: "Potential OOS SKUs", value: "4", unit: "", trend: "up" },
          { label: "Potential daily value at risk", value: "₹2,600", unit: "", trend: "up" },
        ],
        visual: {
          type: "ranking",
          title: "At-risk SKUs by store (demo)",
          data: [
            { label: "Whitefield", value: 4 },
            { label: "Jayanagar", value: 2 },
            { label: "Indiranagar", value: 2 },
            { label: "HSR Layout", value: 1 },
          ],
        },
        insights: ["Next action: trigger replenishment for Whitefield before the weekend peak."],
        follow_up_questions: [
          "Which SKUs repeatedly showed shortages?",
          "What was inventory variance over the last 30 days?",
          "Which corrective actions are overdue?",
        ],
      }),
  },
  {
    id: "brand_share",
    match: [/(brand|brands|share|facings|top products|category|categories|visible units)/i],
    weight: 2,
    build: () =>
      response({
        answer:
          "Colgate leads share of facings at 34%, followed by Sensodyne (22%) and Oral-B (18%). Across 412 facings, Oral Care is the largest category at 38%.",
        metrics: [
          { label: "Total facings", value: "412", unit: "", trend: "flat" },
          { label: "Brands identified", value: "28", unit: "", trend: "up" },
          { label: "Products identified", value: "186", unit: "", trend: "up" },
        ],
        visual: {
          type: "donut",
          title: "Brand share of facings (demo)",
          data: [
            { label: "Colgate", value: 34 },
            { label: "Sensodyne", value: 22 },
            { label: "Oral-B", value: 18 },
            { label: "Pepsodent", value: 14 },
            { label: "Others", value: 12 },
          ],
        },
        table: {
          columns: ["Product", "Facings", "Visible units"],
          rows: [
            ["Colgate Total 120g", 28, 64],
            ["Sensodyne Repair 75ml", 18, 36],
            ["Oral-B Pro Expert", 14, 22],
            ["Lays Classic 52g", 12, 30],
          ],
        },
        follow_up_questions: [
          "Which SKUs repeatedly showed shortages?",
          "Which stores have the lowest planogram compliance?",
          "Why did compliance change this month?",
        ],
      }),
  },
  {
    id: "completion_trend",
    match: [/(completion|completed|audits|audit|trend|overdue audits|progress)/i],
    weight: 1,
    build: () =>
      response({
        answer:
          "42 audits in the last 30 days with 84% completion. Weekly volume grew from 6 audits in week 1 to 10–11 in weeks 5–6.",
        metrics: [
          { label: "Total audits", value: "42", unit: "", trend: "up" },
          { label: "Completed", value: "35", unit: "", trend: "up" },
          { label: "In progress", value: "5", unit: "", trend: "flat" },
          { label: "Completion", value: "84", unit: "%", trend: "up" },
        ],
        visual: {
          type: "line",
          title: "Audits per week (demo)",
          data: [
            { date: "W1", value: 6 },
            { date: "W2", value: 8 },
            { date: "W3", value: 7 },
            { date: "W4", value: 9 },
            { date: "W5", value: 11 },
            { date: "W6", value: 10 },
          ],
        },
        table: {
          columns: ["Store", "Completed", "Total", "Completion"],
          rows: [
            [STORES.koramangala, 12, 12, "100%"],
            [STORES.hsr, 11, 12, "92%"],
            [STORES.jayanagar, 8, 10, "80%"],
            [STORES.whitefield, 8, 12, "67%"],
          ],
        },
        actions: [{ label: "View Assignments", route: "/assignments", params: {} }],
        follow_up_questions: [
          "Which stores have the lowest planogram compliance?",
          "Which corrective actions are overdue?",
          "Compare this month with last month",
        ],
      }),
  },
  {
    id: "comparison",
    match: [/(compare|comparison|vs|versus|last month|this month|improved|declined|better|worse)/i],
    weight: 1,
    build: () =>
      response({
        answer:
          "This month vs last month: compliance +3.1 pts to 84%, audits +4 to 42, and open findings down from 19 to 14. Whitefield is the only store that declined.",
        metrics: [
          { label: "Compliance", value: "84", unit: "%", trend: "up" },
          { label: "Audits", value: "42", unit: "", trend: "up" },
          { label: "Open findings", value: "14", unit: "", trend: "down" },
          { label: "Avg confidence", value: "94.2", unit: "%", trend: "up" },
        ],
        visual: {
          type: "bar",
          title: "Compliance by store — this month, % (demo)",
          data: [
            { label: "Koramangala", value: 91 },
            { label: "HSR Layout", value: 88 },
            { label: "Jayanagar", value: 79 },
            { label: "Whitefield", value: 74 },
          ],
        },
        table: {
          columns: ["Metric", "Last month", "This month", "Change"],
          rows: [
            ["Planogram compliance", "80.9%", "84%", "+3.1 pts"],
            ["Audits", 38, 42, "+4"],
            ["Open findings", 19, 14, "−5"],
            ["Verification coverage", "88.6%", "91%", "+2.4 pts"],
          ],
        },
        follow_up_questions: [
          "Why did compliance change this month?",
          "Which locations declined the most this month?",
          "Which SKUs repeatedly showed shortages?",
        ],
      }),
  },
];

function overviewResponse(): AskAislixResponse {
  return response({
    answer:
      "3 things need attention today: Big Bazaar — Whitefield is at 74% compliance with 5 open findings, 3 corrective actions are overdue, and Oral-B Pro Expert keeps running short in 3 stores.",
    summary: "42 audits · 84% planogram compliance · 14 open findings (3 critical) · 9 open corrective actions",
    metrics: [
      { label: "Planogram compliance", value: "84", unit: "%", trend: "up" },
      { label: "Open findings", value: "14", unit: "", trend: "down" },
      { label: "Critical", value: "3", unit: "", trend: "down" },
      { label: "Overdue actions", value: "3", unit: "", trend: "down" },
    ],
    visual: {
      type: "ranking",
      title: "Planogram compliance by store, % (demo)",
      data: [
        { label: "Koramangala", value: 91 },
        { label: "HSR Layout", value: 88 },
        { label: "Jayanagar", value: 79 },
        { label: "Whitefield", value: 74 },
      ],
    },
    insights: [
      "Whitefield: restock Oral-B Pro Expert and Lays Classic, then re-audit.",
      "Jayanagar: fix Sensodyne price tags and rotate near-expiry dairy.",
      "Koramangala is the benchmark store at 91% — replicate its restock cadence.",
    ],
    actions: [
      { label: "View Findings", route: "/findings", params: {} },
      { label: "View Corrective Actions", route: "/corrective-actions", params: {} },
    ],
    follow_up_questions: [
      "Which SKUs repeatedly showed shortages?",
      "Which stores have the lowest planogram compliance?",
      "Which corrective actions are overdue?",
    ],
  });
}

function scoreIntent(intent: DemoIntent, question: string): number {
  if (!intent.match.every((re) => re.test(question))) return 0;
  return intent.match.length * 10 + (intent.weight ?? 1);
}

/** Best-matching showcase intent, or null when the question is too generic to classify. */
export function matchDemoAskIntent(question: string): DemoIntent | null {
  const q = question.replace(/\(Scope:[^)]*\)/gi, "").trim();
  if (!q) return null;
  let best: DemoIntent | null = null;
  let bestScore = 0;
  for (const intent of INTENTS) {
    const s = scoreIntent(intent, q);
    if (s > bestScore) {
      best = intent;
      bestScore = s;
    }
  }
  return best;
}

/** Always returns a complete demo answer — matched intent or the "what needs attention" overview. */
export function buildDemoAskResponse(question: string): AskAislixResponse {
  const intent = matchDemoAskIntent(question);
  const result = intent ? intent.build(question) : overviewResponse();
  const evidenceIds = INTENT_EVIDENCE[intent?.id ?? "overview"];
  if (result.visual?.type !== "image_gallery" && evidenceIds?.length) {
    result.evidence = {
      title: "Supporting shelf evidence (demo)",
      images: photosById(evidenceIds).map(galleryItem),
    };
  }
  return result;
}

const REFUSAL_PATTERNS = [
  /\bcannot\b/i,
  /\bcan't\b/i,
  /\bunable to\b/i,
  /\bno (sku|data|evidence|records?|audits?)\b/i,
  /\bnot (available|provided|enough|sufficient)\b/i,
  /\binsufficient\b/i,
  /\bdata unavailable\b/i,
  /\bdoes not contain\b/i,
  /\bno audit found\b/i,
  /\bcould not (format|complete)\b/i,
];

/** Detects "I don't have data" style model answers so demo mode can substitute a showcase answer. */
export function isInsufficientDataAnswer(answer: string | null | undefined): boolean {
  if (!answer?.trim()) return true;
  const head = answer.slice(0, 280);
  return REFUSAL_PATTERNS.some((re) => re.test(head));
}
