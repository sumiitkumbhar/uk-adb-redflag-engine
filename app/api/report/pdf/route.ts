import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";
import { createClient } from "@supabase/supabase-js";
import path from "path";
import fs from "fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* ---------------- SUPABASE ---------------- */

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;

  if (!url || !key) throw new Error("Supabase env variables missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

/* ---------------- PDF BUFFER ---------------- */

function buildBuffer(doc: PDFKit.PDFDocument) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

/* ---------------- FONTS ---------------- */

function registerFonts(doc: PDFKit.PDFDocument) {
  const regularPath = path.join(
    process.cwd(),
    "public",
    "fonts",
    "Roboto-Regular.ttf"
  );
  const boldPath = path.join(
    process.cwd(),
    "public",
    "fonts",
    "Roboto-Bold.ttf"
  );

  if (!fs.existsSync(regularPath)) {
    throw new Error(`Missing font file: ${regularPath}`);
  }
  if (!fs.existsSync(boldPath)) {
    throw new Error(`Missing font file: ${boldPath}`);
  }

  doc.registerFont("R", regularPath);
  doc.registerFont("B", boldPath);
  doc.font("R").fontSize(11);
}

/* ---------------- TYPES ---------------- */

type RuleStatus = "PASS" | "FAIL" | "UNKNOWN";

type RuleRow = {
  ruleId?: string;
  rule_id?: string;
  id?: string;
  title?: string;
  ruleTitle?: string;
  part?: string;
  family?: string;
  severity?: string;
  status?: RuleStatus;
  score?: number;
  reason?: string;
  explanation?: string;
  missingMitigation?: string[] | string | null;
  missingMitigations?: string[] | string | null;
  mitigationMissing?: string[] | string | null;
  mitigations?: string[] | string | null;
  mitigationSteps?: string[] | string | null;
  mitigation?: string[] | string | null;
  mitigationStrategy?: string[] | string | null;
  recommendation?: string[] | string | null;
  refs?: any[];
  references?: any[];
  evidence?: string[];
};

type ComplianceApiResponse = {
  ok?: boolean;
  state?: "processing" | "failed" | "not_found";
  message?: string;
  source?: string;
  batch_id?: string;
  document_id?: string;
  document_ids?: string[];
  failed_document_ids?: string[];
  summary?: {
    totalRules?: number;
    pass?: number;
    fail?: number;
    unknown?: number;
    complianceScore?: number;
    completenessScore?: number;
  };
  rules?: RuleRow[];
  failedRules?: RuleRow[];
  unknownRules?: RuleRow[];
  passRulesCount?: number;
  facts?: Record<string, unknown>;
  factSources?: Record<
    string,
    {
      confidence?: number | null;
      page?: number | null;
      chunk_id?: string | null;
      source_snippet?: string | null;
      document_id?: string | null;
    }
  >;
  jobs?: Array<{
    id?: string;
    document_id?: string | null;
    status?: string | null;
    progress?: number | null;
    error?: string | null;
    created_at?: string | null;
    payload?: any;
  }>;
};

/* ---------------- STYLES ---------------- */

const COLORS = {
  ink: "#0F172A",
  muted: "#475569",
  line: "#CBD5E1",
  header: "#0B3B5B",
  header2: "#0EA5E9",
  fail: "#DC2626",
  unknown: "#F59E0B",
  pass: "#16A34A",
  soft: "#F8FAFC",
  white: "#FFFFFF",
};

function statusColor(status: RuleStatus) {
  if (status === "FAIL") return COLORS.fail;
  if (status === "UNKNOWN") return COLORS.unknown;
  return COLORS.pass;
}

function severityFromScore(
  score: number
): "Critical" | "High" | "Medium" | "Low" {
  if (score >= 90) return "Critical";
  if (score >= 70) return "High";
  if (score >= 40) return "Medium";
  return "Low";
}

/* ---------------- HELPERS ---------------- */

function safeText(v: any) {
  if (v === null || v === undefined) return "";
  return String(v);
}

function firstNonEmpty(...vals: any[]) {
  for (const v of vals) {
    const s = safeText(v).trim();
    if (s) return s;
  }
  return "";
}

function asStringArray(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) {
    return v.map((x) => safeText(x).trim()).filter(Boolean);
  }
  const s = safeText(v).trim();
  return s ? [s] : [];
}

