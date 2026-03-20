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

export type DomainKey =
  | "B1"
  | "B2"
  | "B3"
  | "B4"
  | "B5"
  | "UNKNOWN";

export type DomainSummary = {
  total: number;
  pass: number;
  fail: number;
  unknown: number;
  score: number;
};

export type DependencyImpact = {
  ruleId: string;
  blockedBy: string[];
};

export type RootCauseNode = {
  ruleId: string;
  title?: string;
  status: RuleStatus;
  severity?: "critical" | "high" | "medium" | "low";
  reason?: string;
  blocks: string[];
};

export type PrioritisedAction = {
  ruleId: string;
  title?: string;
  severityWeight: number;
  affectsCount: number;
  status: RuleStatus;
  reason?: string;
  mitigation?: string | null;
  blocks: string[];
};

export type ComplianceAssessment = {
  overall: {
    total: number;
    pass: number;
    fail: number;
    unknown: number;
    score: number;
  };
  byPart: Record<DomainKey, DomainSummary>;
  criticalFailures: EngineRuleResult[];
  dependencyImpacts: DependencyImpact[];
  rootCauses: RootCauseNode[];
  prioritisedActions: PrioritisedAction[];
};

type RuleMap = Record<string, EngineRuleResult>;
type DependencyMap = Record<string, string[]>;

/**
 * Keep this graph small and practical at first.
 * Add dependencies only where there is real compliance reasoning value.
 */
export const RULE_DEPENDENCIES: DependencyMap = {
  "B1-FLATS-COMMON-CORRIDOR-TRAVELDIST-TABLE3_1-01": [
    "B1-FLATS-COMMON-CORRIDOR-PROTECTION-REI30_60-01"
  ],
  "B1-FLATS-ESCAPE-ROUTES-TABLE3_1-01": [
    "B1-FLATS-COMMON-CORRIDOR-TRAVELDIST-TABLE3_1-01",
    "B1-FLATS-COMMON-CORRIDOR-PROTECTION-REI30_60-01"
  ],
  "B1-FLATS-COMMON-LOBBY-TRAVELDIST-4_5M-01": [
    "B1-FLATS-COMMON-CORRIDOR-PROTECTION-REI30_60-01"
  ],
  "B1-DW-GT-2STOREYS-4_5M-ALTROUTE-01": [
    "B1-DW-GT7_5-ALTROUTE-OR-SPRINKLER-01"
  ],
  "B5-FIREFIGHTING-HARDSTANDING-PROVISION-01": [
    "B5-FIREFIGHTING-WATER-SUPPLY-01"
  ]
};

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

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

function normaliseScore(results: EngineRuleResult[]): number {
  if (!results.length) return 0;

  let weightedTotal = 0;
  let weightedMax = 0;

  for (const r of results) {
    const weight = severityWeight(r.severity);
    weightedMax += 100 * weight;

    let ruleScore: number;
    if (isFiniteNumber(r.score)) {
      ruleScore = Math.max(0, Math.min(100, r.score));
    } else {
      // Fallback if score is not present
      if (r.status === "PASS") ruleScore = 0;
      else if (r.status === "UNKNOWN") ruleScore = 35;
      else ruleScore = 100;
    }

    weightedTotal += ruleScore * weight;
  }

  // Lower risk = better compliance score
  const complianceScore = Math.round(100 - (weightedTotal / weightedMax) * 100);
  return Math.max(0, Math.min(100, complianceScore));
}

function toDomainKey(part?: string): DomainKey {
  if (part === "B1") return "B1";
  if (part === "B2") return "B2";
  if (part === "B3") return "B3";
  if (part === "B4") return "B4";
  if (part === "B5") return "B5";
  return "UNKNOWN";
}

function buildRuleMap(results: EngineRuleResult[]): RuleMap {
  const map: RuleMap = {};
  for (const result of results) {
    map[result.ruleId] = result;
  }
  return map;
}

function reverseDependencies(dependencies: DependencyMap): Record<string, string[]> {
  const reversed: Record<string, string[]> = {};

  for (const [child, parents] of Object.entries(dependencies)) {
    for (const parent of parents) {
      if (!reversed[parent]) reversed[parent] = [];
      reversed[parent].push(child);
    }
  }

  return reversed;
}

function getBlockedByFailedDependencies(
  ruleId: string,
  rules: RuleMap,
  dependencies: DependencyMap
): string[] {
  const deps = dependencies[ruleId] ?? [];
  return deps.filter((depId) => rules[depId]?.status === "FAIL");
}

function getBlockedByUnknownDependencies(
  ruleId: string,
  rules: RuleMap,
  dependencies: DependencyMap
): string[] {
  const deps = dependencies[ruleId] ?? [];
  return deps.filter((depId) => rules[depId]?.status === "UNKNOWN");
}

