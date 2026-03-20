const fs = require("fs");

const inPath = "riskRules.ts";
const outPath = "riskRules.cleaned.ts";

let s = fs.readFileSync(inPath, "utf8");

// 1) Rename wrong keys -> correct keys
s = s
  .replace(/\bruleid\s*:/g, "rule_id:")
  .replace(/\badbvolume\s*:/g, "adb_volume:")
  .replace(/\badbref\s*:/g, "adb_ref:")
  .replace(/\bconditionsummary\s*:/g, "condition_summary:")
  .replace(/\btypicalinputs\s*:/g, "typical_inputs:");

// 2) Ensure every object has mitigation (only for objects that look like our appended ones)
// Add mitigation before closing "}," when missing
s = s.replace(
  /(\{\s*[\s\S]*?\brule_id\s*:\s*"[^"]+"[\s\S]*?\btypical_inputs\s*:\s*\[[\s\S]*?\]\s*,\s*)(\}\s*,)/g,
  (m, p1, p2) => {
    if (/\bmitigation\s*:/.test(m)) return m;
    return `${p1}mitigation: "Review design against AD B and update drawings/specification to meet this rule.",\n  ${p2}`;
  }
);

// 3) Comment out the known duplicate-ID blocks (the ones that originally came from ruleid and collided)
// If both exist, keep the original rule_id version and comment the later one.
// This is a blunt but safe approach: comment out any SECOND occurrence of the same rule_id.
const ids = [];
s = s.replace(/\brule_id\s*:\s*"([^"]+)"/g, (m, id) => {
  if (ids.includes(id)) {
    return `/* DUPLICATE REMOVED: ${m} */ rule_id: "${id}__DUPLICATE__"`;
  }
  ids.push(id);
  return m;
});

fs.writeFileSync(outPath, s, "utf8");
console.log(`Wrote ${outPath}`);
