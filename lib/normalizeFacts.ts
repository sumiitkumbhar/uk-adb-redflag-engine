/* lib/normalizeFacts.ts */
/* eslint-disable @typescript-eslint/no-explicit-any */

export type NormalizedFacts = Record<string, any>;

type AnyRecord = Record<string, any>;

function asArray<T = any>(v: any): T[] {
  if (Array.isArray(v)) return v;
  if (v === null || v === undefined) return [];
  return [v];
}

function cleanString(v: any): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s.length ? s : undefined;
}

function cleanLower(v: any): string | undefined {
  const s = cleanString(v);
  return s ? s.toLowerCase() : undefined;
}

function firstDefined(obj: AnyRecord, keys: string[]): any {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
      return obj[key];
    }
  }
  return undefined;
}

function normalizeBoolean(v: any): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v !== "string") return undefined;

  const s = v.trim().toLowerCase();

  if (
    ["true", "yes", "y", "1", "present", "provided", "required", "applicable"].includes(s)
  ) {
    return true;
  }

  if (
    ["false", "no", "n", "0", "absent", "not provided", "not required", "none", "n/a"].includes(s)
  ) {
    return false;
  }

  return undefined;
}

function normalizeNumber(v: any): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/,/g, "").trim();
    const match = cleaned.match(/-?\d+(\.\d+)?/);
    if (!match) return undefined;
    const n = Number(match[0]);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function normalizeInteger(v: any): number | undefined {
  const n = normalizeNumber(v);
  return n === undefined ? undefined : Math.round(n);
}

function pickBool(obj: AnyRecord, ...keys: string[]): boolean | undefined {
  return normalizeBoolean(firstDefined(obj, keys));
}

function pickNum(obj: AnyRecord, ...keys: string[]): number | undefined {
  return normalizeNumber(firstDefined(obj, keys));
}

function pickInt(obj: AnyRecord, ...keys: string[]): number | undefined {
  return normalizeInteger(firstDefined(obj, keys));
}

function pickStr(obj: AnyRecord, ...keys: string[]): string | undefined {
  return cleanString(firstDefined(obj, keys));
}

function pickLower(obj: AnyRecord, ...keys: string[]): string | undefined {
  return cleanLower(firstDefined(obj, keys));
}

function looksResidentialUse(s?: string): boolean {
  if (!s) return false;
  const t = s.toLowerCase();
  return [
    "residential", "dwelling", "dwellinghouse", "flat", "flats",
    "apartment", "apartments", "maisonette", "student accommodation",
    "care home", "hotel", "hostel", "boarding house", "residential accommodation",
  ].some((x) => t.includes(x));
}

function looksCommercialUse(s?: string): boolean {
  if (!s) return false;
  const t = s.toLowerCase();
  return [
    "commercial", "office", "retail", "shop", "industrial", "warehouse",
    "factory", "assembly", "restaurant", "cafe", "bar", "non-residential",
  ].some((x) => t.includes(x));
}

function inferBuildingType(raw: AnyRecord): string | undefined {
  const explicit =
    pickLower(raw, "buildingType", "building_type", "useClass", "building_use_type") ??
    pickLower(raw, "buildingUse", "building_use");

  if (!explicit) return undefined;

  if (looksResidentialUse(explicit) && !looksCommercialUse(explicit)) return "residential";
  if (looksCommercialUse(explicit) && !looksResidentialUse(explicit)) return "commercial";
  if (explicit.includes("mixed")) return "mixed_use";
  return explicit;
}

function inferBuildingUse(raw: AnyRecord): string | undefined {
  return (
    pickStr(raw, "buildingUse", "building_use", "primaryUse", "use", "occupancyUse") ??
    pickStr(raw, "buildingType", "building_type")
  );
}

function inferPurposeGroup(raw: AnyRecord, buildingUse?: string): string | undefined {
  const explicit = pickStr(raw, "purposeGroup", "purpose_group", "purposeGroupNumber");
  if (explicit) return explicit;

  const use = (buildingUse ?? "").toLowerCase();
  if (!use) return undefined;

  if (/flat|apartment|maisonette/.test(use)) return "1a";
  if (/house|bungalow|dwellinghouse/.test(use)) return "1c";
  if (/hospital|care home|nursing home/.test(use)) return "2a";
  if (/hotel|hostel|boarding|hall of residence/.test(use)) return "2b";
  if (/office/.test(use)) return "3";
  if (/shop|retail|commercial/.test(use)) return "4";
  if (/assembly|restaurant|bar|pub|school|theatre|cinema|recreation/.test(use)) return "5";
  if (/industrial|factory/.test(use)) return "6";
  if (/warehouse|storage/.test(use)) return "7a";
  if (/car park/.test(use)) return "7b";
  return undefined;
}

function inferRelevantBuildingFlag(raw: AnyRecord, normalized: AnyRecord): boolean | undefined {
  const explicit = pickBool(
    raw,
    "relevantBuildingFlag", "relevant_building_flag",
    "isRelevantBuilding", "relevantBuilding"
  );
  if (explicit !== undefined) return explicit;

  const residential = normalized.isResidentialAccommodation;
  const height = normalized.heightTopStoreyM ?? normalized.buildingHeightM;
  if (residential === true && typeof height === "number") {
    return height >= 18;
  }
  return false;
}

function inferFlatFlags(raw: AnyRecord, normalized: AnyRecord): {
  hasFlats?: boolean;
  flatUnitFlag?: boolean;
  blockOfFlatsFlag?: boolean;
} {
  const hasFlats =
    pickBool(raw, "hasFlats", "flatsPresent", "flats_present") ??
    (normalized.buildingType === "commercial" ? false : undefined);

  const flatUnitFlag =
    pickBool(raw, "flatUnitFlag", "flat_unit_flag", "isFlatUnit", "selfContainedFlatFlag") ??
    (hasFlats === false ? false : undefined);

  const blockOfFlatsFlag =
    pickBool(raw, "blockOfFlatsFlag", "block_of_flats_flag", "isBlockOfFlats") ??
    (hasFlats === true ? true : hasFlats === false ? false : undefined);

  return { hasFlats, flatUnitFlag, blockOfFlatsFlag };
}

