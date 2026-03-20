// scripts/coverageReport.mjs
// COMPLETELY REPLACEABLE FILE
// NOTE: No existing lines removed — only additions + small safe edits.

import fs from "node:fs";

// Usage:
//   node scripts/coverageReport.mjs
//   node scripts/coverageReport.mjs lib/ruleLogic.ts lib/riskRules.ts
//
// Defaults:
//   ruleLogicPath = lib/ruleLogic.ts
//   riskRulesPath = lib/riskRules.ts

const ruleLogicPath = process.argv[2] || "lib/ruleLogic.ts";
const riskRulesPath = process.argv[3] || "lib/riskRules.ts";

const read = (p) => fs.readFileSync(p, "utf8");

// -------------------------
// Extract rule IDs from RULE_LOGIC (existing behaviour)
// -------------------------
function extractRuleLogicIds(tsText) {
  const startIdx = tsText.indexOf("RULE_LOGIC");
  const slice = startIdx !== -1 ? tsText.slice(startIdx) : tsText;

  // keys like: "B4-XYZ-01": (facts, rule) => {
  const keyMatches = [
    ...slice.matchAll(/"([A-Z0-9\-_\.]+-\d{2})"\s*:\s*\(/g),
  ];
  const ids = keyMatches.map((m) => m[1]);

  // detect "Not implemented yet" blocks (existing behaviour)
  const missingIds = [];
  for (let i = 0; i < keyMatches.length; i++) {
    const thisPos = keyMatches[i].index ?? 0;
    const nextPos =
      i + 1 < keyMatches.length
        ? keyMatches[i + 1].index ?? slice.length
        : slice.length;
    const block = slice.slice(thisPos, nextPos);
    if (/reason:\s*"Not implemented yet"/g.test(block))
      missingIds.push(ids[i]);
  }

  return { ids, notImplementedIds: missingIds };
}

// -------------------------
// Extract rule objects from riskRules.ts
// We do NOT execute TS. We do a robust-enough parse for:
//   ruleId: "...."
//   appliesTo: [ ... ]
//   regulatory: { volume: 2, references: [ { ref: "Vol 2, Section 14, ..." } ] }
// -------------------------
function extractRiskRules(tsText) {
  // This finds ruleId fields anywhere. We'll then attempt to capture nearby appliesTo and regulatory.
  // Not perfect, but good enough if your file structure is consistent.
  const ruleIdMatches = [...tsText.matchAll(/ruleId:\s*"([^"]+)"/g)];

  const rules = [];

  for (let i = 0; i < ruleIdMatches.length; i++) {
    const id = ruleIdMatches[i][1];
    const start = ruleIdMatches[i].index ?? 0;
    const end =
      i + 1 < ruleIdMatches.length
        ? ruleIdMatches[i + 1].index ?? tsText.length
        : tsText.length;
    const block = tsText.slice(start, end);

    const appliesTo = [];
    const appliesMatch = block.match(/appliesTo:\s*\[([\s\S]*?)\]/m);
    if (appliesMatch) {
      const raw = appliesMatch[1];
      const tagMatches = [...raw.matchAll(/"([^"]+)"/g)];
      tagMatches.forEach((m) => appliesTo.push(m[1]));
    }

    // volume (prefer explicit)
    let volume = undefined;
    const volMatch = block.match(/volume:\s*([0-9]+)/);
    if (volMatch) volume = Number(volMatch[1]);

    // refs strings
    const refStrings = [];
    const refMatches = [...block.matchAll(/ref:\s*"([^"]+)"/g)];
    refMatches.forEach((m) => refStrings.push(m[1]));

    // NOTE: keep the original shape used elsewhere in this script
    rules.push({ ruleId: id, appliesTo, volume, refStrings });
  }

  return rules;
}

// -------------------------
// Section resolver (Volume 2)
// Priority:
// 1) appliesTo tag: "section:14"
// 2) parse ref strings: "Vol 2, Section 14"
// 3) topic fallback for roof coverings
// -------------------------
function getTagValue(appliesTo, prefix) {
  if (!Array.isArray(appliesTo)) return undefined;
  const hit = appliesTo.find(
    (t) => typeof t === "string" && t.startsWith(prefix)
  );
  return hit ? hit.slice(prefix.length) : undefined;
}

function resolveVol2Section(rule) {
  // 1) explicit
  const tagged = getTagValue(rule.appliesTo, "section:");
  if (tagged) return tagged;

  // 2) parse refs
  for (const r of rule.refStrings || []) {
    const m = String(r).match(/Vol\s*2,\s*Section\s*(\d+)/i);
    if (m?.[1]) return m[1];
  }

  // 3) fallback by topic
  const tags = rule.appliesTo || [];
  const hasRoof =
    tags.includes("topic:roofCoverings") ||
    tags.includes("topic:roof") ||
    tags.includes("topic:roofCovering");
  if (hasRoof) return "14";

  return undefined;
}

// -------------------------
// NEW: inferSectionFromRule + groupBySection
// (adapted to this script's data model: r.refStrings + r.appliesTo)
// -------------------------
function inferSectionFromRule(r) {
  // 0) best signal: explicit tag section:X
  const tagged = getTagValue(r?.appliesTo, "section:");
  if (tagged) return tagged;

  // 1) try explicit "Vol 2, Section X" in refStrings (derived from regulatory.references.ref)
  const refs = Array.isArray(r?.refStrings) ? r.refStrings : [];
  for (const it of refs) {
    const txt = String(it ?? "");
    // Accept both "Vol 2, Section 14" and "Volume 2, Section 14"
    const m = txt.match(/Vol(?:ume)?\s*2[\s,]*Section\s*(\d+)/i);
    if (m) return m[1];
  }

  // 2) fall back: some projects store a single adb ref string in appliesTo or other tags
  // We try to detect patterns like "adbRef:Vol 2, Section 14" if you ever use such tagging.
  const tags = Array.isArray(r?.appliesTo) ? r.appliesTo : [];
  for (const t of tags) {
    const txt = String(t ?? "");
    const m = txt.match(/Vol(?:ume)?\s*2[\s,]*Section\s*(\d+)/i);
    if (m) return m[1];
  }

  // unknown
  return null;
}

function groupBySection(ruleIds, rulesById) {
  const out = {}; // { "12": [...], "??": [...] }
  for (const id of ruleIds) {
    const r = rulesById.get(id);
    const sec = r ? inferSectionFromRule(r) : null;
    const key = sec ?? "??";
    out[key] = out[key] || [];
    out[key].push(id);
  }
  return out;
}

// -------------------------
// Main
// -------------------------
const ruleLogicText = read(ruleLogicPath);
const riskRulesText = read(riskRulesPath);

const logic = extractRuleLogicIds(ruleLogicText);
const rules = extractRiskRules(riskRulesText);

const logicSet = new Set(logic.ids);
const rulesSet = new Set(rules.map((r) => r.ruleId));

const rulesMissingLogic = rules
  .filter((r) => !logicSet.has(r.ruleId))
  .map((r) => r.ruleId);
const logicMissingRule = logic.ids.filter((id) => !rulesSet.has(id));

// Old behaviour totals (logic file)
const total_logic_rule_ids = logic.ids.length;
const not_implemented = logic.notImplementedIds.length;
const implemented = total_logic_rule_ids - not_implemented;

// New: section counts for Volume 2
const vol2Rules = rules.filter(
  (r) => r.volume === 2 || (r.appliesTo || []).includes("volume:2")
);
const vol2Unmapped = [];
const vol2SectionCounts = {}; // { "14": 12, ... }

for (const r of vol2Rules) {
  const sec = resolveVol2Section(r);
  if (!sec) {
    vol2Unmapped.push(r.ruleId);
    continue;
  }
  vol2SectionCounts[sec] = (vol2SectionCounts[sec] || 0) + 1;
}

// NEW: group unmapped by inferred section (or "??")
const rulesById = new Map(rules.map((r) => [r.ruleId, r]));
const volume2_unmapped_by_section = groupBySection(vol2Unmapped, rulesById);

console.log(
  JSON.stringify(
    {
      // keep old fields so you don’t break whatever expects them
      file: ruleLogicPath,
      total_rule_ids: total_logic_rule_ids,
      implemented,
      not_implemented,
      first10_missing_ids: logic.notImplementedIds.slice(0, 10),
      missing_ids: logic.notImplementedIds.slice(0, 3),

      // NEW (actual coverage/matrix)
      riskRulesFile: riskRulesPath,
      total_risk_rules: rules.length,
      rules_missing_logic: rulesMissingLogic,
      logic_missing_rule: logicMissingRule,

      volume2_total_rules: vol2Rules.length,
      volume2_unmapped_rules: vol2Unmapped,
      volume2_unmapped_by_section,
      volume2_section_counts: vol2SectionCounts,
    },
    null,
    2
  )
);