import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const job_id = url.searchParams.get("job_id");
  if (!job_id) {
    return NextResponse.json({ ok: false, error: "job_id required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data, error } = await supabase
    .from("jobs")
    .select("id,status,document_id,started_at,finished_at,last_error")
    .eq("id", job_id)
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, ...data });
}
