import { describe, it, expect } from "vitest";
import { RISK_RULES } from "../lib/riskRules";

describe("RISK_RULES Integrity", () => {
  it("should export non-empty array", () => {
    expect(Array.isArray(RISK_RULES)).toBe(true);
    expect(RISK_RULES.length).toBeGreaterThan(0);
  });

  it("each rule must have required properties", () => {
    for (const rule of RISK_RULES as any[]) {
      expect(typeof rule.ruleId).toBe("string");
      expect(rule.ruleId.length).toBeGreaterThan(0);
      expect(rule.title).toBeDefined();
      expect(rule.part).toBeDefined();
      expect(rule.severity).toBeDefined();
      expect(rule.scope).toBeDefined();
      expect(rule.evaluationType).toBeDefined();
      expect(rule.regulatory).toBeDefined();
    }
  });

  it("ruleIds must be unique", () => {
    const ids = RISK_RULES.map((r: any) => r.ruleId);

    const counts = new Map<string, number>();
    for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);

    const duplicates = [...counts.entries()]
      .filter(([, c]) => c > 1)
      .map(([id, c]) => ({ id, count: c }));

    // If it fails, Vitest will show you exactly which IDs are duplicated
    expect(duplicates).toEqual([]);
  });
});