function inferDwellingFlags(raw: AnyRecord, normalized: AnyRecord): {
  dwellingType?: string;
  dwellinghouseFlag?: boolean;
  isResidentialAccommodation?: boolean;
} {
  const dwellingType =
    pickLower(raw, "dwellingType", "dwelling_type") ??
    (normalized.buildingType === "commercial"
      ? undefined
      : pickLower(raw, "buildingType", "buildingUse"));

  const dwellinghouseFlag =
    pickBool(raw, "dwellinghouseFlag", "isDwellinghouse", "dwelling_house_flag") ??
    (dwellingType
      ? ["house", "dwellinghouse", "dwelling"].some((x) => dwellingType.includes(x))
      : normalized.buildingType === "commercial"
      ? false
      : undefined);

  const isResidentialAccommodation =
    pickBool(raw, "isResidentialAccommodation", "residentialAccommodationFlag", "residential_flag") ??
    (normalized.buildingType === "commercial"
      ? false
      : normalized.buildingType === "residential"
      ? true
      : dwellinghouseFlag);

  return { dwellingType, dwellinghouseFlag, isResidentialAccommodation };
}

function inferDistanceAliases(raw: AnyRecord, out: AnyRecord): void {
  const boundaryM =
    pickNum(
      raw,
      "distance_to_boundary_m", "distanceToBoundaryM", "boundaryDistanceM",
      "boundaryDistanceMeters", "distanceToRelevantBoundaryM"
    ) ??
    (() => {
      const mm = pickNum(
        raw,
        "distanceToRelevantBoundary_mm", "distanceToRelevantBoundaryMm",
        "boundaryDistance_mm", "boundaryDistanceMm",
        "roofDistanceToBoundary_mm", "roofDistanceToBoundaryMm"
      );
      return typeof mm === "number" ? mm / 1000 : undefined;
    })();

  const boundaryMm =
    pickNum(
      raw,
      "distanceToRelevantBoundary_mm", "distanceToRelevantBoundaryMm",
      "boundaryDistance_mm", "boundaryDistanceMm",
      "roofDistanceToBoundary_mm", "roofDistanceToBoundaryMm"
    ) ?? (typeof boundaryM === "number" ? Math.round(boundaryM * 1000) : undefined);

  if (boundaryM !== undefined) {
    out.distance_to_boundary_m = boundaryM;
    out.distanceToBoundaryM = boundaryM;
    out.boundaryDistanceM = boundaryM;
    out.boundaryDistanceMeters = boundaryM;
    out.distanceToRelevantBoundaryM = boundaryM;
    out.distanceToRelevantBoundary_m = boundaryM;
    out.boundaryDistance_m = boundaryM;
  }

  if (boundaryMm !== undefined) {
    out.distanceToRelevantBoundary_mm = boundaryMm;
    out.distanceToRelevantBoundaryMm = boundaryMm;
    out.boundaryDistance_mm = boundaryMm;
    out.boundaryDistanceMm = boundaryMm;
    out.roofDistanceToBoundary_mm = boundaryMm;
    out.roofDistanceToBoundaryMm = boundaryMm;
  }
}

function inferHeightAliases(raw: AnyRecord, out: AnyRecord): void {
  const buildingHeightM =
    pickNum(raw, "buildingHeightM", "buildingHeight", "building_height_m", "height_m") ??
    pickNum(raw, "heightTopStoreyM", "height_top_storey_m", "height_top_storey") ??
    undefined;

  const heightTopStoreyM =
    pickNum(raw, "heightTopStoreyM", "height_top_storey_m", "height_top_storey") ??
    buildingHeightM;

  if (buildingHeightM !== undefined) {
    out.buildingHeightM = buildingHeightM;
    out.buildingHeight_m = buildingHeightM;
    out.buildingHeightMeters = buildingHeightM;
  }

  if (heightTopStoreyM !== undefined) {
    out.heightTopStoreyM = heightTopStoreyM;
    out.height_top_storey_m = heightTopStoreyM;
    out.heightTopStorey_m = heightTopStoreyM;
    out.topStoreyHeightM = heightTopStoreyM;
    out.topStoreyHeight_m = heightTopStoreyM;
    // Threshold flags
    out.buildingHeightOver18m = heightTopStoreyM >= 18;
    out.buildingHeightOver11m = heightTopStoreyM >= 11;
    out.highRiseFlag = heightTopStoreyM >= 18;
    // ADB 2020 amendment: sprinklers required in residential blocks >= 11m
    out.sprinklerSystemRequired ??= heightTopStoreyM >= 11;
  }

  const maxStoreyAboveFRSAccessLevelM =
    pickNum(
      raw,
      "maxStoreyAboveFRSAccessLevelM", "storeyHeightMax_m",
      "topStoreyAboveAccessLevelM", "storeyAboveFireServiceAccessM"
    ) ?? heightTopStoreyM;

  if (maxStoreyAboveFRSAccessLevelM !== undefined) {
    out.maxStoreyAboveFRSAccessLevelM = maxStoreyAboveFRSAccessLevelM;
    out.storeyHeightMax_m = maxStoreyAboveFRSAccessLevelM;
  }
}

