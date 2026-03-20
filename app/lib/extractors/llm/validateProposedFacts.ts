import { FACT_ONTOLOGY } from "@/lib/factOntology";
import type { ProposedFact } from "./types";
import type { FactClaim } from "../../facts/types";

function isValidType(key: string, value: ProposedFact["value"]): boolean {
  const def = FACT_ONTOLOGY[key];
  if (!def) return false;

  switch (def.type) {
    case "boolean":
      return typeof value === "boolean";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "text":
    case "enum":
      return typeof value === "string";
    default:
      return false;
  }
}

export function validateProposedFacts(
  facts: ProposedFact[],
  sourceRef: string
): FactClaim[] {
  const out: FactClaim[] = [];

  for (const fact of facts) {
    if (!FACT_ONTOLOGY[fact.key]) continue;
    if (!isValidType(fact.key, fact.value)) continue;

    out.push({
      key: fact.key,
      value: fact.value,
      confidence: Math.max(0, Math.min(1, fact.confidence)),
      sourceType: "pdf",
      sourceRef,
      evidence: fact.evidence,
      extractor: "llm_proposer.v1",
      timestamp: new Date().toISOString(),
    });
  }

  return out;
}