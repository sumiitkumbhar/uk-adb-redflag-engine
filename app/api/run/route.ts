import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { riskRules } from "@/lib/riskRules";
import * as ruleLogicModule from "@/lib/ruleLogic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RuleStatus = "PASS" | "FAIL" | "UNKNOWN";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function errToJson(e: any) {
  return {
    name: e?.name,
    message: e?.message,
    stack: e?.stack,
    code: e?.code,
    cause: e?.cause,
  };
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!url) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
  if (!key) {
    throw new Error(
      "Missing env: SUPABASE_SERVICE_ROLE_KEY (recommended) or SUPABASE_SERVICE_KEY"
    );
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mustUuid(v: string | null) {
  if (!v) throw new Error("document_id is required");
  if (!UUID_RE.test(v)) throw new Error("document_id must be a UUID");
  return v;
}

function getRuleLogic(): Record<string, any> {
  const m: any = ruleLogicModule;
  return (m.RULE_LOGIC ?? m.ruleLogic ?? m.default ?? {}) as Record<string, any>;
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

function computeOverallCompliance(results: any[]) {
  if (!results.length) return 0;
  const avgRisk =
    results.reduce((s, r) => s + (Number(r.score) || 0), 0) / results.length;
  return Math.max(0, Math.min(100, Math.round(100 - avgRisk)));
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const document_id = mustUuid(searchParams.get("document_id"));

    const supabase = getSupabaseAdmin();

    // 1) Load facts if present (never fail if missing)
    let facts: Record<string, any> = {};
    const { data: factsRow } = await supabase
      .from("document_facts")
      .select("facts")
      .eq("document_id", document_id)
      .maybeSingle();

    if (factsRow?.facts && typeof factsRow.facts === "object") {
      facts = factsRow.facts as Record<string, any>;
    }

    // 2) Evaluate rules
    const logic = getRuleLogic();

    const results = (riskRules as any[]).map((rule) => {
      const fn = logic[rule.ruleId];

      // no evaluator -> UNKNOWN
      if (!fn) {
        const status: RuleStatus = "UNKNOWN";
        return {
          ruleId: rule.ruleId,
          title: rule.title,
          part: rule.part,
          severity: rule.severity,
          status,
          compliant: false,
          score: scoreFrom(rule.severity, status),
          reason: "Rule logic not implemented.",
          evidenceUsed: [],
          mitigation: null,
        };
      }

      // evaluator exists -> run safely
      try {
        const out = fn(facts, rule) ?? {};
        const status: RuleStatus = (out.status ?? "UNKNOWN") as RuleStatus;

        const evidence =
          out.evidenceUsed ?? out.evidence ?? out.evidence_used ?? [];

        return {
          ruleId: rule.ruleId,
          title: rule.title,
          part: rule.part,
          severity: rule.severity,
          status,
          compliant: status === "PASS",
          score: scoreFrom(rule.severity, status),
          reason: out.reason ?? "No reason provided.",
          evidenceUsed: Array.isArray(evidence) ? evidence : [],
          mitigation: out.mitigation ?? null,
        };
      } catch (e: any) {
        const status: RuleStatus = "UNKNOWN";
        return {
          ruleId: rule.ruleId,
          title: rule.title,
          part: rule.part,
          severity: rule.severity,
          status,
          compliant: false,
          score: scoreFrom(rule.severity, status),
          reason: "Evaluator crashed.",
          evidenceUsed: [e?.message ?? String(e)],
          mitigation: null,
        };
      }
    });

    const summary = {
      total: results.length,
      fail: results.filter((r) => r.status === "FAIL").length,
      unknown: results.filter((r) => r.status === "UNKNOWN").length,
      pass: results.filter((r) => r.status === "PASS").length,
    };

    const overall_score = computeOverallCompliance(results);

    // 3) Write ONE row per document into risk_reports (THIS IS THE FIX)
    const reportPayload = {
      document_id,
      generatedAt: new Date().toISOString(),
      overall_score,
      summary,
      results,
    };

    const { error: saveErr } = await supabase
      .from("risk_reports")
      .upsert(
        { document_id, results: reportPayload },
        { onConflict: "document_id" }
      );

    if (saveErr) {
      return json(
        {
          ok: false,
          message: "Failed to write risk_reports",
          document_id,
          supabaseError: saveErr,
        },
        500
      );
    }

    return json({
      ok: true,
      document_id,
      overall_score,
      summary,
      count: results.length,
    });
  } catch (e: any) {
    return json(
      {
        ok: false,
        message: "RUN_FAILED",
        details: errToJson(e),
      },
      500
    );
  }
}