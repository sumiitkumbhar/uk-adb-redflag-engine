import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mustUuid(id: string | null) {
  if (!id || !UUID_RE.test(id)) throw new Error("document_id must be a UUID");
  return id;
}

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

type RuleResult = {
  ruleId: string;
  status: "PASS" | "FAIL" | "UNKNOWN";
  score: number;
};

function gradeFrom(summary: { fail: number; unknownRate: number; totalRisk: number }) {
  // Conservative grading:
  // - Any FAIL => at least MEDIUM
  // - High totalRisk or multiple FAIL => HIGH
  // - High UNKNOWN rate penalizes confidence (pushes grade up)
  const confidencePenalty =
    summary.unknownRate >= 0.5 ? 1 : summary.unknownRate >= 0.25 ? 0.5 : 0;

  let grade: "LOW" | "MEDIUM" | "HIGH" = "LOW";

  if (summary.fail > 0) grade = "MEDIUM";
  if (summary.totalRisk >= 250 || summary.fail >= 3) grade = "HIGH";

  if (grade === "LOW" && confidencePenalty >= 1) grade = "MEDIUM";
  if (grade === "MEDIUM" && confidencePenalty >= 1 && summary.totalRisk >= 150)
    grade = "HIGH";

  return grade;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const document_id = mustUuid(searchParams.get("document_id"));

    const db = supabase();

    const { data, error } = await db
      .from("risk_scores")
      .select("results")
      .eq("document_id", document_id)
      .single();

    if (error || !data?.results) {
      return NextResponse.json(
        { ok: false, message: "risk_scores not found for document_id" },
        { status: 404 }
      );
    }

    const rows = data.results as RuleResult[];
    const total = rows.length || 1;

    const pass = rows.filter((r) => r.status === "PASS").length;
    const fail = rows.filter((r) => r.status === "FAIL").length;
    const unknown = rows.filter((r) => r.status === "UNKNOWN").length;

    const totalRisk = rows.reduce(
      (s, r) => s + (typeof r.score === "number" ? r.score : 0),
      0
    );
    const unknownRate = unknown / total;

    const grade = gradeFrom({ fail, unknownRate, totalRisk });

    return NextResponse.json({
      ok: true,
      document_id,
      grade,
      summary: {
        totalRules: rows.length,
        pass,
        fail,
        unknown,
        unknownRate,
        totalRisk,
      },
      interpretation:
        grade === "HIGH"
          ? "HIGH risk or low confidence (many UNKNOWNs / high total risk). Close UNKNOWNs and resolve FAILs before relying on the report."
          : grade === "MEDIUM"
          ? "MEDIUM risk. Close high-frequency UNKNOWNs to increase confidence and reduce residual risk."
          : "LOW risk. Validate remaining UNKNOWNs for completeness.",
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e.message }, { status: 400 });
  }
}