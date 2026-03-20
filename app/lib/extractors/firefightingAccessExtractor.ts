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
    extractor: "firefighting_access.v1",
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

export const firefightingAccessExtractor: FactExtractor = {
  id: "firefighting_access.v1",

  async run(ctx: ExtractorContext): Promise<FactClaim[]> {
    const claims: FactClaim[] = [];

    for (const chunk of ctx.chunks) {
      const text = chunk.text;

      pushBoolIfMatched(
        claims,
        "fireMainPresent",
        [/\bfire main\b/i, /\brising main\b/i, /\bdry riser\b/i, /\bwet riser\b/i],
        text,
        chunk,
        0.9
      );

      pushBoolIfMatched(
        claims,
        "fireMainsPresent",
        [/\bfire mains\b/i, /\brising main\b/i, /\bdry riser\b/i, /\bwet riser\b/i],
        text,
        chunk,
        0.84
      );

      pushBoolIfMatched(
        claims,
        "risingMainPresent",
        [/\brising main\b/i, /\bdry riser\b/i, /\bwet riser\b/i],
        text,
        chunk,
        0.9
      );

      pushBoolIfMatched(
        claims,
        "firefightingShaftPresent",
        [/\bfirefighting shaft\b/i, /\bfire fighting shaft\b/i],
        text,
        chunk,
        0.92
      );

      pushBoolIfMatched(
        claims,
        "firefightingShaftProvided",
        [/\bfirefighting shaft\b/i, /\bfire fighting shaft\b/i],
        text,
        chunk,
        0.88
      );

      pushBoolIfMatched(
        claims,
        "protectedLobbyPresent",
        [/\bprotected lobby\b/i, /\bfirefighting lobby\b/i, /\bfire fighting lobby\b/i],
        text,
        chunk,
        0.88
      );

      pushBoolIfMatched(
        claims,
        "fireMainInletSignPresent",
        [/\binlet signage\b/i, /\bfire main inlet sign\b/i, /\bdry riser inlet sign\b/i],
        text,
        chunk,
        0.84
      );

      pushBoolIfMatched(
        claims,
        "fireMainInletVisibleFromRoad",
        [/\bvisible from road\b/i, /\bvisible from access road\b/i, /\bvisible from appliance access\b/i],
        text,
        chunk,
        0.76
      );

      pushBoolIfMatched(
        claims,
        "fireServiceVehicleAccessProvided",
        [/\bfire service access\b/i, /\bappliance access\b/i, /\bvehicle access\b/i],
        text,
        chunk,
        0.82
      );

      pushBoolIfMatched(
        claims,
        "pumpApplianceAccessProvided",
        [/\bpump appliance access\b/i, /\bappliance access provided\b/i],
        text,
        chunk,
        0.84
      );

      pushNumIfDefined(
        claims,
        "distanceToNearestPublicHydrantM",
        extractFirstNumber(
          [
            /\bdistance to nearest public hydrant\s*[:=]?\s*([\d.]+)\s*m\b/i,
            /\bnearest hydrant\s*[:=]?\s*([\d.]+)\s*m\b/i,
          ],
          text
        ),
        0.88,
        chunk,
        text
      );

      pushNumIfDefined(
        claims,
        "hoseDistanceMeters",
        extractFirstNumber(
          [
            /\bhose distance\s*[:=]?\s*([\d.]+)\s*m\b/i,
            /\bmax hose distance\s*[:=]?\s*([\d.]+)\s*m\b/i,
          ],
          text
        ),
        0.84,
        chunk,
        text
      );

      pushNumIfDefined(
        claims,
        "maxHosePathLengthM",
        extractFirstNumber(
          [
            /\bmax hose path length\s*[:=]?\s*([\d.]+)\s*m\b/i,
          ],
          text
        ),
        0.84,
        chunk,
        text
      );
    }

    return claims;
  },
};