function sortByPriority(rows: any[]) {
  const statusRank: Record<string, number> = { FAIL: 3, UNKNOWN: 2, PASS: 1 };
  const sevRank: Record<string, number> = {
    critical: 4,
    high: 3,
    medium: 2,
    low: 1,
  };

  return [...rows].sort((a, b) => {
    const sA = statusRank[String(a.status || "").toUpperCase()] ?? 0;
    const sB = statusRank[String(b.status || "").toUpperCase()] ?? 0;
    if (sA !== sB) return sB - sA;

    const sevA = sevRank[String(a.severity || "").toLowerCase()] ?? 0;
    const sevB = sevRank[String(b.severity || "").toLowerCase()] ?? 0;
    if (sevA !== sevB) return sevB - sevA;

    return (Number(b.score) || 0) - (Number(a.score) || 0);
  });
}

function groupRowsByFamily(rows: any[]) {
  const map = new Map<string, any[]>();

  for (const row of rows) {
    const family = firstNonEmpty(row.family, row.part, "Other");
    if (!map.has(family)) map.set(family, []);
    map.get(family)!.push(row);
  }

  return Array.from(map.entries())
    .map(([family, familyRows]) => ({
      family,
      rows: sortByPriority(familyRows),
    }))
    .sort((a, b) => {
      const aWorst = Math.max(...a.rows.map((r: any) => Number(r.score) || 0), 0);
      const bWorst = Math.max(...b.rows.map((r: any) => Number(r.score) || 0), 0);
      if (aWorst !== bWorst) return bWorst - aWorst;
      return a.family.localeCompare(b.family);
    });
}

/* ---------------- DRAW HELPERS ---------------- */

function resetCursor(doc: PDFKit.PDFDocument) {
  doc.x = doc.page.margins.left;
}

function measureText(
  doc: PDFKit.PDFDocument,
  text: string,
  width: number,
  font: "R" | "B" = "R",
  size = 10,
  lineGap = 0
) {
  doc.font(font).fontSize(size);
  return doc.heightOfString(text || "", { width, lineGap });
}

function drawHeader(doc: PDFKit.PDFDocument, title: string) {
  const pageWidth = doc.page.width;
  const headerH = 86;

  doc.save();
  doc.rect(0, 0, pageWidth, headerH).fill(COLORS.header);
  doc.rect(0, headerH - 6, pageWidth, 6).fill(COLORS.header2);

  doc.fillColor(COLORS.white).font("B").fontSize(18);
  doc.text(title, doc.page.margins.left, 24, {
    width: pageWidth - doc.page.margins.left - doc.page.margins.right,
  });

  doc.fillColor("#DCE7F1").font("R").fontSize(10);
  doc.text(
    "Automated compliance red-flag assessment (Fire Safety)",
    doc.page.margins.left,
    50
  );
  doc.restore();

  doc.y = headerH + 22;
  resetCursor(doc);
}

function drawBadge(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  text: string,
  color: string
) {
  doc.save();
  doc.font("B").fontSize(9);
  const w = doc.widthOfString(text) + 18;
  const h = 18;

  doc.roundedRect(x, y, w, h, 9).fill(color);
  doc.fillColor(COLORS.white);
  doc.text(text, x + 9, y + 4, { lineBreak: false });
  doc.restore();

  return w;
}

function drawSummaryCard(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  accent: string
) {
  doc.save();
  doc.roundedRect(x, y, w, h, 10).fill(COLORS.white).strokeColor(COLORS.line).stroke();
  doc.rect(x, y, 6, h).fill(accent);

  doc.fillColor(COLORS.muted).font("R").fontSize(10);
  doc.text(label, x + 14, y + 11, { width: w - 20 });

  doc.fillColor(COLORS.ink).font("B").fontSize(19);
  doc.text(value, x + 14, y + 30, { width: w - 20 });
  doc.restore();
}

