// app/lib/missingFactsResolver.ts
// Production-grade missing fact eliminator for deterministic rule evaluation.
// Purpose:
// 1) scan all rule.required facts
// 2) resolve aliases/equivalents
// 3) derive high-value defaults
// 4) optionally ask caller-provided questions
// 5) return enriched facts + diagnostics

import type { RiskRule } from "./riskRules";
import { FACT_ONTOLOGY } from "./factOntology";
import {
  getMissingRequiredFacts,
  resolveRequiredFactValue,
} from "@/app/lib/facts/resolveRequiredFact";

export type Facts = Record<string, unknown>;

export type MissingFactQuestion = {
  factKey: string;
  question: string;
  type: "boolean" | "number" | "text";
  affectedRuleIds: string[];
  affectedCriticalRuleIds: string[];
};

export type ResolveMissingFactsOptions = {
  ask?: (question: MissingFactQuestion) => Promise<unknown>;
  includeNonCriticalQuestions?: boolean;
  maxQuestions?: number;
  debug?: boolean;
};

export type ResolveMissingFactsResult = {
  facts: Facts;
  questionsAsked: MissingFactQuestion[];
  unresolvedFacts: string[];
  resolvedByAlias: string[];
  resolvedByDerivation: string[];
  resolvedByDefault: string[];
};

type FactQuestionCatalog = Record<
  string,
  {
    question: string;
    type: "boolean" | "number" | "text";
  }
>;

const FACT_QUESTIONS: FactQuestionCatalog = {
  isDwellingFlag: {
    question: "Is the building a dwellinghouse or dwelling-type residential building?",
    type: "boolean",
  },
  purposeGroup: {
    question: "What is the building purpose group?",
    type: "text",
  },
  buildingUse: {
    question: "What is the building use?",
    type: "text",
  },
  dwellingType: {
    question: "What is the dwelling type?",
    type: "text",
  },
  numberOfStaircases: {
    question: "How many staircases serve the building?",
    type: "number",
  },
  singleDirectionDistM: {
    question:
      "What is the travel distance before two directions of escape become available (in metres)?",
    type: "number",
  },
  travelDistanceNearestExitM: {
    question: "What is the travel distance to the nearest exit (in metres)?",
    type: "number",
  },
  twoDirectionsAvailableFlag: {
    question: "Are two alternative directions of escape available?",
    type: "boolean",
  },
  protectedCorridorFlag: {
    question: "Is a protected corridor provided?",
    type: "boolean",
  },
  protectedLobbyPresent: {
    question: "Is a protected lobby present?",
    type: "boolean",
  },
  adjacencyToEscapeRoutes: {
    question: "Is the relevant space adjacent to or near an escape route?",
    type: "text",
  },
  automaticDetectionPresent: {
    question: "Is automatic fire detection present?",
    type: "boolean",
  },
  automaticDetectionProvided: {
    question: "Is automatic fire detection provided?",
    type: "boolean",
  },
  staffPresencePattern: {
    question: "What is the staff presence pattern for the space?",
    type: "text",
  },
  evacuationStrategy: {
    question: "What is the evacuation strategy?",
    type: "text",
  },
  alarmSoundersAllAreas: {
    question: "Are alarm sounders provided throughout all relevant areas?",
    type: "boolean",
  },
  stagedAlarmPresent: {
    question: "Is a staged alarm system present?",
    type: "boolean",
  },
  voiceAlarmPresent: {
    question: "Is a voice alarm system present?",
    type: "boolean",
  },
  hazardLevel: {
    question: "What is the fire hazard level?",
    type: "text",
  },
  occupantLoad: {
    question: "What is the occupant load?",
    type: "number",
  },
  exitCount: {
    question: "How many exits are provided?",
    type: "number",
  },
  finalExitCount: {
    question: "How many final exits are provided?",
    type: "number",
  },
  boundaryDistanceMm: {
    question: "What is the boundary distance in millimetres?",
    type: "number",
  },
  boundaryDistance_m: {
    question: "What is the boundary distance in metres?",
    type: "number",
  },
  relevantBuildingFlag: {
    question: "Is this a relevant building for Regulation 7 purposes?",
    type: "boolean",
  },
  fireMainPresent: {
    question: "Is a fire main present?",
    type: "boolean",
  },
  firefightingShaftPresent: {
    question: "Is a firefighting shaft present?",
    type: "boolean",
  },
  sprinklersProvided: {
    question: "Are sprinklers provided?",
    type: "boolean",
  },
  elementFrMinutes: {
    question: "What fire resistance period is provided to the element (minutes)?",
    type: "number",
  },
  requiredFireResistanceMinutes: {
    question: "What fire resistance period is required (minutes)?",
    type: "number",
  },
};

