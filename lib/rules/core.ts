// app/lib/rules/core.ts
import { Building, FireRule, RuleResult } from "../types";

const isNonDomesticPG = (pg: string) => ["2a","2b","3","4","5"].includes(pg);

// Helper for V1-W-01 [file:2]
export function validateEscapeWindow(
  buildingId: string,
  roomId: string,
  win: any
): RuleResult | null {
  if (!win) return null;
  const { clearWidth_mm, clearHeight_mm, cillHeight_mm } = win;
  const area_m2 = (clearWidth_mm / 1000) * (clearHeight_mm / 1000);

  const ok =
    clearWidth_mm >= 450 &&
    clearHeight_mm >= 450 &&
    area_m2 >= 0.33 &&
    cillHeight_mm <= 1100;

  return {
    ruleId: "V1-W-01",
    passed: ok,
    severity: ok ? "info" : "major",
    buildingId,
    locationRef: `room:${roomId}`,
    message: ok
      ? "Escape window geometry compliant."
      : `Escape window in ${roomId} fails geometry: ${clearWidth_mm}x${clearHeight_mm}mm, cill ${cillHeight_mm}mm.`,
    details: { clearWidth_mm, clearHeight_mm, cillHeight_mm, area_m2 }
  };
}

// V1-MOE-01: House – ground storey escape [file:2]
export const Rule_V1_MOE_01: FireRule = {
  id: "V1-MOE-01",
  title: "House – ground storey escape",
  description:
    "Every habitable room at ground level (excluding kitchens) must either open onto a hall leading to a final exit or have a compliant escape window/door.",
  severity: "critical",
  source: { volume: 1, paragraph: "2.1", diagram: "2.1" },

  applies(b) {
    return b.volume === 1;
  },

  evaluate(b) {
    const results: RuleResult[] = [];
    const groundStorey = b.storeys.find(s => !s.isBasement && s.index === 0);
    if (!groundStorey) return results;

    for (const room of groundStorey.rooms) {
      if (!room.isHabitable || room.type === "kitchen") continue;

      const okDoor = room.hasDoorToHallLeadingToFinalExit === true;
      let okWindow = false;

      if (room.hasEscapeWindow && room.escapeWindow) {
        const winRes = validateEscapeWindow(b.id, room.id, room.escapeWindow);
        if (winRes) {
          results.push(winRes);
          okWindow = winRes.passed;
        }
      }

      const passed = okDoor || okWindow;
      results.push({
        ruleId: "V1-MOE-01",
        passed,
        severity: "critical",
        buildingId: b.id,
        locationRef: `storey:${groundStorey.index}/room:${room.id}`,
        message: passed
          ? "Ground habitable room has compliant escape route."
          : "Ground habitable room lacks door to hall leading to final exit and has no compliant escape window.",
        details: { okDoor, okWindow }
      });
    }

    return results;
  }
};

// V2-TD-01: Travel distance in one direction (simplified) [file:2]
export const Rule_V2_TD_01: FireRule = {
  id: "V2-TD-01",
  title: "Travel distance in one direction",
  description:
    "Travel distance in one direction from any point to a storey exit must not exceed ADB Table 2.1 for the relevant purpose group.",
  severity: "critical",
  source: { volume: 2, table: "2.1", paragraph: "Table 2.1" },

  applies(b) {
    return b.volume === 2 && isNonDomesticPG(b.purposeGroup);
  },

  evaluate(b) {
    const results: RuleResult[] = [];

    const maxOneDirByPG: Record<string, number> = {
      "2a": 9,
      "2b": 18,
      "3": 18,
      "4": 18,
      "5": 18
    };

    const limit = maxOneDirByPG[b.purposeGroup];
    if (!limit) return results;

    for (const storey of b.storeys) {
      if (storey.isBasement) continue;
      for (const room of storey.rooms) {
        if (room.travelOneDirection_m == null) continue;

        const passed = room.travelOneDirection_m <= limit;
        results.push({
          ruleId: "V2-TD-01",
          passed,
          severity: "critical",
          buildingId: b.id,
          locationRef: `storey:${storey.index}/room:${room.id}`,
          message: passed
            ? `Travel one-direction (${room.travelOneDirection_m} m) within ${limit} m.`
            : `Travel one-direction (${room.travelOneDirection_m} m) exceeds ${limit} m for PG ${b.purposeGroup}.`,
          details: { measured: room.travelOneDirection_m, limit }
        });
      }
    }

    return results;
  }
};

export const ALL_RULES: FireRule[] = [
  Rule_V1_MOE_01,
  Rule_V2_TD_01
];
