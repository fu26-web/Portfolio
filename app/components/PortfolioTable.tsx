"use client";

import { useEffect, useState, useCallback } from "react";
import type { PortfolioResponse, PortfolioRow, PerfCell } from "../api/portfolio/route";

const HORIZONS = ["1M", "3M", "1Y", "3Y"] as const;

// ---- Formatierung -----------------------------------------------------------

const NA = <span className="text-stone-600">NA</span>;

function chf(v: number | null) {
  if (v == null) return NA;
  return <>{new Intl.NumberFormat("de-CH", { maximumFractionDigits: 0 }).format(v)}</>;
}

function num2(v: number | null) {
  if (v == null) return NA;
  return (
    <>
      {new Intl.NumberFormat("de-CH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(v)}
    </>
  );
}

function pct(v: number | null) {
  if (v == null) return "NA";
  return (v >= 0 ? "+" : "") + (v * 100).toFixed(1) + "%";
}

function signClass(v: number | null) {
  if (v == null) return "text-stone-600";
  return v >= 0 ? "text-emerald-400" : "text-red-400";
}

// KGV-Farbe: <10 bright-green, 10–15 emerald, 15–20 stone, 20–30 amber, >30 red
function peClass(pe: number | null): string {
  if (pe == null) return "text-stone-600";
  if (pe < 10)  return "text-emerald-300 font-semibold";
  if (pe < 15)  return "text-emerald-400";
  if (pe < 20)  return "text-stone-300";
  if (pe < 30)  return "text-amber-400";
  return "text-red-400";
}

// ---- Sub-components ---------------------------------------------------------

function Th({ children, left = false }: { children?: React.ReactNode; left?: boolean }) {
  return (
    <th className={`px-2 py-2 ${left ? "text-left" : "text-right"} whitespace-nowrap`}>
      {children}
    </th>
  );
}

function Metric({
  label, value, sub, valueClass,
}: {
  label: string; value: string; sub?: string; valueClass?: string;
}) {
  return (
    <div className="text-right">
      <div className="text-[11px] text-stone-500 uppercase tracking-wider">{label}</div>
      <div className={`text-base font-semibold tabular-nums ${valueClass ?? "text-stone-100"}`}>{value}</div>
      {sub && <div className="text-[11px] text-stone-500">{sub}</div>}
    </div>
  );
}

function PerfCellTd({ cell }: { cell: PerfCell | null }) {
  if (!cell)
    return <td className="px-2 py-2 text-right tabular-nums text-stone-600">NA</td>;
  return (
    <td className="px-2 py-2 text-right tabular-nums">
      <div className={signClass(cell.pct) + " font-medium"}>{pct(cell.pct)}</div>
      <div className="text-[11px] text-stone-500">
        {(cell.gainCHF >= 0 ? "+" : "") +
          new Intl.NumberFormat("de-CH", { maximumFractionDigits: 0 }).format(cell.gainCHF)}
      </div>
    </td>
  );
}

function RowTr({ r }: { r: PortfolioRow }) {
  return (
    <tr className="border-b border-stone-800 hover:bg-stone-800/50 transition-colors">
      <td className="px-2 py-2">
        <div className="font-semibold text-stone-100">{r.ticker}</div>
        <div className="text-[11px] text-stone-500">{r.name}</div>
        {r.error && <div className="text-[11px] text-red-400">Fehler: {r.error}</div>}
      </td>
      <td className="px-2 py-2 text-right tabular-nums text-stone-400">{r.quantity}</td>
      <td className="px-2 py-2 text-right tabular-nums">
        <div className="text-stone-200">
          {num2(r.price?.value ?? null)}{" "}
          <span className="text-stone-600">{r.currency}</span>
        </div>
        <div className="text-[11px] text-stone-600">{r.price?.asOf}</div>
      </td>
      <td className="px-2 py-2 text-right tabular-nums font-semibold text-stone-100">
        {chf(r.valueCHF)}
      </td>
      <td className={`px-2 py-2 text-right tabular-nums ${peClass(r.pe)}`}>
        {r.pe == null ? NA : r.pe.toFixed(1)}
      </td>
      <td className="px-2 py-2 text-right tabular-nums text-stone-300">
        {r.roic == null ? NA : r.roic.toFixed(1) + "%"}
      </td>
      <td className="px-2 py-2 text-right tabular-nums">
        <div className="text-stone-300">{r.dividendYield == null ? NA : r.dividendYield.toFixed(2) + "%"}</div>
        <div className="text-[11px] text-stone-600">
          {r.dividendCHF == null ? "" : new Intl.NumberFormat("de-CH", { maximumFractionDigits: 0 }).format(r.dividendCHF)}
        </div>
      </td>
      {HORIZONS.map((h) => <PerfCellTd key={h} cell={r.perf[h] ?? null} />)}
    </tr>
  );
}

// ---- Main component ---------------------------------------------------------

export default function PortfolioTable() {
  const [data, setData] = useState<PortfolioResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [stamp, setStamp] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/portfolio");
      const json: PortfolioResponse = await res.json();
      setData(json);
      setStamp(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totals = data?.totals;
  const rows   = data?.rows ?? [];
  const source = data?.source;

  return (
    <div className="min-h-screen bg-stone-950 text-stone-300 font-mono">
      <div className="mx-auto max-w-7xl px-4 py-6">

        {/* Kopfzeile */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-800 pb-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-stone-600">
              Portfolio Monitor · CHF
            </div>
            <div className="mt-1 text-3xl font-semibold tabular-nums text-stone-100">
              {chf(totals?.value ?? null)}{" "}
              <span className="text-base font-normal text-stone-500">CHF</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <Metric
              label="Ø KGV"
              value={totals?.portfolioPE == null ? "NA" : totals.portfolioPE.toFixed(1)}
              valueClass={peClass(totals?.portfolioPE ?? null)}
            />
            <Metric
              label="Div.-Rendite"
              value={totals?.portfolioDY == null ? "NA" : totals.portfolioDY.toFixed(2) + "%"}
              sub={totals?.dividends != null
                ? new Intl.NumberFormat("de-CH", { maximumFractionDigits: 0 }).format(totals.dividends) + " CHF/J."
                : undefined}
            />
            <Metric
              label="Perf. 1J"
              value={totals?.totalPerf["1Y"] ? pct(totals.totalPerf["1Y"]!.pct) : "NA"}
              valueClass={signClass(totals?.totalPerf["1Y"]?.pct ?? null)}
            />
            <Metric label="Positionen" value={String(rows.length)} />
          </div>
        </div>

        {/* Steuerleiste */}
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <button
            onClick={load}
            disabled={loading}
            className="rounded-sm border border-stone-700 bg-stone-900 px-4 py-1.5 text-stone-200 hover:bg-stone-800 disabled:opacity-40 transition-colors"
          >
            {loading ? "Laden…" : "Update"}
          </button>
          <span className="text-stone-600">
            Quelle:{" "}
            <span className={source === "yahoo" ? "text-emerald-400" : "text-stone-400"}>
              {source === "yahoo" ? "Yahoo Finance" : "Mock"}
            </span>
            {stamp && <> · {stamp.toLocaleString("de-CH")}</>}
          </span>
          {data?.refISO && (
            <span className="text-stone-700 text-[12px]">Stichtag: {data.refISO}</span>
          )}
        </div>

        {/* KGV-Legende */}
        <div className="mt-3 flex flex-wrap gap-3 text-[11px]">
          <span className="text-stone-600">KGV:</span>
          <span className="text-emerald-300 font-semibold">&lt;10 sehr günstig</span>
          <span className="text-emerald-400">10–15 günstig</span>
          <span className="text-stone-400">15–20 fair</span>
          <span className="text-amber-400">20–30 teuer</span>
          <span className="text-red-400">&gt;30 sehr teuer</span>
        </div>

        {/* Tabelle */}
        <div className="mt-4 overflow-x-auto rounded-sm border border-stone-800 bg-stone-900">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-stone-700 text-[11px] uppercase tracking-wide text-stone-600">
                <Th left>Symbol / Titel</Th>
                <Th>Menge</Th><Th>Kurs</Th><Th>Wert CHF</Th>
                <Th>KGV</Th><Th>ROIC</Th><Th>Div %</Th>
                <Th>1M</Th><Th>3M</Th><Th>1J</Th><Th>3J</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => <RowTr key={r.isin} r={r} />)}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-stone-700 bg-stone-950 font-semibold">
                <td className="px-2 py-2 text-stone-300">Total Portfolio</td>
                <td></td><td></td>
                <td className="px-2 py-2 text-right tabular-nums text-stone-100">{chf(totals?.value ?? null)}</td>
                <td className={`px-2 py-2 text-right tabular-nums ${peClass(totals?.portfolioPE ?? null)}`}>
                  {totals?.portfolioPE == null ? NA : totals.portfolioPE.toFixed(1)}
                </td>
                <td></td>
                <td className="px-2 py-2 text-right tabular-nums text-stone-300">
                  {totals?.portfolioDY == null ? NA : totals.portfolioDY.toFixed(2) + "%"}
                </td>
                {HORIZONS.map((h) => <PerfCellTd key={h} cell={totals?.totalPerf[h] ?? null} />)}
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-3 text-[11px] text-stone-700">
          Alle Beträge in CHF · Monatliche Schlusskurse · Fehlende Werte = NA
          {data?.fetchedAt && <> · {new Date(data.fetchedAt).toLocaleString("de-CH")}</>}
        </div>
      </div>
    </div>
  );
}
