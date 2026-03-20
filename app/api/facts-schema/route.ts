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
  reason?: string;
};

function inferFieldMeta(fact: string) {
  const f = fact.toLowerCase();

  if (f.includes("flag") || f.startsWith("is") || f.includes("present")) {
    return { type: "boolean" as const, default: null, placeholder: "true/false" };
  }

  if (
    f.includes("class") ||
    f.includes("type") ||
    f.includes("group") ||
    f.includes("location")
  ) {
    return { type: "string" as const, default: "", placeholder: "enter value" };
  }

  if (f.includes("count") || f.includes("numberof") || f.includes("noof")) {
    return { type: "number" as const, default: null, placeholder: "e.g. 2" };
  }

  if (
    f.includes("height") ||
    f.includes("distance") ||
    f.includes("length") ||
    f.includes("area") ||
    f.includes("_m") ||
    f.includes("meters") ||
    f.includes("m2")
  ) {
    return { type: "number" as const, default: null, placeholder: "e.g. 18" };
  }

  return { type: "string" as const, default: "", placeholder: "enter value" };
}

function extractMissingFact(reason?: string) {
  if (!reason) return null;

  // Examples your engine produces:
  // "innerRoomFlag missing"
  // "boundaryDistance_m missing/invalid"
  // "protectedShaftProvidedFlag missing"
  const m1 = reason.match(/^([a-zA-Z0-9_]+)\s+missing/i);
  if (m1?.[1]) return m1[1];

  const m2 = reason.match(/^([a-zA-Z0-9_]+)\s+missing\/invalid/i);
  if (m2?.[1]) return m2[1];

  return null;
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

    const results = data.results as RuleResult[];

    const counts = new Map<string, number>();
    const examples = new Map<string, string>();

    for (const r of results) {
      if (r.status !== "UNKNOWN") continue;

      const fact = extractMissingFact(r.reason);
      if (!fact) continue;

      counts.set(fact, (counts.get(fact) ?? 0) + 1);
      if (!examples.has(fact)) examples.set(fact, r.reason ?? "");
    }

    const fields = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([fact, count]) => {
        const meta = inferFieldMeta(fact);
        return {
          fact,
          count,
          ...meta,
          exampleReason: examples.get(fact) ?? "",
        };
      });

    return NextResponse.json({
      ok: true,
      document_id,
      totalMissingFacts: fields.length,
      fields,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e.message }, { status: 400 });
  }
}