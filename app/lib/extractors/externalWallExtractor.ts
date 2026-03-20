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
    extractor: "external_wall.v1",
    timestamp: nowIso(),
  };
}

function extractFirstNumber(patterns: RegExp[], text: string): number | undefined {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const n = Number(match[1].replace(/,/g, ""));
      if (Number.isFinite(n)) return n;
    }
  }
  return undefined;
}

function pushNumIfDefined(
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
  confidence = 0.84
) {
  if (patterns.some((p) => p.test(text))) {
    out.push(makeClaim(key, true, confidence, chunk, text));
  }
}

function pushTextIfMatched(
  out: FactClaim[],
  key: string,
  options: Array<{ value: string; patterns: RegExp[]; confidence?: number }>,
  text: string,
  chunk: TextChunk
) {
  for (const option of options) {
    if (option.patterns.some((p) => p.test(text))) {
      out.push(makeClaim(key, option.value, option.confidence ?? 0.82, chunk, text));
      return;
    }
  }
}

export const externalWallExtractor: FactExtractor = {
  id: "external_wall.v1",

  async run(ctx: ExtractorContext): Promise<FactClaim[]> {
    const claims: FactClaim[] = [];

    for (const chunk of ctx.chunks) {
      const text = chunk.text;

      pushNumIfDefined(
        claims,
        "boundaryDistanceMm",
        extractFirstNumber(
          [
            /\bboundary distance\s*[:=]?\s*([\d.]+)\s*mm\b/i,
            /\bdistance to boundary\s*[:=]?\s*([\d.]+)\s*mm\b/i,
            /\brelevant boundary\s*[:=]?\s*([\d.]+)\s*mm\b/i,
          ],
          text
        ),
        0.9,
        chunk,
        text
      );

      pushNumIfDefined(
        claims,
        "boundaryDistanceMeters",
        extractFirstNumber(
          [
            /\bboundary distance\s*[:=]?\s*([\d.]+)\s*m\b/i,
            /\bdistance to boundary\s*[:=]?\s*([\d.]+)\s*m\b/i,
          ],
          text
        ),
        0.82,
        chunk,
        text
      );

      pushNumIfDefined(
        claims,
        "openingAreaM2",
        extractFirstNumber(
          [
            /\bopening area\s*[:=]?\s*([\d.]+)\s*m2\b/i,
            /\bopening area\s*[:=]?\s*([\d.]+)\s*m²\b/i,
            /\bunprotected area\s*[:=]?\s*([\d.]+)\s*m2\b/i,
            /\bunprotected area\s*[:=]?\s*([\d.]+)\s*m²\b/i,
          ],
          text
        ),
        0.86,
        chunk,
        text
      );

      pushNumIfDefined(
        claims,
        "calculatedMaxUnprotectedAreaM2",
        extractFirstNumber(
          [
            /\bmax(?:imum)? unprotected area\s*[:=]?\s*([\d.]+)\s*m2\b/i,
            /\bcalculated max unprotected area\s*[:=]?\s*([\d.]+)\s*m2\b/i,
            /\bpermitted unprotected area\s*[:=]?\s*([\d.]+)\s*m2\b/i,
            /\bmax(?:imum)? unprotected area\s*[:=]?\s*([\d.]+)\s*m²\b/i,
          ],
          text
        ),
        0.86,
        chunk,
        text
      );

      pushNumIfDefined(
        claims,
        "distanceToRelevantBoundaryMm",
        extractFirstNumber(
          [
            /\bdistance to relevant boundary\s*[:=]?\s*([\d.]+)\s*mm\b/i,
          ],
          text
        ),
        0.9,
        chunk,
        text
      );

      pushNumIfDefined(
        claims,
        "spandrelHeightMm",
        extractFirstNumber(
          [
            /\bspandrel height\s*[:=]?\s*([\d.]+)\s*mm\b/i,
          ],
          text
        ),
        0.88,
        chunk,
        text
      );

      pushNumIfDefined(
        claims,
        "minimumRequiredSpandrelHeightMm",
        extractFirstNumber(
          [
            /\bminimum required spandrel height\s*[:=]?\s*([\d.]+)\s*mm\b/i,
            /\brequired spandrel height\s*[:=]?\s*([\d.]+)\s*mm\b/i,
          ],
          text
        ),
        0.88,
        chunk,
        text
      );

      pushNumIfDefined(
        claims,
        "wallAngleDeg",
        extractFirstNumber(
          [
            /\bwall angle\s*[:=]?\s*([\d.]+)\s*deg\b/i,
            /\bwall angle\s*[:=]?\s*([\d.]+)\s*°/i,
          ],
          text
        ),
        0.78,
        chunk,
        text
      );

      pushTextIfMatched(
        claims,
        "roofCoveringDesignation",
        [
          { value: "BROOF(t4)", patterns: [/\bBROOF\s*\(t4\)\b/i] },
          { value: "BROOF", patterns: [/\bBROOF\b/i] },
          { value: "FROOF", patterns: [/\bFROOF\b/i] },
        ],
        text,
        chunk
      );

      pushTextIfMatched(
        claims,
        "roofCoveringClassification",
        [
          { value: "BROOF(t4)", patterns: [/\bBROOF\s*\(t4\)\b/i] },
          { value: "FROOF", patterns: [/\bFROOF\b/i] },
          { value: "AA", patterns: [/\bClass AA\b/i] },
          { value: "AB", patterns: [/\bClass AB\b/i] },
        ],
        text,
        chunk
      );

      pushTextIfMatched(
        claims,
        "roofMaterial",
        [
          { value: "metal", patterns: [/\bmetal roof\b/i, /\bsteel roof\b/i] },
          { value: "membrane", patterns: [/\bmembrane roof\b/i] },
          { value: "bituminous", patterns: [/\bbituminous\b/i] },
          { value: "tile", patterns: [/\btile(?:d)? roof\b/i] },
        ],
        text,
        chunk
      );

      pushTextIfMatched(
        claims,
        "claddingMaterial",
        [
          { value: "HPL", patterns: [/\bHPL\b/i, /\bhigh pressure laminate\b/i] },
          { value: "ACM", patterns: [/\bACM\b/i, /\baluminium composite material\b/i] },
          { value: "A1", patterns: [/\bA1\b/i] },
          { value: "A2-s1,d0", patterns: [/\bA2-s1,d0\b/i] },
          { value: "timber", patterns: [/\btimber cladding\b/i] },
        ],
        text,
        chunk
      );

      pushTextIfMatched(
        claims,
        "externalWallReactionToFireClass",
        [
          { value: "A1", patterns: [/\bclass A1\b/i] },
          { value: "A2-s1,d0", patterns: [/\bA2-s1,d0\b/i] },
          { value: "B-s3,d0", patterns: [/\bB-s3,d0\b/i] },
        ],
        text,
        chunk
      );

      pushBoolIfMatched(
        claims,
        "externalWallHasGlazedOrCurtainWallFacade",
        [/\bcurtain wall(?:ing)?\b/i, /\bglazed facade\b/i, /\bglazed façade\b/i],
        text,
        chunk,
        0.88
      );

      pushBoolIfMatched(
        claims,
        "spandrelPanelProvided",
        [/\bspandrel panel\b/i, /\bspandrel panels\b/i],
        text,
        chunk,
        0.88
      );

      pushBoolIfMatched(
        claims,
        "relevantBuildingFlag",
        [/\brelevant building\b/i],
        text,
        chunk,
        0.82
      );

      pushBoolIfMatched(
        claims,
        "cavityBarrierPresent",
        [/\bcavity barrier\b/i, /\bcavity barriers\b/i],
        text,
        chunk,
        0.8
      );
    }

    return claims;
  },
};