function summariseByPart(results: EngineRuleResult[]): Record<DomainKey, DomainSummary> {
  const groups: Record<DomainKey, EngineRuleResult[]> = {
    B1: [],
    B2: [],
    B3: [],
    B4: [],
    B5: [],
    UNKNOWN: []
  };

  for (const r of results) {
    groups[toDomainKey(r.part)].push(r);
  }

  return {
    B1: summariseGroup(groups.B1),
    B2: summariseGroup(groups.B2),
    B3: summariseGroup(groups.B3),
    B4: summariseGroup(groups.B4),
    B5: summariseGroup(groups.B5),
    UNKNOWN: summariseGroup(groups.UNKNOWN)
  };
}

function summariseGroup(results: EngineRuleResult[]): DomainSummary {
  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  const unknown = results.filter((r) => r.status === "UNKNOWN").length;

  return {
    total: results.length,
    pass,
    fail,
    unknown,
    score: normaliseScore(results)
  };
}

function collectDependencyImpacts(
  results: EngineRuleResult[],
  dependencies: DependencyMap
): DependencyImpact[] {
  const ruleMap = buildRuleMap(results);
  const impacts: DependencyImpact[] = [];

  for (const result of results) {
    const failedDeps = getBlockedByFailedDependencies(result.ruleId, ruleMap, dependencies);
    const unknownDeps = getBlockedByUnknownDependencies(result.ruleId, ruleMap, dependencies);
    const blockedBy = [...failedDeps, ...unknownDeps];

    if (blockedBy.length > 0) {
      impacts.push({
        ruleId: result.ruleId,
        blockedBy
      });
    }
  }

  return impacts.sort((a, b) => a.ruleId.localeCompare(b.ruleId));
}

function collectRootCauses(
  results: EngineRuleResult[],
  dependencies: DependencyMap
): RootCauseNode[] {
  const ruleMap = buildRuleMap(results);
  const reversed = reverseDependencies(dependencies);

  const failedRules = results.filter((r) => r.status === "FAIL");

  const rootCauses: RootCauseNode[] = [];

  for (const rule of failedRules) {
    const failedDeps = getBlockedByFailedDependencies(rule.ruleId, ruleMap, dependencies);

    // A failed rule with no failed parent dependency is treated as a root cause.
    if (failedDeps.length === 0) {
      rootCauses.push({
        ruleId: rule.ruleId,
        title: rule.title,
        status: rule.status,
        severity: rule.severity,
        reason: rule.reason,
        blocks: (reversed[rule.ruleId] ?? []).sort()
      });
    }
  }

  return rootCauses.sort((a, b) => {
    const weightDiff = severityWeight(b.severity) - severityWeight(a.severity);
    if (weightDiff !== 0) return weightDiff;
    return a.ruleId.localeCompare(b.ruleId);
  });
}

function prioritiseActions(
  results: EngineRuleResult[],
  dependencies: DependencyMap
): PrioritisedAction[] {
  const rootCauses = collectRootCauses(results, dependencies);
  const reversed = reverseDependencies(dependencies);

  const actions: PrioritisedAction[] = rootCauses.map((rule) => {
    const affects = new Set<string>();

    const stack = [...(reversed[rule.ruleId] ?? [])];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (affects.has(current)) continue;
      affects.add(current);

      const next = reversed[current] ?? [];
      for (const n of next) stack.push(n);
    }

    return {
      ruleId: rule.ruleId,
      title: rule.title,
      severityWeight: severityWeight(rule.severity),
      affectsCount: affects.size,
      status: rule.status,
      reason: rule.reason,
      mitigation: results.find((r) => r.ruleId === rule.ruleId)?.mitigation ?? null,
      blocks: Array.from(affects).sort()
    };
  });

  return actions.sort((a, b) => {
    if (b.severityWeight !== a.severityWeight) {
      return b.severityWeight - a.severityWeight;
    }
    if (b.affectsCount !== a.affectsCount) {
      return b.affectsCount - a.affectsCount;
    }
    return a.ruleId.localeCompare(b.ruleId);
  });
}

export function assessBuildingCompliance(
  results: EngineRuleResult[],
  dependencies: DependencyMap = RULE_DEPENDENCIES
): ComplianceAssessment {
  const total = results.length;
  const pass = results.filter((r) => r.status === "PASS").length;
  const fail = results.filter((r) => r.status === "FAIL").length;
  const unknown = results.filter((r) => r.status === "UNKNOWN").length;

  const overallScore = normaliseScore(results);

  const criticalFailures = results
    .filter((r) => r.status === "FAIL" && r.severity === "critical")
    .sort((a, b) => a.ruleId.localeCompare(b.ruleId));

  return {
    overall: {
      total,
      pass,
      fail,
      unknown,
      score: overallScore
    },
    byPart: summariseByPart(results),
    criticalFailures,
    dependencyImpacts: collectDependencyImpacts(results, dependencies),
    rootCauses: collectRootCauses(results, dependencies),
    prioritisedActions: prioritiseActions(results, dependencies)
  };
}