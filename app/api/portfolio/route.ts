import { NextResponse } from "next/server";
import YahooFinanceDefault from "yahoo-finance2";
// yahoo-finance2 v3: instantiate once, suppress deprecation notice for historical()
const yahooFinance = new YahooFinanceDefault({
  suppressNotices: ["ripHistorical"],
});

// ---- Types ------------------------------------------------------------------

export interface PricePoint {
  value: number | null;
  asOf: string;
  source: "yahoo" | "mock";
}

export interface PerfCell {
  pct: number;
  gainCHF: number;
}

export interface PortfolioRow {
  isin: string;
  ticker: string;
  name: string;
  currency: string;
  quantity: number;
  price: PricePoint | null;
  priceCHFnow: number | null;
  valueCHF: number | null;
  pe: number | null;
  roic: number | null;
  dividendYield: number | null;
  dividendCHF: number | null;
  perf: Record<string, PerfCell | null>;
  error: string | null;
}

export interface PortfolioTotals {
  value: number;
  portfolioPE: number | null;
  portfolioDY: number | null;
  dividends: number;
  totalPerf: Record<string, PerfCell | null>;
}

export interface PortfolioResponse {
  rows: PortfolioRow[];
  totals: PortfolioTotals;
  refISO: string;
  source: "yahoo" | "mock";
  fetchedAt: string;
}

// ---- Holdings ---------------------------------------------------------------

interface Holding {
  isin: string;
  ticker: string;
  name: string;
  currency: string;
  quantity: number;
}

const HOLDINGS: Holding[] = [
  { isin: "DE0008404005", ticker: "ALV.DE",  name: "Allianz SE",             currency: "EUR", quantity: 18  },
  { isin: "DE0005659700", ticker: "EUZ.DE",  name: "Eckert & Ziegler SE",    currency: "EUR", quantity: 60  },
  { isin: "US02079K3059", ticker: "GOOGL",   name: "Alphabet Inc.",          currency: "USD", quantity: 108 },
  { isin: "DE0008402215", ticker: "HNR1.DE", name: "Hannover Rück SE",       currency: "EUR", quantity: 40  },
  { isin: "US5949181045", ticker: "MSFT",    name: "Microsoft Corp.",        currency: "USD", quantity: 31  },
  { isin: "CH0012032048", ticker: "ROG.SW",  name: "Roche Holding AG",       currency: "CHF", quantity: 40  },
  { isin: "DE0007164600", ticker: "SAP.DE",  name: "SAP SE",                 currency: "EUR", quantity: 20  },
  { isin: "CH0008742519", ticker: "SCMN.SW", name: "Swisscom AG",            currency: "CHF", quantity: 18  },
  { isin: "CH0126881561", ticker: "SREN.SW", name: "Swiss Re AG",            currency: "CHF", quantity: 30  },
  { isin: "CH0011075394", ticker: "ZURN.SW", name: "Zurich Insurance Group", currency: "CHF", quantity: 20  },
  { isin: "FR0000131104", ticker: "BNP.PA",  name: "BNP Paribas SA",         currency: "EUR", quantity: 99  },
  { isin: "US0846707026", ticker: "BRK-B",   name: "Berkshire Hathaway B",   currency: "USD", quantity: 50  },
  { isin: "NL0010273215", ticker: "ASML.AS", name: "ASML Holding NV",        currency: "EUR", quantity: 11  },
  { isin: "FR0000120628", ticker: "CS.PA",   name: "AXA SA",                 currency: "EUR", quantity: 100 },
  { isin: "DE000BASF111", ticker: "BAS.DE",  name: "BASF SE",                currency: "EUR", quantity: 50  },
  { isin: "DE0006231004", ticker: "IFX.DE",  name: "Infineon Technologies",  currency: "EUR", quantity: 90  },
  { isin: "DE0007664039", ticker: "VOW3.DE", name: "Volkswagen AG Vz.",      currency: "EUR", quantity: 35  },
  { isin: "DE0007236101", ticker: "SIE.DE",  name: "Siemens AG",             currency: "EUR", quantity: 14  },
  { isin: "FR0000120578", ticker: "SAN.PA",  name: "Sanofi SA",              currency: "EUR", quantity: 30  },
];

