import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET ?? "documents";
const MAX_BYTES = 25 * 1024 * 1024; // 25MB each

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function safeFilename(name: string) {
  return name.replace(/[^\w.\- ]+/g, "").replace(/\s+/g, "_") || "upload.pdf";
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_KEY"
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
}

function getFilesFromFormData(formData: FormData): File[] {
  const directFiles = formData.getAll("files").filter((x): x is File => x instanceof File);
  if (directFiles.length > 0) return directFiles;

  const single = formData.get("file");
  if (single instanceof File) return [single];

  return [];
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const files = getFilesFromFormData(formData);

    if (files.length === 0) {
      return json({ ok: false, message: "No file(s) provided" }, 400);
    }

    const oversized = files.find((f) => f.size > MAX_BYTES);
    if (oversized) {
      return json(
        {
          ok: false,
          message: `File too large: ${oversized.name}. Max size is ${MAX_BYTES} bytes.`,
        },
        413
      );
    }

    const suppliedBatchId = String(formData.get("batch_id") ?? "").trim();
    const batchId = suppliedBatchId || randomUUID();

    const supabase = getSupabaseAdmin();

    const uploaded: Array<{
      document_id: string;
      job_id: string;
      filename: string;
      storage_path: string;
      mime_type: string;
      size_bytes: number;
      queued: true;
    }> = [];

    for (const file of files) {
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeFilename(
        file.name
      )}`;

      const upload = await supabase.storage.from(BUCKET).upload(filename, file, {
        contentType: file.type || "application/pdf",
        upsert: false,
      });

      if (upload.error) {
        throw new Error(`Storage upload failed for ${file.name}: ${upload.error.message}`);
      }

      const doc = await supabase
        .from("documents")
        .insert({
          filename: file.name,
          storage_path: filename,
          mime_type: file.type || "application/pdf",
          size_bytes: file.size,
          status: "queued",
        })
        .select()
        .single();

      if (doc.error || !doc.data?.id) {
        throw new Error(`Document insert failed for ${file.name}: ${doc.error?.message ?? "Unknown error"}`);
      }

      const documentId = doc.data.id;

      const job = await supabase
        .from("jobs")
        .insert({
          document_id: documentId,
          job_type: "fire_risk_processing",
          status: "queued",
          progress: 0,
          payload: {
            batch_id: batchId,
            original_filename: file.name,
            upload_count: files.length,
          },
        })
        .select()
        .single();

      if (job.error || !job.data?.id) {
        await supabase.from("documents").update({ status: "failed" }).eq("id", documentId);
        throw new Error(`Job insert failed for ${file.name}: ${job.error?.message ?? "Unknown error"}`);
      }

      uploaded.push({
        document_id: documentId,
        job_id: job.data.id,
        filename: file.name,
        storage_path: filename,
        mime_type: file.type || "application/pdf",
        size_bytes: file.size,
        queued: true,
      });
    }

    if (uploaded.length === 1) {
      const one = uploaded[0];
      return json({
        ok: true,
        batch_id: batchId,
        document_id: one.document_id,
        job_id: one.job_id,
        document_ids: uploaded.map((x) => x.document_id),
        job_ids: uploaded.map((x) => x.job_id),
        uploaded,
        queued: true,
        filename: one.filename,
        storage_path: one.storage_path,
        message: "Uploaded successfully and queued for processing",
      });
    }

    return json({
      ok: true,
      batch_id: batchId,
      document_ids: uploaded.map((x) => x.document_id),
      job_ids: uploaded.map((x) => x.job_id),
      uploaded,
      queued: true,
      count: uploaded.length,
      message: `Uploaded ${uploaded.length} files successfully and queued them for processing`,
    });
  } catch (e: any) {
    return json(
      { ok: false, message: e?.message ?? "Internal error" },
      500
    );
  }
}