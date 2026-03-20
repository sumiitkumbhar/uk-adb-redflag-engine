// /app/api/missing-facts/route.ts
import { NextResponse } from "next/server";

type RuleRow = {
  ruleId?: string;
  status?: "PASS" | "FAIL" | "UNKNOWN" | string;
  reason?: string;
  score?: number;
};

type MissingFactItem = {
  fact: string;
  count: number;
  priority: "high" | "medium" | "low";
  examples: { ruleId?: string; reason?: string }[];
};

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "Missing Facts endpoint alive. Use POST with { rows: RuleRow[] }",
  });
}

/**
 * Extract fact name from reason strings such as:
 * - "heightTopStorey_m missing"
 * - "Missing heightTopStorey_m"
 * - "xxx missing; cannot determine ..."
 */
function extractMissingFact(reason?: string): string | null {
  if (!reason || typeof reason !== "string") return null;

  // 1) "heightTopStorey_m missing"
  let m = reason.match(/^([a-zA-Z0-9_]+)\s+missing\b/i);
  if (m) return m[1];

  // 2) "Missing heightTopStorey_m"
  m = reason.match(/^\s*Missing\s+([a-zA-Z0-9_]+)\b/i);
  if (m) return m[1];

  // 3) "... missing" somewhere in the string, still capture first token before "missing"
  m = reason.match(/\b([a-zA-Z0-9_]+)\s+missing\b/i);
  if (m) return m[1];

  return null;
}

/**
 * Canonicalize fact keys so you don't end up with duplicates like:
 * - heightTopStoreyM vs heightTopStorey_m vs height_top_storey_m
 * - boundaryDistance_mm vs boundaryDistanceMeters
 * - fireMainPresent vs fireMainsProvidedFlag vs fireMainsProvided
 */
function canonicalFactKey(input: string): string {
  const k = (input ?? "").trim();
  if (!k) return k;

  const map: Record<string, string> = {
    // Heights
    heightTopStoreyM: "heightTopStorey_m",
    heightTopStorey_m: "heightTopStorey_m",
    height_top_storey_m: "heightTopStorey_m",

    buildingHeightMeters: "buildingHeight_m",
    buildingHeight_m: "buildingHeight_m",
    buildingHeightMetres: "buildingHeight_m",
    buildingHeight: "buildingHeight_m",

    storeyheightm: "storeyHeightMax_m",
    storeyHeightMax_m: "storeyHeightMax_m",

    // Boundary distance (prefer meters canonical)
    boundaryDistance_mm: "boundaryDistance_m",
    boundaryDistanceMeters: "boundaryDistance_m",
    boundaryDistanceMetres: "boundaryDistance_m",

    // Fire mains (prefer fireMainsProvided)
    fireMainPresent: "fireMainsProvided",
    fireMainsProvidedFlag: "fireMainsProvided",
    fireMainsProvided: "fireMainsProvided",
    fireMainsProvided_: "fireMainsProvided",

    // Common flags
    isDwelling: "isDwellingFlag",
    isDwellingFlag: "isDwellingFlag",

    // Misc common variants you already saw
    heightTopStoreyM_: "heightTopStorey_m",
    heightTopStorey__m: "heightTopStorey_m",
  };

  // If already mapped, return mapped
  if (map[k]) return map[k];

  // Normalize some obvious casing differences without being aggressive
  // (don’t destroy your naming conventions)
  return k;
}

function priorityFromCount(count: number): "high" | "medium" | "low" {
  if (count >= 15) return "high";
  if (count >= 5) return "medium";
  return "low";
}

export async function POST(req: Request) {
  try {
    // Read raw body for better debugging + resilience to bad JSON
    const raw = await req.text();

    let body: any;
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch (e: any) {
      return NextResponse.json(
        {
          ok: false,
          error: "Invalid JSON body",
          details: e?.message ?? String(e),
          received: raw.slice(0, 300),
        },
        { status: 400 }
      );
    }

    const rowsAny = body?.rows;

    if (!Array.isArray(rowsAny)) {
      return NextResponse.json(
        {
          ok: false,
          error: "`rows` must be an array",
          receivedType: typeof rowsAny,
          received: rowsAny,
        },
        { status: 400 }
      );
    }

    const rows: RuleRow[] = rowsAny;

    const factCounts: Record<string, number> = {};
    const factExamples: Record<string, { ruleId?: string; reason?: string }[]> =
      {};

    let totalRows = 0;
    let totalUnknown = 0;

    for (const row of rows) {
      totalRows++;

      if (!row || row.status !== "UNKNOWN") continue;
      totalUnknown++;

      const factRaw = extractMissingFact(row.reason);
      if (!factRaw) continue;

      const fact = canonicalFactKey(factRaw);
      if (!fact) continue;

      factCounts[fact] = (factCounts[fact] ?? 0) + 1;

      if (!factExamples[fact]) factExamples[fact] = [];
      if (factExamples[fact].length < 3) {
        factExamples[fact].push({ ruleId: row.ruleId, reason: row.reason });
      }
    }

    const missingFacts: MissingFactItem[] = Object.entries(factCounts)
      .map(([fact, count]) => ({
        fact,
        count,
        priority: priorityFromCount(count),
        examples: factExamples[fact] ?? [],
      }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      ok: true,
      summary: {
        totalRows,
        totalUnknown,
        uniqueMissingFacts: missingFacts.length,
      },
      missingFacts,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "Failed to analyse missing facts",
        details: err?.message ?? String(err),
      },
      { status: 500 }
    );
  }
}