const HORIZONS = ["1M", "3M", "1Y", "3Y"] as const;
type Horizon = (typeof HORIZONS)[number];

// ---- Stichtage --------------------------------------------------------------

function horizonDates(refISO: string): Record<string, string> {
  const ref = new Date(refISO + "T00:00:00Z");
  const shift = (months: number) => {
    const x = new Date(ref);
    x.setUTCMonth(x.getUTCMonth() - months);
    return x.toISOString().slice(0, 10);
  };
  return { now: refISO, "1M": shift(1), "3M": shift(3), "1Y": shift(12), "3Y": shift(36) };
}

// ---- Mock adapter -----------------------------------------------------------

const MOCK_FX_NOW: Record<string, number> = { EUR: 0.935, USD: 0.885, CHF: 1 };
const MOCK_FX_DRIFT: Record<string, number> = { "1M": 0.004, "3M": 0.012, "1Y": -0.02, "3Y": -0.06 };

const MOCK_DATA: Record<string, { px: number; pe: number | null; roic: number | null; dy: number }> = {
  "ALV.DE":  { px: 421.0,  pe: 12.9, roic: 11.5, dy: 5.25 },
  "EUZ.DE":  { px: 52.4,   pe: 19.3, roic: null, dy: 1.44 },
  "GOOGL":   { px: 365.8,  pe: 27.9, roic: 28.4, dy: 0.24 },
  "HNR1.DE": { px: 244.0,  pe: 9.6,  roic: 11.2, dy: 5.55 },
  "MSFT":    { px: 423.0,  pe: 22.8, roic: 32.1, dy: 0.92 },
  "ROG.SW":  { px: 333.0,  pe: 20.8, roic: null, dy: 2.97 },
  "SAP.DE":  { px: 233.0,  pe: 22.4, roic: null, dy: 1.67 },
  "SCMN.SW": { px: 668.0,  pe: 28.5, roic: null, dy: 3.82 },
  "SREN.SW": { px: 138.0,  pe: 9.8,  roic: 9.8,  dy: 5.90 },
  "ZURN.SW": { px: 576.0,  pe: 14.8, roic: 12.5, dy: 5.47 },
  "BNP.PA":  { px: 101.2,  pe: 9.5,  roic: 8.5,  dy: 7.15 },
  "BRK-B":   { px: 490.2,  pe: 14.6, roic: 9.5,  dy: 0.00 },
  "ASML.AS": { px: 1024.0, pe: 38.0, roic: 38.5, dy: 0.95 },
  "CS.PA":   { px: 42.5,   pe: null, roic: null, dy: 0.00 },
  "BAS.DE":  { px: 49.9,   pe: 29.3, roic: null, dy: 4.58 },
  "IFX.DE":  { px: 38.0,   pe: 97.6, roic: null, dy: 0.44 },
  "VOW3.DE": { px: 86.5,   pe: 7.1,  roic: null, dy: 0.00 },
  "SIE.DE":  { px: 233.0,  pe: 28.2, roic: null, dy: 0.00 },
  "SAN.PA":  { px: 88.0,   pe: 19.1, roic: null, dy: 5.38 },
};

function seed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

function mockReturn(ticker: string, h: string): number {
  const base: Record<string, number> = { "1M": 0.05, "3M": 0.10, "1Y": 0.20, "3Y": 0.45 };
  const jitter = (seed(ticker + h) - 0.45) * (base[h] * 3 + 0.15);
  return base[h] + jitter;
}

interface RawHoldingData {
  isin: string;
  ticker: string;
  name: string;
  currency: string;
  quantity: number;
  price: PricePoint | null;
  history: Record<string, { value: number; asOf: string } | null>;
  fxNow: { value: number | null; asOf: string; source: "yahoo" | "mock" } | null;
  fxHistory: Record<string, { value: number; asOf: string } | null>;
  pe: number | null;
  roic: number | null;
  dividendYield: number | null;
  error: string | null;
}