function inferEscapeAndStairFacts(raw: AnyRecord, out: AnyRecord): void {
  const stairCount =
    pickInt(raw, "numberOfStaircases", "stairCount", "numStairs", "escapeStairCount", "commonStairCount") ??
    undefined;

  if (stairCount !== undefined) {
    out.numberOfStaircases = stairCount;
    out.number_of_staircases = stairCount;
    out.stairCount = stairCount;
    out.escapeStairCount = stairCount;
    out.commonStairCount = stairCount;
    out.singleStairFlag = stairCount === 1;
    out.singleStaircaseBuilding = stairCount === 1;
  } else {
    // ── SMART DEFAULT: assume single staircase (conservative — more likely FAIL) ──
    console.log("[normalizeFacts] numberOfStaircases not found — defaulting to 1 (conservative)");
    out.numberOfStaircases = 1;
    out.number_of_staircases = 1;
    out.stairCount = 1;
    out.escapeStairCount = 1;
    out.commonStairCount = 1;
    out.singleStairFlag = true;
    out.singleStaircaseBuilding = true;
  }

  const storeysAboveGroundCount = pickInt(
    raw,
    "storeysAboveGroundCount", "numberOfStoreys",
    "storeyCountAboveGround", "floorsAboveGround", "storeys", "storeyCount"
  );
  if (storeysAboveGroundCount !== undefined) {
    out.storeysAboveGroundCount = storeysAboveGroundCount;
    out.numberOfStoreys = storeysAboveGroundCount;
    out.storeys = storeysAboveGroundCount;
    out.storeyCount = storeysAboveGroundCount;
    out.floorsAboveGround = storeysAboveGroundCount;
    out.storeysAboveGround = storeysAboveGroundCount;
    out.multiStorey = storeysAboveGroundCount > 1;
    out.singleStoreyFlag = storeysAboveGroundCount === 1;
    // Derive height estimate if not already present
    if (out.heightTopStoreyM === undefined && out.buildingHeightM === undefined) {
      const est = storeysAboveGroundCount * 3;
      out.buildingHeightM = est;
      out.buildingHeight_m = est;
      out.heightTopStoreyM = est;
      out.height_top_storey_m = est;
      out.buildingHeightOver18m = est >= 18;
      out.buildingHeightOver11m = est >= 11;
    }
  }

  const protectedStairFlag =
    pickBool(raw, "protectedStairFlag", "protected_stair_flag", "isProtectedStair") ??
    (stairCount !== undefined ? stairCount >= 1 : false);

  out.protectedStairFlag = protectedStairFlag;
  out.protected_stair_flag = protectedStairFlag;
  out.protectedStairPresent = protectedStairFlag;
  out.protectedStairPresentFlag = protectedStairFlag;
  out.protectedStairProvidedFlag = protectedStairFlag;

  const externalStairFlag = pickBool(
    raw,
    "externalStairFlag", "external_stair_flag",
    "externalEscapeStairPresent", "externalEscapeStairProvidedFlag",
    "externalEscapeStairPresentFlag"
  );
  if (externalStairFlag !== undefined) {
    out.externalStairFlag = externalStairFlag;
    out.externalEscapeStairPresent = externalStairFlag;
    out.externalEscapeStairProvidedFlag = externalStairFlag;
    out.externalEscapeStairPresentFlag = externalStairFlag;
  }

  const staircaseWidth =
    pickNum(raw, "stairWidthMm", "stair_width_mm", "escapeStairWidthMm", "stairClearWidthMm") ??
    undefined;
  if (staircaseWidth !== undefined) {
    out.stairWidthMm = staircaseWidth;
    out.stair_width_mm = staircaseWidth;
  }

  const lobbyProvided =
    pickBool(raw, "isLobbyProvided", "lobbyProvided", "lobbyOrProtectedCorridorByStoreyFlag", "protectedLobbyProvided", "protectedLobbyPresent") ??
    false; // default: no lobby (conservative)
  out.isLobbyProvided = lobbyProvided;
  out.lobbyProvided = lobbyProvided;
  out.lobbyOrProtectedCorridorByStoreyFlag = lobbyProvided;
  out.protectedLobbyProvided = lobbyProvided;
  out.protectedLobbyPresent = lobbyProvided;
  out.protected_lobby_provided = lobbyProvided;

  const commonCorridorPresent =
    pickBool(raw, "commonCorridorPresent", "commonCorridorPresentFlag") ??
    (pickLower(raw, "spaceType", "space_type") === "circulation" ? true : undefined);

  if (commonCorridorPresent !== undefined) {
    out.commonCorridorPresent = commonCorridorPresent;
    out.corridorEnclosurePresentFlag =
      pickBool(raw, "corridorEnclosurePresentFlag") ?? commonCorridorPresent;
  }

  const onEscapeRouteFlag =
    pickBool(raw, "onEscapeRouteFlag", "on_escape_route_flag", "escapeRoutePresent", "isEscapeRoute") ??
    (pickLower(raw, "spaceType", "space_type") === "circulation" ? true : false);

  out.onEscapeRouteFlag = onEscapeRouteFlag;
  out.on_escape_route_flag = onEscapeRouteFlag;
  out.escapeRoutePresent = onEscapeRouteFlag;
  out.onEscapeRoute = onEscapeRouteFlag;
  out.escapeRouteFlag = onEscapeRouteFlag;
  out.protectedRoutePresentFlag =
    pickBool(raw, "protectedRoutePresentFlag") ?? (protectedStairFlag === true || onEscapeRouteFlag);

  const finalExitWidthMm = pickNum(raw, "finalExitWidthMm", "final_exit_width_mm", "exitWidthMm", "exitWidthMM");
  if (finalExitWidthMm !== undefined) {
    out.finalExitWidthMm = finalExitWidthMm;
    out.final_exit_width_mm = finalExitWidthMm;
    out.exitWidthMm = finalExitWidthMm;
    out.exitWidthMM = finalExitWidthMm;
  }

  const occupantLoad =
    pickNum(raw, "occupantLoad", "spaceMaxOccupancy", "maxOccupancy", "occupancyLoad", "designOccupancy") ??
    undefined;
  if (occupantLoad !== undefined) {
    out.occupantLoad = occupantLoad;
    out.spaceMaxOccupancy = occupantLoad;
    out.maxOccupancy = occupantLoad;
  }

  const exitCount = pickInt(raw, "exitCount", "numberOfExits", "storeyExitCount");
  if (exitCount !== undefined) {
    out.exitCount = exitCount;
    out.numberOfExits = exitCount;
    out.storeyExitCount = exitCount;
  }
}

