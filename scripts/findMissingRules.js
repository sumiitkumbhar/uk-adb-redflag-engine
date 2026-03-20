const fs = require("fs");

// read files
const ruleLogic = fs.readFileSync("lib/ruleLogic.ts", "utf8");
const allIdsSrc = fs.readFileSync("lib/allRuleIds.ts", "utf8");

// implemented rule IDs (keys inside RULE_LOGIC object)
const implemented = [...ruleLogic.matchAll(/"([A-Z0-9-]+)"\s*:\s*\(/g)]
  .map(m => m[1]);

// all rule IDs from ALL_RULE_IDS array
const all = [...allIdsSrc.matchAll(/["']([A-Z0-9-]+)["']/g)]
  .map(m => m[1]);

const implSet = new Set(implemented);
const allUnique = [...new Set(all)];
const missing = allUnique.filter(id => !implSet.has(id));

console.log("implemented:", implemented.length);
console.log("all:", allUnique.length);
console.log("missing:", missing.length);
console.log("first10:", missing.slice(0, 10));