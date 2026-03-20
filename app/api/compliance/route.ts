import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { riskRules } from "@/lib/riskRules";
import { RULE_LOGIC } from "@/lib/ruleLogic";
import { normalizeFacts } from "@/lib/factNormalizer";
import { mapFactsToRuleSchema } from "@/lib/factMapper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type JobStatus = "queued" | "processing" | "done" | "failed";
type RuleStatus = "PASS" | "FAIL" | "UNKNOWN";

type FactSource = {
  confidence: number | null;
  page: number | null;
  chunk_id: string | null;
  source_snippet: string | null;
  document_id?: string | null;
};

type RuleRow = {
  ruleId: string;
  title: string;
  part: string;
  severity: "critical" | "high" | "medium" | "low" | string;
  status: RuleStatus;
  compliant: boolean;
  score: number;
  reason: string;
  evidence: string[];
  mitigation: string[] | string | null;
};

type Scope =
  | { kind: "document"; document_id: string }
  | { kind: "documents"; document_ids: string[] }
  | { kind: "batch"; batch_id: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function getSupabaseAdmin() {
  const url =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || "";

  if (!url) throw new Error("Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY"
    );
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

function mustUuid(v: string | null, fieldName = "id") {
  if (!v) throw new Error(`${fieldName} is required`);
  if (!UUID_RE.test(v)) throw new Error(`${fieldName} must be a UUID`);
  return v;
}

function parseUuidList(raw: string | null): string[] {
  if (!raw) return [];
  const out = raw
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  for (const id of out) {
    mustUuid(id, "document_ids item");
  }

  return Array.from(new Set(out));
}

function parseStoredFacts(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, any>;
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, any>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

function parseFactValue(raw: unknown): any {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") return raw;

  const trimmed = raw.trim();
  if (!trimmed) return "";

  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (!Number.isNaN(Number(trimmed))) return Number(trimmed);

  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

function compactObject(obj: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && v !== undefined && v !== "") out[k] = v;
  }
  return out;
}

function mergeFactObjects(
  base: Record<string, any>,
  incoming: Record<string, any>
): Record<string, any> {
  const out = { ...base };

  for (const [key, value] of Object.entries(incoming)) {
    const existing = out[key];

    const existingEmpty =
      existing === null ||
      existing === undefined ||
      existing === "" ||
      (Array.isArray(existing) && existing.length === 0);

    if (existingEmpty) {
      out[key] = value;
      continue;
    }

    if (Array.isArray(existing) && Array.isArray(value)) {
      out[key] = Array.from(
        new Set([...existing.map(String), ...value.map(String)])
      );
      continue;
    }
  }

  return out;
}

function buildFactSources(rows: any[]) {
  const factSources: Record<string, FactSource> = {};
  const factValues: Record<string, any> = {};

  for (const row of rows) {
    const key = String(row.fact_key ?? "").trim();
    if (!key) continue;

    const nextConfidence =
      typeof row.confidence === "number" ? row.confidence : 0;

    const current = factSources[key];
    const currentConfidence =
      typeof current?.confidence === "number" ? current.confidence : -1;

    if (!current || nextConfidence > currentConfidence) {
      factSources[key] = {
        confidence: typeof row.confidence === "number" ? row.confidence : null,
        page: typeof row.page === "number" ? row.page : null,
        chunk_id: row.chunk_id ? String(row.chunk_id) : null,
        source_snippet: row.source_snippet
          ? String(row.source_snippet)
          : null,
        document_id: row.document_id ? String(row.document_id) : null,
      };

      factValues[key] = parseFactValue(row.fact_value);
    }
  }

  return { factSources, factValues };
}

function deriveCompatFacts(input: Record<string, any>) {
  const facts = { ...input };

  if (facts.topStoreyHeightM != null && facts.heightTopStoreyM == null) {
    facts.heightTopStoreyM = facts.topStoreyHeightM;
  }
  if (facts.heightTopStoreyM != null && facts.topStoreyHeightM == null) {
    facts.topStoreyHeightM = facts.heightTopStoreyM;
  }

  if (facts.storeys != null && facts.storeysAboveGroundCount == null) {
    facts.storeysAboveGroundCount = facts.storeys;
  }
  if (facts.storeysAboveGroundCount != null && facts.storeys == null) {
    facts.storeys = facts.storeysAboveGroundCount;
  }

  if (
    facts.numberOfStaircases == null &&
    facts.commonStairCount != null
  ) {
    facts.numberOfStaircases = facts.commonStairCount;
  }
  if (
    facts.commonStairCount == null &&
    facts.numberOfStaircases != null
  ) {
    facts.commonStairCount = facts.numberOfStaircases;
  }
  if (
    facts.stairCount == null &&
    facts.numberOfStaircases != null
  ) {
    facts.stairCount = facts.numberOfStaircases;
  }

  if (
    facts.automaticDetectionProvided == null &&
    facts.automaticDetectionPresent != null
  ) {
    facts.automaticDetectionProvided = facts.automaticDetectionPresent;
  }
  if (
    facts.automaticDetectionPresent == null &&
    facts.automaticDetectionProvided != null
  ) {
    facts.automaticDetectionPresent = facts.automaticDetectionProvided;
  }

  if (facts.sprinklersProvided == null && facts.sprinklersPresent != null) {
    facts.sprinklersProvided = facts.sprinklersPresent;
  }
  if (facts.sprinklersPresent == null && facts.sprinklersProvided != null) {
    facts.sprinklersPresent = facts.sprinklersProvided;
  }
  if (
    facts.sprinklerSystemPresent == null &&
    facts.sprinklersProvided != null
  ) {
    facts.sprinklerSystemPresent = facts.sprinklersProvided;
  }

  if (facts.fireMainPresent == null && facts.fireMainsPresent != null) {
    facts.fireMainPresent = facts.fireMainsPresent;
  }
  if (facts.fireMainsPresent == null && facts.fireMainPresent != null) {
    facts.fireMainsPresent = facts.fireMainPresent;
  }

  if (
    facts.protectedLobbyPresent == null &&
    facts.commonLobbyPresent != null
  ) {
    facts.protectedLobbyPresent = facts.commonLobbyPresent;
  }

  if (facts.flatUnitFlag == null && facts.hasFlats != null) {
    facts.flatUnitFlag = facts.hasFlats;
  }

  if (
    facts.hazardLevel == null &&
    (facts.hasFlats === true ||
      facts.isDwellingFlag === true ||
      typeof facts.dwellingType === "string")
  ) {
    facts.hazardLevel = "normal";
  }

  if (
    facts.dwellingType == null &&
    typeof facts.buildingUse === "string"
  ) {
    const use = facts.buildingUse.toLowerCase();
    if (use.includes("flat") || use.includes("apartment")) {
      facts.dwellingType = "flat";
    } else if (
      use.includes("house") ||
      use.includes("dwelling") ||
      use.includes("dwellinghouse")
    ) {
      facts.dwellingType = "house";
    }
  }

  if (
    facts.hasFlats == null &&
    typeof facts.buildingUse === "string"
  ) {
    const use = facts.buildingUse.toLowerCase();
    if (use.includes("flat") || use.includes("apartment")) {
      facts.hasFlats = true;
    }
  }

  if (
    facts.isDwellingFlag == null &&
    typeof facts.buildingUse === "string"
  ) {
    const use = facts.buildingUse.toLowerCase();
    if (
      use.includes("dwelling") ||
      use.includes("house") ||
      use.includes("dwellinghouse")
    ) {
      facts.isDwellingFlag = true;
    }
  }

  if (
    facts.sleepingAccommodation == null &&
    typeof facts.buildingUse === "string"
  ) {
    const use = facts.buildingUse.toLowerCase();
    if (
      use.includes("flat") ||
      use.includes("apartment") ||
      use.includes("hotel") ||
      use.includes("hostel") ||
      use.includes("residential")
    ) {
      facts.sleepingAccommodation = true;
    }
  }

  if (
    facts.relevantBuildingFlag == null &&
    (typeof facts.heightTopStoreyM === "number" ||
      typeof facts.topStoreyHeightM === "number" ||
      typeof facts.buildingHeightM === "number")
  ) {
    const h =
      facts.heightTopStoreyM ??
      facts.topStoreyHeightM ??
      facts.buildingHeightM;
    if (typeof h === "number") {
      facts.relevantBuildingFlag = h >= 18;
    }
  }

  if (
    facts.reg7AppliesFlag == null &&
    facts.relevantBuildingFlag != null
  ) {
    facts.reg7AppliesFlag = facts.relevantBuildingFlag;
  }

  if (
    facts.twoDirectionsAvailableFlag == null &&
    typeof facts.numberOfStaircases === "number"
  ) {
    facts.twoDirectionsAvailableFlag = facts.numberOfStaircases >= 2;
  }

  if (
    facts.staffPresencePattern == null &&
    typeof facts.spaceType === "string"
  ) {
    const st = facts.spaceType.toLowerCase();
    if (["plant", "void", "storage", "store", "bin"].some((x) => st.includes(x))) {
      facts.staffPresencePattern = "unsupervised";
    }
  }

  return facts;
}

function scoreFrom(severity: string, status: RuleStatus) {
  const baseFail: Record<string, number> = {
    critical: 95,
    high: 85,
    medium: 65,
    low: 35,
  };

  const baseUnknown: Record<string, number> = {
    critical: 55,
    high: 45,
    medium: 30,
    low: 15,
  };

  if (status === "PASS") return 0;
  if (status === "UNKNOWN") return baseUnknown[severity] ?? 30;
  return baseFail[severity] ?? 75;
}

function normalizeMitigation(out: any, rule: any): string[] | string | null {
  const candidate =
    out?.missingMitigation ??
    out?.missingMitigations ??
    out?.mitigationMissing ??
    out?.mitigation ??
    rule?.mitigationSteps ??
    null;

  if (!candidate) return null;

  if (Array.isArray(candidate)) {
    return candidate.map((x) => String(x ?? "").trim()).filter(Boolean);
  }

  if (typeof candidate === "string") {
    return candidate.trim() || null;
  }

  return null;
}

function buildRulesFromFacts(facts: Record<string, any>): RuleRow[] {
  return (riskRules as any[]).map((rule) => {
    const fn = RULE_LOGIC[rule.ruleId] ?? RULE_LOGIC[rule.logic?.evaluationId];

    if (!fn) {
      return {
        ruleId: rule.ruleId,
        title: rule.title ?? rule.name ?? rule.ruleId,
        part: rule.part ?? "",
        severity: rule.severity ?? "medium",
        status: "UNKNOWN",
        compliant: false,
        score: scoreFrom(rule.severity ?? "medium", "UNKNOWN"),
        reason: "Rule logic not implemented.",
        evidence: [],
        mitigation: normalizeMitigation({}, rule),
      };
    }

    try {
      const out = fn(facts, rule) ?? {};
      const raw = String(
        out.status ??
          (out.compliant === true
            ? "PASS"
            : out.compliant === false
            ? "FAIL"
            : "UNKNOWN")
      ).toUpperCase();

      const status: RuleStatus =
        raw === "PASS" || raw === "FAIL" ? raw : "UNKNOWN";

      return {
        ruleId: rule.ruleId,
        title: rule.title ?? rule.name ?? rule.ruleId,
        part: rule.part ?? "",
        severity: rule.severity ?? "medium",
        status,
        compliant: status === "PASS",
        score: scoreFrom(rule.severity ?? "medium", status),
        reason: String(out.reason ?? out.message ?? "No reason provided."),
        evidence: Array.isArray(out.evidence)
          ? out.evidence.map((x: unknown) => String(x))
          : Array.isArray(out.evidenceUsed)
          ? out.evidenceUsed.map((x: unknown) => String(x))
          : [],
        mitigation: normalizeMitigation(out, rule),
      };
    } catch (e: any) {
      return {
        ruleId: rule.ruleId,
        title: rule.title ?? rule.name ?? rule.ruleId,
        part: rule.part ?? "",
        severity: rule.severity ?? "medium",
        status: "UNKNOWN",
        compliant: false,
        score: scoreFrom(rule.severity ?? "medium", "UNKNOWN"),
        reason: `Evaluator crashed: ${e?.message ?? "Unknown error"}`,
        evidence: [String(e?.message ?? "Unknown error")],
        mitigation: normalizeMitigation({}, rule),
      };
    }
  });
}

function computeSummary(rows: RuleRow[]) {
  const pass = rows.filter((r) => r.status === "PASS").length;
  const fail = rows.filter((r) => r.status === "FAIL").length;
  const unknown = rows.filter((r) => r.status === "UNKNOWN").length;

  const avgRisk = rows.length
    ? rows.reduce((sum, r) => sum + (Number(r.score) || 0), 0) / rows.length
    : 0;

  const complianceScore = Math.max(
    0,
    Math.min(100, Math.round(100 - avgRisk))
  );

  const completenessScore = rows.length
    ? Math.round(((pass + fail) / rows.length) * 100)
    : 0;

  return {
    totalRules: rows.length,
    pass,
    fail,
    unknown,
    complianceScore,
    completenessScore,
  };
}

async function getDocumentIdsForBatch(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  batch_id: string
) {
  const { data, error } = await supabase
    .from("jobs")
    .select("document_id, status, progress, error, created_at, payload")
    .contains("payload", { batch_id });

  if (error) throw new Error(error.message);

  const docIds = Array.from(
    new Set(
      (data ?? [])
        .map((x: any) => x.document_id)
        .filter((x: any) => typeof x === "string" && x.trim().length > 0)
    )
  );

  return {
    documentIds: docIds,
    jobs: data ?? [],
  };
}

async function getLatestJobsForDocuments(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  documentIds: string[]
) {
  if (documentIds.length === 0) return [];

  const { data, error } = await supabase
    .from("jobs")
    .select("id, document_id, status, progress, error, created_at, payload")
    .in("document_id", documentIds)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const byDoc = new Map<string, any>();

  for (const row of data ?? []) {
    const docId = String(row.document_id ?? "");
    if (!docId) continue;
    if (!byDoc.has(docId)) byDoc.set(docId, row);
  }

  return Array.from(byDoc.values());
}

async function getMergedFactsPayload(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  documentIds: string[]
) {
  if (documentIds.length === 0) return null;

  const { data: factRows, error: factError } = await supabase
    .from("document_facts")
    .select("document_id, facts, updated_at")
    .in("document_id", documentIds);

  if (factError) throw new Error(factError.message);

  const mergedStoredFacts: Record<string, any> = {};
  let latestUpdatedAt: string | null = null;

  for (const row of factRows ?? []) {
    const parsed = compactObject(parseStoredFacts(row.facts));
    Object.assign(mergedStoredFacts, parsed);

    const updatedAt = row.updated_at ? String(row.updated_at) : null;
    if (updatedAt && (!latestUpdatedAt || updatedAt > latestUpdatedAt)) {
      latestUpdatedAt = updatedAt;
    }
  }

  const { data: evidenceRows, error: evidenceError } = await supabase
    .from("building_facts")
    .select(
      "document_id, fact_key, fact_value, confidence, page, chunk_id, source_snippet"
    )
    .in("document_id", documentIds);

  if (evidenceError) throw new Error(evidenceError.message);

  const { factSources, factValues } = buildFactSources(evidenceRows ?? []);

  let facts = compactObject(
    mergeFactObjects(factValues, mergedStoredFacts)
  );

  facts = deriveCompatFacts(facts);
  facts = normalizeFacts(facts) as Record<string, any>;
  facts = deriveCompatFacts(facts);
  facts = mapFactsToRuleSchema(facts);
  facts = normalizeFacts(facts) as Record<string, any>;
  facts = deriveCompatFacts(facts);
  facts = compactObject(facts);

  if (Object.keys(facts).length === 0) {
    return null;
  }

  return {
    facts,
    factSources,
    facts_updated_at: latestUpdatedAt,
  };
}

async function handleScope(scope: Scope) {
  const supabase = getSupabaseAdmin();

  let documentIds: string[] = [];
  let batchId: string | null = null;

  if (scope.kind === "document") {
    documentIds = [scope.document_id];
  } else if (scope.kind === "documents") {
    documentIds = scope.document_ids;
  } else {
    batchId = scope.batch_id;
    const batchLookup = await getDocumentIdsForBatch(supabase, batchId);
    documentIds = batchLookup.documentIds;
  }

  if (documentIds.length === 0) {
    return {
      status: 404,
      body: {
        ok: false,
        state: "not_found",
        batch_id: batchId,
        document_ids: [],
        message: "No documents found for the requested scope.",
      },
    };
  }

  const latestJobs = await getLatestJobsForDocuments(supabase, documentIds);

  const queuedOrProcessing = latestJobs.filter((job) => {
    const s = String(job.status ?? "").toLowerCase() as JobStatus;
    return s === "queued" || s === "processing" || s === "running";
  });

  if (queuedOrProcessing.length > 0) {
    return {
      status: 202,
      body: {
        ok: false,
        state: "processing",
        batch_id: batchId,
        document_ids: documentIds,
        message: "Worker is still processing one or more documents.",
        jobs: latestJobs,
        progress: {
          total: documentIds.length,
          completed: latestJobs.filter((j) =>
            ["done", "completed"].includes(String(j.status).toLowerCase())
          ).length,
          processing: queuedOrProcessing.length,
          failed: latestJobs.filter((j) =>
            ["failed", "error"].includes(String(j.status).toLowerCase())
          ).length,
        },
      },
    };
  }

  const failedJobs = latestJobs.filter((job) =>
    ["failed", "error"].includes(String(job.status ?? "").toLowerCase())
  );

  const successfulDocIds = latestJobs
    .filter((job) => !["failed", "error"].includes(String(job.status).toLowerCase()))
    .map((job) => String(job.document_id));

  if (successfulDocIds.length === 0) {
    return {
      status: 500,
      body: {
        ok: false,
        state: "failed",
        batch_id: batchId,
        document_ids: documentIds,
        message: "All documents in scope failed processing.",
        jobs: latestJobs,
      },
    };
  }

  const factsPayload = await getMergedFactsPayload(supabase, successfulDocIds);

  if (!factsPayload) {
    return {
      status: 404,
      body: {
        ok: false,
        state: "not_found",
        batch_id: batchId,
        document_ids: successfulDocIds,
        message: "No extracted facts found for the requested scope.",
        jobs: latestJobs,
      },
    };
  }

  const rules = buildRulesFromFacts(factsPayload.facts);
  const summary = computeSummary(rules);

  return {
    status: 200,
    body: {
      ok: true,
      source:
        scope.kind === "document"
          ? "document_facts"
          : scope.kind === "documents"
          ? "document_facts_merged"
          : "batch_facts_merged",
      batch_id: batchId,
      document_id: scope.kind === "document" ? scope.document_id : undefined,
      document_ids: successfulDocIds,
      facts: factsPayload.facts,
      factSources: factsPayload.factSources,
      facts_updated_at: factsPayload.facts_updated_at,
      summary,
      failedRules: rules.filter((r) => r.status === "FAIL"),
      unknownRules: rules.filter((r) => r.status === "UNKNOWN"),
      passRulesCount: rules.filter((r) => r.status === "PASS").length,
      rules,
      jobs: latestJobs,
      failed_document_ids: failedJobs.map((j) => String(j.document_id)),
    },
  };
}

function parseScopeFromGet(req: NextRequest): Scope {
  const { searchParams } = new URL(req.url);

  const batch_id = searchParams.get("batch_id");
  const document_id = searchParams.get("document_id");
  const document_ids = parseUuidList(searchParams.get("document_ids"));

  if (batch_id) {
    return { kind: "batch", batch_id: mustUuid(batch_id, "batch_id") };
  }

  if (document_ids.length > 0) {
    return { kind: "documents", document_ids };
  }

  return {
    kind: "document",
    document_id: mustUuid(document_id, "document_id"),
  };
}

function parseScopeFromPost(body: any): Scope {
  if (body?.batch_id) {
    return {
      kind: "batch",
      batch_id: mustUuid(String(body.batch_id), "batch_id"),
    };
  }

  if (Array.isArray(body?.document_ids) && body.document_ids.length > 0) {
    const ids = body.document_ids.map((x: any) =>
      mustUuid(String(x), "document_ids item")
    );
    return { kind: "documents", document_ids: Array.from(new Set(ids)) };
  }

  return {
    kind: "document",
    document_id: mustUuid(String(body?.document_id ?? ""), "document_id"),
  };
}

export async function GET(req: NextRequest) {
  try {
    const scope = parseScopeFromGet(req);
    const { status, body } = await handleScope(scope);
    return json(body, status);
  } catch (e: any) {
    return json(
      {
        ok: false,
        state: "failed",
        message: e?.message ?? "Internal error",
      },
      500
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const scope = parseScopeFromPost(body);
    const { status, body: responseBody } = await handleScope(scope);
    return json(responseBody, status);
  } catch (e: any) {
    return json(
      {
        ok: false,
        state: "failed",
        message: e?.message ?? "Internal error",
      },
      500
    );
  }
}