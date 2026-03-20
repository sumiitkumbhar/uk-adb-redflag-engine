import type { FactClaim, FactExtractor, ExtractorContext, TextChunk } from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

function makeClaim(
  key: string,
  value: FactClaim["value"],
  confidence: number,
  chunk: TextChunk,
  evidence: string
): FactClaim {
  return {
    key,
    value,
    confidence,
    sourceType: "pdf",
    sourceRef: chunk.id,
    evidence: [evidence],
    extractor: "geometry.v1",
    timestamp: nowIso(),
  };
}

function extractNumber(text: string): number | undefined {
  const clean = text.replace(/,/g, "").trim();
  const n = Number(clean);
  return Number.isFinite(n) ? n : undefined;
}

function firstMatchNumber(patterns: RegExp[], text: string): number | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const value = extractNumber(match[1]);
      if (value !== undefined) return value;
    }
  }
  return undefined;
}

function pushIfDefined(
  out: FactClaim[],
  key: string,
  value: number | undefined,
  confidence: number,
  chunk: TextChunk,
  evidence: string
) {
  if (value === undefined) return;
  out.push(makeClaim(key, value, confidence, chunk, evidence));
}

function pushBoolIfMatched(
  out: FactClaim[],
  key: string,
  patterns: RegExp[],
  text: string,
  chunk: TextChunk,
  confidence = 0.82
) {
  if (patterns.some((p) => p.test(text))) {
    out.push(makeClaim(key, true, confidence, chunk, text));
  }
}

function detectStoreyCount(text: string): number | undefined {
  const explicit = firstMatchNumber(
    [
      /\bnumber of storeys?\s*[:=]?\s*(\d+)\b/i,
      /\bstoreys?\s*:\s*(\d+)\b/i,
      /\b(\d+)[- ]storey\b/i,
      /\b(\d+)[- ]story\b/i,
      /\b(\d+)\s+storeys?\b/i,
      /\bstoreys?\s+above ground\s*[:=]?\s*(\d+)\b/i,
      /\bfloors?\s+above ground\s*[:=]?\s*(\d+)\b/i,
    ],
    text
  );
  if (explicit !== undefined) return explicit;

  if (/\bsingle[- ]storey\b/i.test(text)) return 1;
  if (/\btwo[- ]storey\b/i.test(text)) return 2;
  if (/\bthree[- ]storey\b/i.test(text)) return 3;
  if (/\bfour[- ]storey\b/i.test(text)) return 4;
  if (/\bfive[- ]storey\b/i.test(text)) return 5;
  return undefined;
}

function detectBuildingHeightM(text: string): number | undefined {
  return firstMatchNumber(
    [
      /\bbuilding height\s*[:=]?\s*([\d.]+)\s*m\b/i,
      /\bheight of building\s*[:=]?\s*([\d.]+)\s*m\b/i,
      /\bheight to top(?:most)? storey\s*[:=]?\s*([\d.]+)\s*m\b/i,
      /\btop storey height\s*[:=]?\s*([\d.]+)\s*m\b/i,
      /\boverall height\s*[:=]?\s*([\d.]+)\s*m\b/i,
      /\bheight\s*[:=]?\s*([\d.]+)\s*m\b/i,
    ],
    text
  );
}

function detectHeightTopStoreyM(text: string): number | undefined {
  return firstMatchNumber(
    [
      /\bheight to top storey floor\s*[:=]?\s*([\d.]+)\s*m\b/i,
      /\btop storey floor level\s*[:=]?\s*([\d.]+)\s*m\b/i,
      /\bheight of top storey\s*[:=]?\s*([\d.]+)\s*m\b/i,
      /\btop floor height\s*[:=]?\s*([\d.]+)\s*m\b/i,
    ],
    text
  );
}

function detectFloorArea(text: string): number | undefined {
  return firstMatchNumber(
    [
      /\blargest storey area\s*[:=]?\s*([\d.]+)\s*m[2²]\b/i,
      /\bstorey area\s*[:=]?\s*([\d.]+)\s*m[2²]\b/i,
      /\bfloor area\s*[:=]?\s*([\d.,]+)\s*m[2²]\b/i,
      /\bgross floor area\s*[:=]?\s*([\d.,]+)\s*m[2²]\b/i,
      /\bGFA\s*[:=]?\s*([\d.,]+)\s*m[2²]\b/i,
      /\binternal floor area\s*[:=]?\s*([\d.,]+)\s*m[2²]\b/i,
    ],
    text
  );
}