function drawSectionTitle(doc: PDFKit.PDFDocument, title: string) {
  const needed = 40;
  const usableBottom = doc.page.height - doc.page.margins.bottom;

  if (doc.y + needed > usableBottom) {
    doc.addPage();
    drawHeader(doc, "Compliance Results (continued)");
  }

  resetCursor(doc);
  doc.moveDown(0.2);
  doc.fillColor(COLORS.ink).font("B").fontSize(12).text(title);
  doc.moveDown(0.35);

  const x = doc.page.margins.left;
  const w = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  doc
    .moveTo(x, doc.y)
    .lineTo(x + w, doc.y)
    .strokeColor(COLORS.line)
    .lineWidth(1)
    .stroke();

  doc.moveDown(0.75);
  resetCursor(doc);
}

function drawBarChart(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  items: { label: string; value: number; color: string }[]
) {
  doc.save();
  doc.roundedRect(x, y, w, h, 10).fill(COLORS.white).strokeColor(COLORS.line).stroke();

  doc.fillColor(COLORS.ink).font("B").fontSize(11);
  doc.text("Status distribution", x + 14, y + 12);

  const max = Math.max(1, ...items.map((i) => i.value));
  const barX = x + 14;
  const barW = w - 28;
  let cy = y + 38;

  for (const it of items) {
    doc.fillColor(COLORS.muted).font("R").fontSize(10);
    doc.text(`${it.label}: ${it.value}`, barX, cy);

    const trackY = cy + 14;
    doc.roundedRect(barX, trackY, barW, 10, 5).fill("#E5E7EB");
    const fillW = Math.round((barW * it.value) / max);
    doc.roundedRect(barX, trackY, fillW, 10, 5).fill(it.color);

    cy += 30;
  }

  doc.restore();
}

function drawTopFlagsBox(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  topFlags: any[]
) {
  const innerX = x + 14;
  const innerW = w - 28;

  doc.save();
  doc.roundedRect(x, y, w, h, 10).fill(COLORS.white).strokeColor(COLORS.line).stroke();
  doc.fillColor(COLORS.ink).font("B").fontSize(11);
  doc.text("Top red flags", innerX, y + 12);

  let cy = y + 34;

  if (topFlags.length === 0) {
    doc.fillColor(COLORS.muted).font("R").fontSize(10);
    doc.text("No FAIL results found.", innerX, cy, { width: innerW });
    doc.restore();
    return;
  }

  for (const r of topFlags) {
    const ruleId = firstNonEmpty(r.ruleId, "").slice(0, 60);
    const sev = severityFromScore(Number(r.score) || 0);
    const scoreText = `Score: ${Number(r.score) || 0}`;
    const preview =
      asStringArray(
        r.missingMitigation ??
          r.missingMitigations ??
          r.mitigationMissing ??
          r.mitigations ??
          r.mitigation
      )[0] || "";

    const ruleIdH = measureText(doc, ruleId, innerW, "B", 10);
    const previewH = preview
      ? measureText(doc, preview.slice(0, 120), innerW, "R", 8.5, 1)
      : 0;

    const blockH = ruleIdH + 20 + (preview ? previewH + 8 : 0) + 12;
    if (cy + blockH > y + h - 10) break;

    doc.fillColor(COLORS.ink).font("B").fontSize(10);
    doc.text(ruleId, innerX, cy, { width: innerW });
    cy += ruleIdH + 4;

    const badgeW = drawBadge(doc, innerX, cy, sev, statusColor("FAIL"));

    doc.fillColor(COLORS.muted).font("R").fontSize(9);
    doc.text(scoreText, innerX + badgeW + 10, cy + 3, {
      width: innerW - badgeW - 10,
    });
    cy += 22;

    if (preview) {
      doc.fillColor(COLORS.muted).font("R").fontSize(8.5);
      doc.text(preview.slice(0, 120), innerX, cy, {
        width: innerW,
        lineGap: 1,
      });
      cy += previewH + 8;
    }

    cy += 4;
  }

  doc.restore();
}

/* ---------------- DATA LOADING ---------------- */

async function loadDocumentFilenames(
  supabase: ReturnType<typeof getSupabase>,
  documentIds: string[]
) {
  if (!documentIds.length) return [];

  const { data, error } = await supabase
    .from("documents")
    .select("id, filename, storage_path")
    .in("id", documentIds);

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    filename: firstNonEmpty(row.filename, row.storage_path, "Unknown file"),
  }));
}

