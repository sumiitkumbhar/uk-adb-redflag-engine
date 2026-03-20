export type RawFactLike = {
    key: string;
    value: string | number | boolean | null | undefined;
    confidence?: number;
  };
  
  function isMeaningful(v: unknown): boolean {
    return v !== null && v !== undefined && v !== "";
  }
  
  function betterFact(
    existing: RawFactLike | undefined,
    incoming: RawFactLike
  ): RawFactLike {
    if (!existing) return incoming;
  
    const a = existing.confidence ?? 0.5;
    const b = incoming.confidence ?? 0.5;
  
    if (b > a) return incoming;
    return existing;
  }
  
  function normalizeValue(v: any) {
    if (typeof v === "string") {
      const s = v.trim();
      if (s === "") return "";
  
      if (s === "true") return true;
      if (s === "false") return false;
  
      const num = Number(s);
      if (!Number.isNaN(num)) return num;
  
      return s;
    }
    return v;
  }
  
  function inferFacts(base: Record<string, any>): Record<string, any> {
    const facts = { ...base };
  
    const buildingUse = String(facts.buildingUse ?? "").toLowerCase();
    const purposeGroup = String(facts.purposeGroup ?? "").toLowerCase();
    const alarmCategory = String(facts.alarmCategory ?? "").toLowerCase();
    const fireAlarmSystem = String(facts.fireAlarmSystem ?? "").toLowerCase();
    const spaceType = String(facts.spaceType ?? "").toLowerCase();
  
    if (
      !facts.dwellingType &&
      (buildingUse.includes("flat") ||
        buildingUse.includes("apartment") ||
        buildingUse.includes("maisonette"))
    ) {
      facts.dwellingType = "flat";
    }
  
    if (
      !facts.dwellingType &&
      (buildingUse.includes("dwelling") || buildingUse.includes("house"))
    ) {
      facts.dwellingType = "dwellinghouse";
    }
  
    if (!facts.hasFlats && facts.dwellingType === "flat") {
      facts.hasFlats = true;
    }
  
    if (
      !facts.sleepingAccommodation &&
      (buildingUse.includes("hotel") ||
        buildingUse.includes("hostel") ||
        buildingUse.includes("care") ||
        buildingUse.includes("student") ||
        buildingUse.includes("flat") ||
        purposeGroup === "2(a)" ||
        purposeGroup === "2(b)")
    ) {
      facts.sleepingAccommodation = true;
    }
  
    if (
      facts.automaticDetectionPresent === undefined &&
      (alarmCategory.includes("l1") ||
        alarmCategory.includes("l2") ||
        alarmCategory.includes("l3") ||
        alarmCategory.includes("ld1") ||
        alarmCategory.includes("ld2") ||
        fireAlarmSystem.includes("detector") ||
        fireAlarmSystem.includes("detection"))
    ) {
      facts.automaticDetectionPresent = true;
    }
  
    if (
      !facts.staffPresencePattern &&
      (spaceType.includes("plant") ||
        spaceType.includes("storage") ||
        spaceType.includes("void") ||
        spaceType.includes("bin") ||
        spaceType.includes("refuse"))
    ) {
      facts.staffPresencePattern = "unsupervised";
    }
  
    if (
      facts.adjacencyToEscapeRoutes === undefined &&
      (spaceType.includes("corridor") ||
        spaceType.includes("lobby") ||
        spaceType.includes("stair"))
    ) {
      facts.adjacencyToEscapeRoutes = true;
    }
  
    if (
      facts.hazardLevel === undefined &&
      (buildingUse.includes("flat") ||
        buildingUse.includes("dwelling") ||
        buildingUse.includes("residential"))
    ) {
      facts.hazardLevel = "normal";
    }
  
    if (
      facts.numberOfStaircases === undefined &&
      typeof facts.commonStairCount === "number"
    ) {
      facts.numberOfStaircases = facts.commonStairCount;
    }
  
    if (
      facts.escapeRouteCount === undefined &&
      typeof facts.numberOfStaircases === "number"
    ) {
      facts.escapeRouteCount = facts.numberOfStaircases;
    }
  
    if (
      facts.finalExitWidthMm === undefined &&
      typeof facts.exitWidthMm === "number"
    ) {
      facts.finalExitWidthMm = facts.exitWidthMm;
    }
  
    if (
      facts.travelDistanceSingleDirectionM === undefined &&
      typeof facts.singleDirectionDistM === "number"
    ) {
      facts.travelDistanceSingleDirectionM = facts.singleDirectionDistM;
    }
  
    if (
      facts.travelDistanceTwoDirectionM === undefined &&
      typeof facts.travelDistanceNearestExitM === "number"
    ) {
      facts.travelDistanceTwoDirectionM = facts.travelDistanceNearestExitM;
    }
  
    return facts;
  }
  
  export function mergeFacts(rawFacts: RawFactLike[]): Record<string, any> {
    const bestFacts: Record<string, RawFactLike> = {};
  
    for (const fact of rawFacts) {
      if (!fact?.key) continue;
      if (!isMeaningful(fact.value)) continue;
  
      const normalized: RawFactLike = {
        ...fact,
        value: normalizeValue(fact.value),
      };
  
      bestFacts[fact.key] = betterFact(bestFacts[fact.key], normalized);
    }
  
    const values: Record<string, any> = {};
  
    for (const key in bestFacts) {
      values[key] = bestFacts[key].value;
    }
  
    return inferFacts(values);
  }