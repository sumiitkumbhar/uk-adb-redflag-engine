import { NextResponse } from "next/server";
import { riskRules } from "@/lib/riskRules";
import { aggregateScore } from "@/lib/scoring";
import type { RiskRule } from "@/lib/riskRules";

// Support both export names without breaking build
import * as ruleLogicModule from "@/lib/ruleLogic";
import {
  getMissingRequiredFacts,
  resolveRequiredFactValue,
} from "@/app/lib/facts/resolveRequiredFact";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RuleStatus = "PASS" | "FAIL" | "UNKNOWN";

type RuleResult = {
  ruleId: string;
  title: string;
  part: string;
  severity: "critical" | "high" | "medium" | "low";
  status: RuleStatus;
  compliant: boolean;
  score: number;
  reason: string;
  mitigation: string | null;
  evidence: string[];
};

type RawRuleEval = {
  status?: RuleStatus;
  compliant?: boolean;
  score?: number;
  reason?: string;
  mitigation?: string | string[] | null;
  evidence?: string[];
};

function getRuleLogic(): Record<string, any> {
  const m: any = ruleLogicModule;
  return (m.ruleLogic ?? m.RULE_LOGIC ?? m.default ?? {}) as Record<string, any>;
}

function firstDefined(...values: any[]) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function normalizeFacts(input: Record<string, any>): Record<string, any> {
  const rawFacts = input ?? {};

  const wallLiningClass = firstDefined(
    rawFacts.wallLiningClass,
    rawFacts.wallliningclass,
    rawFacts.wallReactionToFireClass,
    rawFacts.wallreactiontofireclass,
    rawFacts.liningClassification,
    rawFacts.liningclassification,
    rawFacts.liningClass,
    rawFacts.liningclass,
    rawFacts.lining_class
  );

  const ceilingLiningClass = firstDefined(
    rawFacts.ceilingLiningClass,
    rawFacts.ceilingliningclass,
    rawFacts.ceilingReactionToFireClass,
    rawFacts.ceilingreactiontofireclass,
    rawFacts.liningClassification,
    rawFacts.liningclassification,
    rawFacts.liningClass,
    rawFacts.liningclass,
    rawFacts.lining_class
  );

  const liningClassification = firstDefined(
    rawFacts.liningClassification,
    rawFacts.liningclassification,
    rawFacts.liningClass,
    rawFacts.liningclass,
    rawFacts.lining_class,
    wallLiningClass,
    ceilingLiningClass
  );

  return {
    ...rawFacts,

    wallLiningClass,
    wallliningclass: firstDefined(rawFacts.wallliningclass, wallLiningClass),

    ceilingLiningClass,
    ceilingliningclass: firstDefined(rawFacts.ceilingliningclass, ceilingLiningClass),

    liningClassification,
    liningclassification: firstDefined(rawFacts.liningclassification, liningClassification),
  };
}

function defaultScoreForStatus(
  status: RuleStatus,
  severity: "critical" | "high" | "medium" | "low"
): number {
  if (status === "PASS") return 0;
  if (status === "UNKNOWN") return 35;

  const failDefaults: Record<"critical" | "high" | "medium" | "low", number> = {
    critical: 100,
    high: 80,
    medium: 60,
    low: 40,
  };

  return failDefaults[severity] ?? 60;
}

function normalizeMitigation(
  rawMitigation: string | string[] | null | undefined,
  rule: RiskRule
): string | null {
  if (Array.isArray(rawMitigation) && rawMitigation.length > 0) {
    return rawMitigation.join(" | ");
  }

  if (typeof rawMitigation === "string" && rawMitigation.trim()) {
    return rawMitigation.trim();
  }

  const fallback = (rule as any)?.mitigationSteps;
  if (Array.isArray(fallback) && fallback.length > 0) {
    return fallback.join(" | ");
  }

  return null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const rawFacts = ((body as any)?.facts ?? {}) as Record<string, any>;
    const facts = normalizeFacts(rawFacts);

    const logic = getRuleLogic();

    const results: RuleResult[] = [];

    for (const rule of riskRules) {
      const evaluator = logic[rule.ruleId];
      const requiredFacts = rule.inputs?.required ?? [];

      if (!evaluator) {
        results.push({
          ruleId: rule.ruleId,
          title: rule.title,
          part: rule.part,
          severity: rule.severity,
          status: "UNKNOWN",
          compliant: false,
          score: 35,
          reason: "Rule logic not implemented.",
          mitigation: normalizeMitigation(null, rule),
          evidence: [],
        });
        continue;
      }

      const missing = getMissingRequiredFacts(requiredFacts, facts);

      if (missing.length > 0) {
        results.push({
          ruleId: rule.ruleId,
          title: rule.title,
          part: rule.part,
          severity: rule.severity,
          status: "UNKNOWN",
          compliant: false,
          score: 35,
          reason: `Missing ${missing.join(", ")}`,
          mitigation: normalizeMitigation(null, rule),
          evidence: [],
        });
        continue;
      }

      const fallbackFacts = Object.fromEntries(
        requiredFacts.map((key) => [key, resolveRequiredFactValue(key, facts)])
      );

      const factsForRule = {
        ...facts,
        ...fallbackFacts,
      };

      try {
        const evaluation: RawRuleEval = evaluator(factsForRule, rule) ?? {};

        const status: RuleStatus =
          evaluation.status ??
          (typeof evaluation.compliant === "boolean"
            ? evaluation.compliant
              ? "PASS"
              : "FAIL"
            : "UNKNOWN");

        const compliant =
          typeof evaluation.compliant === "boolean"
            ? evaluation.compliant
            : status === "PASS";

        const score =
          typeof evaluation.score === "number" && Number.isFinite(evaluation.score)
            ? evaluation.score
            : defaultScoreForStatus(status, rule.severity);

        results.push({
          ruleId: rule.ruleId,
          title: rule.title,
          part: rule.part,
          severity: rule.severity,
          status,
          compliant,
          score,
          reason: String(evaluation.reason ?? "No reason provided."),
          mitigation: normalizeMitigation(evaluation.mitigation, rule),
          evidence: Array.isArray(evaluation.evidence)
            ? evaluation.evidence.filter(
                (x): x is string => typeof x === "string" && x.trim().length > 0
              )
            : [],
        });
      } catch (err: any) {
        results.push({
          ruleId: rule.ruleId,
          title: rule.title,
          part: rule.part,
          severity: rule.severity,
          status: "UNKNOWN",
          compliant: false,
          score: 35,
          reason: `Execution error: ${err?.message ?? "Unknown error"}`,
          mitigation: normalizeMitigation(null, rule),
          evidence: [],
        });
      }
    }

    const scoring = aggregateScore(
      results.map((r) => ({
        ruleId: r.ruleId,
        severity: r.severity,
        status: r.status,
        score: r.score,
        part: r.part,
      }))
    );

    const totalRules = results.length;
    const passes = results.filter((r) => r.status === "PASS").length;
    const failures = results.filter((r) => r.status === "FAIL").length;
    const unknowns = results.filter((r) => r.status === "UNKNOWN").length;

    return NextResponse.json({
      summary: {
        totalRules,
        passes,
        failures,
        unknowns,
        overallRiskScore: scoring.overallScore,
        weightedTotal: scoring.totalWeighted,
        weightedMax: scoring.maxPossible,
        severityBreakdown: scoring.breakdown,
      },
      results,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: err?.message ?? "Unexpected error",
      },
      { status: 500 }
    );
  }
}
