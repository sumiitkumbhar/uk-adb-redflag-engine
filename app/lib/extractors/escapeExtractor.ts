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
    extractor: "escape.v1",
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
  confidence = 0.82
) {
  if (patterns.some((p) => p.test(text))) {
    out.push(makeClaim(key, true, confidence, chunk, text));
  }
}

function pushBoolFalseIfMatched(
  out: FactClaim[],
  key: string,
  patterns: RegExp[],
  text: string,
  chunk: TextChunk,
  confidence = 0.72
) {
  if (patterns.some((p) => p.test(text))) {
    out.push(makeClaim(key, false, confidence, chunk, text));
  }
}

export const escapeExtractor: FactExtractor = {
  id: "escape.v1",

  async run(ctx: ExtractorContext): Promise<FactClaim[]> {
    const claims: FactClaim[] = [];

    for (const chunk of ctx.chunks) {
      const text = chunk.text;

      // ── Travel distances ──────────────────────────────────────────────────
      const singleDirectionDist = extractFirstNumber(
        [
          /\bsingle[- ]direction(?: travel)? distance\s*[:=]?\s*([\d.]+)\s*m\b/i,
          /\bone[- ]direction(?: travel)? distance\s*[:=]?\s*([\d.]+)\s*m\b/i,
          /\btravel distance.*?single.*?([\d.]+)\s*m\b/i,
        ],
        text
      );

      const nearestExitDist = extractFirstNumber(
        [
          /\btravel distance to nearest exit\s*[:=]?\s*([\d.]+)\s*m\b/i,
          /\btravel distance\s*[:=]?\s*([\d.]+)\s*m\b/i,
          /\bmax(?:imum)? travel distance\s*[:=]?\s*([\d.]+)\s*m\b/i,
          /\btravel dist(?:ance)?\s*[:=]?\s*([\d.]+)\s*m\b/i,
        ],
        text
      );

      const deadEndDist = extractFirstNumber(
        [
          /\bdead[- ]?end(?: corridor)?(?: length)?\s*[:=]?\s*([\d.]+)\s*m\b/i,
          /\bmax(?:imum)? dead[- ]?end\s*[:=]?\s*([\d.]+)\s*m\b/i,
        ],
        text
      );

      pushNumIfDefined(claims, "singleDirectionDistM", singleDirectionDist, 0.9, chunk, text);
      pushNumIfDefined(claims, "travelDistanceM", singleDirectionDist ?? nearestExitDist, 0.85, chunk, text);
      pushNumIfDefined(claims, "travelDistanceNearestExitM", nearestExitDist, 0.8, chunk, text);
      pushNumIfDefined(claims, "maxDeadEndCorridorLengthM", deadEndDist, 0.88, chunk, text);

      // ── Exit counts ───────────────────────────────────────────────────────
      const exitCount = extractFirstNumber(
        [
          /\bnumber of exits\s*[:=]?\s*(\d+)\b/i,
          /\b(\d+)\s+exits?\b/i,
        ],
        text
      );
      const finalExitCount = extractFirstNumber(
        [
          /\bfinal exits\s*[:=]?\s*(\d+)\b/i,
          /\bnumber of final exits\s*[:=]?\s*(\d+)\b/i,
          /\b(\d+)\s+final exits?\b/i,
        ],
        text
      );

      pushNumIfDefined(claims, "exitCount", exitCount, 0.9, chunk, text);
      pushNumIfDefined(claims, "numberOfExits", exitCount, 0.9, chunk, text);
      pushNumIfDefined(claims, "storeyExitCount", exitCount, 0.78, chunk, text);
      pushNumIfDefined(claims, "finalExitCount", finalExitCount, 0.9, chunk, text);

      // ── Exit widths ───────────────────────────────────────────────────────
      const exitWidthMm = extractFirstNumber(
        [
          /\bexit width\s*[:=]?\s*([\d.]+)\s*mm\b/i,
          /\bclear width of exit\s*[:=]?\s*([\d.]+)\s*mm\b/i,
          /\bmin(?:imum)? exit width\s*[:=]?\s*([\d.]+)\s*mm\b/i,
        ],
        text
      );
      const finalExitWidthMm = extractFirstNumber(
        [/\bfinal exit width\s*[:=]?\s*([\d.]+)\s*mm\b/i],
        text
      );
      const storeyExitWidthMm = extractFirstNumber(
        [/\bstorey exit width\s*[:=]?\s*([\d.]+)\s*mm\b/i],
        text
      );

      pushNumIfDefined(claims, "exitWidthMm", exitWidthMm, 0.88, chunk, text);
      pushNumIfDefined(claims, "exitWidthMM", exitWidthMm, 0.88, chunk, text);
      pushNumIfDefined(claims, "finalExitWidthMm", finalExitWidthMm, 0.88, chunk, text);
      pushNumIfDefined(claims, "final_exit_width_mm", finalExitWidthMm, 0.85, chunk, text);
      pushNumIfDefined(claims, "storeyExitWidthMm", storeyExitWidthMm, 0.85, chunk, text);

      // ── Occupant load ─────────────────────────────────────────────────────
      const occupantLoad = extractFirstNumber(
        [
          /\boccupant load\s*[:=]?\s*([\d,]+)\b/i,
          /\bmax(?:imum)? occupancy\s*[:=]?\s*([\d,]+)\b/i,
          /\bdesign occupancy\s*[:=]?\s*([\d,]+)\b/i,
          /\boccupancy\s*[:=]?\s*([\d,]+)\s*persons?\b/i,
          /\b([\d,]+)\s+persons?\s+(?:per floor|total|occupant)/i,
        ],
        text
      );
      pushNumIfDefined(claims, "occupantLoad", occupantLoad, 0.84, chunk, text);
      pushNumIfDefined(claims, "spaceMaxOccupancy", occupantLoad, 0.8, chunk, text);
      pushNumIfDefined(claims, "maxOccupancy", occupantLoad, 0.8, chunk, text);

      // ── Stair width ───────────────────────────────────────────────────────
      const stairWidthMm = extractFirstNumber(
        [
          /\bstair(?:case)? width\s*[:=]?\s*([\d.]+)\s*mm\b/i,
          /\bescape stair width\s*[:=]?\s*([\d.]+)\s*mm\b/i,
          /\bclear width of stair\s*[:=]?\s*([\d.]+)\s*mm\b/i,
        ],
        text
      );
      pushNumIfDefined(claims, "stairWidthMm", stairWidthMm, 0.86, chunk, text);
      pushNumIfDefined(claims, "stair_width_mm", stairWidthMm, 0.83, chunk, text);

      // ── Two directions of escape ──────────────────────────────────────────
      pushBoolIfMatched(
        claims,
        "twoDirectionsOfEscape",
        [
          /\btwo directions of escape\b/i,
          /\b2 directions of escape\b/i,
          /\balternative escape route\b/i,
          /\balternative means of escape\b/i,
          /\btwo independent escape routes\b/i,
          /\bdual escape routes\b/i,
        ],
        text, chunk, 0.88
      );
      pushBoolIfMatched(
        claims,
        "twoDirectionsAvailableFlag",
        [
          /\btwo directions of escape\b/i,
          /\b2 directions of escape\b/i,
          /\balternative escape route\b/i,
        ],
        text, chunk, 0.86
      );

      // ── Single direction / dead-end (twoDirections = false) ───────────────
      pushBoolFalseIfMatched(
        claims,
        "twoDirectionsOfEscape",
        [
          /\bdead[- ]?end\b/i,
          /\bsingle direction\b/i,
          /\bescape is initially in one direction\b/i,
          /\bone direction only\b/i,
        ],
        text, chunk, 0.72
      );

      // ── On escape route / circulation ─────────────────────────────────────
      pushBoolIfMatched(
        claims,
        "onEscapeRouteFlag",
        [
          /\bescape route\b/i,
          /\bescape corridor\b/i,
          /\bprotected corridor\b/i,
          /\bprotected route\b/i,
          /\bcirculation space\b/i,
          /\bcommon corridor\b/i,
        ],
        text, chunk, 0.78
      );

      // ── Corridor / lobby ──────────────────────────────────────────────────
      pushBoolIfMatched(
        claims,
        "commonCorridorPresent",
        [
          /\bcommon corridor\b/i,
          /\bshared corridor\b/i,
          /\bcirculation corridor\b/i,
        ],
        text, chunk, 0.82
      );
      pushBoolIfMatched(
        claims,
        "isLobbyProvided",
        [
          /\bprotected lobby\b/i,
          /\blobby provided\b/i,
          /\blobby approach\b/i,
          /\bfirefighting lobby\b/i,
        ],
        text, chunk, 0.84
      );
      pushBoolIfMatched(
        claims,
        "protectedLobbyProvided",
        [/\bprotected lobby\b/i, /\blobby approach\b/i],
        text, chunk, 0.84
      );

      // ── Adjacency to escape routes (for alarm unsupervised rule) ──────────
      pushBoolIfMatched(
        claims,
        "adjacencyToEscapeRoutes",
        [
          /\badjacent to escape route\b/i,
          /\bnear(?:by)? escape route\b/i,
          /\bplant room.*escape\b/i,
          /\bstorage.*escape route\b/i,
          /\bvoid.*escape route\b/i,
          /\brisk room.*escape\b/i,
          /\bunsupervised.*escape\b/i,
          /\bescape route.*risk\b/i,
        ],
        text, chunk, 0.76
      );

      // ── Place of safety ───────────────────────────────────────────────────
      pushBoolIfMatched(
        claims,
        "escapeLeadsToPlaceOfSafetyFlag",
        [/\bplace of safety\b/i, /\bfinal place of safety\b/i, /\bassembly point\b/i],
        text, chunk, 0.84
      );

      // ── External escape stair ─────────────────────────────────────────────
      pushBoolIfMatched(
        claims,
        "externalStairFlag",
        [
          /\bexternal (escape )?stair\b/i,
          /\bexterior staircase\b/i,
          /\bexternal escape route\b/i,
        ],
        text, chunk, 0.82
      );

      // ── Inner room ────────────────────────────────────────────────────────
      pushBoolIfMatched(
        claims,
        "innerRoomFlag",
        [
          /\binner room\b/i,
          /\baccess room\b/i,
          /\broom accessed through another room\b/i,
        ],
        text, chunk, 0.84
      );

      // ── Dead end access route ─────────────────────────────────────────────
      pushBoolIfMatched(
        claims,
        "deadEndAccessRouteFlag",
        [/\bdead[- ]?end access\b/i, /\bdead[- ]?end corridor\b/i],
        text, chunk, 0.8
      );

      // ── Refuge ────────────────────────────────────────────────────────────
      pushBoolIfMatched(
        claims,
        "requiresRefugesFlag",
        [/\brefuge\b/i, /\bplace of refuge\b/i, /\brefuge area\b/i],
        text, chunk, 0.8
      );
    }

    return claims;
  },
};