function inferEvacuationFacts(raw: AnyRecord, out: AnyRecord): void {
  const explicit = pickStr(raw, "evacuationStrategy", "evacuation_strategy", "evacuationstrategy");

  if (explicit) {
    out.evacuationStrategy = explicit;
  } else {
    // ── SMART DEFAULT: derive from building type per ADB Vol1 §3.3 ──────────
    const isFlats =
      out.hasFlats === true ||
      out.flatUnitFlag === true ||
      out.blockOfFlatsFlag === true ||
      /flat|apartment|maisonette/i.test(String(out.buildingUse ?? "")) ||
      String(out.purposeGroup ?? "").startsWith("1a") ||
      String(out.purposeGroup ?? "").startsWith("2");

    out.evacuationStrategy = isFlats ? "stay put" : "simultaneous evacuation";
    console.log(`[normalizeFacts] evacuationStrategy defaulted to "${out.evacuationStrategy}" based on buildingType`);
  }

  const evac = out.evacuationStrategy.toLowerCase();
  out.evacuation_strategy = out.evacuationStrategy;
  out.evacuationstrategy = out.evacuationStrategy;
  out.stayPutStrategy = evac.includes("stay put");
  out.stayPut = out.stayPutStrategy;
  out.stayPutEvacuation = out.stayPutStrategy;
  out.simultaneousEvacuation = evac.includes("simultaneous");
  out.phasedEvacuation = evac.includes("phased");
}

function inferFireAlarmFacts(raw: AnyRecord, out: AnyRecord): void {
  const fireAlarmSystem =
    pickStr(raw, "fireAlarmSystem", "alarmSystemType", "alarmCategory", "fire_alarm_system") ??
    "not specified"; // default so alarm rules can evaluate

  out.fireAlarmSystem = fireAlarmSystem;
  out.alarmSystemType = pickStr(raw, "alarmSystemType") ?? fireAlarmSystem;
  out.alarmCategory = pickStr(raw, "alarmCategory") ?? fireAlarmSystem;
  out.alarmGrade = pickStr(raw, "alarmGrade", "fireAlarmGrade", "alarm_grade") ?? "not specified";
  out.fireAlarmGrade = out.alarmGrade;

  // Auto-detection
  const autoDetection =
    pickBool(raw, "automaticDetectionPresent", "automaticDetectionProvided", "automaticDetectionAlarmProvided") ??
    false;
  out.automaticDetectionPresent = autoDetection;
  out.automaticDetectionProvided = autoDetection;
  out.automaticDetectionAlarmProvided = autoDetection;

  // Staff presence — CRITICAL: rules like B1-ALARM-AUTODET-UNSUPERVISED need this
  out.staffPresencePattern =
    pickStr(raw, "staffPresencePattern", "staff_presence_pattern", "occupancyPattern") ??
    "unknown";
  out.occupancyPattern = pickStr(raw, "occupancyPattern") ?? out.staffPresencePattern;
  out.managementProceduresPresent =
    pickBool(raw, "managementProceduresPresent", "management_procedures_present") ?? false;
}

function inferSprinklerFacts(raw: AnyRecord, out: AnyRecord): void {
  const sprinklersProvided =
    pickBool(
      raw,
      "sprinklersProvided", "sprinklersProvidedFlag", "sprinklerSystemProvided",
      "sprinklersPresent", "sprinklersPresentFlag", "sprinklerProvided",
      "sprinklerSystemPresent", "sprinklerSystemFlag"
    ) ?? false; // conservative default: NOT provided

  out.sprinklersProvided = sprinklersProvided;
  out.sprinklersProvidedFlag = sprinklersProvided;
  out.sprinklerSystemProvided = sprinklersProvided;
  out.sprinklersPresent = sprinklersProvided;
  out.sprinklersPresentFlag = sprinklersProvided;
  out.sprinklerProvided = sprinklersProvided;
  out.sprinklerSystemPresent = sprinklersProvided;
  out.sprinklerSystemFlag = sprinklersProvided;

  if (out.sprinklerSystemRequired === undefined && out.buildingHeightOver11m === true) {
    out.sprinklerSystemRequired = true;
  }
}