function mockFetch(holding: Holding, refISO: string): RawHoldingData {
  const dates = horizonDates(refISO);
  const m = MOCK_DATA[holding.ticker];
  if (!m) {
    return {
      ...holding,
      price: null, history: {}, fxNow: null, fxHistory: {},
      pe: null, roic: null, dividendYield: null,
      error: `Kein Mock-Datensatz für ${holding.ticker}`,
    };
  }
  const fxBase = MOCK_FX_NOW[holding.currency] ?? 1;
  const history: Record<string, { value: number; asOf: string }> = {};
  const fxHistory: Record<string, { value: number; asOf: string }> = {};
  for (const h of HORIZONS) {
    const r = mockReturn(holding.ticker, h);
    history[h]   = { value: m.px / (1 + r), asOf: dates[h] };
    fxHistory[h] = { value: fxBase * (1 + (MOCK_FX_DRIFT[h] ?? 0)), asOf: dates[h] };
  }
  return {
    ...holding,
    price:        { value: m.px, asOf: dates.now, source: "mock" },
    history,
    fxNow:        { value: fxBase, asOf: dates.now, source: "mock" },
    fxHistory,
    pe:            m.pe,
    roic:          m.roic,
    dividendYield: m.dy,
    error:         null,
  };
}

// ---- Yahoo Finance adapter --------------------------------------------------

interface EodRow { date: string; close: number }

function closeOnOrBefore(
  series: EodRow[],
  dateISO: string
): { value: number; asOf: string } | null {
  let hit: EodRow | null = null;
  for (const row of series) {
    if (row.date <= dateISO) hit = row;
    else break;
  }
  return hit ? { value: hit.close, asOf: hit.date } : null;
}

