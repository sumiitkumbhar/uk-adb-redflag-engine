"use client";

import React, { useEffect, useMemo, useState } from "react";

type RiskScoreRow = {
  document_id: string;
  rule_id: string;
  rule_name?: string;
  worst_severity?: string;
  confidence?: number;
  frequency?: number;
  pages?: number[];
  chunk_ids?: string[];
  title?: string;
};

function severityBadge(sev?: string) {
  const s = (sev ?? "").toLowerCase();
  const base =
    "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium";
  if (s === "critical") return `${base} border-red-500/30 bg-red-500/10 text-red-300`;
  if (s === "high") return `${base} border-orange-500/30 bg-orange-500/10 text-orange-300`;
  if (s === "medium") return `${base} border-yellow-500/30 bg-yellow-500/10 text-yellow-200`;
  if (s === "low") return `${base} border-emerald-500/30 bg-emerald-500/10 text-emerald-300`;
  return `${base} border-white/10 bg-white/5 text-slate-200`;
}

export default function RiskScoresPanel() {
  const [documentId, setDocumentId] = useState("");
  const [rows, setRows] = useState<RiskScoreRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const stats = useMemo(() => {
    const total = rows.length;
    const critical = rows.filter(r => (r.worst_severity ?? "").toLowerCase() === "critical").length;
    const high = rows.filter(r => (r.worst_severity ?? "").toLowerCase() === "high").length;
    return { total, critical, high };
  }, [rows]);

  async function load() {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/risk-scores?document_id=${encodeURIComponent(documentId)}&limit=500`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
      setRows(json.data ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  // optional: press Enter to load
  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") load();
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white/90">Risk Scores</h2>
              <p className="text-sm text-white/50">
                Enter a document_id to view aggregated rule risk scores.
              </p>
            </div>

            <div className="flex w-full gap-2 md:w-auto">
              <input
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="document_id (uuid)"
                className="w-full md:w-[420px] rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none focus:border-purple-500/40"
              />
              <button
                onClick={load}
                disabled={!documentId || loading}
                className="rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm text-white/90 hover:bg-white/15 disabled:opacity-50"
              >
                {loading ? "Loading..." : "Load"}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/70">
              Total rules: <span className="text-white/90">{stats.total}</span>
            </span>
            <span className="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-[11px] text-red-200">
              Critical: <span className="text-red-100">{stats.critical}</span>
            </span>
            <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-[11px] text-orange-200">
              High: <span className="text-orange-100">{stats.high}</span>
            </span>
          </div>

          {err && (
            <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              {err}
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/30">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-white/5 text-white/70">
                <tr>
                  <th className="px-4 py-3">Rule</th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Confidence</th>
                  <th className="px-4 py-3">Frequency</th>
                  <th className="px-4 py-3">Pages</th>
                  <th className="px-4 py-3">Title</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {rows.map((r, idx) => (
                  <tr key={`${r.rule_id}-${idx}`} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3">
                      <div className="text-white/90 font-medium">{r.rule_id}</div>
                      <div className="text-white/50 text-xs">{r.rule_name ?? ""}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={severityBadge(r.worst_severity)}>
                        {r.worst_severity ?? "-"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/80">
                      {typeof r.confidence === "number" ? r.confidence.toFixed(3) : "-"}
                    </td>
                    <td className="px-4 py-3 text-white/80">{r.frequency ?? "-"}</td>
                    <td className="px-4 py-3 text-white/70 text-xs">
                      {Array.isArray(r.pages) ? r.pages.join(", ") : "-"}
                    </td>
                    <td className="px-4 py-3 text-white/70 text-xs">
                      {r.title ?? "-"}
                    </td>
                  </tr>
                ))}

                {rows.length === 0 && !loading && (
                  <tr>
                    <td className="px-4 py-6 text-white/50" colSpan={6}>
                      No data loaded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
