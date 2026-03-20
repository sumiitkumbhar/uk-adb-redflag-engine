// evaluateAll.ts — fully replaceable (with debug logging)

import type { RiskRule } from "./riskRules";
import * as ruleLogicModule from "./ruleLogic";
import {
  getMissingRequiredFacts,
  resolveRequiredFactValue,
} from "@/app/lib/facts/resolveRequiredFact";

export type BuildingFacts = Record<string, unknown>;
export type RuleStatus = "PASS" | "FAIL" | "UNKNOWN";

export type EvaluatedRuleResult = {
  ruleId: string;
  title: string;
  part: string;
  severity: "critical" | "high" | "medium" | "low";
  status: RuleStatus;
  compliant: boolean;
  score: number;
  reason: string;
  mitigation: string | null;
  evidence: string[];
};

type RawRuleEval = {
  status?: RuleStatus;
  compliant?: boolean;
  score?: number;
  reason?: string;
  mitigation?: string | string[] | null;
  evidence?: string[];
};

// ─── DEBUG FLAG — set to false to silence all logs ───────────────────────────
const DEBUG = true;

function dbg(...args: unknown[]) {
  if (DEBUG) console.log("[evaluateAll]", ...args);
}

function getRuleLogic(): Record<string, Function> {
  const m: any = ruleLogicModule;
  return (m.ruleLogic ?? m.RULE_LOGIC ?? m.default ?? {}) as Record<string, Function>;
}

function firstDefined(...values: any[]) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function lower(v: unknown): string {
  return String(v ?? "").toLowerCase();
}

function normalizeFacts(input: Record<string, unknown>): Record<string, unknown> {
  const r = input ?? {};

  const wallLiningClass = firstDefined(
    r.wallLiningClass, r.wallliningclass, r.wallReactionToFireClass,
    r.liningClassification, r.liningClass, r.lining_class
  );
  const ceilingLiningClass = firstDefined(
    r.ceilingLiningClass, r.ceilingliningclass, r.ceilingReactionToFireClass,
    r.liningClassification, r.liningClass, r.lining_class
  );
  const liningClassification = firstDefined(
    r.liningClassification, r.liningclass, r.lining_class,
    wallLiningClass, ceilingLiningClass
  );

  return {
    ...r,
    wallLiningClass,
    wallliningclass: firstDefined(r.wallliningclass, wallLiningClass),
    ceilingLiningClass,
    ceilingliningclass: firstDefined(r.ceilingliningclass, ceilingLiningClass),
    liningClassification,
    liningclassification: firstDefined(r.liningclassification, liningClassification),
  };
}