function inferFireMainAndFRSFacts(raw: AnyRecord, out: AnyRecord): void {
  const fireMainPresent =
    pickBool(
      raw,
      "fireMainPresent", "fire_mains_present", "fire_mains_provided", "fireMainsProvided",
      "fireMainsPresent", "dryRiserPresent", "risingMainPresent"
    ) ?? false;

  out.fireMainPresent = fireMainPresent;
  out.fire_mains_present = fireMainPresent;
  out.fire_mains_provided = fireMainPresent;
  out.fireMainsProvided = fireMainPresent;
  out.fireMainsPresent = fireMainPresent;
  out.dryRiserPresent = pickBool(raw, "dryRiserPresent") ?? fireMainPresent;
  out.risingMainPresent = pickBool(raw, "risingMainPresent") ?? fireMainPresent;
  out.fireMainProvided =
    pickBool(raw, "fireMainProvided") ?? fireMainPresent;

  const signageQuality =
    pickLower(raw, "signageQuality", "fireMainInletSignageQuality") ??
    (pickBool(raw, "visibilityFromRoad") === false ? "inadequate" : undefined);
  if (signageQuality !== undefined) {
    out.signageQuality = signageQuality;
  }

  const vehicleAccessProvided = pickBool(
    raw,
    "vehicleAccessProvided", "fireServiceVehicleAccessProvided", "applianceAccessProvided"
  );
  if (vehicleAccessProvided !== undefined) {
    out.vehicleAccessProvided = vehicleAccessProvided;
  }

  const accessRoadWidth = pickNum(raw, "accessRoadWidth_m", "accessRoadWidthM", "fireServiceAccessWidthM");
  if (accessRoadWidth !== undefined) {
    out.accessRoadWidth_m = accessRoadWidth;
    out.accessRoadWidthM = accessRoadWidth;
  }

  const hardstandingPresent = pickBool(raw, "hardstandingPresent", "hardstanding_flag");
  if (hardstandingPresent !== undefined) {
    out.hardstandingPresent = hardstandingPresent;
  }

  const accessRouteObstructed = pickBool(raw, "accessRouteObstructed", "access_route_obstructed");
  if (accessRouteObstructed !== undefined) {
    out.accessRouteObstructed = accessRouteObstructed;
  }

  const hoseDistance =
    pickNum(raw, "hoseDistanceMax_m", "maxHoseRun_m", "commonEscapeTravelDistanceM", "hoseCoverageDistanceM") ??
    undefined;
  if (hoseDistance !== undefined) {
    out.hoseDistanceMax_m = hoseDistance;
    out.maxHoseRun_m = hoseDistance;
  }

  const shaftRequired =
    pickBool(raw, "firefightingShaftRequired", "firefighting_shaft_required") ??
    (() => {
      const h = out.heightTopStoreyM ?? out.buildingHeightM;
      return typeof h === "number" ? h > 18 : false; // default false (conservative)
    })();

  out.firefightingShaftRequired = shaftRequired;

  const shaftProvided =
    pickBool(raw, "firefightingShaftProvided", "firefightingShaftPresent", "firefighting_shaft_provided") ??
    (shaftRequired === false ? false : false); // default false

  out.firefightingShaftProvided = shaftProvided;
  out.firefightingShaftPresent = shaftProvided;
  out.protectedShaftProvidedFlag =
    pickBool(raw, "protectedShaftProvidedFlag") ?? shaftProvided;

  const liftProvided =
    pickBool(raw, "firefightingLiftProvided", "firefighting_lift_provided", "firefightingLiftPresent") ??
    false;
  out.firefightingLiftProvided = liftProvided;
  out.firefightingLiftPresent = liftProvided;

  const bs9990Referenced =
    pickBool(raw, "bs9990ReferencedInFireMainSpecFlag", "bs9990Referenced", "fireMainToBS9990") ??
    (fireMainPresent === true ? true : undefined);
  if (bs9990Referenced !== undefined) {
    out.bs9990ReferencedInFireMainSpecFlag = bs9990Referenced;
    out.fireMainDesignStandard = bs9990Referenced ? "BS 9990" : undefined;
  }
}

function inferStructuralFacts(raw: AnyRecord, out: AnyRecord): void {
  const elementFrMinutes =
    pickNum(raw, "elementFrMinutes", "elementFireResistanceMinutes", "primaryStructureFrMinutes") ??
    undefined;
  if (elementFrMinutes !== undefined) {
    out.elementFrMinutes = elementFrMinutes;
    out.elementFireResistanceMinutes = elementFrMinutes;
  }

  const compartmentWallPresent = pickBool(
    raw, "compartmentWallPresent", "compartmentWallPresentFlag", "partyWallPresentFlag"
  );
  if (compartmentWallPresent !== undefined) {
    out.compartmentWallPresent = compartmentWallPresent;
    out.compartmentWallPresentFlag = compartmentWallPresent;
    out.partyWallPresentFlag =
      pickBool(raw, "partyWallPresentFlag") ?? compartmentWallPresent;
  }

  const compartmentFloorPresent = pickBool(raw, "compartmentFloorPresent", "compartmentFloorPresentFlag");
  if (compartmentFloorPresent !== undefined) {
    out.compartmentFloorPresent = compartmentFloorPresent;
    out.compartmentFloorPresentFlag = compartmentFloorPresent;
  }

  const concealedSpaces =
    pickBool(raw, "hasConcealedSpaces", "concealedCavitiesPresentFlag", "hasCavities", "cavityPresentFlag") ??
    undefined;
  if (concealedSpaces !== undefined) {
    out.hasConcealedSpaces = concealedSpaces;
    out.concealedCavitiesPresentFlag = concealedSpaces;
    out.hasCavities = concealedSpaces;
    out.cavityPresentFlag = concealedSpaces;
  }

  const cavityBarriersPresent =
    pickBool(raw, "cavityBarriersPresent", "cavityBarriersProvidedFlag", "barriersAtCompartmentLineFlag") ??
    false;
  out.cavityBarriersPresent = cavityBarriersPresent;
  out.cavityBarriersProvidedFlag = cavityBarriersPresent;
  out.barriersAtCompartmentLineFlag = cavityBarriersPresent;

  const cavityBarrierFixingSpecified = pickBool(
    raw, "cavityBarrierFixingSpecified", "cavity_barrier_fixing_specified"
  );
  if (cavityBarrierFixingSpecified !== undefined) {
    out.cavityBarrierFixingSpecified = cavityBarrierFixingSpecified;
  }

  const fireSeparatingElementPresent = pickBool(
    raw, "fireSeparatingElementPresent", "fireSeparatingConstructionPresent"
  );
  if (fireSeparatingElementPresent !== undefined) {
    out.fireSeparatingElementPresent = fireSeparatingElementPresent;
  }

  const pipePenetrationsPresent = pickBool(
    raw, "pipePenetrationPresent", "pipePenetrationsPresent", "pipe_penetration_present"
  );
  if (pipePenetrationsPresent !== undefined) {
    out.pipePenetrationPresent = pipePenetrationsPresent;
    out.pipePenetrationsPresent = pipePenetrationsPresent;
    out.pipe_penetration_present = pipePenetrationsPresent;
    out.pipePenetrationsThroughFireSeparatingElementFlag =
      pickBool(raw, "pipePenetrationsThroughFireSeparatingElementFlag") ?? pipePenetrationsPresent;
  }

  const ductPenetrationsPresent = pickBool(raw, "ductPenetrationsPresent", "flueOrDuctThroughFireSeparatingElementFlag");
  if (ductPenetrationsPresent !== undefined) {
    out.ductPenetrationsPresent = ductPenetrationsPresent;
    out.flueOrDuctThroughFireSeparatingElementFlag =
      pickBool(raw, "flueOrDuctThroughFireSeparatingElementFlag") ?? ductPenetrationsPresent;
  }

  const shaftOpeningsPresent = pickBool(raw, "shaftOpeningsPresent");
  if (shaftOpeningsPresent !== undefined) {
    out.shaftOpeningsPresent = shaftOpeningsPresent;
  }
}

