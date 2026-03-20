// resolveRequiredFact.ts — fully replaceable

import { FACT_ONTOLOGY } from "@/lib/factOntology";

export type EngineFacts = Record<string, unknown>;

const EQUIVALENT_FACTS: Record<string, string[]> = {
  // Detection / alarms
  automaticDetectionPresent: ["automaticDetectionProvided", "automaticDetectionAlarmProvided"],
  automaticDetectionAlarmProvided: ["automaticDetectionProvided", "automaticDetectionPresent"],
  automaticDetectionProvided: ["automaticDetectionPresent", "automaticDetectionAlarmProvided"],

  // Stairs
  protectedStairPresent: ["protectedStairFlag", "protectedStairPresentFlag", "protectedStairProvidedFlag"],
  protectedStairFlag: ["protectedStairPresent", "protectedStairPresentFlag"],
  numberOfStaircases: ["number_of_staircases", "stairCount", "escapeStairCount", "commonStairCount"],
  number_of_staircases: ["numberOfStaircases", "stairCount", "escapeStairCount"],
  stairCount: ["numberOfStaircases", "number_of_staircases", "escapeStairCount"],
  singleStaircaseBuilding: ["singleStairFlag"],
  singleStairFlag: ["singleStaircaseBuilding"],

  // Height
  buildingHeight_m: ["buildingHeightM", "buildingHeightMeters", "heightTopStoreyM", "topStoreyHeightM"],
  buildingHeightM: ["buildingHeight_m", "buildingHeightMeters", "heightTopStoreyM"],
  heightTopStoreyM: ["topStoreyHeightM", "heightTopStorey_m", "height_top_storey_m", "buildingHeightM"],
  topStoreyHeightM: ["heightTopStoreyM", "heightTopStorey_m", "buildingHeightM"],

  // Storeys
  storeys: ["storeyCount", "storeysAboveGroundCount", "numberOfStoreys", "floorsAboveGround"],
  storeyCount: ["storeys", "storeysAboveGroundCount", "numberOfStoreys"],
  storeysAboveGroundCount: ["storeys", "storeyCount", "numberOfStoreys"],

  // Purpose group
  purposeGroup: ["purpose_group", "buildingPurposeGroup"],
  purpose_group: ["purposeGroup", "buildingPurposeGroup"],

  // Dwelling
  dwellingType: ["dwelling_type", "isDwellingFlag", "dwellingFlag"],
  isDwellingFlag: ["dwellingFlag", "dwelling_flag"],

  // Sprinklers
  sprinklersProvided: ["sprinklersPresent", "sprinklerSystemPresent", "sprinklerSystemFlag", "sprinklersProvidedFlag"],
  sprinklersPresent: ["sprinklersProvided", "sprinklerSystemPresent", "sprinklerSystemFlag"],
  sprinklerSystemPresent: ["sprinklersProvided", "sprinklersPresent", "sprinklerSystemFlag"],

  // Fire mains / rising mains
  risingMainPresent: ["fireMainPresent", "fireMainsPresent", "dryRiserPresent", "fireMainsProvided"],
  fireMainPresent: ["fireMainsPresent", "risingMainPresent", "dryRiserPresent"],
  fireMainsPresent: ["fireMainPresent", "risingMainPresent", "dryRiserPresent"],
  dryRiserPresent: ["risingMainPresent", "fireMainsPresent", "fireMainPresent"],

  // Firefighting shaft
  firefightingShaftProvided: ["firefightingShaftPresent", "protectedShaftProvidedFlag"],
  firefightingShaftPresent: ["firefightingShaftProvided", "protectedShaftProvidedFlag"],
  protectedShaftProvidedFlag: ["firefightingShaftPresent", "firefightingShaftProvided"],

  // Lobby
  protectedLobbyProvided: ["protectedLobbyPresent"],
  protectedLobbyPresent: ["protectedLobbyProvided"],

  // AOV
  aovPresent: ["aovProvided"],
  aovProvided: ["aovPresent"],

  // Boundary distance
  boundaryDistance_mm: ["boundaryDistanceMm", "distanceToRelevantBoundary_mm", "distanceToRelevantBoundaryMm"],
  boundaryDistanceMm: ["boundaryDistance_mm", "distanceToRelevantBoundary_mm"],
  distanceToRelevantBoundary_mm: ["boundaryDistance_mm", "boundaryDistanceMm", "distanceToRelevantBoundaryMm"],
  distanceToRelevantBoundaryMm: ["distanceToRelevantBoundary_mm", "boundaryDistance_mm"],
  distanceToRelevantBoundary_m: ["boundaryDistance_m", "distanceToRelevantBoundaryM"],
  distanceToRelevantBoundaryM: ["distanceToRelevantBoundary_m", "boundaryDistance_m"],

  // Opening / unprotected area
  openingArea_m2: ["openingAreaM2"],
  openingAreaM2: ["openingArea_m2"],
  calculatedMaxUnprotectedArea_m2: ["calculatedMaxUnprotectedAreaM2"],
  calculatedMaxUnprotectedAreaM2: ["calculatedMaxUnprotectedArea_m2"],

  // Exit width
  exitWidthMM: ["exitWidthMm"],
  exitWidthMm: ["exitWidthMM"],
  requiredExitWidthMM: ["requiredExitWidthMm"],
  requiredExitWidthMm: ["requiredExitWidthMM"],

  // Escape route flags
  onEscapeRouteFlag: ["on_escape_route_flag", "onEscapeRoute", "escapeRouteFlag"],
  on_escape_route_flag: ["onEscapeRouteFlag", "onEscapeRoute"],

  // Sleeping
  sleepingAccommodation: ["sleepingAccommodationFlag", "sleepingRiskFlag"],
  sleepingAccommodationFlag: ["sleepingAccommodation", "sleepingRiskFlag"],

  // Staff / occupancy
  staffPresencePattern: ["occupancyPattern", "staffPattern"],
  occupancyPattern: ["staffPresencePattern", "staffPattern"],

  // Lining
  wallLiningClass: ["wallliningclass", "liningClassification", "liningClass"],
  ceilingLiningClass: ["ceilingliningclass", "liningClassification", "liningClass"],
  liningClassification: ["wallLiningClass", "ceilingLiningClass", "liningClass"],

  // Relevant building
  relevantBuildingFlag: ["relevant_building_flag", "relevantBuilding_reg7_4"],
  relevant_building_flag: ["relevantBuildingFlag", "relevantBuilding_reg7_4"],

  // Smoke / AOV
  smokeControlSystem: ["smokeControlProvided"],

  // Space type
  spaceType: ["roomType", "areaType"],
  roomType: ["spaceType", "areaType"],
  areaType: ["spaceType", "roomType"],
};

function hasUsableValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function getOntologyAliases(key: string): string[] {
  const def = FACT_ONTOLOGY[key];
  return def?.aliases ?? [];
}

export function resolveRequiredFactValue(
  requiredKey: string,
  facts: EngineFacts
): unknown {
  const direct = facts[requiredKey];
  if (hasUsableValue(direct)) return direct;

  for (const alias of getOntologyAliases(requiredKey)) {
    const v = facts[alias];
    if (hasUsableValue(v)) return v;
  }

  for (const equivalent of EQUIVALENT_FACTS[requiredKey] ?? []) {
    const v = facts[equivalent];
    if (hasUsableValue(v)) return v;
  }

  return undefined;
}

export function getMissingRequiredFacts(
  requiredFacts: string[],
  facts: EngineFacts
): string[] {
  return requiredFacts.filter(
    (key) => !hasUsableValue(resolveRequiredFactValue(key, facts))
  );
}