async function fetchCompliancePayload(
  req: NextRequest,
  documentId: string | null,
  batchId: string | null
): Promise<ComplianceApiResponse> {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const baseUrl = host ? `${proto}://${host}` : "http://localhost:3000";

  const query = batchId
    ? `/api/compliance?batch_id=${encodeURIComponent(batchId)}`
    : `/api/compliance?document_id=${encodeURIComponent(documentId || "")}`;

  const res = await fetch(`${baseUrl}${query}`, { cache: "no-store" });

  let payload: ComplianceApiResponse | null = null;
  try {
    payload = (await res.json()) as ComplianceApiResponse;
  } catch {
    payload = null;
  }

  if (!res.ok || !payload?.ok) {
    throw new Error(
      payload?.message ||
        `Compliance API failed (${res.status}) for ${batchId ? "batch" : "document"} report generation.`
    );
  }

  return payload;
}

/* ---------------- ROUTE ---------------- */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const document_id = searchParams.get("document_id");
    const batch_id = searchParams.get("batch_id");

    if (!document_id && !batch_id) {
      return NextResponse.json(
        { error: "document_id or batch_id required" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const compliance = await fetchCompliancePayload(req, document_id, batch_id);

    const rows = sortByPriority(
      Array.isArray(compliance.rules) ? compliance.rules : []
    );

    const fails = rows.filter((r: any) => r.status === "FAIL");
    const unknown = rows.filter((r: any) => r.status === "UNKNOWN");
    const pass = rows.filter((r: any) => r.status === "PASS");

    const failFamilies = groupRowsByFamily(fails);
    const unknownFamilies = groupRowsByFamily(unknown);
    const passFamilies = groupRowsByFamily(pass);

    const summary = {
      total:
        compliance.summary?.totalRules ??
        rows.length,
      fail:
        compliance.summary?.fail ??
        fails.length,
      unknown:
        compliance.summary?.unknown ??
        unknown.length,
      pass:
        compliance.summary?.pass ??
        pass.length,
      complianceScore:
        compliance.summary?.complianceScore ?? 0,
      completenessScore:
        compliance.summary?.completenessScore ?? 0,
    };

    const effectiveDocumentIds = Array.isArray(compliance.document_ids)
      ? compliance.document_ids
      : document_id
      ? [document_id]
      : [];

    const filenames = await loadDocumentFilenames(supabase, effectiveDocumentIds);

    const topFlags = [...fails]
      .sort((a, b) => (Number(b.score) || 0) - (Number(a.score) || 0))
      .slice(0, 6);

    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: {
        Title: batch_id
          ? `Fire Safety Compliance Batch Report - ${batch_id}`
          : `Fire Safety Compliance Report - ${document_id}`,
        Author: "Fire Safety Compliance Engine",
      },
    });

    registerFonts(doc);

    const addNewPage = (title = "Compliance Results (continued)") => {
      doc.addPage();
      drawHeader(doc, title);
      resetCursor(doc);
    };

    const ensureSpace = (
      minHeight: number,
      nextTitle = "Compliance Results (continued)"
    ) => {
      const usableBottom = doc.page.height - doc.page.margins.bottom;
      if (doc.y + minHeight > usableBottom) {
        addNewPage(nextTitle);
      }
    };

    /* ---------------- PAGE 1: SUMMARY ---------------- */

    drawHeader(
      doc,
      batch_id ? "Fire Safety Batch Compliance Report" : "Fire Safety Compliance Report"
    );
    resetCursor(doc);

    doc.fillColor(COLORS.ink).font("R").fontSize(11);

    if (batch_id) {
      doc.text(`Batch ID: ${batch_id}`);
      doc.text(`Documents in batch: ${effectiveDocumentIds.length}`);
    }

    if (document_id) {
      doc.text(`Document ID: ${document_id}`);
    }

    if (filenames.length > 0) {
      doc.moveDown(0.2);
      doc.fillColor(COLORS.muted).font("R").fontSize(10);
      doc.text("Included files:");
      doc.fillColor(COLORS.ink).font("R").fontSize(10);
      filenames.slice(0, 10).forEach((file) => {
        doc.text(`• ${file.filename}`);
      });
      if (filenames.length > 10) {
        doc.text(`• +${filenames.length - 10} more file(s)`);
      }
    }

    doc.moveDown(0.3);
    resetCursor(doc);
    doc.fillColor(COLORS.ink).font("R").fontSize(11);
    doc.text(`Analysis Date: ${new Date().toLocaleString()}`);

    doc.moveDown(0.6);
    resetCursor(doc);
    doc.fillColor(COLORS.muted).font("R").fontSize(10).text("Prepared by:");
    doc.fillColor(COLORS.ink).font("B").fontSize(12).text("Fire Safety Compliance Engine");
    doc.moveDown(1.1);

    const x0 = doc.page.margins.left;
    const y0 = doc.y;
    const gap = 12;
    const cardW =
      (doc.page.width - doc.page.margins.left - doc.page.margins.right - gap * 3) /
      4;
    const cardH = 64;

    drawSummaryCard(
      doc,
      x0 + (cardW + gap) * 0,
      y0,
      cardW,
      cardH,
      "Total rules",
      `${summary.total}`,
      COLORS.header2
    );
    drawSummaryCard(
      doc,
      x0 + (cardW + gap) * 1,
      y0,
      cardW,
      cardH,
      "FAIL",
      `${summary.fail}`,
      COLORS.fail
    );
    drawSummaryCard(
      doc,
      x0 + (cardW + gap) * 2,
      y0,
      cardW,
      cardH,
      "UNKNOWN",
      `${summary.unknown}`,
      COLORS.unknown
    );
    drawSummaryCard(
      doc,
      x0 + (cardW + gap) * 3,
      y0,
      cardW,
      cardH,
      "PASS",
      `${summary.pass}`,
      COLORS.pass
    );

    doc.y = y0 + cardH + 18;
    resetCursor(doc);

    doc.fillColor(COLORS.ink).font("B").fontSize(13).text("Executive Summary");
    doc.moveDown(0.35);
    resetCursor(doc);

    const overall_score = Number(summary.complianceScore) || 0;
    const completeness_score = Number(summary.completenessScore) || 0;

    const rating =
      overall_score >= 80
        ? "Low Risk"
        : overall_score >= 60
        ? "Moderate Risk"
        : overall_score >= 40
        ? "High Risk"
        : "Critical Risk";

    const ratingColor =
      overall_score >= 80
        ? COLORS.pass
        : overall_score >= 60
        ? COLORS.unknown
        : COLORS.fail;

    doc.fillColor(COLORS.muted).font("R").fontSize(10).text("Overall compliance score");
    doc.fillColor(COLORS.ink).font("B").fontSize(24).text(`${overall_score}/100`);
    doc.moveDown(0.15);
    resetCursor(doc);
    doc.fillColor(COLORS.muted).font("R").fontSize(10).text(`Risk rating: ${rating}`);
    drawBadge(doc, x0, doc.y + 8, rating, ratingColor);
    doc.moveDown(2.1);

    doc.fillColor(COLORS.muted).font("R").fontSize(10);
    doc.text(`Completeness score: ${completeness_score}/100`);
    doc.moveDown(0.3);
    resetCursor(doc);
    doc
      .fillColor(COLORS.muted)
      .font("R")
      .fontSize(9)
      .text(
        "Results are based on provided inputs; missing or incomplete data may lead to UNKNOWN classifications requiring further review.",
        {
          width:
            doc.page.width - doc.page.margins.left - doc.page.margins.right,
          lineGap: 2,
        }
      );
    doc.moveDown(0.7);

    const chartY = doc.y;
    const chartW =
      (doc.page.width - doc.page.margins.left - doc.page.margins.right - 16) / 2;
    const chartH = 150;

    drawBarChart(doc, x0, chartY, chartW, chartH, [
      { label: "FAIL", value: fails.length, color: COLORS.fail },
      { label: "UNKNOWN", value: unknown.length, color: COLORS.unknown },
      { label: "PASS", value: pass.length, color: COLORS.pass },
    ]);

    const topBoxX = x0 + chartW + 16;
    drawTopFlagsBox(doc, topBoxX, chartY, chartW, chartH, topFlags);

    doc.y = chartY + chartH + 12;
    resetCursor(doc);

    /* ---------------- PAGE 2: FAMILY OVERVIEW ---------------- */

    addNewPage("Family Overview");
    resetCursor(doc);

    const familySummary = (() => {
      const families = groupRowsByFamily(rows);
      return families.map((f) => ({
        family: f.family,
        total: f.rows.length,
        fail: f.rows.filter((r: any) => r.status === "FAIL").length,
        unknown: f.rows.filter((r: any) => r.status === "UNKNOWN").length,
        pass: f.rows.filter((r: any) => r.status === "PASS").length,
      }));
    })();

    const tableX = doc.page.margins.left;
    const totalW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const rowH = 24;
    const col1 = Math.round(totalW * 0.46);
    const col2 = Math.round(totalW * 0.14);
    const col3 = Math.round(totalW * 0.14);
    const col4 = Math.round(totalW * 0.14);
    const col5 = totalW - col1 - col2 - col3 - col4;

    const drawTableRow = (y: number, cells: string[], header = false) => {
      const cols = [col1, col2, col3, col4, col5];
      let cx = tableX;

      for (let i = 0; i < cols.length; i++) {
        doc.save();
        doc.rect(cx, y, cols[i], rowH)
          .fill(header ? COLORS.soft : COLORS.white)
          .strokeColor(COLORS.line)
          .stroke();

        doc.fillColor(header ? COLORS.ink : COLORS.muted)
          .font(header ? "B" : "R")
          .fontSize(9)
          .text(cells[i], cx + 8, y + 7, {
            width: cols[i] - 16,
            ellipsis: true,
          });

        doc.restore();
        cx += cols[i];
      }
    };

    drawTableRow(doc.y, ["Family", "FAIL", "UNKNOWN", "PASS", "TOTAL"], true);
    doc.y += rowH;

    for (const fam of familySummary) {
      ensureSpace(rowH + 4, "Family Overview (continued)");
      drawTableRow(doc.y, [
        fam.family,
        String(fam.fail),
        String(fam.unknown),
        String(fam.pass),
        String(fam.total),
      ]);
      doc.y += rowH;
      resetCursor(doc);
    }

    doc.moveDown(0.8);
    resetCursor(doc);

    /* ---------------- PAGE 3+: RESULTS ---------------- */

    addNewPage("Compliance Results Overview");
    resetCursor(doc);

    doc.fillColor(COLORS.muted).font("R").fontSize(10);
    doc.text("Grouped view of evaluated rules by status and rule family.");
    doc.moveDown(0.7);
    resetCursor(doc);

    const renderFamilySection = (
      title: string,
      families: { family: string; rows: any[] }[],
      section: "FAIL" | "PASS" | "UNKNOWN"
    ) => {
      drawSectionTitle(doc, title);

      if (!families.length) {
        resetCursor(doc);
        doc.fillColor(COLORS.muted).font("R").fontSize(10);
        doc.text(`No ${title.toLowerCase()} found.`);
        doc.moveDown(0.8);
        resetCursor(doc);
        return;
      }

      for (const fam of families) {
        ensureSpace(40);
        resetCursor(doc);
        doc.fillColor(COLORS.ink).font("B").fontSize(11).text(fam.family);
        doc.fillColor(COLORS.muted).font("R").fontSize(9);
        doc.text(`${fam.rows.length} item(s) • ${section}`);
        doc.moveDown(0.4);
        resetCursor(doc);

        for (const r of fam.rows) {
          const status: RuleStatus = firstNonEmpty(r.status, "UNKNOWN") as RuleStatus;
          const score = Number(r.score) || 0;
          const ruleId = firstNonEmpty(r.ruleId, r.rule_id, r.id, "UNKNOWN_RULE");
          const ruleTitle = firstNonEmpty(r.title, r.ruleTitle, "Untitled rule");
          const part = firstNonEmpty(r.part, "-");
          const family = firstNonEmpty(r.family, "Other");
          const severity = firstNonEmpty(r.severity, "-");
          const reason = firstNonEmpty(
            r.reason,
            r.explanation,
            status === "PASS" ? "Compliant based on extracted facts." : "No reason provided."
          );

          const mitigations = asStringArray(
            r.missingMitigation ??
              r.missingMitigations ??
              r.mitigationMissing ??
              r.mitigations ??
              r.mitigationSteps ??
              r.mitigation ??
              r.mitigationStrategy ??
              r.recommendation
          ).slice(0, 4);

          const contentW =
            doc.page.width - doc.page.margins.left - doc.page.margins.right - 28;
          const metaLine = `Part: ${part} • Family: ${family} • Severity: ${severity}`;

          const ruleIdH = measureText(doc, ruleId, contentW, "B", 11);
          const badgeBlockH = 24;
          const ruleTitleH = measureText(doc, ruleTitle, contentW, "R", 11);
          const metaH = measureText(doc, metaLine, contentW, "R", 10);
          const reasonH = measureText(doc, reason, contentW, "R", 10, 2);

          const mitigationHeading =
            section === "PASS"
              ? "Compliance"
              : section === "UNKNOWN"
              ? "Missing info / action"
              : "Mitigation";

          const mitigationLines =
            section === "PASS"
              ? ["No mitigation required (PASS)."]
              : mitigations.length
              ? mitigations.map((m) => `• ${m}`)
              : [
                  section === "UNKNOWN"
                    ? "Insufficient information / not provided."
                    : "Not provided.",
                ];

          const mitigationHeadingH = 14;
          const mitigationLinesH = mitigationLines.reduce(
            (sum, line) => sum + measureText(doc, line, contentW, "R", 10, 2) + 4,
            0
          );

          const topPad = 12;
          const bottomPad = 12;

          const boxHeight =
            topPad +
            ruleIdH +
            8 +
            badgeBlockH +
            8 +
            ruleTitleH +
            8 +
            metaH +
            8 +
            reasonH +
            10 +
            mitigationHeadingH +
            mitigationLinesH +
            bottomPad;

          ensureSpace(boxHeight);

          const boxX = doc.page.margins.left;
          const boxY = doc.y;
          const boxW = doc.page.width - doc.page.margins.left - doc.page.margins.right;

          doc.save();
          doc.roundedRect(boxX, boxY, boxW, boxHeight, 10)
            .fill(COLORS.white)
            .strokeColor(COLORS.line)
            .stroke();
          doc.rect(boxX, boxY, 7, boxHeight).fill(statusColor(status));
          doc.restore();

          let cy = boxY + topPad;
          const tx = boxX + 16;

          doc.fillColor(COLORS.ink).font("B").fontSize(11);
          doc.text(ruleId, tx, cy, { width: contentW });
          cy += ruleIdH + 8;

          const badge1 = drawBadge(doc, tx, cy, status, statusColor(status));
          drawBadge(doc, tx + badge1 + 10, cy, severityFromScore(score), statusColor(status));

          doc.fillColor(COLORS.muted).font("R").fontSize(10);
          doc.text(`Score: ${score}`, tx + 215, cy + 3);
          cy += badgeBlockH;

          doc.fillColor(COLORS.ink).font("R").fontSize(11);
          doc.text(ruleTitle, tx, cy, { width: contentW });
          cy += ruleTitleH + 8;

          doc.fillColor(COLORS.muted).font("R").fontSize(10);
          doc.text(metaLine, tx, cy, { width: contentW });
          cy += metaH + 8;

          doc.fillColor(COLORS.ink).font("R").fontSize(10);
          doc.text(reason, tx, cy, { width: contentW, lineGap: 2 });
          cy += reasonH + 10;

          doc.fillColor(COLORS.ink).font("B").fontSize(10);
          doc.text(mitigationHeading, tx, cy);
          cy += mitigationHeadingH;

          doc.fillColor(COLORS.ink).font("R").fontSize(10);
          for (const line of mitigationLines) {
            const lineH = measureText(doc, line, contentW, "R", 10, 2);
            doc.text(line, tx, cy, { width: contentW, lineGap: 2 });
            cy += lineH + 4;
          }

          doc.y = boxY + boxHeight + 12;
          resetCursor(doc);
        }
      }
    };

    renderFamilySection("Red Flags", failFamilies, "FAIL");
    renderFamilySection("Missing Information", unknownFamilies, "UNKNOWN");
    renderFamilySection("Green Flags", passFamilies, "PASS");

    const buffer = await buildBuffer(doc);

    const outputId = batch_id || document_id || "report";
    const filename = batch_id
      ? `fire-safety-batch-report-${outputId}.pdf`
      : `fire-safety-report-${outputId}.pdf`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "PDF generation failed", details: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}