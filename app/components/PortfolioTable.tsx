"use client";

import { useEffect, useState, useCallback } from "react";
import type { PortfolioResponse, PortfolioRow, PerfCell } from "../api/portfolio/route";

const HORIZONS = ["1M", "3M", "1Y", "3Y"] as const;

// ---- Formatierung -----------------------------------------------------------

const NA = <span className="text-stone-400">NA</span>;

function chf(v: number | null) {
  if (v == null) return NA;
  return <>{new Intl.NumberFormat("de-CH", { maximumFractionDigits: 0 }).format(v)}</>;
}

function num2(v: number | null, suf = "") {
  if (v == null) return NA;
  return (
    <>
      {new Intl.NumberFormat("de-CH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(v)}
      {suf}
    </>
  );
}

function pct(v: number | null) {
  if (v == null) return "NA";
  return (v >= 0 ? "+" : "") + (v * 100).toFixed(1) + "%";
}

function signClass(v: number | null) {
  if (v == null) return "text-stone-400";
  return v >= 0 ? "text-emerald-700" : "text-red-700";
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
  label,
  value,
  sub,
  valueClass,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="text-right">
      <div className="text-[11px] text-stone-500">{label}</div>
      <div className={`text-base font-semibold tabular-nums ${valueClass ?? ""}`}>{value}</div>
      {sub && <div className="text-[11px] text-stone-400">{sub}</div>}
    </div>
  );
}

function PerfCellTd({ cell }: { cell: PerfCell | null }) {
  if (!cell)
    return (
      <td className="px-2 py-2 text-right tabular-nums text-stone-400">NA</td>
    );
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
    <tr className="border-b border-stone-100 hover:bg-stone-50">
      <td className="px-2 py-2">
        <div className="font-semibold">{r.ticker}</div>
        <div className="text-[11px] text-stone-500">{r.name}</div>
        {r.error && <div className="text-[11px] text-red-600">Fehler: {r.error}</div>}
      </td>
      <td className="px-2 py-2 text-right tabular-nums">{r.quantity}</td>
      <td className="px-2 py-2 text-right tabular-nums">
        <div>
          {num2(r.price?.value ?? null)}{" "}
          <span className="text-stone-400">{r.currency}</span>
        </div>
        <div className="text-[11px] text-stone-400">{r.price?.asOf}</div>
      </td>
      <td className="px-2 py-2 text-right tabular-nums font-medium">{chf(r.valueCHF)}</td>
      <td className="px-2 py-2 text-right tabular-nums">
        {r.pe == null ? NA : r.pe.toFixed(1)}
      </td>
      <td className="px-2 py-2 text-right tabular-nums">
        {r.roic == null ? NA : r.roic.toFixed(1) + "%"}
      </td>
      <td className="px-2 py-2 text-right tabular-nums">
        <div>{r.dividendYield == null ? NA : r.dividendYield.toFixed(2) + "%"}</div>
        <div className="text-[11px] text-stone-500">
          {r.dividendCHF == null
            ? ""
            : new Intl.NumberFormat("de-CH", { maximumFractionDigits: 0 }).format(r.dividendCHF)}
        </div>
      </td>
      {HORIZONS.map((h) => (
        <PerfCellTd key={h} cell={r.perf[h] ?? null} />
      ))}
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

  useEffect(() => {
    load();
  }, [load]);

  const totals = data?.totals;
  const rows   = data?.rows ?? [];
  const source = data?.source;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-mono">
      <div className="mx-auto max-w-7xl px-4 py-6">

        {/* Kopfzeile */}
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-300 pb-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-stone-500">
              Portfolio Monitor · CHF
            </div>
            <div className="mt-1 text-3xl font-semibold tabular-nums">
              {chf(totals?.value ?? null)}{" "}
              <span className="text-base font-normal text-stone-500">CHF</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <Metric
              label="Ø KGV"
              value={totals?.portfolioPE == null ? "NA" : totals.portfolioPE.toFixed(1)}
            />
            <Metric
              label="Div.-Rendite"
              value={
                totals?.portfolioDY == null
                  ? "NA"
                  : totals.portfolioDY.toFixed(2) + "%"
              }
              sub={
                totals?.dividends != null
                  ? new Intl.NumberFormat("de-CH", { maximumFractionDigits: 0 }).format(
                      totals.dividends
                    ) + " CHF/J."
                  : undefined
              }
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
            className="rounded-sm border border-stone-900 bg-stone-900 px-4 py-1.5 text-stone-50 hover:bg-stone-700 disabled:opacity-50"
          >
            {loading ? "Laden…" : "Update"}
          </button>
          <span className="text-stone-500">
            Quelle:{" "}
            <span className={source === "yahoo" ? "text-emerald-700" : "text-stone-700"}>
              {source === "yahoo" ? "Yahoo Finance (live)" : "Mock (deterministisch)"}
            </span>
            {stamp && <> · {stamp.toLocaleString("de-CH")}</>}
          </span>
          {data?.refISO && (
            <span className="text-stone-400 text-[12px]">Stichtag: {data.refISO}</span>
          )}
        </div>

        {source === "yahoo" && (
          <div className="mt-3 rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-900">
            Echtzeitdaten via Yahoo Finance — kein API-Key erforderlich.
          </div>
        )}

        {/* Tabelle */}
        <div className="mt-4 overflow-x-auto rounded-sm border border-stone-200 bg-white">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-stone-300 text-[11px] uppercase tracking-wide text-stone-500">
                <Th left>Symbol / Titel</Th>
                <Th>Menge</Th>
                <Th>Kurs</Th>
                <Th>Wert CHF</Th>
                <Th>KGV</Th>
                <Th>ROIC</Th>
                <Th>Div %</Th>
                <Th>1M</Th>
                <Th>3M</Th>
                <Th>1J</Th>
                <Th>3J</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <RowTr key={r.isin} r={r} />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-stone-300 bg-stone-50 font-semibold">
                <td className="px-2 py-2">Total Portfolio</td>
                <td></td>
                <td></td>
                <td className="px-2 py-2 text-right tabular-nums">{chf(totals?.value ?? null)}</td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {totals?.portfolioPE == null ? NA : totals.portfolioPE.toFixed(1)}
                </td>
                <td></td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {totals?.portfolioDY == null ? NA : totals.portfolioDY.toFixed(2) + "%"}
                </td>
                {HORIZONS.map((h) => (
                  <PerfCellTd key={h} cell={totals?.totalPerf[h] ?? null} />
                ))}
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-4 text-[11px] text-stone-400">
          Alle Beträge in CHF. Fehlende Werte werden als NA angezeigt – keine Schätzung.
          {data?.fetchedAt && (
            <> Datenabruf: {new Date(data.fetchedAt).toLocaleString("de-CH")}.</>
          )}
        </div>
      </div>
    </div>
  );
}
