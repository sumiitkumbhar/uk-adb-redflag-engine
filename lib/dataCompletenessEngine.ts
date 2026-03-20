export type RuleStatus = "PASS" | "FAIL" | "UNKNOWN";

export type EngineRuleResult = {
  ruleId: string;
  title?: string;
  part?: string;
  severity?: "critical" | "high" | "medium" | "low";
  status: RuleStatus;
  score?: number;
  reason?: string;
  mitigation?: string | null;
  evidence?: string[];
};

export type MissingFactImpact = {
  factKey: string;
  count: number;
  affectedRuleIds: string[];
  affectedCriticalRuleIds: string[];
  weightedImpact: number;
};

export type UnknownRuleDetail = {
  ruleId: string;
  title?: string;
  part?: string;
  severity?: "critical" | "high" | "medium" | "low";
  reason?: string;
  missingFacts: string[];
};

export type DataCompletenessSummary = {
  totalRules: number;
  unknownRules: number;
  knownRules: number;
  completenessScore: number;
  topMissingFacts: MissingFactImpact[];
  unknownRuleDetails: UnknownRuleDetail[];
};

function severityWeight(
  severity?: "critical" | "high" | "medium" | "low"
): number {
  switch (severity) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 1;
  }
}

/**
 * Pull likely missing fact keys out of evaluator reason strings.
 *
 * Handles patterns like:
 * - "buildingUse missing"
 * - "topStoreyHeightM missing"
 * - "a and b missing"
 * - "x / y missing"
 */
export function extractMissingFactsFromReason(reason?: string): string[] {
  if (!reason) return [];

  const text = String(reason).trim();
  if (!text) return [];

  const lower = text.toLowerCase();
  if (!lower.includes("missing")) return [];

  // Remove trailing punctuation for cleaner parsing.
  const cleaned = text.replace(/[.]+$/g, "").trim();

  // Capture everything before the word "missing"
  const match = cleaned.match(/^(.*?)\s+missing$/i);
  if (!match?.[1]) return [];

  const raw = match[1].trim();
  if (!raw) return [];

  // Split on common separators while preserving actual field names
  const parts = raw
    .split(/\s*(?:\/|,| and )\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);

  // Normalise and dedupe
  return Array.from(new Set(parts));
}

function buildMissingFactImpacts(
  unknownRuleDetails: UnknownRuleDetail[]
): MissingFactImpact[] {
  const map = new Map<string, MissingFactImpact>();

  for (const detail of unknownRuleDetails) {
    for (const factKey of detail.missingFacts) {
      if (!map.has(factKey)) {
        map.set(factKey, {
          factKey,
          count: 0,
          affectedRuleIds: [],
          affectedCriticalRuleIds: [],
          weightedImpact: 0
        });
      }

      const entry = map.get(factKey)!;
      entry.count += 1;
      entry.affectedRuleIds.push(detail.ruleId);
      entry.weightedImpact += severityWeight(detail.severity);

      if (detail.severity === "critical") {
        entry.affectedCriticalRuleIds.push(detail.ruleId);
      }
    }
  }

  for (const entry of map.values()) {
    entry.affectedRuleIds = Array.from(new Set(entry.affectedRuleIds)).sort();
    entry.affectedCriticalRuleIds = Array.from(
      new Set(entry.affectedCriticalRuleIds)
    ).sort();
  }

  return Array.from(map.values()).sort((a, b) => {
    if (b.weightedImpact !== a.weightedImpact) {
      return b.weightedImpact - a.weightedImpact;
    }
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    return a.factKey.localeCompare(b.factKey);
  });
}

export function assessDataCompleteness(
  results: EngineRuleResult[]
): DataCompletenessSummary {
  const totalRules = results.length;
  const unknownResults = results.filter((r) => r.status === "UNKNOWN");
  const unknownRules = unknownResults.length;
  const knownRules = totalRules - unknownRules;

  const completenessScore =
    totalRules === 0 ? 0 : Math.round((knownRules / totalRules) * 100);

  const unknownRuleDetails: UnknownRuleDetail[] = unknownResults
    .map((r) => ({
      ruleId: r.ruleId,
      title: r.title,
      part: r.part,
      severity: r.severity,
      reason: r.reason,
      missingFacts: extractMissingFactsFromReason(r.reason)
    }))
    .sort((a, b) => {
      const weightDiff = severityWeight(b.severity) - severityWeight(a.severity);
      if (weightDiff !== 0) return weightDiff;
      return a.ruleId.localeCompare(b.ruleId);
    });

  const topMissingFacts = buildMissingFactImpacts(unknownRuleDetails);

  return {
    totalRules,
    unknownRules,
    knownRules,
    completenessScore,
    topMissingFacts,
    unknownRuleDetails
  };
}