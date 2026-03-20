import type { FactClaim, FactGraph, FactValue, ResolvedFact, ResolvedFactMap } from "./types";

const SOURCE_WEIGHT: Record<FactClaim["sourceType"], number> = {
  manual: 1.0,
  derived: 0.9,
  pdf: 0.8,
  rule: 0.7,
};

function scoreClaim(claim: FactClaim): number {
  return claim.confidence * SOURCE_WEIGHT[claim.sourceType];
}

function sameValue(a: FactValue, b: FactValue): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
  }
  return a === b;
}

function chooseBestClaim(claims: FactClaim[]): FactClaim | undefined {
  return [...claims].sort((a, b) => scoreClaim(b) - scoreClaim(a))[0];
}

export function resolveFact(claims: FactClaim[]): ResolvedFact | undefined {
  if (!claims.length) return undefined;

  const best = chooseBestClaim(claims);
  if (!best) return undefined;

  const alternatives = claims.filter(
    (c) =>
      c !== best &&
      !sameValue(c.value, best.value)
  );

  return {
    key: best.key,
    value: best.value,
    confidence: best.confidence,
    chosenFrom: best,
    alternatives: alternatives.length ? alternatives : undefined,
  };
}

export function resolveFactGraph(graph: FactGraph): ResolvedFactMap {
  const out: ResolvedFactMap = {};

  for (const [key, claims] of Object.entries(graph.claims)) {
    const resolved = resolveFact(claims);
    if (resolved) out[key] = resolved;
  }

  return out;
}

export function toFlatFactMap(graph: FactGraph): Record<string, FactValue> {
  const resolved = resolveFactGraph(graph);
  const out: Record<string, FactValue> = {};

  for (const [key, item] of Object.entries(resolved)) {
    out[key] = item.value;
  }

  return out;
}

export function getFactValue<T extends FactValue = FactValue>(
  graph: FactGraph,
  key: string
): T | undefined {
  const claims = graph.claims[key] ?? [];
  const resolved = resolveFact(claims);
  return resolved?.value as T | undefined;
}