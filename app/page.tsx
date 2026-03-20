"use client";

import React, { useMemo, useRef, useState } from "react";
import SummaryCards from "@/components/SummaryCards";
import EvidencePanel from "@/components/EvidencePanel";

type RuleStatus = "PASS" | "FAIL" | "UNKNOWN";

type RuleRow = {
  ruleId: string;
  title?: string;
  part?: string;
  severity?: "low" | "medium" | "high" | "critical" | string;
  status: RuleStatus;
  compliant?: boolean;
  score?: number | null;
  reason?: string | null;
  evidence?: string[];
  evidenceUsed?: string[];
  mitigation?: string[] | string | null;
};

type UploadResponse = {
  ok?: boolean;
  batch_id?: string;
  document_id?: string;
  job_id?: string;
  document_ids?: string[];
  job_ids?: string[];
  message?: string;
  queued?: boolean;
  count?: number;
};

type ComplianceResponse = {
  ok?: boolean;
  state?: "processing" | "failed" | "not_found";
  message?: string;
  source?: string;
  batch_id?: string;
  document_id?: string;
  document_ids?: string[];
  failed_document_ids?: string[];
  facts?: Record<string, unknown>;
  factSources?: Record<
    string,
    {
      confidence?: number | null;
      page?: number | null;
      chunk_id?: string | null;
      source_snippet?: string | null;
      document_id?: string | null;
    }
  >;
  summary?: {
    totalRules: number;
    pass: number;
    fail: number;
    unknown: number;
    complianceScore: number;
    completenessScore: number;
  };
  compliance?: any;
  completeness?: any;
  strategy?: any;
  failedRules?: RuleRow[];
  unknownRules?: RuleRow[];
  passRulesCount?: number;
  rules?: RuleRow[];
  jobs?: Array<{
    id?: string;
    document_id?: string | null;
    status?: string | null;
    progress?: number | null;
    error?: string | null;
    created_at?: string | null;
    payload?: any;
  }>;
  progress?: {
    total?: number;
    completed?: number;
    processing?: number;
    failed?: number;
  };
};

type ComplianceFetchResult =
  | { kind: "ready"; data: ComplianceResponse }
  | { kind: "processing"; data: ComplianceResponse }
  | { kind: "failed"; data: ComplianceResponse; message: string }
  | { kind: "not_found"; data: ComplianceResponse; message: string };

function severityClass(sev?: string) {
  const s = String(sev || "").toLowerCase();
  if (s.includes("critical")) return "dot critical";
  if (s.includes("high")) return "dot high";
  if (s.includes("medium")) return "dot medium";
  if (s.includes("low")) return "dot low";
  return "dot";
}