function inferSmokeVentFacts(raw: AnyRecord, out: AnyRecord): void {
  out.smokeControlSystem =
    pickStr(raw, "smokeControlSystem", "smoke_control_system") ?? "not specified";
  out.smokeControlProvided =
    pickBool(raw, "smokeControlProvided", "smokeControlPresent") ?? false;

  out.aovPresent = pickBool(raw, "aovPresent", "aov_present") ?? false;
  out.aovProvided = pickBool(raw, "aovProvided") ?? out.aovPresent;

  out.smokeExtractionProvided =
    pickBool(raw, "smokeExtractionProvided", "smokeExtractionPresent") ?? false;
  out.smokeDetectionPresent =
    pickBool(raw, "smokeDetectionPresent", "smokeDetectionProvided") ?? false;
}

function inferB2Facts(raw: AnyRecord, out: AnyRecord): void {
  const wallLiningClass =
    pickStr(raw, "wallLiningClass", "liningClassification", "wall_lining_class", "lining_classification") ??
    undefined;
  if (wallLiningClass !== undefined) {
    out.wallLiningClass = wallLiningClass;
    out.liningClassification = wallLiningClass;
    out.liningClass = wallLiningClass;
    out.lining_class = wallLiningClass;
  }

  const ceilingLiningClass =
    pickStr(raw, "ceilingLiningClass", "ceilingliningclass") ??
    wallLiningClass;
  if (ceilingLiningClass !== undefined) {
    out.ceilingLiningClass = ceilingLiningClass;
    out.ceilingliningclass = ceilingLiningClass;
  }

  const elementType = pickLower(raw, "elementType", "componentType", "element_type");
  if (elementType !== undefined) {
    out.elementType = elementType;
    out.componentType = elementType;
  }

  const lightingDiffusersProvidedFlag =
    pickBool(raw, "lightingDiffusersProvidedFlag", "diffuserFormsPartOfCeiling", "thermoplasticDiffusersPresent") ??
    undefined;
  if (lightingDiffusersProvidedFlag !== undefined) {
    out.lightingDiffusersProvidedFlag = lightingDiffusersProvidedFlag;
    out.diffuserFormsPartOfCeiling = lightingDiffusersProvidedFlag;
  }

  const isExternalWindow = pickBool(raw, "isExternalWindow", "externalWindowFlag");
  if (isExternalWindow !== undefined) {
    out.isExternalWindow = isExternalWindow;
  }

  const ceilingThermoplasticClass = pickStr(
    raw, "ceilingThermoplasticClass", "rooflightTPClass", "thermoplasticClass"
  );
  if (ceilingThermoplasticClass !== undefined) {
    out.ceilingThermoplasticClass = ceilingThermoplasticClass;
  }
}

function inferFacadeFacts(raw: AnyRecord, out: AnyRecord): void {
  const clsRaw = firstDefined(raw, [
    "externalWallMaterialClass", "externalWallReactionToFireClass",
    "reactionToFireClass", "materialClass", "class",
  ]);

  const clsValues = asArray(clsRaw).map((x) => String(x));
  const clsJoined = clsValues.join(" | ");
  if (clsValues.length) {
    out.externalWallMaterialClass = clsJoined;
    out.externalWallReactionToFireClass = clsJoined;
    out.reactionToFireClass = clsJoined;
    out.class = clsJoined;
  } else {
    out.externalWallMaterialClass ??= "not specified";
    out.externalWallReactionToFireClass ??= "not specified";
  }

  const claddingType = pickStr(raw, "claddingType", "cladding_type", "externalWallType", "external_wall_type", "claddingMaterial");
  if (claddingType !== undefined) {
    out.claddingType = claddingType;
    out.externalWallType = claddingType;
    out.claddingMaterial = claddingType;
  } else {
    out.claddingMaterial ??= "not specified";
  }

  const canopyProvided =
    pickBool(raw, "canopyProvidedFlag", "has_canopy", "hasCanopy", "canopyPresent") ??
    undefined;
  if (canopyProvided !== undefined) {
    out.canopyProvidedFlag = canopyProvided;
    out.has_canopy = canopyProvided;
    out.hasCanopy = canopyProvided;
  }

  const balconyPresent = pickBool(raw, "balconyPresent", "balconyPresentFlag") ?? undefined;
  if (balconyPresent !== undefined) {
    out.balconyPresent = balconyPresent;
    out.balconyPresentFlag = balconyPresent;
  }

  const externalWallAttachmentPresentFlag =
    pickBool(raw, "externalWallAttachmentPresentFlag", "specifiedAttachmentsPresentFlag") ??
    (balconyPresent === true || canopyProvided === true ? true : undefined);
  if (externalWallAttachmentPresentFlag !== undefined) {
    out.externalWallAttachmentPresentFlag = externalWallAttachmentPresentFlag;
  }

  const membranePresentFlag = pickBool(raw, "membranePresentFlag", "externalWallMembranePresent");
  if (membranePresentFlag !== undefined) {
    out.membranePresentFlag = membranePresentFlag;
  }

  const thermalBreaksPresentFlag = pickBool(raw, "thermalBreaksPresentFlag", "thermalBreakPresent");
  if (thermalBreaksPresentFlag !== undefined) {
    out.thermalBreaksPresentFlag = thermalBreaksPresentFlag;
  }

  const roofCoverDesignation = pickStr(raw, "roofCoverDesignation", "roof_cover_designation", "roofClassification");
  if (roofCoverDesignation !== undefined) {
    out.roofCoverDesignation = roofCoverDesignation;
    out.roofClassification = roofCoverDesignation;
  }

  const roofEdgeNearBoundary = pickBool(raw, "roofEdgeNearBoundary", "roof_edge_near_boundary");
  if (roofEdgeNearBoundary !== undefined) {
    out.roofEdgeNearBoundary = roofEdgeNearBoundary;
  }

  const compartmentWallMeetsRoof =
    pickBool(
      raw,
      "compartmentWallMeetsRoofFlag", "compartmentWallMeetsOrPassesUnderRoofFlag",
      "compartmentWallThroughRoofFlag", "hasCompartmentWallToRoofJunction"
    ) ?? undefined;

  if (compartmentWallMeetsRoof !== undefined) {
    out.compartmentWallMeetsRoofFlag = compartmentWallMeetsRoof;
    out.compartmentWallMeetsOrPassesUnderRoofFlag = compartmentWallMeetsRoof;
    out.compartmentWallThroughRoofFlag = compartmentWallMeetsRoof;
    out.hasCompartmentWallToRoofJunction = compartmentWallMeetsRoof;
  }
}

