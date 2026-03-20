import type { FactClaim, FactGraph, FactValue } from "./types";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function valuesEqual(a: FactValue, b: FactValue): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
  }
  return a === b;
}

function normalizeConfidence(confidence: number): number {
  if (!Number.isFinite(confidence)) return 0;
  return Math.max(0, Math.min(1, confidence));
}

export function createEmptyFactGraph(): FactGraph {
  return { claims: {} };
}

export function addClaim(graph: FactGraph, claim: FactClaim): FactGraph {
  const key = claim.key.trim();
  if (!key) return graph;

  const nextClaim: FactClaim = {
    ...claim,
    key,
    confidence: normalizeConfidence(claim.confidence),
  };

  const existing = graph.claims[key] ?? [];

  // de-dupe exact same value/source/evidence
  const duplicate = existing.find(
    (c) =>
      valuesEqual(c.value, nextClaim.value) &&
      c.sourceType === nextClaim.sourceType &&
      c.sourceRef === nextClaim.sourceRef &&
      JSON.stringify(c.evidence ?? []) === JSON.stringify(nextClaim.evidence ?? [])
  );

  if (duplicate) {
    return graph;
  }

  return {
    claims: {
      ...graph.claims,
      [key]: [...existing, nextClaim],
    },
  };
}

export function addClaims(graph: FactGraph, claims: FactClaim[]): FactGraph {
  return claims.reduce(addClaim, graph);
}

export function buildFactGraph(claims: FactClaim[]): FactGraph {
  return addClaims(createEmptyFactGraph(), claims);
}

export function getClaims(graph: FactGraph, key: string): FactClaim[] {
  return graph.claims[key] ?? [];
}

export function factGraphStats(graph: FactGraph) {
  const keys = Object.keys(graph.claims);
  const totalClaims = keys.reduce((sum, key) => sum + graph.claims[key].length, 0);
  const numericKeys = keys.filter((key) =>
    graph.claims[key].some((c) => isFiniteNumber(c.value))
  ).length;

  return {
    factKeys: keys.length,
    totalClaims,
    numericKeys,
  };
}