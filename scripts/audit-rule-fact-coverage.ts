/* eslint-disable no-console */
import { riskRules } from "../lib/riskRules";
import { RULE_FACT_MAP } from "../lib/ui/ruleFactMap";
import { FACT_ONTOLOGY, getFactDefinition } from "../lib/factOntology";

type CoverageRow = {
  ruleId: string;
  title: string;
  part: string;
  severity: string;
  requiredInputs: string[];
  mappedFacts: string[];
  unmappedRequired: string[];
  unknownMappedFacts: string[];
  score: number;
};

function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function scoreRow(row: CoverageRow): number {
  const totalRequired = row.requiredInputs.length || 1;
  const covered = totalRequired - row.unmappedRequired.length;
  return Number(((covered / totalRequired) * 100).toFixed(1));
}

function main() {
  const rows: CoverageRow[] = riskRules.map((rule) => {
    const requiredInputs = uniq((rule.inputs?.required ?? []).filter(Boolean));
    const mappedFacts = uniq((RULE_FACT_MAP[rule.ruleId] ?? []).filter(Boolean));

    const unmappedRequired = requiredInputs.filter(
      (key) => !mappedFacts.includes(key)
    );

    const unknownMappedFacts = mappedFacts.filter(
      (key) => !getFactDefinition(key)
    );

    const row: CoverageRow = {
      ruleId: rule.ruleId,
      title: rule.title,
      part: rule.part,
      severity: rule.severity,
      requiredInputs,
      mappedFacts,
      unmappedRequired,
      unknownMappedFacts,
      score: 0
    };

    row.score = scoreRow(row);
    return row;
  });

  const worstRows = [...rows]
    .sort((a, b) => a.score - b.score || a.ruleId.localeCompare(b.ruleId));

  const totallyUnmapped = worstRows.filter((r) => r.mappedFacts.length === 0);
  const partial = worstRows.filter(
    (r) => r.mappedFacts.length > 0 && r.unmappedRequired.length > 0
  );
  const ontologyGaps = worstRows.filter((r) => r.unknownMappedFacts.length > 0);

  console.log("==========================================");
  console.log("RULE FACT COVERAGE AUDIT");
  console.log("==========================================");
  console.log(`Total rules: ${rows.length}`);
  console.log(`Ontology facts: ${Object.keys(FACT_ONTOLOGY).length}`);
  console.log(`Totally unmapped rules: ${totallyUnmapped.length}`);
  console.log(`Partially mapped rules: ${partial.length}`);
  console.log(`Mapped facts missing ontology definitions: ${ontologyGaps.length}`);
  console.log("");

  console.log("---- 25 WORST RULES ----");
  for (const row of worstRows.slice(0, 25)) {
    console.log(
      `${row.ruleId} | score=${row.score}% | required=${row.requiredInputs.length} | mapped=${row.mappedFacts.length}`
    );
    if (row.unmappedRequired.length) {
      console.log(`  unmappedRequired: ${row.unmappedRequired.join(", ")}`);
    }
    if (row.unknownMappedFacts.length) {
      console.log(`  unknownMappedFacts: ${row.unknownMappedFacts.join(", ")}`);
    }
  }

  console.log("");
  console.log("---- FULLY UNMAPPED RULES ----");
  for (const row of totallyUnmapped) {
    console.log(`${row.ruleId} | ${row.title}`);
  }

  console.log("");
  console.log("---- ONTOLOGY GAPS ----");
  for (const row of ontologyGaps) {
    console.log(`${row.ruleId} -> ${row.unknownMappedFacts.join(", ")}`);
  }
}

main();