function inferMiscFacts(raw: AnyRecord, out: AnyRecord): void {
  const emergencyLightingPresent = pickBool(
    raw, "emergencyLightingPresent", "escapeLightingPresent", "emergency_lighting_present"
  );
  if (emergencyLightingPresent !== undefined) {
    out.emergencyLightingPresent = emergencyLightingPresent;
    out.escapeLightingPresent = emergencyLightingPresent;
  }

  const refugeFlag = pickBool(raw, "requiresRefugesFlag", "refugeRequiredFlag");
  if (refugeFlag !== undefined) {
    out.requiresRefugesFlag = refugeFlag;
  }

  const innerRoomFlag = pickBool(raw, "innerRoomFlag", "inner_room_flag");
  if (innerRoomFlag !== undefined) {
    out.innerRoomFlag = innerRoomFlag;
  }

  const galleryPresentFlag = pickBool(raw, "galleryPresentFlag", "galleryPresent");
  if (galleryPresentFlag !== undefined) {
    out.galleryPresentFlag = galleryPresentFlag;
    out.galleryPresent = galleryPresentFlag;
  }

  const basementHabitableRoomsFlag = pickBool(raw, "basementHabitableRoomsFlag", "basement_habitable_rooms_flag");
  if (basementHabitableRoomsFlag !== undefined) {
    out.basementHabitableRoomsFlag = basementHabitableRoomsFlag;
  }

  const passengerLiftPresent = pickBool(raw, "passengerLiftPresent", "hasPassengerLift", "liftPresent");
  if (passengerLiftPresent !== undefined) {
    out.passengerLiftPresent = passengerLiftPresent;
  }

  const emergencyEscapeWindowPresent = pickBool(
    raw,
    "emergencyEscapeWindowPresent", "emergencyEscapeWindowProvidedFlag",
    "emergencyEscapeWindowPresentFlag"
  );
  if (emergencyEscapeWindowPresent !== undefined) {
    out.emergencyEscapeWindowPresent = emergencyEscapeWindowPresent;
    out.emergencyEscapeWindowProvidedFlag = emergencyEscapeWindowPresent;
  }

  const emergencyEscapeDoorPresent = pickBool(
    raw, "emergencyEscapeDoorProvidedFlag", "emergencyEscapeDoorPresentFlag"
  );
  if (emergencyEscapeDoorPresent !== undefined) {
    out.emergencyEscapeDoorProvidedFlag = emergencyEscapeDoorPresent;
  }

  const replacementWindowsFlag = pickBool(raw, "replacementWindowsFlag", "replacement_windows_flag");
  if (replacementWindowsFlag !== undefined) {
    out.replacementWindowsFlag = replacementWindowsFlag;
  }

  const materialChangeOfUseFlag = pickBool(raw, "materialChangeOfUseFlag", "material_change_of_use_flag");
  if (materialChangeOfUseFlag !== undefined) {
    out.materialChangeOfUseFlag = materialChangeOfUseFlag;
  }

  const liveWorkUnitFlag = pickBool(raw, "liveWorkUnitFlag", "live_work_unit_flag");
  if (liveWorkUnitFlag !== undefined) {
    out.liveWorkUnitFlag = liveWorkUnitFlag;
  }

  const openConnectionPresent = pickBool(raw, "openConnectionPresent", "openingBetweenFloorsPresentFlag");
  if (openConnectionPresent !== undefined) {
    out.openConnectionPresent = openConnectionPresent;
    out.openingBetweenFloorsPresentFlag = openConnectionPresent;
  }

  const deadEndAccessRouteFlag = pickBool(raw, "deadEndAccessRouteFlag", "dead_end_access_route_flag");
  if (deadEndAccessRouteFlag !== undefined) {
    out.deadEndAccessRouteFlag = deadEndAccessRouteFlag;
  }

  const secureInfoBoxProvided = pickBool(raw, "secureInfoBoxProvided", "premisesInfoBoxProvided");
  if (secureInfoBoxProvided !== undefined) {
    out.secureInfoBoxProvided = secureInfoBoxProvided;
  }

  const wayfindingSignageProvided = pickBool(raw, "wayfindingSignageProvided", "wayfinding_signage_provided");
  if (wayfindingSignageProvided !== undefined) {
    out.wayfindingSignageProvided = wayfindingSignageProvided;
  }

  const carParkFlag = pickBool(raw, "carParkFlag", "car_park_flag", "carParkPresent");
  if (carParkFlag !== undefined) {
    out.carParkFlag = carParkFlag;
    out.carParkPresent = carParkFlag;
  }

  // Sleeping / occupancy risk
  const isResidential = out.isResidentialAccommodation;
  out.sleepingAccommodation ??= isResidential ?? false;
  out.sleepingAccommodationFlag ??= out.sleepingAccommodation;
  out.sleepingRiskFlag ??= out.sleepingAccommodation;

  // Space / room defaults
  out.spaceType ??= out.roomType ?? out.areaType ?? "not specified";
  out.roomType ??= out.spaceType;
  out.areaType ??= out.spaceType;
  out.hazardLevel ??= "normal";
  out.fireHazardLevel ??= out.hazardLevel;

  // Relevant building (BSA 2022)
  out.relevantBuilding_reg7_4 ??= out.relevantBuildingFlag;
  out.reg7AppliesFlag ??= out.relevantBuildingFlag;
}

