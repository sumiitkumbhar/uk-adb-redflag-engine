import { describe, it, expect } from "vitest";
import { RULE_LOGIC } from "../lib/ruleLogic";
import { RISK_RULES } from "../lib/riskRules";

describe("RULE_LOGIC Registry", () => {
  it("should export RULE_LOGIC object", () => {
    expect(RULE_LOGIC).toBeDefined();
    expect(typeof RULE_LOGIC).toBe("object");
  });

  it("should not contain duplicate rule IDs", () => {
    const keys = Object.keys(RULE_LOGIC);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it("should have implementation for every risk rule", () => {
    const ruleIds = RISK_RULES.map((r: any) => r.ruleId);
    const missing = ruleIds.filter((id: string) => !(id in RULE_LOGIC));
    expect(missing).toEqual([]);
  });

  it("each rule should return valid status", () => {
    for (const id of Object.keys(RULE_LOGIC)) {
      const result = (RULE_LOGIC as any)[id]({}, {});
      expect(["PASS", "FAIL", "UNKNOWN"]).toContain(result.status);
    }
  });
});