import { riskRules } from "../lib/riskRules";
import fs from "fs";

const out = riskRules.map(r => ({
  rule_id: r.ruleId,
  name: r.title,
  part: r.part,
  severity: r.severity,
  scope: r.scope,
  adb_ref: r.regulatory?.references?.map(ref => ref.ref).join(", ") ?? "",
  condition_summary: r.title,
  mitigation: r.mitigationSteps?.join(" ") ?? ""
}));

fs.writeFileSync("riskRules.json", JSON.stringify(out, null, 2));

console.log("Exported rules to riskRules.json");