import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { riskRules } from "@/lib/riskRules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mustUuid(id: string | null) {
  if (!id) return { ok: false, status: 400, message: "document_id is required" as const };
  if (!UUID_RE.test(id))
    return { ok: false, status: 400, message: "document_id must be a UUID" as const };
  return { ok: true, id } as const;
}

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

type RuleStatus = "PASS" | "FAIL" | "UNKNOWN";

type RuleResult = {
  ruleId: string;
  status: RuleStatus;
  compliant: boolean;
  score: number;
  reason: string;
  evidence?: string[];
};

function ruleById() {
  const m = new Map<string, any>();
  for (const r of riskRules as any[]) m.set(r.ruleId, r);
  return m;
}

function summarize(results: RuleResult[]) {
  const totals = { PASS: 0, FAIL: 0, UNKNOWN: 0 };
  let riskScore = 0;

  for (const r of results) {
    totals[r.status] = (totals as any)[r.status] + 1;
    riskScore += typeof r.score === "number" ? r.score : 0;
  }

  const total = results.length || 1;
  return {
    totalRules: results.length,
    pass: totals.PASS,
    fail: totals.FAIL,
    unknown: totals.UNKNOWN,
    unknownRate: totals.UNKNOWN / total,
    totalRiskScore: riskScore,
  };
}

function topMitigations(failing: Array<{ rule: any; result: RuleResult }>) {
  // Flatten mitigations; count repeats to prioritize
  const counts = new Map<string, number>();
  for (const f of failing) {
    const steps: string[] = Array.isArray(f.rule?.mitigationSteps)
      ? f.rule.mitigationSteps
      : [];
    for (const s of steps) counts.set(s, (counts.get(s) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([step, count]) => ({ step, count }));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const check = mustUuid(searchParams.get("document_id"));
  if (!check.ok) return json({ ok: false, message: check.message }, check.status);
  const document_id = check.id;

  const db = supabase();

  // Pull latest computed results
  const { data, error } = await db
    .from("risk_scores")
    .select("results, document_id")
    .eq("document_id", document_id)
    .single();

  if (error || !data?.results) {
    return json(
      { ok: false, message: "Risk scores not found. Run /api/risk-scores first." },
      404
    );
  }

  const results = data.results as RuleResult[];
  const byId = ruleById();

  const enriched = results.map((r) => {
    const rule = byId.get(r.ruleId);
    return {
      ...r,
      meta: rule
        ? {
            title: rule.title,
            part: rule.part,
            severity: rule.severity,
            scope: rule.scope,
            regulatory: rule.regulatory,
            appliesTo: rule.appliesTo,
            mitigationSteps: rule.mitigationSteps ?? [],
          }
        : null,
    };
  });

  const failing = enriched
    .filter((r) => r.status === "FAIL")
    .map((r) => ({ rule: byId.get(r.ruleId), result: r }));

  const report = {
    ok: true,
    document_id,
    summary: summarize(results),
    failures: enriched.filter((r) => r.status === "FAIL"),
    unknowns: enriched.filter((r) => r.status === "UNKNOWN"),
    passes: enriched.filter((r) => r.status === "PASS"),
    mitigationPlan: {
      topActions: topMitigations(failing),
      byRule: enriched
        .filter((r) => r.status === "FAIL")
        .map((r) => ({
          ruleId: r.ruleId,
          title: r.meta?.title ?? "(rule not found)",
          severity: r.meta?.severity ?? null,
          reason: r.reason,
          mitigationSteps: r.meta?.mitigationSteps ?? [],
        })),
    },
  };

  return json(report, 200);
}