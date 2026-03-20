import path from "node:path";

import { extractDocumentText } from "../lib/ingestion/pdfTextExtractor";
import { splitDocumentIntoSections } from "../lib/ingestion/documentSplitter";
import { parseDocumentLayout } from "../lib/ingestion/layoutParser";

import {
  buildNormalizedFactSet,
  toEngineFacts
} from "../lib/extraction/factNormalizer";
import {
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

function buildDefaultDemoTextPath(): string {
  return path.resolve("./artifacts/demo-fire-strategy.txt");
}

function collectFactsFromParsedLayout(
  parsed: ReturnType<typeof parseDocumentLayout>
) {
  return parsed.sections.flatMap((section) => section.extractedFacts);
}

function main(): void {
  const cliPath = process.argv[2];
  const inputPath = cliPath ? path.resolve(cliPath) : buildDefaultDemoTextPath();

  const extracted = extractDocumentText(inputPath);
  const sections = splitDocumentIntoSections(extracted.text);
  const parsed = parseDocumentLayout(sections, extracted.fileName);

  const rawFacts = collectFactsFromParsedLayout(parsed);
  const normalizedFacts = buildNormalizedFactSet(rawFacts);
  const engineFacts = toEngineFacts(normalizedFacts);
  const normalizedConfidence = summarizeNormalizedFactConfidence(normalizedFacts);

  const results = evaluateAll(riskRules, engineFacts);
  const assessment = assessBuildingCompliance(results);
  const completeness = assessDataCompleteness(results);
  const strategy = generateFireStrategy(results);

  printSection("INGESTED DOCUMENT");
  console.log(`File: ${extracted.fileName}`);
  console.log(`Type: ${extracted.contentType}`);
  console.log(`Text length: ${extracted.text.length}`);

  printSection("DOCUMENT SECTIONS");
  for (const section of parsed.sections) {
    console.log(
      `- ${section.id} | title="${section.title}" | classifiedAs=${section.documentType} | confidence=${section.documentTypeConfidence.toFixed(2)}`
    );
    if (section.matchedSignals.length > 0) {
      console.log(`  signals: ${section.matchedSignals.join(", ")}`);
    }
    console.log(`  extractedFacts: ${section.extractedFacts.length}`);
  }

  printSection("NORMALIZED FACT CONFIDENCE SUMMARY");
  console.log(JSON.stringify(normalizedConfidence, null, 2));

  printSection("ENGINE FACTS");
  console.log(JSON.stringify(engineFacts, null, 2));

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
  const sectionsToPrint = [
    strategy.buildingSummary,
    strategy.meansOfEscape,
    strategy.compartmentation,
    strategy.fireSpread,
    strategy.firefighting,
    strategy.activeSystems,
    strategy.complianceSummary
  ];

  for (const section of sectionsToPrint) {
    console.log(`\n${section.title}`);
    console.log(`${"-".repeat(section.title.length)}`);
    for (const line of section.content.slice(0, 8)) {
      console.log(`- ${line}`);
    }
  }
}

main();