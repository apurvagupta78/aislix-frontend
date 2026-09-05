/**
 * Display-currency helpers for the plan catalogue.
 *
 * Prices are authored in INR (see `src/lib/pricing.ts`). This module converts
 * them for *display only* using static indicative rates — billing/checkout
 * still happens in INR until the payment provider supports multi-currency.
 *
 * Detection is client-side (browser locale, then time zone), with a manual
 * override persisted in localStorage. SSR always renders the INR default so
 * hydration never mismatches.
 */
import { useCallback, useEffect, useState } from "react";

export type CurrencyCode =
  | "INR"
  | "USD"
  | "GBP"
  | "EUR"
  | "AED"
  | "AUD"
  | "CAD"
  | "SGD"
  | "BRL"
  | "MXN"
  | "CLP"
  | "COP";


export type CurrencyInfo = {
  code: CurrencyCode;
  label: string;
  /** Units of this currency per 1 INR. */
  rate: number;
  locale: string;
  /** Smallest visual step used when rounding a converted price. */
  step: number;
};

export const BASE_CURRENCY: CurrencyCode = "INR";

export const currencies: Record<CurrencyCode, CurrencyInfo> = {
  INR: { code: "INR", label: "INR ₹", rate: 1, locale: "en-IN", step: 1, whole: true },
  USD: { code: "USD", label: "USD $", rate: 0.0115, locale: "en-US", step: 1 },
  GBP: { code: "GBP", label: "GBP £", rate: 0.0088, locale: "en-GB", step: 1 },
  EUR: { code: "EUR", label: "EUR €", rate: 0.0103, locale: "en-IE", step: 1 },
  AED: { code: "AED", label: "AED", rate: 0.0423, locale: "en-AE", step: 1 },
  AUD: { code: "AUD", label: "AUD $", rate: 0.0176, locale: "en-AU", step: 1 },
  CAD: { code: "CAD", label: "CAD $", rate: 0.0159, locale: "en-CA", step: 1 },
  SGD: { code: "SGD", label: "SGD $", rate: 0.0150, locale: "en-SG", step: 1 },
  BRL: { code: "BRL", label: "BRL R$", rate: 0.0620, locale: "pt-BR", step: 1 },
  MXN: { code: "MXN", label: "MXN $", rate: 0.2100, locale: "es-MX", step: 1 },
  CLP: { code: "CLP", label: "CLP $", rate: 11.0, locale: "es-CL", step: 1, whole: true },
  COP: { code: "COP", label: "COP $", rate: 46.0, locale: "es-CO", step: 1, whole: true },
};


export const currencyList: CurrencyInfo[] = Object.values(currencies);

/** ISO country → display currency. Anything unmapped falls back to USD. */
const countryCurrency: Record<string, CurrencyCode> = {
  IN: "INR",
  US: "USD",
  GB: "GBP",
  UK: "GBP",
  IE: "EUR",
  DE: "EUR",
  FR: "EUR",
  ES: "EUR",
  IT: "EUR",
  NL: "EUR",
  BE: "EUR",
  AT: "EUR",
  PT: "EUR",
  FI: "EUR",
  GR: "EUR",
  SK: "EUR",
  SI: "EUR",
  EE: "EUR",
  LV: "EUR",
  LT: "EUR",
  LU: "EUR",
  CY: "EUR",
  MT: "EUR",
  HR: "EUR",
  AE: "AED",
  SA: "AED",
  QA: "AED",
  OM: "AED",
  BH: "AED",
  KW: "AED",
  AU: "AUD",
  NZ: "AUD",
  CA: "CAD",
  SG: "SGD",
  MY: "SGD",
};