function dbg(enabled: boolean | undefined, ...args: unknown[]) {
  if (enabled) console.log("[missingFactsResolver]", ...args);
}

function isUsable(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function normalizeString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const s = value.trim();
  return s.length ? s : undefined;
}

function normalizeLower(value: unknown): string | undefined {
  const s = normalizeString(value);
  return s ? s.toLowerCase() : undefined;
}

function normalizeBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return undefined;
  }
  if (typeof value !== "string") return undefined;

  const s = value.trim().toLowerCase();
  if (["true", "yes", "y", "1", "present", "provided", "applicable"].includes(s)) {
    return true;
  }
  if (["false", "no", "n", "0", "absent", "not provided", "not applicable"].includes(s)) {
    return false;
  }
  return undefined;
}

function normalizeNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;

  const cleaned = value.replace(/,/g, "").trim();
  const match = cleaned.match(/-?\d+(\.\d+)?/);
  if (!match) return undefined;

  const n = Number(match[0]);
  return Number.isFinite(n) ? n : undefined;
}

function firstDefined(obj: Facts, keys: string[]): unknown {
  for (const key of keys) {
    const value = obj[key];
    if (isUsable(value)) return value;
  }
  return undefined;
}

function setIfMissing(target: Facts, key: string, value: unknown): boolean {
  if (!isUsable(value)) return false;
  if (isUsable(target[key])) return false;
  target[key] = value;
  return true;
}

function buildAffectedRuleMap(riskRules: RiskRule[]) {
  const map = new Map<
    string,
    {
      affectedRuleIds: string[];
      affectedCriticalRuleIds: string[];
    }
  >();

  for (const rule of riskRules) {
    const required = Array.isArray(rule.inputs?.required) ? rule.inputs.required : [];
    for (const factKey of required) {
      const entry = map.get(factKey) ?? {
        affectedRuleIds: [],
        affectedCriticalRuleIds: [],
      };
      entry.affectedRuleIds.push(rule.ruleId);
      if (rule.severity === "critical") {
        entry.affectedCriticalRuleIds.push(rule.ruleId);
      }
      map.set(factKey, entry);
    }
  }

  for (const [, entry] of map) {
    entry.affectedRuleIds.sort();
    entry.affectedCriticalRuleIds.sort();
  }

  return map;
}

