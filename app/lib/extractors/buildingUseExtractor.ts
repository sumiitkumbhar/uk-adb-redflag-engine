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
    extractor: "building_use.v1",
    timestamp: nowIso(),
  };
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
      out.push(makeClaim(key, option.value, option.confidence ?? 0.84, chunk, text));
      return;
    }
  }
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

export const buildingUseExtractor: FactExtractor = {
  id: "building_use.v1",

  async run(ctx: ExtractorContext): Promise<FactClaim[]> {
    const claims: FactClaim[] = [];

    for (const chunk of ctx.chunks) {
      const text = chunk.text;

      pushTextIfMatched(
        claims,
        "buildingUse",
        [
          {
            value: "flats",
            patterns: [
              /\bblock of flats\b/i,
              /\bflats\b/i,
              /\bapartment(?:s)?\b/i,
            ],
            confidence: 0.92,
          },
          {
            value: "dwelling",
            patterns: [
              /\bdwellinghouse\b/i,
              /\bdwelling\b/i,
              /\bhouse\b/i,
              /\bhousehold\b/i,
            ],
            confidence: 0.9,
          },
          {
            value: "hotel",
            patterns: [/\bhotel\b/i, /\bhostel\b/i, /\bboarding\b/i],
            confidence: 0.9,
          },
          {
            value: "office",
            patterns: [/\boffice\b/i, /\boffices\b/i],
            confidence: 0.88,
          },
          {
            value: "shop",
            patterns: [/\bshop\b/i, /\bretail\b/i, /\bstore\b/i],
            confidence: 0.86,
          },
          {
            value: "industrial",
            patterns: [/\bindustrial\b/i, /\bwarehouse\b/i, /\bfactory\b/i],
            confidence: 0.86,
          },
          {
            value: "assembly",
            patterns: [/\bassembly\b/i, /\bschool\b/i, /\beducation\b/i],
            confidence: 0.82,
          },
        ],
        text,
        chunk
      );

      pushTextIfMatched(
        claims,
        "purposeGroup",
        [
          { value: "2(b)", patterns: [/\bblock of flats\b/i, /\bflats\b/i, /\bapartment(?:s)?\b/i], confidence: 0.92 },
          { value: "2(a)", patterns: [/\bhotel\b/i, /\bhostel\b/i, /\bboarding\b/i], confidence: 0.9 },
          { value: "3", patterns: [/\boffice\b/i, /\boffices\b/i], confidence: 0.88 },
          { value: "4", patterns: [/\bshop\b/i, /\bretail\b/i, /\bstore\b/i], confidence: 0.86 },
          { value: "5", patterns: [/\bassembly\b/i, /\bschool\b/i, /\beducation\b/i], confidence: 0.82 },
          { value: "6", patterns: [/\bindustrial\b/i, /\bwarehouse\b/i, /\bfactory\b/i], confidence: 0.82 },
        ],
        text,
        chunk
      );

      pushTextIfMatched(
        claims,
        "dwellingType",
        [
          { value: "flat", patterns: [/\bflat\b/i, /\bapartment\b/i], confidence: 0.92 },
          { value: "house", patterns: [/\bhouse\b/i, /\bdwellinghouse\b/i], confidence: 0.9 },
        ],
        text,
        chunk
      );

      pushBoolIfMatched(
        claims,
        "hasFlats",
        [/\bblock of flats\b/i, /\bflats\b/i, /\bapartment(?:s)?\b/i],
        text,
        chunk,
        0.92
      );

      pushBoolIfMatched(
        claims,
        "flatUnitFlag",
        [/\bflat\b/i, /\bapartment\b/i, /\bself-contained flat\b/i],
        text,
        chunk,
        0.9
      );

      pushBoolIfMatched(
        claims,
        "isDwellingFlag",
        [/\bdwelling\b/i, /\bdwellinghouse\b/i, /\bhouse\b/i],
        text,
        chunk,
        0.88
      );

      pushBoolIfMatched(
        claims,
        "sleepingAccommodation",
        [
          /\bbedroom\b/i,
          /\bsleeping accommodation\b/i,
          /\bhotel\b/i,
          /\bhostel\b/i,
          /\bflat\b/i,
          /\bapartment\b/i,
        ],
        text,
        chunk,
        0.88
      );
    }

    return claims;
  },
};