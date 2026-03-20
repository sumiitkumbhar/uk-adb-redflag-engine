/* eslint-disable no-console */

import { riskRules } from "../lib/riskRules";
import { RULE_FACT_MAP } from "../lib/ui/ruleFactMap";
import { FACT_ONTOLOGY } from "../lib/factOntology";

function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function main() {
  const missingRuleMapEntries: Array<{
    ruleId: string;
    title: string;
    required: string[];
  }> = [];

  const missingOntologyKeys = new Set<string>();

  for (const rule of riskRules) {
    const required = uniq((rule.inputs?.required ?? []).filter(Boolean));
    const mapped = uniq((RULE_FACT_MAP[rule.ruleId] ?? []).filter(Boolean));

    if (mapped.length === 0) {
      missingRuleMapEntries.push({
        ruleId: rule.ruleId,
        title: rule.title,
        required,
      });
    }

    for (const key of mapped) {
      if (!(key in FACT_ONTOLOGY)) {
        missingOntologyKeys.add(key);
      }
    }
  }

  console.log("==========================================");
  console.log("SCAFFOLD: MISSING RULE_FACT_MAP ENTRIES");
  console.log("==========================================");
  console.log("");

  for (const item of missingRuleMapEntries) {
    console.log(`// ${item.title}`);
    console.log(`"${item.ruleId}": [`);
    for (const key of item.required) {
      console.log(`  "${key}",`);
    }
    console.log("],");
    console.log("");
  }

  console.log("==========================================");
  console.log("SCAFFOLD: MISSING FACT ONTOLOGY ENTRIES");
  console.log("==========================================");
  console.log("");

  for (const key of Array.from(missingOntologyKeys).sort()) {
    console.log(`"${key}": {`);
    console.log(`  key: "${key}",`);
    console.log(`  label: "${key}",`);
    console.log(`  category: "other",`);
    console.log(`  type: "text",`);
    console.log("},");
    console.log("");
  }

  console.log("==========================================");
  console.log("SUMMARY");
  console.log("==========================================");
  console.log(`Missing RULE_FACT_MAP entries: ${missingRuleMapEntries.length}`);
  console.log(`Missing ontology keys: ${missingOntologyKeys.size}`);
}

main();