/** Time-zone → country, used when the browser locale has no region subtag. */
const zoneCountry: Record<string, string> = {
  "Asia/Kolkata": "IN",
  "Asia/Calcutta": "IN",
  "Europe/London": "GB",
  "Europe/Dublin": "IE",
  "Europe/Paris": "FR",
  "Europe/Berlin": "DE",
  "Europe/Madrid": "ES",
  "Europe/Rome": "IT",
  "Europe/Amsterdam": "NL",
  "Europe/Brussels": "BE",
  "Europe/Lisbon": "PT",
  "Europe/Vienna": "AT",
  "Asia/Dubai": "AE",
  "Asia/Riyadh": "SA",
  "Asia/Singapore": "SG",
  "Asia/Kuala_Lumpur": "MY",
  "Australia/Sydney": "AU",
  "Australia/Melbourne": "AU",
  "Pacific/Auckland": "NZ",
  "America/Toronto": "CA",
  "America/Vancouver": "CA",
};

const STORAGE_KEY = "aislix.display-currency";

function isCurrency(value: unknown): value is CurrencyCode {
  return typeof value === "string" && value in currencies;
}

/** Best-effort currency for the visitor's location. Browser-only. */
export function detectCurrency(): CurrencyCode {
  if (typeof window === "undefined") return BASE_CURRENCY;

  const tags = [
    ...(navigator.languages ?? []),
    navigator.language,
  ].filter(Boolean) as string[];

  for (const tag of tags) {
    try {
      const region = new Intl.Locale(tag).maximize().region;
      if (region && countryCurrency[region]) return countryCurrency[region]!;
    } catch {
      const region = tag.split("-")[1]?.toUpperCase();
      if (region && countryCurrency[region]) return countryCurrency[region]!;
    }
  }

  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const country = zone ? zoneCountry[zone] : undefined;
    if (country && countryCurrency[country]) return countryCurrency[country]!;
    if (zone?.startsWith("Europe/")) return "EUR";
    if (zone?.startsWith("America/")) return "USD";
  } catch {
    /* ignore */
  }

  return "USD";
}

/** Nearest value from a charm-price ladder (…9.99 / …99 endings). */
function nearestCharm(raw: number, step: number, offset: number): number {
  const lower = Math.floor(raw / step) * step + offset;
  const upper = lower + step;
  const low = lower > 0 ? lower : upper;
  const picked = Math.abs(raw - low) <= Math.abs(upper - raw) ? low : upper;
  return Math.round(picked * 100) / 100;

}

/**
 * Convert an INR amount and round it to a marketable charm price
 * (e.g. ₹2,999 → $29.99, £24.99, €29.99 — never $31.74).
 */
export function convertFromInr(amountInr: number, code: CurrencyCode): number {
  const info = currencies[code];
  const raw = amountInr * info.rate;
  if (raw === 0) return 0;

  if (code === BASE_CURRENCY) {
    // Rupee prices keep whole-number 9 endings: 499, 999, 2,999…
    if (raw < 100) return nearestCharm(raw, 10, -1);
    if (raw < 1000) return nearestCharm(raw, 100, -1);
    return nearestCharm(raw, 1000, -1);
  }

  // 1.99 / 4.99 steps for small amounts, then 9.99 tiers, then 99 endings.
  if (raw < 10) return Math.max(0.99, nearestCharm(raw, 1, -0.01));
  if (raw < 100) return nearestCharm(raw, 10, -0.01);
  if (raw < 1000) return nearestCharm(raw, 50, -1);
  return nearestCharm(raw, 100, -1);
}


/** Format an already-converted amount in its own currency. */
export function formatCurrency(amount: number, code: CurrencyCode): string {
  const info = currencies[code];
  return new Intl.NumberFormat(info.locale, {
    style: "currency",
    currency: code,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

/** Convert + format in one step. */
export function formatFromInr(amountInr: number, code: CurrencyCode): string {
  return formatCurrency(convertFromInr(amountInr, code), code);
}

/**
 * Currency for the current visitor. Starts at INR (SSR-safe) and switches to
 * the detected or stored currency right after hydration.
 */
export function useDisplayCurrency() {
  const [currency, setCurrency] = useState<CurrencyCode>(BASE_CURRENCY);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setCurrency(isCurrency(stored) ? stored : detectCurrency());
  }, []);

  const choose = useCallback((next: CurrencyCode) => {
    setCurrency(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }, []);

  return {
    currency,
    setCurrency: choose,
    isBase: currency === BASE_CURRENCY,
    format: (amountInr: number) => formatFromInr(amountInr, currency),
  };
}
