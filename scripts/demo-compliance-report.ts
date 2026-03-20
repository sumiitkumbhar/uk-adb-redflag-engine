import { riskRules } from "../lib/riskRules";
import { evaluateAll } from "../lib/evaluateAll";
import { assessBuildingCompliance } from "../lib/complianceEngine";
import { generateFireStrategy } from "../lib/fireStrategyEngine";
import { assessDataCompleteness } from "../lib/dataCompletenessEngine";
import { resolveMissingFacts } from "../lib/missingFactsResolver";

type DemoFacts = Record<string, any>;

let demoFacts: DemoFacts = {
  buildingUse: "flats",
  commonCorridorPresent: true,
  corridorIsProtected: false,
  topStoreyHeightM: 6,
  flatToCorridorWallFireResistanceMinutes: 30,

  commonCorridorTravelDistanceM: 10,
  maxAllowedCommonCorridorTravelDistanceM: 7.5,

  commonEscapeRoutePresent: true,
  commonEscapeRouteTravelDistanceM: 12,
  maxAllowedCommonEscapeRouteTravelDistanceM: 7.5,

  commonLobbyPresent: true,
  lobbyTravelDistanceM: 5.2,
  lobbyTravelDistanceLimitApplies: true,

  sprinklersProvided: false,
  alternativeEscapeRouteProvided: false,

  fireStoppingProvided: true,
  servicePenetrationsPresent: true,
  penetratesCompartmentWallOrFloor: true,
  penetrationSealFireResistanceMinutes: 60,
  compartmentElementRequiredFireResistanceMinutes: 60,

  externalWallHasGlazedOrCurtainWallFacade: true,
  spandrelPanelProvided: true,
  spandrelHeightMm: 700,
  minimumRequiredSpandrelHeightMm: 900,
  slabEdgeFireStoppingProvided: true,

  largestCompartmentAreaM2: 500,
  distanceToNearestPublicHydrantM: 150,
  fireMainsProvided: true,
  privateHydrantsProvided: true,
  maxDistanceFromInletToHydrantM: 60,
  hydrantSpacingM: 80,
  pipedWaterSupplyAvailable: true,
  waterMainPressureAdequate: true
};

function printSection(title: string): void {
  console.log(`\n${"=".repeat(80)}`);
  console.log(title);
  console.log(`${"=".repeat(80)}`);
}

function printKeyValue(label: string, value: string | number): void {
  console.log(`${label}${value}`);
}

function printList(lines: string[]): void {
  if (lines.length === 0) {
    console.log("None");
    return;
  }

  for (const line of lines) {
    console.log(`- ${line}`);
  }
}

