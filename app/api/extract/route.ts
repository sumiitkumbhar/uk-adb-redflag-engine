import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { splitDocumentIntoSections } from "@/lib/ingestion/documentSplitter";
import { parseDocumentLayout } from "@/lib/ingestion/layoutParser";
import {
  buildNormalizedFactSet,
  toEngineFacts
} from "@/lib/extraction/factNormalizer";
import {
  summarizeNormalizedFactConfidence
} from "@/lib/extraction/factConfidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getTextFromRequest(req: NextRequest): Promise<{
  text: string;
  sourceDocument: string;
}> {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = await req.json();
    return {
      text: String(body?.text ?? ""),
      sourceDocument: String(body?.sourceDocument ?? "uploaded-text.txt")
    };
  }

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new Error("No file uploaded in form-data field 'file'.");
    }

    const fileName = file.name || "uploaded.txt";
    const ext = path.extname(fileName).toLowerCase();

    if (![".txt", ".md"].includes(ext)) {
      throw new Error(
        "V1 extract route supports only .txt or .md uploads. Convert PDF to text first."
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const tempPath = path.join(os.tmpdir(), `${Date.now()}-${fileName}`);
    fs.writeFileSync(tempPath, buffer);

    const text = fs.readFileSync(tempPath, "utf8");
    fs.unlinkSync(tempPath);

    return {
      text,
      sourceDocument: fileName
    };
  }

  throw new Error(
    "Unsupported content type. Use application/json or multipart/form-data."
  );
}

export async function POST(req: NextRequest) {
  try {
    const { text, sourceDocument } = await getTextFromRequest(req);

    if (!text.trim()) {
      return NextResponse.json(
        { ok: false, error: "No text content provided." },
        { status: 400 }
      );
    }

    const sections = splitDocumentIntoSections(text);
    const parsed = parseDocumentLayout(sections, sourceDocument);
    const rawFacts = parsed.sections.flatMap((section) => section.extractedFacts);
    const normalizedFacts = buildNormalizedFactSet(rawFacts);
    const engineFacts = toEngineFacts(normalizedFacts);
    const confidence = summarizeNormalizedFactConfidence(normalizedFacts);

    return NextResponse.json({
      ok: true,
      sourceDocument,
      document: {
        sectionCount: parsed.sections.length,
        sections: parsed.sections.map((section) => ({
          id: section.id,
          title: section.title,
          documentType: section.documentType,
          documentTypeConfidence: section.documentTypeConfidence,
          matchedSignals: section.matchedSignals,
          extractedFactCount: section.extractedFacts.length
        }))
      },
      normalizedFacts,
      engineFacts,
      confidence
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown extraction error"
      },
      { status: 500 }
    );
  }
}