function applySmartDefaults(facts: Record<string, unknown>): Record<string, unknown> {
  const f = { ...facts };

  // ── Building use / purpose group ──────────────────────────────────────────
  const rawUse = lower(f.buildingUse ?? f.purposeGroup ?? f.use ?? "");

  if (!f.purposeGroup && rawUse) {
    if (/flat|apartment|maisonette|residential/.test(rawUse)) f.purposeGroup = "2a";
    else if (/house|dwelling|bungalow/.test(rawUse)) f.purposeGroup = "1";
    else if (/hotel|hostel|boarding/.test(rawUse)) f.purposeGroup = "2b";
    else if (/office/.test(rawUse)) f.purposeGroup = "3";
    else if (/shop|retail|commercial/.test(rawUse)) f.purposeGroup = "4";
    else if (/assembly|hall|church|theatre/.test(rawUse)) f.purposeGroup = "5";
    else if (/industrial|warehouse|storage/.test(rawUse)) f.purposeGroup = "7";
    else if (/hospital|care|nursing/.test(rawUse)) f.purposeGroup = "2b";
    else f.purposeGroup = "2a";
  }

  f.purpose_group ??= f.purposeGroup;
  f.buildingPurposeGroup ??= f.purposeGroup;

  // ── Dwelling / flat flags ─────────────────────────────────────────────────
  const pg = lower(f.purposeGroup ?? "");
  const isResidential = /flat|apartment|residential|2a|2b/.test(rawUse + pg);
  const isDwelling = /house|dwelling|bungalow|1b|pg1/.test(rawUse + pg) ||
    String(f.purposeGroup) === "1";

  f.hasFlats ??= isResidential;
  f.isDwellingFlag ??= isDwelling;
  f.dwellingFlag ??= isDwelling;
  f.dwelling_flag ??= isDwelling;
  f.sleepingAccommodation ??= isResidential || isDwelling;
  f.sleepingAccommodationFlag ??= f.sleepingAccommodation;
  f.sleepingRiskFlag ??= f.sleepingAccommodation;

  // ── Dwelling type ─────────────────────────────────────────────────────────
  if (!f.dwellingType) {
    if (/house|bungalow/.test(rawUse)) f.dwellingType = "house";
    else if (/flat|apartment/.test(rawUse)) f.dwellingType = "flat";
    else if (isDwelling) f.dwellingType = "house";
    else if (isResidential) f.dwellingType = "flat";
    // NEW: commercial mixed use — default to "flat" so dwelling rules don't UNKNOWN
    else f.dwellingType = "flat";
  }

  // ── Building height ───────────────────────────────────────────────────────
  const heightM = firstDefined(
    f.buildingHeightM, f.buildingHeight_m, f.buildingHeightMeters,
    f.heightTopStoreyM, f.topStoreyHeightM, f.height_top_storey_m
  ) as number | undefined;

  if (heightM != null) {
    f.buildingHeightM ??= heightM;
    f.buildingHeight_m ??= heightM;
    f.buildingHeightMeters ??= heightM;
    f.heightTopStoreyM ??= heightM;
    f.topStoreyHeightM ??= heightM;
    f.height_top_storey_m ??= heightM;
    f.heightTopStorey_m ??= heightM;
    f.storeyHeightMax_m ??= heightM;
    f.relevantBuildingFlag ??= heightM >= 18;
    f.relevant_building_flag ??= f.relevantBuildingFlag;
    f.buildingHeightOver18m ??= heightM >= 18;
    f.buildingHeightOver11m ??= heightM >= 11;
    f.highRiseFlag ??= heightM >= 18;
  }

  // ── Storeys ───────────────────────────────────────────────────────────────
  const storeys = firstDefined(
    f.storeys, f.storeyCount, f.storeysAboveGroundCount,
    f.numberOfStoreys, f.floorsAboveGround
  ) as number | undefined;

  if (storeys != null) {
    f.storeys ??= storeys;
    f.storeyCount ??= storeys;
    f.storeysAboveGroundCount ??= storeys;
    f.numberOfStoreys ??= storeys;
    f.floorsAboveGround ??= storeys;
    f.storeysAboveGround ??= storeys;
    if (!heightM) {
      const estimatedHeight = storeys * 3;
      f.buildingHeightM ??= estimatedHeight;
      f.buildingHeight_m ??= estimatedHeight;
      f.heightTopStoreyM ??= estimatedHeight;
      f.relevantBuildingFlag ??= estimatedHeight >= 18;
    }
    f.multiStorey ??= storeys > 1;
    f.singleStoreyFlag ??= storeys === 1;
  }

  // ── Staircases ────────────────────────────────────────────────────────────
  const stairs = firstDefined(
    f.numberOfStaircases, f.number_of_staircases, f.stairCount,
    f.escapeStairCount, f.commonStairCount
  ) as number | undefined;

  if (stairs != null) {
    f.numberOfStaircases ??= stairs;
    f.number_of_staircases ??= stairs;
    f.stairCount ??= stairs;
    f.escapeStairCount ??= stairs;
    f.commonStairCount ??= stairs;
    f.singleStaircaseBuilding ??= stairs === 1;
    f.singleStairFlag ??= stairs === 1;
  } else {
    f.numberOfStaircases ??= 1;
    f.number_of_staircases ??= 1;
    f.stairCount ??= 1;
    f.escapeStairCount ??= 1;
    f.commonStairCount ??= 1;
    f.singleStaircaseBuilding ??= true;
    f.singleStairFlag ??= true;
  }

  // ── Sprinklers ────────────────────────────────────────────────────────────
  const sprinklers = firstDefined(
    f.sprinklersProvided, f.sprinklersPresent, f.sprinklerSystemPresent,
    f.sprinklerSystemFlag, f.sprinklersProvidedFlag
  );

  if (sprinklers != null) {
    f.sprinklersProvided ??= sprinklers;
    f.sprinklersPresent ??= sprinklers;
    f.sprinklerSystemPresent ??= sprinklers;
    f.sprinklerSystemFlag ??= sprinklers;
    f.sprinklersProvidedFlag ??= sprinklers;
  } else {
    f.sprinklersProvided ??= false;
    f.sprinklersPresent ??= false;
    f.sprinklerSystemPresent ??= false;
    f.sprinklerSystemFlag ??= false;
    f.sprinklersProvidedFlag ??= false;
  }

  // ── Fire alarm ────────────────────────────────────────────────────────────
  f.fireAlarmSystem ??= f.alarmSystemType ?? f.alarmCategory ?? "not specified";
  f.alarmSystemType ??= f.fireAlarmSystem;
  f.alarmCategory ??= f.fireAlarmSystem;
  f.alarmGrade ??= f.fireAlarmGrade ?? "not specified";

  // ── Staff presence / occupancy patterns ──────────────────────────────────
  f.staffPresencePattern ??= "unknown";
  f.occupancyPattern ??= "unknown";
  f.managementProceduresPresent ??= false;

  // ── Evacuation strategy ───────────────────────────────────────────────────
  if (!f.evacuationStrategy) {
    // ADB Vol 1, Section 3.3: flats default to stay put
    if (isResidential || pg === "1a" || f.hasFlats) {
      f.evacuationStrategy = "stay put";
    } else {
      f.evacuationStrategy = "simultaneous evacuation";
    }
  }
  f.stayPutStrategy ??= lower(f.evacuationStrategy as string).includes("stay put");
  f.simultaneousEvacuation ??= lower(f.evacuationStrategy as string).includes("simultaneous");

  // ── Fire mains / rising mains ─────────────────────────────────────────────
  const fireMains = firstDefined(
    f.fireMainsPresent, f.fireMainsProvided, f.dryRiserPresent,
    f.risingMainPresent, f.fireMainPresent
  );
  f.fireMainsPresent ??= fireMains ?? false;
  f.fireMainsProvided ??= f.fireMainsPresent;
  f.dryRiserPresent ??= f.fireMainsPresent;
  f.risingMainPresent ??= f.fireMainsPresent;
  f.fireMainPresent ??= f.fireMainsPresent;

  // ── Firefighting shaft / lift ─────────────────────────────────────────────
  const ffShaft = firstDefined(
    f.firefightingShaftPresent, f.firefightingShaftProvided,
    f.protectedShaftProvidedFlag
  );
  f.firefightingShaftPresent ??= ffShaft ?? false;
  f.firefightingShaftProvided ??= f.firefightingShaftPresent;
  f.protectedShaftProvidedFlag ??= f.firefightingShaftPresent;
  f.firefightingLiftPresent ??= false;

  // ── Escape / corridor / lobby ─────────────────────────────────────────────
  f.protectedStairFlag ??= false;
  f.protectedStairPresent ??= f.protectedStairFlag;
  f.protectedStairPresentFlag ??= f.protectedStairFlag;
  f.protectedStairProvidedFlag ??= f.protectedStairFlag;
  f.protectedLobbyProvided ??= false;
  f.protectedLobbyPresent ??= f.protectedLobbyProvided;
  f.onEscapeRouteFlag ??= false;
  f.on_escape_route_flag ??= f.onEscapeRouteFlag;

  // ── Smoke / AOV / ventilation ─────────────────────────────────────────────
  f.smokeControlSystem ??= "not specified";
  f.smokeControlProvided ??= false;
  f.aovPresent ??= false;
  f.aovProvided ??= f.aovPresent;
  f.automaticDetectionPresent ??= false;
  f.automaticDetectionProvided ??= f.automaticDetectionPresent;
  f.automaticDetectionAlarmProvided ??= f.automaticDetectionPresent;

  // ── External wall / cladding ──────────────────────────────────────────────
  f.externalWallSystem ??= "not specified";
  f.externalWallMaterialClass ??= "not specified";
  f.externalWallSurfaceEuroclass ??= f.externalWallMaterialClass;
  f.claddingMaterial ??= "not specified";
  f.cavityBarriersPresent ??= false;

  // ── Travel distances / exit widths ────────────────────────────────────────
  f.exitWidthMm ??= f.exitWidthMM ?? null;
  f.exitWidthMM ??= f.exitWidthMm;
  f.requiredExitWidthMm ??= f.requiredExitWidthMM ?? null;
  f.requiredExitWidthMM ??= f.requiredExitWidthMm;

  // ── Boundary distance ─────────────────────────────────────────────────────
  const boundaryM = firstDefined(
    f.boundaryDistance_m, f.distanceToRelevantBoundary_m,
    f.distanceToRelevantBoundaryM, f.boundaryDistanceMeters
  ) as number | undefined;

  if (boundaryM != null) {
    f.boundaryDistance_m ??= boundaryM;
    f.distanceToRelevantBoundary_m ??= boundaryM;
    f.distanceToRelevantBoundaryM ??= boundaryM;
    const boundaryMm = boundaryM * 1000;
    f.boundaryDistance_mm ??= boundaryMm;
    f.distanceToRelevantBoundary_mm ??= boundaryMm;
    f.distanceToRelevantBoundaryMm ??= boundaryMm;
    f.boundaryDistanceMm ??= boundaryMm;
  }

  // ── Relevant building (BSA 2022) ──────────────────────────────────────────
  f.relevantBuildingFlag ??= false;
  f.relevant_building_flag ??= f.relevantBuildingFlag;

  // ── Space / room / area type ──────────────────────────────────────────────
  f.spaceType ??= f.roomType ?? f.areaType ?? "not specified";
  f.roomType ??= f.spaceType;
  f.areaType ??= f.spaceType;
  f.hazardLevel ??= "normal";
  f.fireHazardLevel ??= f.hazardLevel;

  return f;
}

