import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Body = { document_id?: string };

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const document_id = (body.document_id || "").trim();

    if (!document_id) {
      return NextResponse.json({ error: "document_id required" }, { status: 400 });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!SUPABASE_URL || !SERVICE_KEY) {
      return NextResponse.json(
        { error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local" },
        { status: 500 }
      );
    }

    const fnUrl = `${SUPABASE_URL}/functions/v1/bright-task`;

    const res = await fetch(fnUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ document_id }),
    });

    // Your edge fn might return plain text OR JSON. Handle both.
    const contentType = res.headers.get("content-type") || "";
    const payload =
      contentType.includes("application/json")
        ? await res.json().catch(() => null)
        : await res.text().catch(() => "");

    if (!res.ok) {
      return NextResponse.json(
        { error: typeof payload === "string" ? payload : payload?.error || JSON.stringify(payload) },
        { status: res.status }
      );
    }

    if (typeof payload === "string") {
      return NextResponse.json({ output: payload }, { status: 200 });
    }
    return NextResponse.json(payload, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unknown error" }, { status: 500 });
  }
}
