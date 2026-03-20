import type { RawExtractedFact } from "./factExtractor";
import type { NormalizedFactSet } from "./factNormalizer";

export type FactConfidenceSummaryItem = {
  key: string;
  value: string | number | boolean | null;
  confidence: number;
  sourceDocument?: string;
  sourceSnippet?: string;
  band: "high" | "medium" | "low";
};

export type FactConfidenceSummary = {
  totalFacts: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  averageConfidence: number;
  items: FactConfidenceSummaryItem[];
};

function bandFromConfidence(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 0.85) return "high";
  if (confidence >= 0.6) return "medium";
  return "low";
}

export function summarizeRawFactConfidence(rawFacts: RawExtractedFact[]): FactConfidenceSummary {
  const items = rawFacts
    .map((fact) => ({
      key: fact.key,
      value: fact.value,
      confidence: fact.confidence,
      sourceDocument: fact.sourceDocument,
      sourceSnippet: fact.sourceSnippet,
      band: bandFromConfidence(fact.confidence)
    }))
    .sort((a, b) => b.confidence - a.confidence || a.key.localeCompare(b.key));

  const totalFacts = items.length;
  const highConfidence = items.filter((i) => i.band === "high").length;
  const mediumConfidence = items.filter((i) => i.band === "medium").length;
  const lowConfidence = items.filter((i) => i.band === "low").length;

  const averageConfidence =
    totalFacts === 0
      ? 0
      : Number((items.reduce((sum, i) => sum + i.confidence, 0) / totalFacts).toFixed(2));

  return {
    totalFacts,
    highConfidence,
    mediumConfidence,
    lowConfidence,
    averageConfidence,
    items
  };
}

export function summarizeNormalizedFactConfidence(
  normalized: NormalizedFactSet
): FactConfidenceSummary {
  const items = Object.entries(normalized)
    .map(([key, fact]) => ({
      key,
      value: fact.value,
      confidence: fact.confidence,
      sourceDocument: fact.sourceDocument,
      sourceSnippet: fact.sourceSnippet,
      band: bandFromConfidence(fact.confidence)
    }))
    .sort((a, b) => b.confidence - a.confidence || a.key.localeCompare(b.key));

  const totalFacts = items.length;
  const highConfidence = items.filter((i) => i.band === "high").length;
  const mediumConfidence = items.filter((i) => i.band === "medium").length;
  const lowConfidence = items.filter((i) => i.band === "low").length;

  const averageConfidence =
    totalFacts === 0
      ? 0
      : Number((items.reduce((sum, i) => sum + i.confidence, 0) / totalFacts).toFixed(2));

  return {
    totalFacts,
    highConfidence,
    mediumConfidence,
    lowConfidence,
    averageConfidence,
    items
  };
}