function deriveFacts(baseFacts: Facts, debug?: boolean): {
  facts: Facts;
  resolvedByDerivation: string[];
  resolvedByDefault: string[];
} {
  const facts: Facts = { ...baseFacts };
  const resolvedByDerivation: string[] = [];
  const resolvedByDefault: string[] = [];

  const buildingUse = normalizeLower(
    firstDefined(facts, ["buildingUse", "building_use", "use", "occupancyType"])
  );
  const purposeGroup = normalizeString(
    firstDefined(facts, ["purposeGroup", "purpose_group", "buildingPurposeGroup"])
  );
  const stairCount =
    normalizeNumber(
      firstDefined(facts, [
        "numberOfStaircases",
        "number_of_staircases",
        "stairCount",
        "escapeStairCount",
        "commonStairCount",
      ])
    ) ?? undefined;

  const automaticDetection =
    normalizeBoolean(
      firstDefined(facts, [
        "automaticDetectionPresent",
        "automaticDetectionProvided",
        "automaticDetectionAlarmProvided",
      ])
    ) ?? undefined;

  const sprinklers =
    normalizeBoolean(
      firstDefined(facts, [
        "sprinklersProvided",
        "sprinklersPresent",
        "sprinklerSystemPresent",
        "sprinklerSystemProvided",
      ])
    ) ?? undefined;

  const fireMain =
    normalizeBoolean(
      firstDefined(facts, [
        "fireMainPresent",
        "fireMainsPresent",
        "risingMainPresent",
        "dryRiserPresent",
      ])
    ) ?? undefined;

  const protectedStair =
    normalizeBoolean(
      firstDefined(facts, [
        "protectedStairPresent",
        "protectedStairFlag",
        "protectedStairPresentFlag",
        "protectedStairProvidedFlag",
      ])
    ) ?? undefined;

  const boundaryDistanceM =
    normalizeNumber(
      firstDefined(facts, [
        "boundaryDistance_m",
        "boundaryDistanceMeters",
        "distanceToRelevantBoundary_m",
        "distanceToRelevantBoundaryM",
      ])
    ) ?? undefined;

  const boundaryDistanceMm =
    normalizeNumber(
      firstDefined(facts, [
        "boundaryDistanceMm",
        "boundaryDistance_mm",
        "distanceToRelevantBoundaryMm",
        "distanceToRelevantBoundary_mm",
      ])
    ) ?? undefined;

  if (
    !isUsable(facts.isDwellingFlag) &&
    (buildingUse?.includes("dwelling") ||
      buildingUse?.includes("house") ||
      buildingUse?.includes("flat") ||
      buildingUse?.includes("apartment") ||
      purposeGroup === "2(b)")
  ) {
    facts.isDwellingFlag = true;
    resolvedByDerivation.push("isDwellingFlag");
  }

  if (!isUsable(facts.dwellingType) && buildingUse) {
    if (buildingUse.includes("flat") || buildingUse.includes("apartment")) {
      facts.dwellingType = "flat";
      resolvedByDerivation.push("dwellingType");
    } else if (buildingUse.includes("house") || buildingUse.includes("dwelling")) {
      facts.dwellingType = "house";
      resolvedByDerivation.push("dwellingType");
    }
  }

  if (!isUsable(facts.purposeGroup) && buildingUse) {
    if (buildingUse.includes("flat") || buildingUse.includes("apartment")) {
      facts.purposeGroup = "2(b)";
      resolvedByDerivation.push("purposeGroup");
    } else if (buildingUse.includes("hotel") || buildingUse.includes("hostel")) {
      facts.purposeGroup = "2(a)";
      resolvedByDerivation.push("purposeGroup");
    } else if (buildingUse.includes("office")) {
      facts.purposeGroup = "3";
      resolvedByDerivation.push("purposeGroup");
    } else if (buildingUse.includes("shop") || buildingUse.includes("retail") || buildingUse.includes("store")) {
      facts.purposeGroup = "4";
      resolvedByDerivation.push("purposeGroup");
    }
  }

  if (!isUsable(facts.twoDirectionsAvailableFlag) && stairCount !== undefined) {
    facts.twoDirectionsAvailableFlag = stairCount >= 2;
    resolvedByDerivation.push("twoDirectionsAvailableFlag");
  }

  if (!isUsable(facts.numberOfEscapeRoutes) && stairCount !== undefined) {
    facts.numberOfEscapeRoutes = stairCount;
    resolvedByDerivation.push("numberOfEscapeRoutes");
  }

  if (!isUsable(facts.singleStairFlag) && stairCount !== undefined) {
    facts.singleStairFlag = stairCount === 1;
    resolvedByDerivation.push("singleStairFlag");
  }

  if (!isUsable(facts.singleStaircaseBuilding) && stairCount !== undefined) {
    facts.singleStaircaseBuilding = stairCount === 1;
    resolvedByDerivation.push("singleStaircaseBuilding");
  }

  if (!isUsable(facts.automaticDetectionPresent) && automaticDetection !== undefined) {
    facts.automaticDetectionPresent = automaticDetection;
    resolvedByDerivation.push("automaticDetectionPresent");
  }

  if (!isUsable(facts.automaticDetectionProvided) && automaticDetection !== undefined) {
    facts.automaticDetectionProvided = automaticDetection;
    resolvedByDerivation.push("automaticDetectionProvided");
  }

  if (!isUsable(facts.sprinklersProvided) && sprinklers !== undefined) {
    facts.sprinklersProvided = sprinklers;
    resolvedByDerivation.push("sprinklersProvided");
  }

  if (!isUsable(facts.fireMainPresent) && fireMain !== undefined) {
    facts.fireMainPresent = fireMain;
    resolvedByDerivation.push("fireMainPresent");
  }

  if (!isUsable(facts.fireMainsPresent) && fireMain !== undefined) {
    facts.fireMainsPresent = fireMain;
    resolvedByDerivation.push("fireMainsPresent");
  }

  if (!isUsable(facts.protectedStairPresent) && protectedStair !== undefined) {
    facts.protectedStairPresent = protectedStair;
    resolvedByDerivation.push("protectedStairPresent");
  }

  if (!isUsable(facts.protectedStairFlag) && protectedStair !== undefined) {
    facts.protectedStairFlag = protectedStair;
    resolvedByDerivation.push("protectedStairFlag");
  }

  if (!isUsable(facts.boundaryDistanceMm) && boundaryDistanceM !== undefined) {
    facts.boundaryDistanceMm = boundaryDistanceM * 1000;
    resolvedByDerivation.push("boundaryDistanceMm");
  }

  if (!isUsable(facts.boundaryDistance_m) && boundaryDistanceMm !== undefined) {
    facts.boundaryDistance_m = boundaryDistanceMm / 1000;
    resolvedByDerivation.push("boundaryDistance_m");
  }

  if (!isUsable(facts.relevantBuildingFlag)) {
    facts.relevantBuildingFlag = false;
    resolvedByDefault.push("relevantBuildingFlag");
  }

  if (!isUsable(facts.hazardLevel)) {
    facts.hazardLevel = "normal";
    resolvedByDefault.push("hazardLevel");
  }

  if (!isUsable(facts.spaceType)) {
    const roomType = normalizeString(firstDefined(facts, ["roomType", "areaType"]));
    if (roomType) {
      facts.spaceType = roomType;
      resolvedByDerivation.push("spaceType");
    } else {
      facts.spaceType = "not specified";
      resolvedByDefault.push("spaceType");
    }
  }

  if (!isUsable(facts.roomType) && isUsable(facts.spaceType)) {
    facts.roomType = facts.spaceType;
    resolvedByDerivation.push("roomType");
  }

  if (!isUsable(facts.areaType) && isUsable(facts.spaceType)) {
    facts.areaType = facts.spaceType;
    resolvedByDerivation.push("areaType");
  }

  if (!isUsable(facts.staffPresencePattern)) {
    const st = normalizeLower(facts.spaceType);
    if (st && ["plant", "void", "storage"].some((x) => st.includes(x))) {
      facts.staffPresencePattern = "unsupervised";
      resolvedByDerivation.push("staffPresencePattern");
    }
  }

  dbg(debug, "resolvedByDerivation", resolvedByDerivation);
  dbg(debug, "resolvedByDefault", resolvedByDefault);

  return { facts, resolvedByDerivation, resolvedByDefault };
}

