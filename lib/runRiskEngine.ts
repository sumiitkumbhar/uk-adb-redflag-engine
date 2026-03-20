import Groq from "groq-sdk";
import { riskRules, RiskRule } from "./riskRules";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

const LEGACY_WRAPPER_RULE_IDS = new Set<string>([
  "B4-UNPROTECTED-AREAS-SMALL-01",
  "B4-DW-EXTWALL-BOUNDARY-01",
  "B5-VEHICLE-DISTANCE-01",
  "B5-ACCESS-VEHICLE-01",
  "B4-DW-ROOF-BOUNDARY-01",
  "B4-ROOF-EDGE-SEPARATION-01",
  "B4-EXTWALL-NONCOMB-11M-RES-01",
  "B4-EXT-SURFACE-SPREAD-01",
  "B4-EXTWALL-COMBUSTIBILITY-01",
]);

export type ChunkRuleEvaluation = {
  rule_id: string;
  status: "violation" | "compliant_evidence" | "not_relevant" | "insufficient_info";
  confidence: number;
  evidence_spans: string[];
  explanation: string;
};

export type ChunkAnalysisResult = {
  chunk_id: string;
  page_estimate?: number | null;
  rule_evaluations: ChunkRuleEvaluation[];
};

export type EvaluateChunkOptions = {
  debug?: boolean;
  includeLegacyRuleOutput?: boolean;
  rules?: RiskRule[];
};

function shouldIncludeRuleForChunkEvaluation(
  rule: RiskRule,
  opts?: {
    debug?: boolean;
    includeLegacyRuleOutput?: boolean;
  }
): boolean {
  const debug = Boolean(opts?.debug);
  const includeLegacy = Boolean(opts?.includeLegacyRuleOutput);

  if (debug || includeLegacy) return true;

  const ruleId = String(rule?.ruleId ?? "").trim();
  if (!ruleId) return false;

  return !LEGACY_WRAPPER_RULE_IDS.has(ruleId);
}

function buildRulesPayload(rules: RiskRule[]) {
  return rules.map((r) => ({
    rule_id: r.ruleId,
    name: r.title,
    part: r.part,
    severity: r.severity,
    scope: r.scope,
    adb_ref: r.regulatory?.references?.[0]?.ref ?? "",
    condition_summary: r.conditionSummary ?? "",
  }));
}

function parseJsonFromModelContent(content: string): ChunkAnalysisResult {
  const cleaned = String(content || "{}")
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim();

  const parsed = JSON.parse(cleaned);

  const safeEvaluations: ChunkRuleEvaluation[] = Array.isArray(parsed?.rule_evaluations)
    ? parsed.rule_evaluations.map((ev: any) => ({
        rule_id: String(ev?.rule_id ?? ""),
        status:
          ev?.status === "violation" ||
          ev?.status === "compliant_evidence" ||
          ev?.status === "not_relevant" ||
          ev?.status === "insufficient_info"
            ? ev.status
            : "insufficient_info",
        confidence:
          typeof ev?.confidence === "number"
            ? Math.max(0, Math.min(1, ev.confidence))
            : 0,
        evidence_spans: Array.isArray(ev?.evidence_spans)
          ? ev.evidence_spans.map((s: any) => String(s))
          : [],
        explanation: String(ev?.explanation ?? ""),
      }))
    : [];

  return {
    chunk_id: String(parsed?.chunk_id ?? ""),
    page_estimate:
      parsed?.page_estimate === null || parsed?.page_estimate === undefined
        ? null
        : Number(parsed.page_estimate),
    rule_evaluations: safeEvaluations,
  };
}

export async function evaluateChunkWithRules(
  chunkId: string,
  text: string,
  pageEstimate: number | null,
  optionsOrRules: EvaluateChunkOptions | RiskRule[] = riskRules
): Promise<ChunkAnalysisResult> {
  const isRulesArray = Array.isArray(optionsOrRules);

  const options: EvaluateChunkOptions = isRulesArray
    ? { rules: optionsOrRules as RiskRule[] }
    : (optionsOrRules as EvaluateChunkOptions);

  const sourceRules = Array.isArray(options.rules) ? options.rules : riskRules;

  const effectiveRules = sourceRules.filter((rule) =>
    shouldIncludeRuleForChunkEvaluation(rule, {
      debug: options.debug,
      includeLegacyRuleOutput: options.includeLegacyRuleOutput,
    })
  );

  const rulesPayload = buildRulesPayload(effectiveRules);

  const systemPrompt = `
You are a UK fire-safety compliance engine.

You must evaluate building fire safety text against a fixed set of rules derived from
Approved Document B (Fire Safety) to the Building Regulations 2010 for England.

For each rule, you must decide whether the text provides:
- explicit evidence of a VIOLATION of the rule,
- explicit evidence that the situation is COMPLIANT WITH the rule,
- or NO clear information (NOT_RELEVANT / INSUFFICIENT_INFO).

Use only information present in the provided text chunk.
Be conservative: if the text is ambiguous, use "insufficient_info".
Return only valid JSON according to the specified schema.
`;

  const userPrompt = `
You are given:

1) A list of fire-safety rules, each with:
   - rule_id
   - name
   - part (B1–B5)
   - severity
   - scope
   - adb_ref
   - condition_summary

2) A text chunk extracted from a fire safety report.

TASK:
For EACH rule in the list, decide its status with respect to THIS chunk only:
  - "violation": the chunk clearly describes a condition that does NOT meet the rule.
  - "compliant_evidence": the chunk clearly states that the rule's condition IS met.
  - "not_relevant": the chunk is about a different topic.
  - "insufficient_info": the chunk touches the topic but does not say enough to decide.

For each rule, fill:
  - rule_id
  - status
  - confidence (0.0–1.0)
  - evidence_spans: list of 1–3 short, exact quotations from the chunk that support your status
    (empty list if status is "not_relevant")
  - explanation: 1–3 sentences explaining your reasoning, referencing the evidence and adb_ref.

Important:
- Do NOT invent data; only use the chunk text.
- Never infer compliance from silence.

Return JSON in this format:

{
  "chunk_id": "${chunkId}",
  "page_estimate": ${pageEstimate ?? null},
  "rule_evaluations": [
    {
      "rule_id": "...",
      "status": "violation" | "compliant_evidence" | "not_relevant" | "insufficient_info",
      "confidence": 0.0-1.0,
      "evidence_spans": ["...", "..."],
      "explanation": "..."
    }
  ]
}

=== RULES JSON ===
${JSON.stringify(rulesPayload, null, 2)}

=== CHUNK TEXT (verbatim) ===
${text}
`;

  const res = await groq.chat.completions.create({
    model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    temperature: 0.1,
    max_tokens: 4096,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const content = res.choices[0]?.message?.content || "{}";
  const parsed = parseJsonFromModelContent(content);

  const allowedRuleIds = new Set<string>(
    effectiveRules.map((r) => String(r.ruleId))
  );

  const filteredEvaluations: ChunkRuleEvaluation[] = parsed.rule_evaluations.filter(
    (ev: ChunkRuleEvaluation) => allowedRuleIds.has(String(ev.rule_id))
  );

  return {
    chunk_id: parsed.chunk_id || chunkId,
    page_estimate:
      parsed.page_estimate === null || parsed.page_estimate === undefined
        ? pageEstimate ?? null
        : parsed.page_estimate,
    rule_evaluations: filteredEvaluations,
  };
}