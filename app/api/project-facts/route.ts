import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mustUuid(id: string | null) {
  if (!id || !UUID_RE.test(id)) {
    throw new Error("document_id must be a UUID");
  }
  return id;
}

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/**
 * GET → fetch stored project facts
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const document_id = mustUuid(searchParams.get("document_id"));

    const db = supabase();

    const { data } = await db
      .from("project_facts")
      .select("facts")
      .eq("document_id", document_id)
      .single();

    return NextResponse.json({
      ok: true,
      facts: data?.facts ?? {},
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e.message },
      { status: 400 }
    );
  }
}

/**
 * POST → MERGE facts (SAFE UPDATE)
 * NEW facts overwrite ONLY same keys.
 * Existing keys remain.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();

    const document_id = mustUuid(body.document_id);
    const incomingFacts = body.facts ?? {};

    const db = supabase();

    // 1️⃣ Load existing facts
    const { data: existingRow } = await db
      .from("project_facts")
      .select("facts")
      .eq("document_id", document_id)
      .single();

    const existingFacts = existingRow?.facts ?? {};

    // 2️⃣ MERGE (critical fix)
    const mergedFacts = {
      ...existingFacts,
      ...incomingFacts,
    };

    // 3️⃣ Save merged result
    await db.from("project_facts").upsert(
      {
        document_id,
        facts: mergedFacts,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "document_id" }
    );

    return NextResponse.json({
      ok: true,
      mergedKeys: Object.keys(incomingFacts),
      totalFactsStored: Object.keys(mergedFacts).length,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e.message },
      { status: 400 }
    );
  }
}