function hydrateAliases(baseFacts: Facts, debug?: boolean): {
  facts: Facts;
  resolvedByAlias: string[];
} {
  const facts: Facts = { ...baseFacts };
  const resolvedByAlias: string[] = [];

  const keys = new Set<string>([
    ...Object.keys(baseFacts),
    ...Object.keys(FACT_ONTOLOGY ?? {}),
  ]);

  for (const key of keys) {
    if (isUsable(facts[key])) continue;

    const resolved = resolveRequiredFactValue(key, facts);
    if (isUsable(resolved)) {
      facts[key] = resolved;
      resolvedByAlias.push(key);
    }
  }

  dbg(debug, "resolvedByAlias", resolvedByAlias);

  return { facts, resolvedByAlias };
}

function toQuestion(
  factKey: string,
  affectedRuleMap: ReturnType<typeof buildAffectedRuleMap>
): MissingFactQuestion {
  const fallbackType =
    FACT_ONTOLOGY[factKey]?.type === "number"
      ? "number"
      : FACT_ONTOLOGY[factKey]?.type === "boolean"
      ? "boolean"
      : "text";

  const entry = FACT_QUESTIONS[factKey];

  return {
    factKey,
    question:
      entry?.question ??
      `Provide a value for ${factKey}`,
    type: entry?.type ?? fallbackType,
    affectedRuleIds: affectedRuleMap.get(factKey)?.affectedRuleIds ?? [],
    affectedCriticalRuleIds: affectedRuleMap.get(factKey)?.affectedCriticalRuleIds ?? [],
  };
}