async function yahooFetch(holding: Holding, refISO: string): Promise<RawHoldingData> {
  const dates = horizonDates(refISO);
  const from = new Date(dates["3Y"] + "T00:00:00Z");
  const to   = new Date(refISO + "T23:59:59Z");
  const fxTicker = holding.currency === "CHF" ? null : `${holding.currency}CHF=X`;

  try {
    const [pxRaw, fxRaw, summary] = await Promise.all([
      yahooFinance.historical(holding.ticker, { period1: from, period2: to, interval: "1d" }, ),
      fxTicker
        ? yahooFinance.historical(fxTicker, { period1: from, period2: to, interval: "1d" }, )
        : Promise.resolve(null),
      (yahooFinance.quoteSummary(holding.ticker, {
        modules: ["summaryDetail", "financialData"],
      }, ) as Promise<unknown>).catch(() => null),
    ]);

    // Normalize to { date: "YYYY-MM-DD", close: number }[]
    const toSeries = (rows: { date: Date; adjClose?: number | null; close?: number | null }[]): EodRow[] =>
      rows
        .map((r) => ({
          date:  r.date.toISOString().slice(0, 10),
          close: r.adjClose ?? r.close ?? 0,
        }))
        .filter((r) => r.close > 0)
        .sort((a, b) => a.date.localeCompare(b.date));

    const px = toSeries(pxRaw);
    const fx = fxRaw ? toSeries(fxRaw) : null;

    const pxNow = closeOnOrBefore(px, refISO);
    const fxVal = (d: string) =>
      holding.currency === "CHF"
        ? { value: 1, asOf: d }
        : fx ? closeOnOrBefore(fx, d) : null;

    const history: Record<string, { value: number; asOf: string } | null> = {};
    const fxHistory: Record<string, { value: number; asOf: string } | null> = {};
    for (const h of HORIZONS) {
      history[h]   = closeOnOrBefore(px, dates[h]);
      fxHistory[h] = fxVal(dates[h]);
    }

    type SummaryResult = { summaryDetail?: Record<string, unknown>; financialData?: Record<string, unknown> };
    const s = summary as SummaryResult | null;
    const sd = s?.summaryDetail ?? {};
    const fd = s?.financialData ?? {};
    const num = (v: unknown): number | null =>
      typeof v === "number" && isFinite(v) ? v : null;

    // dividendYield from Yahoo is already a fraction (e.g. 0.05 = 5%)
    const rawDY = (sd as Record<string, unknown>).dividendYield;
    const dividendYield = num(rawDY) != null ? (rawDY as number) * 100 : null;

    // ROIC: Yahoo financialData has returnOnCapital (often null), fallback null → honest NA
    const roic = num((fd as Record<string, unknown>).returnOnCapital) ??
                 num((fd as Record<string, unknown>).returnOnEquity);

    return {
      ...holding,
      price:   pxNow ? { ...pxNow, source: "yahoo" } : { value: null, asOf: refISO, source: "yahoo" },
      history,
      fxNow:   { ...(fxVal(refISO) ?? { value: null, asOf: refISO }), source: "yahoo" },
      fxHistory,
      pe:            num((sd as Record<string, unknown>).trailingPE),
      roic,
      dividendYield,
      error:         null,
    };
  } catch (e) {
    return {
      ...holding,
      price: null, history: {}, fxNow: null, fxHistory: {},
      pe: null, roic: null, dividendYield: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// ---- Compute layer ----------------------------------------------------------

function computeRow(p: RawHoldingData): PortfolioRow {
  const pxOk = p.price && typeof p.price.value === "number";
  const fxOk = p.fxNow && typeof p.fxNow.value === "number";
  const priceCHFnow = pxOk && fxOk ? p.price!.value! * p.fxNow!.value! : null;
  const valueCHF = priceCHFnow != null ? priceCHFnow * p.quantity : null;

  const perf: Record<string, PerfCell | null> = {};
  for (const h of HORIZONS) {
    const hp = p.history?.[h];
    const hf = p.fxHistory?.[h];
    if (priceCHFnow != null && hp?.value && hf?.value) {
      const thenCHF = hp.value * hf.value;
      perf[h] = {
        pct: priceCHFnow / thenCHF - 1,
        gainCHF: (priceCHFnow - thenCHF) * p.quantity,
      };
    } else {
      perf[h] = null;
    }
  }

  const dividendCHF =
    valueCHF != null && p.dividendYield != null
      ? valueCHF * (p.dividendYield / 100)
      : null;

  return {
    isin:          p.isin,
    ticker:        p.ticker,
    name:          p.name,
    currency:      p.currency,
    quantity:      p.quantity,
    price:         p.price,
    priceCHFnow,
    valueCHF,
    pe:            p.pe,
    roic:          p.roic,
    dividendYield: p.dividendYield,
    dividendCHF,
    perf,
    error:         p.error,
  };
}

function computeTotals(rows: PortfolioRow[]): PortfolioTotals {
  let value = 0, earnings = 0, dividends = 0;
  const perf: Record<Horizon, { now: number; then: number }> = {
    "1M": { now: 0, then: 0 },
    "3M": { now: 0, then: 0 },
    "1Y": { now: 0, then: 0 },
    "3Y": { now: 0, then: 0 },
  };
  for (const r of rows) {
    if (r.valueCHF == null) continue;
    value += r.valueCHF;
    if (r.pe) earnings += r.valueCHF / r.pe;
    if (r.dividendCHF != null) dividends += r.dividendCHF;
    for (const h of HORIZONS) {
      const p = r.perf[h];
      if (p) {
        perf[h].now += r.valueCHF;
        perf[h].then += r.valueCHF - p.gainCHF;
      }
    }
  }
  const portfolioPE = earnings > 0 ? value / earnings : null;
  const portfolioDY = value > 0 ? (dividends / value) * 100 : null;
  const totalPerf = Object.fromEntries(
    HORIZONS.map((h) => {
      const { now, then } = perf[h];
      return [h, then > 0 ? { pct: now / then - 1, gainCHF: now - then } : null];
    })
  );
  return { value, portfolioPE, portfolioDY, dividends, totalPerf };
}

// ---- Route handler ----------------------------------------------------------

const REF_ISO = "2026-06-17";

export async function GET(): Promise<NextResponse<PortfolioResponse>> {
  // USE_MOCK=true forces mock mode (e.g. for offline development/testing)
  const useMock = process.env.USE_MOCK === "true";

  const raw: RawHoldingData[] = await Promise.all(
    HOLDINGS.map((h) =>
      useMock ? Promise.resolve(mockFetch(h, REF_ISO)) : yahooFetch(h, REF_ISO)
    )
  );

  const rows   = raw.map(computeRow);
  const totals = computeTotals(rows);

  return NextResponse.json({
    rows,
    totals,
    refISO: REF_ISO,
    source: useMock ? "mock" : "yahoo",
    fetchedAt: new Date().toISOString(),
  });
}