function detectStairCount(text: string): number | undefined {
  const explicit = firstMatchNumber(
    [
      /\bnumber of staircases\s*[:=]?\s*(\d+)\b/i,
      /\bstaircases?\s*[:=]?\s*(\d+)\b/i,
      /\b(\d+)\s+staircases?\b/i,
      /\bstairs?\s*[:=]?\s*(\d+)\b/i,
      /\b(\d+)\s+escape stairs?\b/i,
      /\b(\d+)\s+common stairs?\b/i,
      /\b(\d+)\s+protected stairs?\b/i,
    ],
    text
  );
  if (explicit !== undefined) return explicit;

  if (/\bsingle stair\b/i.test(text)) return 1;
  if (/\btwo stairs\b/i.test(text)) return 2;
  if (/\bdouble stair\b/i.test(text)) return 2;
  if (/\bthree stairs\b/i.test(text)) return 3;
  return undefined;
}

function detectBoundaryDistanceM(text: string): number | undefined {
  return firstMatchNumber(
    [
      /\bdistance to (?:relevant )?boundary\s*[:=]?\s*([\d.]+)\s*m\b/i,
      /\bboundary distance\s*[:=]?\s*([\d.]+)\s*m\b/i,
      /\bdistance from boundary\s*[:=]?\s*([\d.]+)\s*m\b/i,
      /\brelevant boundary\s*[:=]?\s*([\d.]+)\s*m\b/i,
    ],
    text
  );
}

function detectBoundaryDistanceMm(text: string): number | undefined {
  return firstMatchNumber(
    [
      /\bdistance to (?:relevant )?boundary\s*[:=]?\s*([\d.]+)\s*mm\b/i,
      /\bboundary distance\s*[:=]?\s*([\d.]+)\s*mm\b/i,
    ],
    text
  );
}

function detectInternalFloorAreaM2(text: string): number | undefined {
  return firstMatchNumber(
    [
      /\binternal floor area\s*[:=]?\s*([\d.,]+)\s*m[2²]\b/i,
      /\bnet floor area\s*[:=]?\s*([\d.,]+)\s*m[2²]\b/i,
      /\bNIA\s*[:=]?\s*([\d.,]+)\s*m[2²]\b/i,
    ],
    text
  );
}