function parseStrategySections(strategy: any) {
  if (!strategy || typeof strategy !== "object") return [];

  const ordered = [
    strategy.buildingSummary,
    strategy.meansOfEscape,
    strategy.compartmentation,
    strategy.fireSpread,
    strategy.firefighting,
    strategy.activeSystems,
    strategy.complianceSummary,
  ];

  return ordered.filter(
    (section) =>
      section &&
      typeof section === "object" &&
      typeof section.title === "string" &&
      Array.isArray(section.content)
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createBatchId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `batch-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function Page() {
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [documentId, setDocumentId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploadedDocIds, setUploadedDocIds] = useState<string[]>([]);
  const [rows, setRows] = useState<RuleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const [summary, setSummary] = useState<ComplianceResponse["summary"] | null>(
    null
  );
  const [facts, setFacts] = useState<Record<string, unknown> | null>(null);
  const [factSources, setFactSources] = useState<
    ComplianceResponse["factSources"] | null
  >(null);
  const [completeness, setCompleteness] = useState<any>(null);
  const [strategy, setStrategy] = useState<any>(null);
  const [selectedRule, setSelectedRule] = useState<RuleRow | null>(null);

  const [batchProgress, setBatchProgress] = useState({
    total: 0,
    completed: 0,
    processing: 0,
    failed: 0,
  });

  const sortedRows = useMemo(() => {
    const severityOrder: Record<string, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    return rows.slice().sort((a, b) => {
      if (a.status !== b.status) {
        const statusOrder: Record<RuleStatus, number> = {
          FAIL: 3,
          UNKNOWN: 2,
          PASS: 1,
        };
        return statusOrder[b.status] - statusOrder[a.status];
      }

      const sevA = severityOrder[String(a.severity).toLowerCase()] ?? 0;
      const sevB = severityOrder[String(b.severity).toLowerCase()] ?? 0;
      if (sevA !== sevB) return sevB - sevA;

      return (Number(b.score) || 0) - (Number(a.score) || 0);
    });
  }, [rows]);

  const strategySections = useMemo(
    () => parseStrategySections(strategy),
    [strategy]
  );

  async function parseJson<T>(
    res: Response,
    fallbackMessage: string
  ): Promise<T> {
    try {
      return (await res.json()) as T;
    } catch {
      throw new Error(fallbackMessage);
    }
  }

  function resetResultState() {
    setRows([]);
    setSummary(null);
    setFacts(null);
    setFactSources(null);
    setCompleteness(null);
    setStrategy(null);
    setSelectedRule(null);
  }

  function clearMessages() {
    setError("");
    setStatus("");
    setStage("");
  }

  function resetBatchState(total = 0) {
    setUploadedDocIds([]);
    setBatchProgress({
      total,
      completed: 0,
      processing: 0,
      failed: 0,
    });
  }

  function applyComplianceResult(json: ComplianceResponse) {
    const directRules = Array.isArray(json.rules) ? json.rules : [];
    const failRows = Array.isArray(json.failedRules) ? json.failedRules : [];
    const unknownRows = Array.isArray(json.unknownRules)
      ? json.unknownRules
      : [];
    const passCount =
      typeof json.passRulesCount === "number"
        ? json.passRulesCount
        : json.summary?.pass ?? 0;

    const passPlaceholders: RuleRow[] =
      directRules.length === 0 && passCount > 0
        ? Array.from({ length: passCount }).map((_, i) => ({
            ruleId: `PASS-${i + 1}`,
            title: "Compliant rule",
            severity: "low",
            status: "PASS" as const,
            compliant: true,
            score: 0,
            reason: "Compliant against current extracted facts.",
            evidence: [],
            mitigation: null,
          }))
        : [];

    const allRows =
      directRules.length > 0
        ? directRules
        : [...failRows, ...unknownRows, ...passPlaceholders];

    setRows(allRows);
    setSummary(json.summary ?? null);
    setFacts((json.facts as Record<string, unknown>) ?? null);
    setFactSources(json.factSources ?? null);
    setCompleteness(json.completeness ?? null);
    setStrategy(json.strategy ?? null);

    if (json.document_id) {
      setDocumentId(json.document_id);
    }
    if (json.batch_id) {
      setBatchId(json.batch_id);
    }
    if (Array.isArray(json.document_ids)) {
      setUploadedDocIds(json.document_ids);
    }

    const firstInteresting =
      allRows.find((r) => r.status === "FAIL") ||
      allRows.find((r) => r.status === "UNKNOWN") ||
      allRows[0] ||
      null;

    setSelectedRule(firstInteresting);
  }

  async function runComplianceByDocument(
    docId: string
  ): Promise<ComplianceFetchResult> {
    const res = await fetch(
      `/api/compliance?document_id=${encodeURIComponent(docId)}`,
      {
        method: "GET",
        cache: "no-store",
      }
    );

    const json = await parseJson<ComplianceResponse>(
      res,
      "Compliance API did not return JSON."
    );

    if (res.status === 202 || json.state === "processing") {
      return { kind: "processing", data: json };
    }

    if (res.status === 404 || json.state === "not_found") {
      return {
        kind: "not_found",
        data: json,
        message: json?.message || "No extracted facts found for this document.",
      };
    }

    if (!res.ok || json.ok === false || json.state === "failed") {
      return {
        kind: "failed",
        data: json,
        message:
          json?.message || `Compliance evaluation failed (HTTP ${res.status}).`,
      };
    }

    return { kind: "ready", data: json };
  }

  async function runComplianceByBatch(
    currentBatchId: string
  ): Promise<ComplianceFetchResult> {
    const res = await fetch(
      `/api/compliance?batch_id=${encodeURIComponent(currentBatchId)}`,
      {
        method: "GET",
        cache: "no-store",
      }
    );

    const json = await parseJson<ComplianceResponse>(
      res,
      "Compliance API did not return JSON."
    );

    if (res.status === 202 || json.state === "processing") {
      return { kind: "processing", data: json };
    }

    if (res.status === 404 || json.state === "not_found") {
      return {
        kind: "not_found",
        data: json,
        message: json?.message || "No extracted facts found for this batch.",
      };
    }

    if (!res.ok || json.ok === false || json.state === "failed") {
      return {
        kind: "failed",
        data: json,
        message:
          json?.message || `Batch compliance evaluation failed (HTTP ${res.status}).`,
      };
    }

    return { kind: "ready", data: json };
  }

  async function pollBatchCompliance(currentBatchId: string) {
    while (true) {
      const result = await runComplianceByBatch(currentBatchId);

      if (result.kind === "ready") {
        return result.data;
      }

      if (result.kind === "failed") {
        throw new Error(result.message);
      }

      if (result.kind === "not_found") {
        throw new Error(result.message);
      }

      const progress = result.data.progress ?? {};

      setBatchProgress({
        total: progress.total ?? uploadedDocIds.length ?? files.length ?? 0,
        completed: progress.completed ?? 0,
        processing: progress.processing ?? 0,
        failed: progress.failed ?? 0,
      });

      setStage("Processing uploaded documents...");
      setStatus(
        `Completed ${progress.completed ?? 0}/${progress.total ?? 0} documents`
      );
      setError("");

      await sleep(2500);
    }
  }

  async function fetchExistingComplianceFromBottom() {
    clearMessages();
    setLoading(true);

    try {
      if (batchId.trim()) {
        const result = await runComplianceByBatch(batchId.trim());

        if (result.kind === "ready") {
          clearMessages();
          applyComplianceResult(result.data);
          setStage("Complete");
          setStatus(
            `Loaded batch. FAIL=${result.data.summary?.fail ?? 0}, UNKNOWN=${
              result.data.summary?.unknown ?? 0
            }, PASS=${result.data.summary?.pass ?? 0}.`
          );
          return;
        }

        if (result.kind === "processing") {
          setError("");
          resetResultState();
          const progress = result.data.progress ?? {};
          setBatchProgress({
            total: progress.total ?? 0,
            completed: progress.completed ?? 0,
            processing: progress.processing ?? 0,
            failed: progress.failed ?? 0,
          });
          setStage("Worker processing batch...");
          setStatus(
            result.data.message || "Worker is still processing this batch."
          );
          return;
        }

        if (result.kind === "not_found") {
          setError(result.message);
          setStatus("");
          setStage("");
          resetResultState();
          return;
        }

        throw new Error(result.message);
      }

      const docId = documentId.trim();
      if (!docId) {
        setError("Enter a batch_id or document_id.");
        return;
      }

      const result = await runComplianceByDocument(docId);

      if (result.kind === "ready") {
        clearMessages();
        applyComplianceResult(result.data);
        setStage("Complete");
        setStatus(
          `Loaded. FAIL=${result.data.summary?.fail ?? 0}, UNKNOWN=${
            result.data.summary?.unknown ?? 0
          }, PASS=${result.data.summary?.pass ?? 0}.`
        );
        return;
      }

      if (result.kind === "processing") {
        setError("");
        resetResultState();
        setStage("Worker processing document...");
        setStatus(
          result.data.message || "Worker is still processing this document."
        );
        return;
      }

      if (result.kind === "not_found") {
        setError(result.message);
        setStatus("");
        setStage("");
        resetResultState();
        return;
      }

      throw new Error(result.message);
    } catch (e: any) {
      resetResultState();
      setError(e?.message || "Failed to fetch compliance results.");
      setStatus("");
      setStage("");
    } finally {
      setLoading(false);
    }
  }

  async function onUploadAndProcess() {
    clearMessages();
    resetResultState();

    if (files.length === 0) {
      setError("Select at least one PDF first.");
      return;
    }

    setLoading(true);
    resetBatchState(files.length);

    try {
      const currentBatchId = createBatchId();
      const docIds: string[] = [];

      setBatchId(currentBatchId);

      for (let i = 0; i < files.length; i++) {
        const currentFile = files[i];

        setStage(`Uploading ${i + 1} of ${files.length}...`);
        setStatus(`Uploading ${currentFile.name}...`);
        setError("");

        const fd = new FormData();
        fd.append("file", currentFile);
        fd.append("batch_id", currentBatchId);

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: fd,
        });

        const uploadJson = await parseJson<UploadResponse>(
          uploadRes,
          "Upload API did not return JSON."
        );

        if (!uploadRes.ok || !uploadJson.ok || !uploadJson.document_id) {
          throw new Error(
            uploadJson?.message ||
              `Upload failed for ${currentFile.name} (HTTP ${uploadRes.status}).`
          );
        }

        docIds.push(uploadJson.document_id);
        setUploadedDocIds([...docIds]);

        setBatchProgress({
          total: files.length,
          completed: 0,
          processing: docIds.length,
          failed: 0,
        });
      }

      setStage("Queued for worker...");
      setStatus(
        `Uploaded ${docIds.length} document(s) under batch ${currentBatchId}. Waiting for processing...`
      );
      setError("");

      const result = await pollBatchCompliance(currentBatchId);

      clearMessages();
      applyComplianceResult(result);
      setStage("Complete");
      setStatus(
        `Batch processed. FAIL=${result.summary?.fail ?? 0}, UNKNOWN=${
          result.summary?.unknown ?? 0
        }, PASS=${result.summary?.pass ?? 0}.`
      );

      setFiles([]);
      if (fileRef.current) {
        fileRef.current.value = "";
      }
    } catch (e: any) {
      resetResultState();
      setError(e?.message || "Something failed.");
      setStatus("");
      setStage("");
    } finally {
      setLoading(false);
    }
  }

  function onPickFile() {
    fileRef.current?.click();
  }

  function openPdfReport() {
    const currentBatchId = batchId.trim();
    const currentDocId = documentId.trim();

    if (currentBatchId) {
      const url = `/api/report/pdf?batch_id=${encodeURIComponent(currentBatchId)}`;
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    if (currentDocId) {
      const url = `/api/report/pdf?document_id=${encodeURIComponent(currentDocId)}`;
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }

    setError("No batch_id or document_id available for PDF report.");
  }

  const panelHeight = 420;
  const progressPercent = Math.round(
    (batchProgress.completed / Math.max(batchProgress.total, 1)) * 100
  );

  return (
    <div className="container">
      <div className="topbar">
        <div className="brand">
          <h1>AI Assistant</h1>
          <p>Fire safety compliance viewer</p>
        </div>

        <div className="kv">
          <span className="pill">
            <span className="muted2">Rules</span>
            <span className="badge">{sortedRows.length}</span>
          </span>

          {batchId && (
            <span className="pill">
              <span className="muted2">batch_id</span>
              <span className="badge">{batchId}</span>
            </span>
          )}

          {documentId && (
            <span className="pill">
              <span className="muted2">document_id</span>
              <span className="badge">{documentId}</span>
            </span>
          )}
        </div>
      </div>

      <SummaryCards
        complianceScore={summary?.complianceScore}
        completenessScore={summary?.completenessScore}
        pass={summary?.pass}
        fail={summary?.fail}
        unknown={summary?.unknown}
        totalRules={summary?.totalRules}
      />

      <div className="card">
        <div className="cardHeader">
          <h2>Compliance Dashboard</h2>
          <div className="sub">
            Upload multiple PDFs into one batch, or paste a{" "}
            <span className="mono">batch_id</span> /{" "}
            <span className="mono">document_id</span> and fetch existing
            results.
          </div>

          {stage ? (
            <div className="alert ok">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {loading ? <span className="spinner" /> : null}
                <div>
                  <div>{status || stage}</div>
                  <div className="smallHint" style={{ marginTop: 6 }}>
                    Current stage: {stage}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {!stage && status ? <div className="alert ok">{status}</div> : null}
          {error ? <div className="alert">{error}</div> : null}

          {loading && batchProgress.total > 0 ? (
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                  fontSize: 13,
                  opacity: 0.9,
                }}
              >
                <span>
                  Batch progress: {batchProgress.completed}/{batchProgress.total}{" "}
                  completed
                </span>
                <span>{progressPercent}%</span>
              </div>

              <div
                style={{
                  width: "100%",
                  height: 10,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.08)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${progressPercent}%`,
                    height: "100%",
                    borderRadius: 999,
                    background: "linear-gradient(90deg, #7c5cff, #33d1ff)",
                    transition: "width 0.35s ease",
                  }}
                />
              </div>

              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  gap: 16,
                  fontSize: 12,
                  opacity: 0.85,
                  flexWrap: "wrap",
                }}
              >
                <span>Completed: {batchProgress.completed}</span>
                <span>Processing: {batchProgress.processing}</span>
                <span>Failed: {batchProgress.failed}</span>
                <span>Total: {batchProgress.total}</span>
              </div>
            </div>
          ) : null}

          {uploadedDocIds.length > 0 && (
            <div
              style={{
                marginTop: 10,
                fontSize: 12,
                opacity: 0.85,
                wordBreak: "break-all",
              }}
            >
              Uploaded documents: {uploadedDocIds.length}
            </div>
          )}

          <div className="row">
            <button
              className="btn"
              onClick={openPdfReport}
              disabled={loading || (!batchId.trim() && !documentId.trim())}
            >
              Generate PDF report
            </button>
          </div>
        </div>

        <div className="cardBody">
          {sortedRows.length === 0 ? (
            <div className="emptyState">
              <div className="emptyIcon">📄</div>
              <h3>No results yet</h3>
              <p>Upload a report or fetch by batch id / document id.</p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.4fr) minmax(360px, 0.9fr)",
                gap: 18,
                alignItems: "stretch",
              }}
            >
              <div
                className="card"
                style={{
                  height: panelHeight,
                  overflow: "hidden",
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    padding: "14px 16px 10px 16px",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    fontWeight: 600,
                  }}
                >
                  Rules
                </div>

                <div
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    overflowX: "hidden",
                  }}
                >
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead
                      style={{
                        position: "sticky",
                        top: 0,
                        zIndex: 2,
                        background: "rgba(20,22,35,0.96)",
                        backdropFilter: "blur(8px)",
                      }}
                    >
                      <tr>
                        <th
                          style={{
                            width: 150,
                            textAlign: "left",
                            padding: "12px 14px",
                          }}
                        >
                          RULE_ID
                        </th>
                        <th
                          style={{
                            width: 240,
                            textAlign: "left",
                            padding: "12px 14px",
                          }}
                        >
                          TITLE
                        </th>
                        <th
                          style={{
                            width: 110,
                            textAlign: "left",
                            padding: "12px 14px",
                          }}
                        >
                          SEVERITY
                        </th>
                        <th
                          style={{
                            width: 110,
                            textAlign: "left",
                            padding: "12px 14px",
                          }}
                        >
                          STATUS
                        </th>
                        <th
                          style={{
                            width: 90,
                            textAlign: "left",
                            padding: "12px 14px",
                          }}
                        >
                          SCORE
                        </th>
                        <th style={{ textAlign: "left", padding: "12px 14px" }}>
                          REASON
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRows.map((r) => {
                        const active = selectedRule?.ruleId === r.ruleId;
                        return (
                          <tr
                            key={`${r.ruleId}-${r.status}-${r.title ?? ""}`}
                            onClick={() => setSelectedRule(r)}
                            style={{
                              cursor: "pointer",
                              background: active
                                ? "rgba(130, 88, 255, 0.14)"
                                : "transparent",
                            }}
                          >
                            <td
                              className="mono"
                              style={{
                                padding: "14px",
                                borderBottom:
                                  "1px solid rgba(255,255,255,0.06)",
                                verticalAlign: "top",
                              }}
                            >
                              {r.ruleId}
                            </td>
                            <td
                              style={{
                                padding: "14px",
                                borderBottom:
                                  "1px solid rgba(255,255,255,0.06)",
                                verticalAlign: "top",
                              }}
                            >
                              {r.title}
                            </td>
                            <td
                              style={{
                                padding: "14px",
                                borderBottom:
                                  "1px solid rgba(255,255,255,0.06)",
                                verticalAlign: "top",
                              }}
                            >
                              <span className="sev">
                                <span className={severityClass(r.severity)} />
                                <span className="mono">
                                  {r.severity ?? "—"}
                                </span>
                              </span>
                            </td>
                            <td
                              style={{
                                padding: "14px",
                                borderBottom:
                                  "1px solid rgba(255,255,255,0.06)",
                                verticalAlign: "top",
                              }}
                            >
                              <span className="pill">
                                <span className="badge">{r.status}</span>
                              </span>
                            </td>
                            <td
                              className="mono"
                              style={{
                                padding: "14px",
                                borderBottom:
                                  "1px solid rgba(255,255,255,0.06)",
                                verticalAlign: "top",
                              }}
                            >
                              {r.score ?? "—"}
                            </td>
                            <td
                              style={{
                                padding: "14px",
                                borderBottom:
                                  "1px solid rgba(255,255,255,0.06)",
                                verticalAlign: "top",
                              }}
                            >
                              {r.reason ?? "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div
                style={{
                  height: panelHeight,
                  overflow: "hidden",
                }}
              >
                <EvidencePanel
                  selectedRule={selectedRule}
                  facts={(facts as Record<string, any>) ?? null}
                  factSources={factSources ?? null}
                />
              </div>
            </div>
          )}

          {completeness?.topMissingFacts?.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h3 style={{ marginBottom: 12 }}>Top Missing Facts</h3>
              <div className="tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 240 }}>fact</th>
                      <th style={{ width: 120 }}>affects</th>
                      <th style={{ width: 160 }}>criticalAffected</th>
                      <th style={{ width: 160 }}>weightedImpact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completeness.topMissingFacts
                      .slice(0, 15)
                      .map((item: any) => (
                        <tr key={item.factKey}>
                          <td className="mono">{item.factKey}</td>
                          <td className="mono">{item.count}</td>
                          <td className="mono">
                            {Array.isArray(item.affectedCriticalRuleIds)
                              ? item.affectedCriticalRuleIds.length
                              : 0}
                          </td>
                          <td className="mono">{item.weightedImpact}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {strategySections.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h3 style={{ marginBottom: 12 }}>Auto-generated Fire Strategy</h3>
              <div className="tableWrap" style={{ padding: 16 }}>
                {strategySections.map((section: any) => (
                  <div key={section.title} style={{ marginBottom: 20 }}>
                    <h4 style={{ marginBottom: 8 }}>{section.title}</h4>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {section.content
                        .slice(0, 8)
                        .map((line: string, idx: number) => (
                          <li
                            key={`${section.title}-${idx}`}
                            className="muted"
                            style={{ marginBottom: 6 }}
                          >
                            {line}
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bottomBar">
        <div className="composer">
          <input
            className="input"
            placeholder="Paste batch_id here or use upload"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
          />

          <input
            className="input"
            placeholder="Paste document_id here if needed"
            value={documentId}
            onChange={(e) => setDocumentId(e.target.value)}
          />

          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            multiple
            style={{ display: "none" }}
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />

          <button className="btn" onClick={onPickFile} disabled={loading}>
            {files.length > 0
              ? `${files.length} PDF(s) selected`
              : "Choose PDF(s)"}
          </button>

          <button
            className="btn btnPrimary"
            onClick={onUploadAndProcess}
            disabled={loading || files.length === 0}
          >
            {loading ? "Processing..." : "Upload & Process"}
          </button>

          <button
            className="btn"
            onClick={fetchExistingComplianceFromBottom}
            disabled={loading || (!batchId.trim() && !documentId.trim())}
          >
            Fetch
          </button>
        </div>
      </div>
    </div>
  );
}