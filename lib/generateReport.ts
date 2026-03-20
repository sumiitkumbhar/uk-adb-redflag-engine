import { riskRules } from "./riskRules";
import { evaluateAll } from "./evaluateAll";
import { aggregateScore } from "./scoring";
import { resolveMissingFactsForRules } from "./missingFactsResolver";

export async function generateReport(facts: any) {
  const resolved = await resolveMissingFactsForRules(riskRules, facts, {
    // For UI/web flow, pass your own modal/form callback here later.
    // ask: async (q) => ...
    debug: true,
    includeNonCriticalQuestions: false,
    maxQuestions: 20,
  });

  const results = evaluateAll(riskRules, resolved.facts);

  const scoring = aggregateScore(
    results.map((r: any) => ({
      ruleId: r.ruleId,
      severity: (riskRules.find((x) => x.ruleId === r.ruleId)?.severity ?? "medium") as any,
      status: r.status,
      score: r.score ?? 0,
      part: riskRules.find((x) => x.ruleId === r.ruleId)?.part,
    }))
  );

  const summary = {
    totalRules: results.length,
    passes: results.filter((r: any) => r.status === "PASS").length,
    failures: results.filter((r: any) => r.status === "FAIL").length,
    unknowns: results.filter((r: any) => r.status === "UNKNOWN").length,
    overallRiskScore: scoring.overallScore,
    severityBreakdown: scoring.breakdown,
    unresolvedFacts: resolved.unresolvedFacts,
    questionsAsked: resolved.questionsAsked,
  };

  return { summary, results, factResolution: resolved };
}