function deriveCommercialHardGates(out: AnyRecord): void {
  if (out.buildingType === "commercial" || out.isResidentialAccommodation === false) {
    out.flatUnitFlag ??= false;
    out.hasFlats ??= false;
    out.blockOfFlatsFlag ??= false;
    out.dwellinghouseFlag ??= false;
    out.dwellingType ??= undefined;
  }
}

function finalConsistencyPass(out: AnyRecord): void {
  if (out.buildingType === "commercial") {
    out.isResidentialAccommodation = false;
    out.relevantBuildingFlag = false;
  }

  if (out.onEscapeRouteFlag === true && out.protectedRoutePresentFlag === undefined) {
    out.protectedRoutePresentFlag = true;
  }

  if (out.fireMainPresent === true && out.fireMainProvided === undefined) {
    out.fireMainProvided = true;
  }

  if (out.firefightingShaftRequired === false && out.firefightingShaftProvided === undefined) {
    out.firefightingShaftProvided = false;
  }

  if (out.heightTopStoreyM !== undefined && out.maxStoreyAboveFRSAccessLevelM === undefined) {
    out.maxStoreyAboveFRSAccessLevelM = out.heightTopStoreyM;
  }

  if (out.distanceToRelevantBoundaryMm !== undefined && out.boundaryDistanceMeters === undefined) {
    out.boundaryDistanceMeters = out.distanceToRelevantBoundaryMm / 1000;
  }

  if (out.boundaryDistanceMeters !== undefined && out.distanceToRelevantBoundaryMm === undefined) {
    out.distanceToRelevantBoundaryMm = Math.round(out.boundaryDistanceMeters * 1000);
  }

  if (out.externalWallMaterialClass && !out.externalWallReactionToFireClass) {
    out.externalWallReactionToFireClass = out.externalWallMaterialClass;
  }

  if (out.externalWallReactionToFireClass && !out.externalWallMaterialClass) {
    out.externalWallMaterialClass = out.externalWallReactionToFireClass;
  }

  // ── TEMP DEBUG: log key resolved facts ─────────────────────────────────────
  console.log("[normalizeFacts] RESOLVED FACTS PREVIEW:", {
    buildingUse: out.buildingUse,
    buildingType: out.buildingType,
    purposeGroup: out.purposeGroup,
    isResidentialAccommodation: out.isResidentialAccommodation,
    hasFlats: out.hasFlats,
    dwellingType: out.dwellingType,
    heightTopStoreyM: out.heightTopStoreyM,
    buildingHeightM: out.buildingHeightM,
    buildingHeightOver18m: out.buildingHeightOver18m,
    buildingHeightOver11m: out.buildingHeightOver11m,
    numberOfStaircases: out.numberOfStaircases,
    singleStaircaseBuilding: out.singleStaircaseBuilding,
    sprinklersProvided: out.sprinklersProvided,
    evacuationStrategy: out.evacuationStrategy,
    stayPutStrategy: out.stayPutStrategy,
    fireAlarmSystem: out.fireAlarmSystem,
    staffPresencePattern: out.staffPresencePattern,
    fireMainPresent: out.fireMainPresent,
    firefightingShaftRequired: out.firefightingShaftRequired,
    relevantBuildingFlag: out.relevantBuildingFlag,
    totalKeys: Object.keys(out).length,
  });
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
export function normalizeFacts(input: AnyRecord = {}): NormalizedFacts {
  const raw: AnyRecord = { ...input };
  const out: AnyRecord = { ...input };

  // Step 1: core identity facts
  out.buildingUse = inferBuildingUse(raw);
  out.buildingType = inferBuildingType(raw);

  // Step 2: height and distance aliases (must come before stair/shaft inference)
  inferHeightAliases(raw, out);
  inferDistanceAliases(raw, out);

  // Step 3: dwelling / flat flags
  const dwelling = inferDwellingFlags(raw, out);
  Object.assign(out, dwelling);

  const flats = inferFlatFlags(raw, out);
  Object.assign(out, flats);

  // Step 4: purpose group (after buildingUse is resolved)
  out.purposeGroup = inferPurposeGroup(raw, out.buildingUse) ?? out.purposeGroup;
  out.purpose_group = out.purposeGroup;
  out.buildingPurposeGroup = out.purposeGroup;

  // Step 5: space / hazard
  out.hazardLevel = pickLower(raw, "hazardLevel", "hazard_level") ?? out.hazardLevel ?? "normal";
  out.spaceType = pickLower(raw, "spaceType", "space_type", "roomType") ?? out.spaceType;
  out.isCirculationSpace =
    pickBool(raw, "isCirculationSpace", "circulationSpaceFlag") ??
    (out.spaceType === "circulation" ? true : undefined);

  // Step 6: all sub-domain inferences
  inferEscapeAndStairFacts(raw, out);
  inferEvacuationFacts(raw, out);      // ← NEW: evacuation strategy + stayPut flags
  inferFireAlarmFacts(raw, out);       // ← NEW: alarm + staffPresencePattern defaults
  inferSprinklerFacts(raw, out);       // ← NEW: sprinkler defaults (false = conservative)
  inferSmokeVentFacts(raw, out);       // ← NEW: AOV / smoke control defaults
  inferFireMainAndFRSFacts(raw, out);
  inferStructuralFacts(raw, out);
  inferB2Facts(raw, out);
  inferFacadeFacts(raw, out);
  inferMiscFacts(raw, out);

  // Step 7: relevantBuildingFlag (after height + residential flags resolved)
  out.relevantBuildingFlag = inferRelevantBuildingFlag(raw, out);
  out.relevant_building_flag = out.relevantBuildingFlag;

  // Step 8: hard commercial overrides
  deriveCommercialHardGates(out);

  // Step 9: final cross-field consistency + debug log
  finalConsistencyPass(out);

  return out;
}

/* Extra exports for compatibility */
export const buildCanonicalFacts = normalizeFacts;
export const normalizeCanonicalFacts = normalizeFacts;
export default normalizeFacts;