function sortMissingFactsForImpact(
  missingFacts: string[],
  affectedRuleMap: ReturnType<typeof buildAffectedRuleMap>
): string[] {
  return [...missingFacts].sort((a, b) => {
    const aCrit = affectedRuleMap.get(a)?.affectedCriticalRuleIds.length ?? 0;
    const bCrit = affectedRuleMap.get(b)?.affectedCriticalRuleIds.length ?? 0;
    if (bCrit !== aCrit) return bCrit - aCrit;

    const aAll = affectedRuleMap.get(a)?.affectedRuleIds.length ?? 0;
    const bAll = affectedRuleMap.get(b)?.affectedRuleIds.length ?? 0;
    if (bAll !== aAll) return bAll - aAll;

    return a.localeCompare(b);
  });
}

export async function resolveMissingFactsForRules(
  riskRules: RiskRule[],
  inputFacts: Facts,
  options: ResolveMissingFactsOptions = {}
): Promise<ResolveMissingFactsResult> {
  const debug = Boolean(options.debug);
  const ask = options.ask;
  const includeNonCriticalQuestions = Boolean(options.includeNonCriticalQuestions);
  const maxQuestions = Math.max(0, options.maxQuestions ?? 25);

  let facts: Facts = { ...(inputFacts ?? {}) };

  const aliasPass = hydrateAliases(facts, debug);
  facts = aliasPass.facts;

  const derivePass = deriveFacts(facts, debug);
  facts = derivePass.facts;

  const allRequiredFacts = Array.from(
    new Set(
      riskRules.flatMap((rule) =>
        Array.isArray(rule.inputs?.required) ? rule.inputs.required : []
      )
    )
  );

  let unresolvedFacts = getMissingRequiredFacts(allRequiredFacts, facts);
  const affectedRuleMap = buildAffectedRuleMap(riskRules);

  unresolvedFacts = sortMissingFactsForImpact(unresolvedFacts, affectedRuleMap);

  const questionsAsked: MissingFactQuestion[] = [];

  if (ask && unresolvedFacts.length > 0 && maxQuestions > 0) {
    let askedCount = 0;

    for (const factKey of unresolvedFacts) {
      const impacted = affectedRuleMap.get(factKey);
      const hasCriticalImpact = (impacted?.affectedCriticalRuleIds.length ?? 0) > 0;

      if (!includeNonCriticalQuestions && !hasCriticalImpact) continue;
      if (askedCount >= maxQuestions) break;

      const q = toQuestion(factKey, affectedRuleMap);
      questionsAsked.push(q);

      let answer: unknown;
      try {
        answer = await ask(q);
      } catch (error) {
        dbg(debug, "ask() failed for", factKey, error);
        continue;
      }

      if (!isUsable(answer)) continue;

      const ontologyType = FACT_ONTOLOGY[factKey]?.type;
      let finalValue: unknown = answer;

      if (ontologyType === "boolean") finalValue = normalizeBoolean(answer);
      else if (ontologyType === "number") finalValue = normalizeNumber(answer);
      else if (ontologyType === "text" || ontologyType === "enum") {
        finalValue = normalizeString(answer);
      }

      if (!isUsable(finalValue)) continue;

      facts[factKey] = finalValue;
      askedCount++;

      const aliasRefresh = hydrateAliases(facts, debug);
      facts = aliasRefresh.facts;

      const deriveRefresh = deriveFacts(facts, debug);
      facts = deriveRefresh.facts;
    }
  }

  unresolvedFacts = getMissingRequiredFacts(allRequiredFacts, facts);
  unresolvedFacts = sortMissingFactsForImpact(unresolvedFacts, affectedRuleMap);

  return {
    facts,
    questionsAsked,
    unresolvedFacts,
    resolvedByAlias: Array.from(new Set(aliasPass.resolvedByAlias)).sort(),
    resolvedByDerivation: Array.from(new Set(derivePass.resolvedByDerivation)).sort(),
    resolvedByDefault: Array.from(new Set(derivePass.resolvedByDefault)).sort(),
  };
}