function printAssessment(
  results: ReturnType<typeof evaluateAll>,
  assessment: ReturnType<typeof assessBuildingCompliance>,
  completeness: ReturnType<typeof assessDataCompleteness>,
  strategy: ReturnType<typeof generateFireStrategy>
): void {
  printSection("BUILDING FIRE COMPLIANCE REPORT");

  printKeyValue("Overall compliance score: ", `${assessment.overall.score}/100`);
  printKeyValue("Total rules evaluated: ", assessment.overall.total);
  printKeyValue("PASS: ", assessment.overall.pass);
  printKeyValue("FAIL: ", assessment.overall.fail);
  printKeyValue("UNKNOWN: ", assessment.overall.unknown);

  printSection("SCORES BY PART");
  for (const [part, summary] of Object.entries(assessment.byPart)) {
    if (summary.total === 0) continue;

    console.log(
      `${part} -> score=${summary.score}/100 | total=${summary.total} | pass=${summary.pass} | fail=${summary.fail} | unknown=${summary.unknown}`
    );
  }

  printSection("CRITICAL FAILURES");
  if (assessment.criticalFailures.length === 0) {
    console.log("None");
  } else {
    for (const r of assessment.criticalFailures.slice(0, 20)) {
      console.log(`- ${r.ruleId}`);
      if (r.title) console.log(`  title: ${r.title}`);
      if (r.reason) console.log(`  reason: ${r.reason}`);
      if (r.mitigation) console.log(`  mitigation: ${r.mitigation}`);
    }
  }

  printSection("ROOT CAUSES");
  if (assessment.rootCauses.length === 0) {
    console.log("None");
  } else {
    for (const node of assessment.rootCauses.slice(0, 20)) {
      console.log(`- ${node.ruleId}`);
      if (node.title) console.log(`  title: ${node.title}`);
      if (node.reason) console.log(`  reason: ${node.reason}`);
      if (node.blocks.length > 0) {
        console.log(`  blocks: ${node.blocks.join(", ")}`);
      }
    }
  }

  printSection("DEPENDENCY IMPACTS");
  if (assessment.dependencyImpacts.length === 0) {
    console.log("None");
  } else {
    for (const impact of assessment.dependencyImpacts.slice(0, 20)) {
      console.log(`- ${impact.ruleId} blocked by: ${impact.blockedBy.join(", ")}`);
    }
  }

  printSection("TOP PRIORITISED ACTIONS");
  if (assessment.prioritisedActions.length === 0) {
    console.log("None");
  } else {
    for (const action of assessment.prioritisedActions.slice(0, 10)) {
      console.log(`- ${action.ruleId}`);
      if (action.title) console.log(`  title: ${action.title}`);
      console.log(`  severityWeight: ${action.severityWeight}`);
      console.log(`  affectsCount: ${action.affectsCount}`);
      if (action.reason) console.log(`  reason: ${action.reason}`);
      if (action.mitigation) console.log(`  mitigation: ${action.mitigation}`);
      if (action.blocks.length > 0) {
        console.log(`  downstream impact: ${action.blocks.join(", ")}`);
      }
    }
  }

  printSection("TOP 15 FAILED RULES");
  const failed = results.filter((r) => r.status === "FAIL").slice(0, 15);
  if (failed.length === 0) {
    console.log("None");
  } else {
    for (const r of failed) {
      console.log(`- ${r.ruleId}`);
      if (r.title) console.log(`  title: ${r.title}`);
      if (r.reason) console.log(`  reason: ${r.reason}`);
      if (typeof r.score === "number") console.log(`  score: ${r.score}`);
    }
  }

  printSection("DATA COMPLETENESS");
  printKeyValue("Completeness score: ", `${completeness.completenessScore}/100`);
  printKeyValue("Known rules: ", completeness.knownRules);
  printKeyValue("Unknown rules: ", completeness.unknownRules);

  console.log("\nTop missing facts:");
  if (completeness.topMissingFacts.length === 0) {
    console.log("None");
  } else {
    for (const item of completeness.topMissingFacts.slice(0, 15)) {
      console.log(
        `- ${item.factKey} | affects=${item.count} | criticalAffected=${item.affectedCriticalRuleIds.length} | weightedImpact=${item.weightedImpact}`
      );
    }
  }

  console.log("\nTop unknown rule details:");
  if (completeness.unknownRuleDetails.length === 0) {
    console.log("None");
  } else {
    for (const item of completeness.unknownRuleDetails.slice(0, 15)) {
      console.log(`- ${item.ruleId}`);
      if (item.title) console.log(`  title: ${item.title}`);
      if (item.reason) console.log(`  reason: ${item.reason}`);
      if (item.missingFacts.length > 0) {
        console.log(`  missingFacts: ${item.missingFacts.join(", ")}`);
      }
    }
  }

  printSection("AUTO-GENERATED FIRE STRATEGY");

  const strategySections = [
    strategy.buildingSummary,
    strategy.meansOfEscape,
    strategy.compartmentation,
    strategy.fireSpread,
    strategy.firefighting,
    strategy.activeSystems,
    strategy.complianceSummary
  ];

  for (const section of strategySections) {
    console.log(`\n${section.title}`);
    console.log(`${"-".repeat(section.title.length)}`);
    printList(section.content);
  }
}

function runEngines(facts: DemoFacts) {
  const results = evaluateAll(riskRules, facts);
  const assessment = assessBuildingCompliance(results);
  const completeness = assessDataCompleteness(results);
  const strategy = generateFireStrategy(results);

  return {
    results,
    assessment,
    completeness,
    strategy
  };
}

async function main(): Promise<void> {
  const initial = runEngines(demoFacts);

  printAssessment(
    initial.results,
    initial.assessment,
    initial.completeness,
    initial.strategy
  );

  if (initial.completeness.topMissingFacts.length > 0) {
    printSection("INTERACTIVE MISSING-FACT RESOLUTION");
    console.log("Missing inputs detected.");
    console.log("Answer the questions below to improve completeness and re-run the engine.");

    const missingKeys = initial.completeness.topMissingFacts
      .slice(0, 15)
      .map((f) => f.factKey);

    const resolvedFacts = await resolveMissingFacts(demoFacts, missingKeys);
    demoFacts = { ...demoFacts, ...resolvedFacts };

    printSection("RE-RUNNING EVALUATION WITH UPDATED FACTS");

    const rerun = runEngines(demoFacts);

    printAssessment(
      rerun.results,
      rerun.assessment,
      rerun.completeness,
      rerun.strategy
    );
  }

  printSection("DONE");
}

main().catch((err) => {
  console.error("Fatal error while running demo compliance report:");
  console.error(err);
  process.exit(1);
});