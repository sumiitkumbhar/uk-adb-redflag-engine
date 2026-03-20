"use client";

import { getRelevantFactKeysForRule } from "@/lib/ui/ruleFactMap";

type FactSource = {
  confidence?: number | null;
  page?: number | null;
  chunk_id?: string | null;
  source_snippet?: string | null;
};

type Props = {
  selectedRule: any | null;
  facts: Record<string, any> | null;
  factSources?: Record<string, FactSource> | null;
};

function renderValue(value: unknown) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function normalizeMitigationSteps(mitigation: any): string[] {
  if (!mitigation) return [];
  if (Array.isArray(mitigation)) {
    return mitigation.map((x) => String(x).trim()).filter(Boolean);
  }
  return String(mitigation)
    .split("|")
    .map((x) => x.trim())
    .filter(Boolean);
}

export default function EvidencePanel({
  selectedRule,
  facts,
  factSources,
}: Props) {
  if (!selectedRule) {
    return (
      <div
        className="card"
        style={{
          height: "100%",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "16px 16px 12px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            flexShrink: 0,
          }}
        >
          <h3 style={{ margin: 0 }}>Evidence</h3>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 16,
          }}
        >
          <div className="muted">
            Select a failed or unknown rule to inspect evidence.
          </div>
        </div>
      </div>
    );
  }

  const relevantKeys = getRelevantFactKeysForRule(
    String(selectedRule.ruleId ?? ""),
    facts
  );

  const mitigationSteps = normalizeMitigationSteps(selectedRule.mitigation);

  return (
    <div
      className="card"
      style={{
        height: "100%",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "16px 16px 12px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}
      >
        <h3 style={{ margin: 0 }}>Evidence</h3>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 16,
        }}
      >
        <div style={{ marginBottom: 14 }}>
          <div className="mono" style={{ fontWeight: 700 }}>
            {selectedRule.ruleId}
          </div>
          <div style={{ marginTop: 6 }}>{selectedRule.title ?? "—"}</div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div className="muted2" style={{ marginBottom: 6 }}>
            Reason
          </div>
          <div>{selectedRule.reason ?? "—"}</div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div className="muted2" style={{ marginBottom: 8 }}>
            Mitigation Steps
          </div>

          {mitigationSteps.length === 0 ? (
            <div>—</div>
          ) : (
            <ol style={{ margin: 0, paddingLeft: 20 }}>
              {mitigationSteps.map((step, idx) => (
                <li
                  key={`${selectedRule.ruleId}-mitigation-${idx}`}
                  style={{
                    marginBottom: 8,
                    lineHeight: 1.5,
                  }}
                >
                  {step}
                </li>
              ))}
            </ol>
          )}
        </div>

        <div style={{ marginBottom: 12 }}>
          <div className="muted2" style={{ marginBottom: 8 }}>
            Relevant Facts
          </div>

          {relevantKeys.length === 0 ? (
            <div className="muted">No mapped facts available for this rule yet.</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {relevantKeys.map((key) => {
                const src = factSources?.[key];
                return (
                  <div
                    key={key}
                    style={{
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 12,
                      padding: 12,
                      background: "rgba(255,255,255,0.02)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 10,
                        marginBottom: 8,
                        alignItems: "flex-start",
                      }}
                    >
                      <span className="mono" style={{ wordBreak: "break-word" }}>
                        {key}
                      </span>
                      <span
                        className="muted2"
                        style={{ flexShrink: 0, whiteSpace: "nowrap" }}
                      >
                        confidence:{" "}
                        {typeof src?.confidence === "number"
                          ? src.confidence.toFixed(2)
                          : "—"}
                      </span>
                    </div>

                    <div style={{ marginBottom: 8 }}>
                      <span className="muted2">value: </span>
                      <span style={{ wordBreak: "break-word" }}>
                        {renderValue(facts?.[key])}
                      </span>
                    </div>

                    <div style={{ marginBottom: 8 }}>
                      <span className="muted2">page: </span>
                      <span>{src?.page ?? "—"}</span>
                    </div>

                    <div style={{ marginBottom: 8 }}>
                      <span className="muted2">chunk_id: </span>
                      <span className="mono" style={{ wordBreak: "break-all" }}>
                        {src?.chunk_id ?? "—"}
                      </span>
                    </div>

                    <div>
                      <div className="muted2" style={{ marginBottom: 6 }}>
                        source snippet
                      </div>
                      <div
                        style={{
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          lineHeight: 1.5,
                          fontSize: 14,
                          opacity: 0.92,
                        }}
                      >
                        {src?.source_snippet ?? "—"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}