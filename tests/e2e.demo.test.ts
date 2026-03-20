import { describe, it, expect } from "vitest";
import { evaluateAll } from "../lib/evaluateAll";

describe("End-to-end demo", () => {
  it("runs evaluation on sample building", () => {
    const facts = {
      buildingHeightM: 22,
      hasACMCladding: true,
      cavityBarriersPresent: false,
    };

    const results = evaluateAll([], facts);

    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });
});