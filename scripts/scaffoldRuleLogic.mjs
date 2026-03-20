import fs from "fs";

// READ cleaned rules from /lib
const src = fs.readFileSync("../lib/riskRules.cleaned.ts", "utf8");

// Extract rule IDs
const ids = [...src.matchAll(/rule_id:\s*"([^"]+)"/g)].map(m => m[1]);
const unique = [...new Set(ids)].sort();

// Generate scaffold
const out =
`// AUTO-SCAFFOLDED: fill each evaluator deterministically.
// Do NOT edit riskRules.cleaned.ts for logic; implement here.

import type { BuildingFacts } from "./types";
import type { RiskRule } from "./riskRules.cleaned";

export type RuleEval = {
  status: "PASS" | "FAIL" | "UNKNOWN";
  reason: string;
  evidence: string[];
};

type EvalFn = (facts: BuildingFacts, rule: RiskRule) => RuleEval;

export const RULE_LOGIC: Record<string, EvalFn> = {
` +
unique.map(id =>
`  "${id}": (_facts, _rule) => ({
    status: "UNKNOWN",
    reason: "Not implemented yet",
    evidence: [],
  }),
`
).join("") +
`};
`;

fs.writeFileSync("../lib/ruleLogic.scaffold.ts", out, "utf8");
console.log("Wrote lib/ruleLogic.scaffold.ts with", unique.length, "rule_ids");
