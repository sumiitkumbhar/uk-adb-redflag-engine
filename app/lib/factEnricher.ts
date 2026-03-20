// app/lib/factEnricher.ts

export type FactMap = Record<string, any>;

function asString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function asLower(v: unknown): string {
  return asString(v).toLowerCase();
}

function asBool(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") {
    if (v === 1) return true;
    if (v === 0) return false;
  }
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "yes", "y", "1", "provided", "present"].includes(s)) return true;
    if (["false", "no", "n", "0", "not provided", "absent"].includes(s)) return false;
  }
  return undefined;
}

function asNum(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.trim());
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function firstDefined<T = unknown>(...values: T[]): T | undefined {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

export function enrichFacts(rawFacts: FactMap): FactMap {
  const facts: FactMap = { ...(rawFacts ?? {}) };

  const buildingUse = asLower(
    firstDefined(
      facts.buildingUse,
      facts.buildinguse,
      facts.use,
      facts.occupancyType
    )
  );

  const evacuationStrategy = asLower(
    firstDefined(
      facts.evacuationStrategy,
      facts.evacuationstrategy
    )
  );

  const spaceType = asLower(
    firstDefined(
      facts.spaceType,
      facts.spacetype,
      facts.roomType,
      facts.roomtype
    )
  );

  const numberOfStaircases = asNum(
    firstDefined(
      facts.numberOfStaircases,
      facts.numberofstaircases
    )
  );

  const storeysAboveGroundCount = asNum(
    firstDefined(
      facts.storeysAboveGroundCount,
      facts.storeysabovegroundcount,
      facts.numberOfStoreys,
      facts.numberofstoreys,
      facts.storeys
    )
  );

  const travelDistanceM = asNum(
    firstDefined(
      facts.travelDistanceM,
      facts.traveldistancem
    )
  );

  const alarmCategory = asString(
    firstDefined(
      facts.alarmCategory,
      facts.alarmcategory
    )
  );

  const sprinklersProvided = asBool(
    firstDefined(
      facts.sprinklersProvided,
      facts.sprinklersprovided
    )
  );

  // -----------------------------
  // Core occupancy / use mappings
  // -----------------------------
  if (!facts.purposeGroup) {
    if (
      buildingUse.includes("flat") ||
      buildingUse.includes("apartment") ||
      buildingUse.includes("block of flats")
    ) {
      facts.purposeGroup = "2(b)";
    } else if (
      buildingUse.includes("hotel") ||
      buildingUse.includes("hostel") ||
      buildingUse.includes("boarding")
    ) {
      facts.purposeGroup = "2(a)";
    } else if (buildingUse.includes("office")) {
      facts.purposeGroup = "3";
    } else if (
      buildingUse.includes("shop") ||
      buildingUse.includes("retail")
    ) {
      facts.purposeGroup = "4";
    } else if (
      buildingUse.includes("assembly") ||
      buildingUse.includes("school") ||
      buildingUse.includes("education")
    ) {
      facts.purposeGroup = "5";
    } else if (
      buildingUse.includes("industrial") ||
      buildingUse.includes("warehouse") ||
      buildingUse.includes("factory")
    ) {
      facts.purposeGroup = "6";
    }
  }

  if (!facts.dwellingType) {
    if (
      buildingUse.includes("flat") ||
      buildingUse.includes("apartment")
    ) {
      facts.dwellingType = "flat";
    } else if (
      buildingUse.includes("house") ||
      buildingUse.includes("dwelling")
    ) {
      facts.dwellingType = "house";
    }
  }

  if (facts.flatUnitFlag === undefined) {
    if (
      buildingUse.includes("flat") ||
      buildingUse.includes("apartment")
    ) {
      facts.flatUnitFlag = true;
    }
  }

  if (facts.hasFlats === undefined) {
    if (
      buildingUse.includes("flat") ||
      buildingUse.includes("apartment") ||
      buildingUse.includes("block of flats")
    ) {
      facts.hasFlats = true;
    }
  }

  if (facts.isDwellingFlag === undefined) {
    if (
      buildingUse.includes("dwelling") ||
      buildingUse.includes("house")
    ) {
      facts.isDwellingFlag = true;
    }
  }

  if (facts.sleepingAccommodation === undefined) {
    if (
      buildingUse.includes("flat") ||
      buildingUse.includes("apartment") ||
      buildingUse.includes("hotel") ||
      buildingUse.includes("hostel") ||
      buildingUse.includes("residential")
    ) {
      facts.sleepingAccommodation = true;
    }
  }

  // -----------------------------
  // Escape / stair / route mappings
  // -----------------------------
  if (facts.numberOfStoreys === undefined && storeysAboveGroundCount !== undefined) {
    facts.numberOfStoreys = storeysAboveGroundCount;
  }

  if (facts.numberOfStaircases === undefined && numberOfStaircases !== undefined) {
    facts.numberOfStaircases = numberOfStaircases;
  }

  if (facts.numberExits === undefined && numberOfStaircases !== undefined) {
    facts.numberExits = numberOfStaircases;
  }

  if (facts.numberOfEscapeRoutes === undefined && numberOfStaircases !== undefined) {
    facts.numberOfEscapeRoutes = numberOfStaircases;
  }

  if (facts.twoDirectionsAvailableFlag === undefined && numberOfStaircases !== undefined) {
    facts.twoDirectionsAvailableFlag = numberOfStaircases >= 2;
  }

  if (facts.singleDirectionDistM === undefined && travelDistanceM !== undefined) {
    facts.singleDirectionDistM = travelDistanceM;
  }

  if (facts.travelDistanceNearestExitM === undefined && travelDistanceM !== undefined) {
    facts.travelDistanceNearestExitM = travelDistanceM;
  }

  // -----------------------------
  // Detection / alarm mappings
  // -----------------------------
  if (facts.automaticDetectionPresent === undefined) {
    if (alarmCategory) {
      facts.automaticDetectionPresent = true;
    }
  }

  if (facts.automaticDetectionProvided === undefined) {
    if (facts.automaticDetectionPresent !== undefined) {
      facts.automaticDetectionProvided = facts.automaticDetectionPresent;
    }
  }

  if (facts.fireAlarmSystem && !facts.alarmSystemType) {
    facts.alarmSystemType = "electrical";
  }

  // -----------------------------
  // Evacuation mappings
  // -----------------------------
  if (facts.stayPutStrategy === undefined && evacuationStrategy) {
    if (evacuationStrategy.includes("stay put")) {
      facts.stayPutStrategy = true;
    }
  }

  // -----------------------------
  // Risk / staffing / adjacency heuristics
  // -----------------------------
  if (facts.staffPresencePattern === undefined) {
    if (
      spaceType.includes("plant") ||
      spaceType.includes("void") ||
      spaceType.includes("storage") ||
      spaceType.includes("service riser")
    ) {
      facts.staffPresencePattern = "unsupervised";
    }
  }

  if (facts.adjacencyToEscapeRoutes === undefined) {
    // conservative default: leave missing unless explicit
    facts.adjacencyToEscapeRoutes = undefined;
  }

  if (facts.hazardLevel === undefined) {
    if (
      spaceType.includes("plant") ||
      spaceType.includes("kitchen") ||
      spaceType.includes("storage") ||
      spaceType.includes("boiler") ||
      spaceType.includes("electrical")
    ) {
      facts.hazardLevel = "high";
    } else {
      facts.hazardLevel = "normal";
    }
  }

  // -----------------------------
  // Height / relevant building mappings
  // -----------------------------
  const topStoreyHeightM = asNum(
    firstDefined(
      facts.topStoreyHeightM,
      facts.topstoreyheightm,
      facts.heightTopStoreyM,
      facts.heighttopstoreym
    )
  );

  if (facts.topStoreyHeightM === undefined && topStoreyHeightM !== undefined) {
    facts.topStoreyHeightM = topStoreyHeightM;
  }

  if (facts.heightTopStoreyM === undefined && topStoreyHeightM !== undefined) {
    facts.heightTopStoreyM = topStoreyHeightM;
  }

  if (facts.relevantBuildingFlag === undefined && topStoreyHeightM !== undefined) {
    facts.relevantBuildingFlag = topStoreyHeightM >= 18;
  }

  // -----------------------------
  // Sprinkler / system mappings
  // -----------------------------
  if (facts.sprinklersProvided === undefined && sprinklersProvided !== undefined) {
    facts.sprinklersProvided = sprinklersProvided;
  }

  return facts;
}