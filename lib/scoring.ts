export type Severity = "critical" | "high" | "medium" | "low";
export type RuleStatus = "PASS" | "FAIL" | "UNKNOWN";

export type ScoredRule = {
  ruleId: string;
  severity: Severity;
  status: RuleStatus;
  score: number; // your rule score output (0..100-ish)
  part?: string;
  appliesTo?: string[];
};

const SEVERITY_MULT: Record<Severity, number> = {
  critical: 1.0,
  high: 0.7,
  medium: 0.4,
  low: 0.2,
};

export function scoreRule(r: ScoredRule) {
  const mult = SEVERITY_MULT[r.severity] ?? 0.4;

  // Base score depending on status
  const base =
    r.status === "PASS"
      ? 0
      : r.status === "FAIL"
      ? clamp(r.score ?? 0, 0, 100)
      : // UNKNOWN: treat as risk (not 0)
        35;

  return clamp(base * mult, 0, 100);
}

export function aggregateScore(rules: ScoredRule[]) {
  const weighted = rules.map(scoreRule);

  // Normalisation factor:
  // Use max possible weighted score if everything FAILED at 100.
  const maxPossible = rules.reduce((sum, r) => {
    const mult = SEVERITY_MULT[r.severity] ?? 0.4;
    return sum + 100 * mult;
  }, 0);

  const totalWeighted = weighted.reduce((a, b) => a + b, 0);

  const overall =
    maxPossible > 0 ? clamp((totalWeighted / maxPossible) * 100, 0, 100) : 0;

  const breakdown = {
    critical: bucket(rules, "critical"),
    high: bucket(rules, "high"),
    medium: bucket(rules, "medium"),
    low: bucket(rules, "low"),
  };

  return {
    overallScore: round1(overall),
    totalWeighted: round1(totalWeighted),
    maxPossible: round1(maxPossible),
    breakdown,
  };
}

function bucket(rules: ScoredRule[], severity: Severity) {
  const subset = rules.filter((r) => r.severity === severity);
  const counts = {
    total: subset.length,
    pass: subset.filter((r) => r.status === "PASS").length,
    fail: subset.filter((r) => r.status === "FAIL").length,
    unknown: subset.filter((r) => r.status === "UNKNOWN").length,
  };
  const agg = aggregateScoreSubset(subset);
  return { ...counts, ...agg };
}

function aggregateScoreSubset(subset: ScoredRule[]) {
  const weighted = subset.map(scoreRule);
  const maxPossible = subset.reduce((sum, r) => {
    const mult = SEVERITY_MULT[r.severity] ?? 0.4;
    return sum + 100 * mult;
  }, 0);
  const totalWeighted = weighted.reduce((a, b) => a + b, 0);
  const overall =
    maxPossible > 0 ? clamp((totalWeighted / maxPossible) * 100, 0, 100) : 0;
  return { overallScore: round1(overall), totalWeighted: round1(totalWeighted) };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}