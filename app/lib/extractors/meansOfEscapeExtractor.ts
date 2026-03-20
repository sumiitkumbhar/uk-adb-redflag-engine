// meansOfEscapeExtractor.ts
// NOTE: This extractor uses the legacy graph-mutation pattern (different from the FactExtractor
// pipeline). Keep it as-is for compatibility with any direct callers, but enriched patterns.

export type ExtractionContext = {
  text: string;
  graph: any;
};

function numberFromMatch(match: RegExpMatchArray | null): number | undefined {
  if (!match || !match[1]) return undefined;
  const n = parseFloat(match[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

export function meansOfEscapeExtractor(ctx: ExtractionContext) {
  const text = ctx.text.toLowerCase();
  const claims: any[] = [];

  // ── Exit counts ────────────────────────────────────────────────────────────
  const exitCountMatch = text.match(/(\d+)\s+(?:final\s+)?exits?/);
  const numberOfExits = numberFromMatch(exitCountMatch);
  if (numberOfExits !== undefined) {
    claims.push({ fact: "numberOfExits", value: numberOfExits });
    claims.push({ fact: "exitCount", value: numberOfExits });
    claims.push({ fact: "storeyExitCount", value: numberOfExits });
  }

  // ── Two directions of escape ───────────────────────────────────────────────
  if (
    /two\s+directions?\s+of\s+escape/.test(text) ||
    /alternative\s+escape\s+route/.test(text) ||
    /two\s+independent\s+escape\s+routes/.test(text) ||
    /alternative\s+means\s+of\s+escape/.test(text)
  ) {
    claims.push({ fact: "twoDirectionsAvailableFlag", value: true });
    claims.push({ fact: "twoDirectionsOfEscape", value: true });
  }

  // Dead end = single direction
  if (/dead[\s-]?end/.test(text)) {
    claims.push({ fact: "twoDirectionsOfEscape", value: false });
    claims.push({ fact: "deadEndAccessRouteFlag", value: true });
  }

  // ── Travel distances ───────────────────────────────────────────────────────
  const travelMatch = text.match(/travel\s+distance[^0-9]*([\d.]+)\s*m/);
  const travelDistance = numberFromMatch(travelMatch);
  if (travelDistance !== undefined) {
    claims.push({ fact: "travelDistance", value: travelDistance });
    claims.push({ fact: "travelDistanceM", value: travelDistance });
    claims.push({ fact: "travelDistanceNearestExitM", value: travelDistance });
  }

  const deadEndMatch = text.match(/dead[\s-]?end\s+corridor[^0-9]*([\d.]+)\s*m/);
  const deadEnd = numberFromMatch(deadEndMatch);
  if (deadEnd !== undefined) {
    claims.push({ fact: "maxDeadEndCorridorLengthM", value: deadEnd });
  }

  // ── Exit width ─────────────────────────────────────────────────────────────
  const exitWidthMatch = text.match(/exit\s+width[^0-9]*([\d.]+)\s*mm/);
  const exitWidth = numberFromMatch(exitWidthMatch);
  if (exitWidth !== undefined) {
    claims.push({ fact: "exitWidthMM", value: exitWidth });
    claims.push({ fact: "exitWidthMm", value: exitWidth });
    claims.push({ fact: "finalExitWidthMm", value: exitWidth });
  }

  // ── Stair count ────────────────────────────────────────────────────────────
  const stairMatch = text.match(/(\d+)\s+staircases?/);
  const singleStair = /single\s+stair/.test(text);
  const twoStairs = /two\s+stairs?/.test(text) || /double\s+stair/.test(text);

  const stairCount = stairMatch
    ? numberFromMatch(stairMatch)
    : singleStair
    ? 1
    : twoStairs
    ? 2
    : undefined;

  if (stairCount !== undefined) {
    claims.push({ fact: "numberOfStaircases", value: stairCount });
    claims.push({ fact: "stairCount", value: stairCount });
    claims.push({ fact: "escapeStairCount", value: stairCount });
    if (stairCount === 1) {
      claims.push({ fact: "singleStairFlag", value: true });
      claims.push({ fact: "singleStaircaseBuilding", value: true });
    }
  }

  // ── Protected stair ────────────────────────────────────────────────────────
  if (/protected\s+stair/.test(text) || /enclosed\s+stair/.test(text)) {
    claims.push({ fact: "protectedStairPresent", value: true });
    claims.push({ fact: "protectedStairFlag", value: true });
    claims.push({ fact: "protectedStairProvidedFlag", value: true });
  }

  // ── On escape route ────────────────────────────────────────────────────────
  if (
    /escape\s+route/.test(text) ||
    /protected\s+corridor/.test(text) ||
    /circulation\s+space/.test(text) ||
    /common\s+corridor/.test(text)
  ) {
    claims.push({ fact: "onEscapeRouteFlag", value: true });
    claims.push({ fact: "escapeRoutePresent", value: true });
  }

  // ── Common corridor ────────────────────────────────────────────────────────
  if (/common\s+corridor/.test(text) || /shared\s+corridor/.test(text)) {
    claims.push({ fact: "commonCorridorPresent", value: true });
  }

  // ── Lobby ──────────────────────────────────────────────────────────────────
  if (/protected\s+lobby/.test(text) || /lobby\s+approach/.test(text)) {
    claims.push({ fact: "isLobbyProvided", value: true });
    claims.push({ fact: "protectedLobbyProvided", value: true });
    claims.push({ fact: "lobbyOrProtectedCorridorByStoreyFlag", value: true });
  }

  // ── Adjacency to escape routes ─────────────────────────────────────────────
  if (
    /adjacent\s+to\s+escape\s+route/.test(text) ||
    /near(?:by)?\s+escape\s+route/.test(text) ||
    /plant\s+room.*escape/.test(text) ||
    /storage.*escape\s+route/.test(text) ||
    /unsupervised.*escape/.test(text)
  ) {
    claims.push({ fact: "adjacencyToEscapeRoutes", value: true });
  }

  // ── Place of safety ────────────────────────────────────────────────────────
  if (/place\s+of\s+safety/.test(text) || /assembly\s+point/.test(text)) {
    claims.push({ fact: "escapeLeadsToPlaceOfSafetyFlag", value: true });
  }

  // ── Occupant load ──────────────────────────────────────────────────────────
  const occupantMatch = text.match(/(\d[\d,]*)\s+persons?(?:\s+(?:per floor|total|occupant))?/);
  const occupantLoad = numberFromMatch(occupantMatch);
  if (occupantLoad !== undefined) {
    claims.push({ fact: "occupantLoad", value: occupantLoad });
    claims.push({ fact: "maxOccupancy", value: occupantLoad });
    claims.push({ fact: "spaceMaxOccupancy", value: occupantLoad });
  }

  // ── Inner room ─────────────────────────────────────────────────────────────
  if (/inner\s+room/.test(text) || /access\s+room/.test(text)) {
    claims.push({ fact: "innerRoomFlag", value: true });
  }

  return {
    ...ctx.graph,
    claims: [...(ctx.graph?.claims ?? []), ...claims],
  };
}