export const geometryExtractor: FactExtractor = {
  id: "geometry.v1",

  async run(ctx: ExtractorContext): Promise<FactClaim[]> {
    const claims: FactClaim[] = [];

    for (const chunk of ctx.chunks) {
      const text = chunk.text;

      // ── Building height ───────────────────────────────────────────────────
      const buildingHeight = detectBuildingHeightM(text);
      const heightTopStorey = detectHeightTopStoreyM(text) ?? buildingHeight;

      pushIfDefined(claims, "buildingHeightM", buildingHeight, 0.86, chunk, text);
      pushIfDefined(claims, "buildingHeight_m", buildingHeight, 0.83, chunk, text);
      pushIfDefined(claims, "buildingHeightMeters", buildingHeight, 0.8, chunk, text);
      pushIfDefined(claims, "topStoreyHeightM", buildingHeight, 0.72, chunk, text);
      pushIfDefined(claims, "topFloorHeightM", buildingHeight, 0.58, chunk, text);
      pushIfDefined(claims, "heightTopStoreyM", heightTopStorey, 0.82, chunk, text);
      pushIfDefined(claims, "height_top_storey_m", heightTopStorey, 0.79, chunk, text);
      pushIfDefined(claims, "maxStoreyAboveFRSAccessLevelM", heightTopStorey, 0.75, chunk, text);

      // ── Storey count ──────────────────────────────────────────────────────
      const storeys = detectStoreyCount(text);
      pushIfDefined(claims, "storeys", storeys, 0.9, chunk, text);
      pushIfDefined(claims, "storeyCount", storeys, 0.9, chunk, text);
      pushIfDefined(claims, "numberOfStoreys", storeys, 0.9, chunk, text);
      pushIfDefined(claims, "storeysAboveGroundCount", storeys, 0.88, chunk, text);
      pushIfDefined(claims, "floorsAboveGround", storeys, 0.82, chunk, text);
      pushIfDefined(claims, "storeysAboveGround", storeys, 0.82, chunk, text);

      // ── Floor areas ───────────────────────────────────────────────────────
      const floorArea = detectFloorArea(text);
      pushIfDefined(claims, "largestStoreyAreaM2", floorArea, 0.82, chunk, text);
      pushIfDefined(claims, "floorAreaM2", floorArea, 0.8, chunk, text);
      pushIfDefined(claims, "grossFloorAreaM2", floorArea, 0.75, chunk, text);

      const internalFloorArea = detectInternalFloorAreaM2(text);
      pushIfDefined(claims, "internalFloorAreaM2", internalFloorArea, 0.84, chunk, text);

      // ── Stair count ───────────────────────────────────────────────────────
      const stairCount = detectStairCount(text);
      pushIfDefined(claims, "numberOfStaircases", stairCount, 0.9, chunk, text);
      pushIfDefined(claims, "number_of_staircases", stairCount, 0.88, chunk, text);
      pushIfDefined(claims, "stairCount", stairCount, 0.9, chunk, text);
      pushIfDefined(claims, "escapeStairCount", stairCount, 0.85, chunk, text);
      pushIfDefined(claims, "commonStairCount", stairCount, 0.62, chunk, text);

      // ── Boundary distances ────────────────────────────────────────────────
      const boundaryM = detectBoundaryDistanceM(text);
      const boundaryMm = detectBoundaryDistanceMm(text);

      pushIfDefined(claims, "distanceToBoundaryM", boundaryM, 0.88, chunk, text);
      pushIfDefined(claims, "distanceToRelevantBoundaryM", boundaryM, 0.88, chunk, text);
      pushIfDefined(claims, "boundaryDistanceM", boundaryM, 0.85, chunk, text);
      pushIfDefined(claims, "distance_to_boundary_m", boundaryM, 0.83, chunk, text);
      pushIfDefined(claims, "distanceToRelevantBoundary_mm", boundaryMm, 0.88, chunk, text);
      pushIfDefined(claims, "boundaryDistanceMm", boundaryMm, 0.85, chunk, text);

      // ── Purpose group ─────────────────────────────────────────────────────
      const pgMatch = text.match(/\bpurpose group\s*[:=]?\s*([1-9][a-c]?\b)/i);
      if (pgMatch?.[1]) {
        claims.push(makeClaim("purposeGroup", pgMatch[1].toLowerCase(), 0.88, chunk, text));
        claims.push(makeClaim("purpose_group", pgMatch[1].toLowerCase(), 0.85, chunk, text));
      }

      // ── Building use / type ───────────────────────────────────────────────
      const useMatch = text.match(
        /\bbuilding (?:use|type|classification)\s*[:=]?\s*([A-Za-z\s/]+?)(?:\.|,|\n|$)/i
      );
      if (useMatch?.[1]?.trim()) {
        claims.push(makeClaim("buildingUse", useMatch[1].trim(), 0.76, chunk, text));
        claims.push(makeClaim("building_use", useMatch[1].trim(), 0.73, chunk, text));
      }

      // ── Basement ──────────────────────────────────────────────────────────
      pushBoolIfMatched(
        claims,
        "basementHabitableRoomsFlag",
        [/\bbasement.*habitable\b/i, /\bhabitable.*basement\b/i],
        text, chunk, 0.82
      );

      // ── Gallery ───────────────────────────────────────────────────────────
      pushBoolIfMatched(
        claims,
        "galleryPresentFlag",
        [/\bgallery\b/i, /\bmezzanine\b/i, /\bgallery floor\b/i],
        text, chunk, 0.78
      );

      // ── Open connection between floors ────────────────────────────────────
      pushBoolIfMatched(
        claims,
        "openConnectionPresent",
        [/\bopen.*between floors\b/i, /\bvoid between floors\b/i, /\batrium\b/i],
        text, chunk, 0.76
      );
    }

    return claims;
  },
};
