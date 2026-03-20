import fs from "node:fs";
import path from "node:path";

import { classifyDocumentText } from "../lib/extraction/documentClassifier";
import { extractFactsFromText } from "../lib/extraction/factExtractor";
import {
  buildNormalizedFactSet,
  toEngineFacts
} from "../lib/extraction/factNormalizer";
import {
  summarizeRawFactConfidence,
  summarizeNormalizedFactConfidence
} from "../lib/extraction/factConfidence";

import { riskRules } from "../lib/riskRules";
import { evaluateAll } from "../lib/evaluateAll";
import { assessBuildingCompliance } from "../lib/complianceEngine";
import { assessDataCompleteness } from "../lib/dataCompletenessEngine";
import { generateFireStrategy } from "../lib/fireStrategyEngine";

function printSection(title: string): void {
  console.log(`\n${"=".repeat(80)}`);
  console.log(title);
  console.log(`${"=".repeat(80)}`);
}

function loadInputText(): { text: string; sourceDocument: string } {
  const cliPath = process.argv[2];

  if (cliPath) {
    const absolute = path.resolve(cliPath);
    if (!fs.existsSync(absolute)) {
      throw new Error(`Input file not found: ${absolute}`);
    }

    return {
      text: fs.readFileSync(absolute, "utf8"),
      sourceDocument: path.basename(absolute)
    };
  }

  const demoText = `
  Fire Strategy Report
  Proposed block of flats with a single stair and common corridor arrangement.
  Top storey height is 6 m above ground level.
  Common corridor travel distance is 10 m.
  Common escape route travel distance is 12 m.
  Lobby travel distance is 5.2 m.
  No sprinklers are proposed.
  Protected shaft is provided.
  Occupant load is 20.
  Private hydrants are provided.
  Fire mains are provided.
  Distance to nearest public hydrant is 150 m.
  Largest compartment area is 500 m2.
  The facade includes a spandrel zone.
  Spandrel height is 700 mm.
  Minimum required spandrel height is 900 mm.
  `;

  return {
    text: demoText,
    sourceDocument: "demo-fire-strategy.txt"
  };
}

function printObject(title: string, value: unknown): void {
  printSection(title);
  console.log(JSON.stringify(value, null, 2));
}

function main(): void {
  const { text, sourceDocument } = loadInputText();

  const classification = classifyDocumentText(text);
  const rawFacts = extractFactsFromText({ text, sourceDocument });
  const normalizedFacts = buildNormalizedFactSet(rawFacts);
  const engineFacts = toEngineFacts(normalizedFacts);

  const rawConfidence = summarizeRawFactConfidence(rawFacts);
  const normalizedConfidence = summarizeNormalizedFactConfidence(normalizedFacts);

  const results = evaluateAll(riskRules, engineFacts);
  const assessment = assessBuildingCompliance(results);
  const completeness = assessDataCompleteness(results);
  const strategy = generateFireStrategy(results);

  printObject("DOCUMENT CLASSIFICATION", classification);

  printSection("RAW EXTRACTED FACTS");
  for (const fact of rawFacts) {
    console.log(
      `- ${fact.key} = ${String(fact.value)} | confidence=${fact.confidence.toFixed(2)} | source=${fact.sourceDocument ?? "unknown"}`
    );
    if (fact.sourceSnippet) {
      console.log(`  snippet: ${fact.sourceSnippet}`);
    }
  }

  printObject("RAW FACT CONFIDENCE SUMMARY", rawConfidence);
  printObject("NORMALIZED FACT SET", normalizedFacts);
  printObject("NORMALIZED FACT CONFIDENCE SUMMARY", normalizedConfidence);
  printObject("ENGINE FACTS", engineFacts);

  printSection("COMPLIANCE SUMMARY");
  console.log(`Overall compliance score: ${assessment.overall.score}/100`);
  console.log(`Total rules evaluated: ${assessment.overall.total}`);
  console.log(`PASS: ${assessment.overall.pass}`);
  console.log(`FAIL: ${assessment.overall.fail}`);
  console.log(`UNKNOWN: ${assessment.overall.unknown}`);

  printSection("DATA COMPLETENESS SUMMARY");
  console.log(`Completeness score: ${completeness.completenessScore}/100`);
  console.log(`Known rules: ${completeness.knownRules}`);
  console.log(`Unknown rules: ${completeness.unknownRules}`);

  console.log("\nTop missing facts:");
  for (const item of completeness.topMissingFacts.slice(0, 10)) {
    console.log(
      `- ${item.factKey} | affects=${item.count} | criticalAffected=${item.affectedCriticalRuleIds.length} | weightedImpact=${item.weightedImpact}`
    );
  }

  printSection("AUTO-GENERATED FIRE STRATEGY SUMMARY");
  const sections = [
    strategy.buildingSummary,
    strategy.meansOfEscape,
    strategy.compartmentation,
    strategy.fireSpread,
    strategy.firefighting,
    strategy.activeSystems,
    strategy.complianceSummary
  ];

  for (const section of sections) {
    console.log(`\n${section.title}`);
    console.log(`${"-".repeat(section.title.length)}`);
    for (const line of section.content.slice(0, 8)) {
      console.log(`- ${line}`);
    }
  }
}

main();