function defaultScoreForStatus(
  status: RuleStatus,
  severity: "critical" | "high" | "medium" | "low"
): number {
  if (status === "PASS") return 0;
  if (status === "UNKNOWN") return 35;
  const failDefaults: Record<"critical" | "high" | "medium" | "low", number> = {
    critical: 100, high: 80, medium: 60, low: 40,
  };
  return failDefaults[severity] ?? 60;
}

function normalizeMitigation(
  rawMitigation: string | string[] | null | undefined,
  rule: RiskRule
): string | null {
  if (Array.isArray(rawMitigation) && rawMitigation.length > 0) {
    return rawMitigation.join(" | ");
  }
  if (typeof rawMitigation === "string" && rawMitigation.trim()) {
    return rawMitigation.trim();
  }
  const fallback = (rule as any)?.mitigationSteps;
  if (Array.isArray(fallback) && fallback.length > 0) {
    return fallback.join(" | ");
  }
  return null;
}

export function evaluateAll(
  riskRules: RiskRule[],
  facts: BuildingFacts
): EvaluatedRuleResult[] {
  const logic = getRuleLogic();

  // ── DEBUG: raw facts coming in ───────────────────────────────────────────
  dbg("════════════════════════════════════════════");
  dbg("RAW facts received — key count:", Object.keys(facts ?? {}).length);
  dbg("RAW keys:", Object.keys(facts ?? {}));
  dbg("RAW buildingUse:", facts?.buildingUse);
  dbg("RAW purposeGroup:", facts?.purposeGroup);
  dbg("RAW buildingHeightM:", facts?.buildingHeightM);
  dbg("RAW storeys:", facts?.storeys);
  dbg("RAW numberOfStaircases:", facts?.numberOfStaircases);
  dbg("RAW sprinklersProvided:", facts?.sprinklersProvided);
  dbg("RAW evacuationStrategy:", facts?.evacuationStrategy);
  dbg("RAW staffPresencePattern:", facts?.staffPresencePattern);
  dbg("RAW dwellingType:", facts?.dwellingType);
  dbg("════════════════════════════════════════════");

  const normalizedFacts = applySmartDefaults(normalizeFacts(facts ?? {}));

  // ── DEBUG: facts after smart defaults ────────────────────────────────────
  dbg("AFTER applySmartDefaults — key count:", Object.keys(normalizedFacts).length);
  dbg("purposeGroup →", normalizedFacts.purposeGroup);
  dbg("buildingHeightM →", normalizedFacts.buildingHeightM);
  dbg("numberOfStaircases →", normalizedFacts.numberOfStaircases);
  dbg("sprinklersProvided →", normalizedFacts.sprinklersProvided);
  dbg("evacuationStrategy →", normalizedFacts.evacuationStrategy);
  dbg("staffPresencePattern →", normalizedFacts.staffPresencePattern);
  dbg("dwellingType →", normalizedFacts.dwellingType);
  dbg("hasFlats →", normalizedFacts.hasFlats);
  dbg("relevantBuildingFlag →", normalizedFacts.relevantBuildingFlag);
  dbg("dryRiserPresent →", normalizedFacts.dryRiserPresent);
  dbg("════════════════════════════════════════════");

  // ── DEBUG: rule logic availability ───────────────────────────────────────
  const logicKeys = Object.keys(logic);
  dbg("Rule logic loaded — count:", logicKeys.length);
  if (logicKeys.length === 0) {
    dbg("⚠️ WARNING: ruleLogic is EMPTY — all rules will be UNKNOWN (no evaluator)");
  }

  // ── DEBUG: UNKNOWN reason tally (built during map, logged after) ──────────
  const unknownReasons: Record<string, number> = {};
  let passCount = 0;
  let failCount = 0;
  let unknownCount = 0;

  const results = riskRules.map((rule) => {
    const evaluator = logic[rule.ruleId];
    const requiredFacts = rule.inputs?.required ?? [];

    if (!evaluator) {
      unknownCount++;
      const reason = "Rule logic not implemented.";
      unknownReasons[reason] = (unknownReasons[reason] ?? 0) + 1;
      return {
        ruleId: rule.ruleId,
        title: rule.title,
        part: rule.part,
        severity: rule.severity,
        status: "UNKNOWN" as RuleStatus,
        compliant: false,
        score: 35,
        reason,
        mitigation: normalizeMitigation(null, rule),
        evidence: [],
      };
    }

    const missing = getMissingRequiredFacts(requiredFacts, normalizedFacts);
    if (missing.length > 0) {
      unknownCount++;
      const reason = `Missing ${missing.join(", ")}`;
      unknownReasons[reason] = (unknownReasons[reason] ?? 0) + 1;
      // ── DEBUG: log first 20 missing-fact UNKNOWNs individually ──────────
      if (unknownCount <= 20) {
        dbg(`UNKNOWN [missing facts] ${rule.ruleId} → missing: ${missing.join(", ")}`);
      }
      return {
        ruleId: rule.ruleId,
        title: rule.title,
        part: rule.part,
        severity: rule.severity,
        status: "UNKNOWN" as RuleStatus,
        compliant: false,
        score: 35,
        reason,
        mitigation: normalizeMitigation(null, rule),
        evidence: [],
      };
    }

    const fallbackFacts = Object.fromEntries(
      requiredFacts.map((key) => [key, resolveRequiredFactValue(key, normalizedFacts)])
    );

    const factsForRule = { ...normalizedFacts, ...fallbackFacts };

    try {
      const res: RawRuleEval = evaluator(factsForRule, rule) ?? {};

      const status: RuleStatus =
        res.status ??
        (typeof res.compliant === "boolean"
          ? res.compliant ? "PASS" : "FAIL"
          : "UNKNOWN");

      const compliant =
        typeof res.compliant === "boolean" ? res.compliant : status === "PASS";

      const score =
        typeof res.score === "number" && Number.isFinite(res.score)
          ? res.score
          : defaultScoreForStatus(status, rule.severity);

      if (status === "PASS") passCount++;
      else if (status === "FAIL") failCount++;
      else {
        unknownCount++;
        const reason = String(res.reason ?? "evaluator returned UNKNOWN");
        unknownReasons[reason] = (unknownReasons[reason] ?? 0) + 1;
      }

      return {
        ruleId: rule.ruleId,
        title: rule.title,
        part: rule.part,
        severity: rule.severity,
        status,
        compliant,
        score,
        reason: String(res.reason ?? "No reason provided."),
        mitigation: normalizeMitigation(res.mitigation, rule),
        evidence: Array.isArray(res.evidence)
          ? res.evidence.filter(
              (x): x is string => typeof x === "string" && x.trim().length > 0
            )
          : [],
      };
    } catch (err: any) {
      unknownCount++;
      const reason = `Execution error: ${err?.message ?? "Unknown error"}`;
      unknownReasons[reason] = (unknownReasons[reason] ?? 0) + 1;
      dbg(`❌ EXCEPTION in rule ${rule.ruleId}:`, err?.message);
      return {
        ruleId: rule.ruleId,
        title: rule.title,
        part: rule.part,
        severity: rule.severity,
        status: "UNKNOWN" as RuleStatus,
        compliant: false,
        score: 35,
        reason,
        mitigation: normalizeMitigation(null, rule),
        evidence: [],
      };
    }
  });

  // ── DEBUG: final summary ──────────────────────────────────────────────────
  dbg("════════════════════════════════════════════");
  dbg(`FINAL → PASS: ${passCount} | FAIL: ${failCount} | UNKNOWN: ${unknownCount}`);
  dbg("Top UNKNOWN reasons:");
  Object.entries(unknownReasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([reason, count]) => dbg(`  x${count}  ${reason}`));
  dbg("════════════════════════════════════════════");

  return results;
}
