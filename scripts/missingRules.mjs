import fs from "node:fs";

const targetFile = process.argv[2] || "lib/ruleLogic.ts";

// 1) Read the ruleLogic file
const src = fs.readFileSync(targetFile, "utf8");

// 2) Extract implemented rule IDs from RULE_LOGIC keys:  "B1-...": (
const implemented = [...src.matchAll(/"([A-Z0-9-]+)"\s*:\s*\(/g)].map(m => m[1]);
const implSet = new Set(implemented);

// 3) Extract ALL rule IDs from your file by looking for ruleid lines if they exist
// If your repo stores rule IDs in another format, update this regex accordingly.
const all = [...src.matchAll(/\bruleid\s+([A-Z0-9-]+)/g)].map(m => m[1]);
const allUnique = [...new Set(all)];

// 4) Compute missing
const missing = allUnique.filter(id => !implSet.has(id));

console.log(JSON.stringify({
  file: targetFile,
  implemented: implemented.length,
  all: allUnique.length,
  missing: missing.length,
  first10: missing.slice(0, 10),
  missingIds: missing
}, null, 2));