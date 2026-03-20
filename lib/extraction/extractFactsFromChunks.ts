import { extractFactsFromText, type RawExtractedFact } from "@/lib/extraction/factExtractor";
import {
  buildNormalizedFactSet,
  toEngineFacts,
} from "@/lib/extraction/factNormalizer";

export type ChunkRow = {
  id: string;
  idx?: number | null;
  page?: number | null;
  text: string;
};

export type ExtractedFactRow = {
  fact_key: string;
  fact_value: string | number | boolean | null;
  confidence: number;
  page: number | null;
  chunk_id: string;
  source_snippet?: string;
};

export type EnrichedFacts = Record<string, any>;

export type ChunkFactExtractionResult = {
  rawFacts: RawExtractedFact[];
  normalizedFacts: EnrichedFacts;
  engineFacts: EnrichedFacts;
  factRows: ExtractedFactRow[];
};

function cleanText(text: string): string {
  return String(text ?? "")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();
}

function mergeRawFactsFromChunks(
  chunks: ChunkRow[],
  sourceDocument?: string
): { rawFacts: RawExtractedFact[]; factRows: ExtractedFactRow[] } {
  const rawFacts: RawExtractedFact[] = [];
  const factRows: ExtractedFactRow[] = [];

  for (const chunk of chunks) {
    const facts = extractFactsFromText({
      text: chunk.text,
      sourceDocument,
    });

    for (const fact of facts) {
      rawFacts.push(fact);
      factRows.push({
        fact_key: fact.key,
        fact_value: fact.value,
        confidence: fact.confidence,
        page: typeof chunk.page === "number" ? chunk.page : null,
        chunk_id: chunk.id,
        source_snippet: fact.sourceSnippet,
      });
    }
  }

  return { rawFacts, factRows };
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const cleaned = String(value)
    .replace(/,/g, "")
    .replace(/\bmm\b/gi, "")
    .replace(/\bm\b/gi, "")
    .trim();

  if (!cleaned) return null;

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function toBooleanOrNull(value: unknown): boolean | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;

  const s = String(value).trim().toLowerCase();

  if (
    [
      "true",
      "yes",
      "y",
      "present",
      "provided",
      "installed",
      "available",
      "compliant",
      "adjacent",
      "near",
      "nearby",
    ].includes(s)
  ) {
    return true;
  }

  if (
    [
      "false",
      "no",
      "n",
      "absent",
      "not provided",
      "not installed",
      "not available",
      "non-compliant",
      "not adjacent",
      "not near",
      "remote",
    ].includes(s)
  ) {
    return false;
  }

  return null;
}

function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s || null;
}

function firstNonNull<T>(...values: Array<T | null | undefined>): T | null {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== "") return value as T;
  }
  return null;
}

function includesAny(text: string, needles: string[]) {
  const lc = text.toLowerCase();
  return needles.some((needle) => lc.includes(needle.toLowerCase()));
}

function addRawFact(
  rawFacts: RawExtractedFact[],
  factRows: ExtractedFactRow[],
  fact: RawExtractedFact,
  chunkId = "__document__",
  page: number | null = null
) {
  const existing = rawFacts.find((f) => f.key === fact.key);

  if (!existing) {
    rawFacts.push(fact);
    factRows.push({
      fact_key: fact.key,
      fact_value: fact.value,
      confidence: fact.confidence,
      page,
      chunk_id: chunkId,
      source_snippet: fact.sourceSnippet,
    });
    return;
  }

  if ((fact.confidence ?? 0) > (existing.confidence ?? 0)) {
    existing.value = fact.value;
    existing.confidence = fact.confidence;
    existing.sourceDocument = fact.sourceDocument;
    existing.sourceSnippet = fact.sourceSnippet;
  }
}

function addGlobalFallbackFacts(
  rawFacts: RawExtractedFact[],
  factRows: ExtractedFactRow[],
  chunks: ChunkRow[],
  sourceDocument?: string
) {
  const fullText = cleanText(chunks.map((c) => c.text ?? "").join("\n\n"));
  if (!fullText) return;

  const snippet = fullText.slice(0, 300);

  const purposeGroupMatch = fullText.match(
    /\bpurpose group\s*[:\-]?\s*(1\(a\)|1\(b\)|1\(c\)|2\(a\)|2\(b\)|3|4|5|6|7)\b/i
  ) || fullText.match(
    /\bpurpose groups?\s*(1\(a\)|1\(b\)|1\(c\)|2\(a\)|2\(b\)|3|4|5|6|7)\b/i
  );

  if (purposeGroupMatch) {
    addRawFact(
      rawFacts,
      factRows,
      {
        key: "purposeGroup",
        value: purposeGroupMatch[1],
        confidence: 0.95,
        sourceDocument,
        sourceSnippet: purposeGroupMatch[0],
      }
    );
  }

  const numberOfStairsMatch =
    fullText.match(/\bnumber of staircases\s*[:\-]?\s*([0-9]+)\b/i) ||
    fullText.match(/\b([0-9]+)\s+(?:protected\s+)?staircases?\b/i) ||
    fullText.match(/\b([0-9]+)\s+stair\s+cores?\b/i);

  if (numberOfStairsMatch) {
    const n = Number(numberOfStairsMatch[1]);
    if (Number.isFinite(n)) {
      addRawFact(
        rawFacts,
        factRows,
        {
          key: "numberOfStaircases",
          value: n,
          confidence: 0.93,
          sourceDocument,
          sourceSnippet: numberOfStairsMatch[0],
        }
      );
    }
  } else if (/\bsingle stair\b/i.test(fullText) || /\bone stair core\b/i.test(fullText)) {
    addRawFact(
      rawFacts,
      factRows,
      {
        key: "numberOfStaircases",
        value: 1,
        confidence: 0.9,
        sourceDocument,
        sourceSnippet: snippet,
      }
    );
  } else if (/\btwo stairs?\b/i.test(fullText) || /\btwo stair cores?\b/i.test(fullText)) {
    addRawFact(
      rawFacts,
      factRows,
      {
        key: "numberOfStaircases",
        value: 2,
        confidence: 0.9,
        sourceDocument,
        sourceSnippet: snippet,
      }
    );
  }

  const singleDirectionMatch =
    fullText.match(/\bsingle direction travel distance\s*(?:is|of|:)?\s*([0-9]+(?:\.[0-9]+)?)\s*m\b/i) ||
    fullText.match(/\btravel distance in one direction\s*(?:is|of|:)?\s*([0-9]+(?:\.[0-9]+)?)\s*m\b/i) ||
    fullText.match(/\bmaximum travel distance.*?one direction.*?([0-9]+(?:\.[0-9]+)?)\s*m\b/i);

  if (singleDirectionMatch) {
    const n = Number(singleDirectionMatch[1]);
    if (Number.isFinite(n)) {
      addRawFact(
        rawFacts,
        factRows,
        {
          key: "travelDistanceSingleDirectionM",
          value: n,
          confidence: 0.9,
          sourceDocument,
          sourceSnippet: singleDirectionMatch[0],
        }
      );
    }
  }

  const twoDirectionMatch =
    fullText.match(/\btwo direction travel distance\s*(?:is|of|:)?\s*([0-9]+(?:\.[0-9]+)?)\s*m\b/i) ||
    fullText.match(/\btravel distance(?: where escape is possible)? in more than one direction\s*(?:is|of|:)?\s*([0-9]+(?:\.[0-9]+)?)\s*m\b/i) ||
    fullText.match(/\btravel distance in two directions\s*(?:is|of|:)?\s*([0-9]+(?:\.[0-9]+)?)\s*m\b/i);

  if (twoDirectionMatch) {
    const n = Number(twoDirectionMatch[1]);
    if (Number.isFinite(n)) {
      addRawFact(
        rawFacts,
        factRows,
        {
          key: "travelDistanceTwoDirectionM",
          value: n,
          confidence: 0.9,
          sourceDocument,
          sourceSnippet: twoDirectionMatch[0],
        }
      );
    }
  }

  if (
    /\btwo directions of escape\b/i.test(fullText) ||
    /\bmore than one direction of escape\b/i.test(fullText) ||
    /\balternative directions of escape\b/i.test(fullText) ||
    /\balternative escape route provided\b/i.test(fullText) ||
    /\bsecondary escape route provided\b/i.test(fullText)
  ) {
    addRawFact(
      rawFacts,
      factRows,
      {
        key: "twoDirectionsAvailableFlag",
        value: true,
        confidence: 0.88,
        sourceDocument,
        sourceSnippet: snippet,
      }
    );
  } else if (
    /\bsingle direction of escape\b/i.test(fullText) ||
    /\bonly one direction of escape\b/i.test(fullText) ||
    /\bescape initially in one direction only\b/i.test(fullText)
  ) {
    addRawFact(
      rawFacts,
      factRows,
      {
        key: "twoDirectionsAvailableFlag",
        value: false,
        confidence: 0.88,
        sourceDocument,
        sourceSnippet: snippet,
      }
    );
  }

  const buildingUseHints: Array<{ pattern: RegExp; value: string }> = [
    { pattern: /\bblock of flats\b/i, value: "flats" },
    { pattern: /\bflats\b/i, value: "flats" },
    { pattern: /\bapartment(s)?\b/i, value: "flats" },
    { pattern: /\bmaisonette(s)?\b/i, value: "flats" },
    { pattern: /\bdwellinghouse\b/i, value: "dwellinghouse" },
    { pattern: /\bdwelling house\b/i, value: "dwellinghouse" },
    { pattern: /\bhotel\b/i, value: "hotel" },
    { pattern: /\bhostel\b/i, value: "hostel" },
    { pattern: /\bcare home\b/i, value: "care_home" },
    { pattern: /\bstudent accommodation\b/i, value: "student_accommodation" },
  ];

  for (const hint of buildingUseHints) {
    if (hint.pattern.test(fullText)) {
      addRawFact(
        rawFacts,
        factRows,
        {
          key: "buildingUse",
          value: hint.value,
          confidence: 0.86,
          sourceDocument,
          sourceSnippet: snippet,
        }
      );
      break;
    }
  }

  const alarmCategoryMatch =
    fullText.match(/\balarm category\s*[:\-]?\s*(L1|L2|L3|L4|L5|M|P1|P2|LD1|LD2|LD3)\b/i) ||
    fullText.match(/\b(Grade\s+[A-F]\s+LD[123])\b/i);

  if (alarmCategoryMatch) {
    addRawFact(
      rawFacts,
      factRows,
      {
        key: "alarmCategory",
        value: alarmCategoryMatch[1],
        confidence: 0.92,
        sourceDocument,
        sourceSnippet: alarmCategoryMatch[0],
      }
    );
  }

  if (
    /\bautomatic fire detection\b/i.test(fullText) ||
    /\bautomatic detection\b/i.test(fullText) ||
    /\bsmoke detection throughout\b/i.test(fullText) ||
    /\bsmoke detector(s)?\b/i.test(fullText) ||
    /\bheat detector(s)?\b/i.test(fullText) ||
    /\bafd system\b/i.test(fullText) ||
    /\bl1 fire alarm system\b/i.test(fullText) ||
    /\bl2 fire alarm system\b/i.test(fullText) ||
    /\bl3 fire alarm system\b/i.test(fullText) ||
    /\bld1 system\b/i.test(fullText) ||
    /\bld2 system\b/i.test(fullText) ||
    /\bld3 system\b/i.test(fullText)
  ) {
    addRawFact(
      rawFacts,
      factRows,
      {
        key: "automaticDetectionPresent",
        value: true,
        confidence: 0.9,
        sourceDocument,
        sourceSnippet: snippet,
      }
    );
  }

  if (
    /\bplant room\b/i.test(fullText) ||
    /\bstorage room\b/i.test(fullText) ||
    /\bstore room\b/i.test(fullText) ||
    /\bbin store\b/i.test(fullText) ||
    /\brefuse store\b/i.test(fullText) ||
    /\bvoid\b/i.test(fullText) ||
    /\bservice riser\b/i.test(fullText) ||
    /\belectrical cupboard\b/i.test(fullText)
  ) {
    addRawFact(
      rawFacts,
      factRows,
      {
        key: "staffPresencePattern",
        value: "unsupervised",
        confidence: 0.82,
        sourceDocument,
        sourceSnippet: snippet,
      }
    );
  }

  if (
    /\bcorridor\b/i.test(fullText) ||
    /\blobby\b/i.test(fullText) ||
    /\bstair\b/i.test(fullText) ||
    /\bescape route\b/i.test(fullText)
  ) {
    addRawFact(
      rawFacts,
      factRows,
      {
        key: "adjacencyToEscapeRoutes",
        value: true,
        confidence: 0.78,
        sourceDocument,
        sourceSnippet: snippet,
      }
    );
  }

  if (
    /\bstay put\b/i.test(fullText)
  ) {
    addRawFact(
      rawFacts,
      factRows,
      {
        key: "evacuationStrategy",
        value: "stay put",
        confidence: 0.88,
        sourceDocument,
        sourceSnippet: snippet,
      }
    );
  } else if (
    /\bsimultaneous evacuation\b/i.test(fullText)
  ) {
    addRawFact(
      rawFacts,
      factRows,
      {
        key: "evacuationStrategy",
        value: "simultaneous evacuation",
        confidence: 0.88,
        sourceDocument,
        sourceSnippet: snippet,
      }
    );
  }
}

function deriveStaffPresencePattern(
  facts: Record<string, any>,
  spaceType: string | null
): string | null {
  const existing = firstNonNull(
    toStringOrNull(facts.staffPresencePattern),
    toStringOrNull(facts.staffpresencepattern)
  );
  if (existing) return existing;

  if (
    spaceType &&
    includesAny(spaceType, [
      "plant",
      "storage",
      "void",
      "service riser",
      "bin store",
      "electrical cupboard",
      "refuse",
    ])
  ) {
    return "unsupervised";
  }

  if (spaceType && includesAny(spaceType, ["office", "reception", "concierge"])) {
    return "supervised";
  }

  return null;
}

function deriveAdjacencyToEscapeRoutes(
  facts: Record<string, any>,
  spaceType: string | null,
  commonCorridorPresent: boolean | null,
  commonLobbyPresent: boolean | null
): boolean | string | null {
  const existingBool = firstNonNull(
    toBooleanOrNull(facts.adjacencyToEscapeRoutes),
    toBooleanOrNull(facts.adjacencytoescaperoutes)
  );
  if (existingBool !== null) return existingBool;

  const existingStr = firstNonNull(
    toStringOrNull(facts.adjacencyToEscapeRoutes),
    toStringOrNull(facts.adjacencytoescaperoutes)
  );
  if (existingStr) return existingStr;

  if (spaceType && includesAny(spaceType, ["escape route", "corridor", "lobby", "stair"])) {
    return true;
  }

  if (commonCorridorPresent === true || commonLobbyPresent === true) {
    return true;
  }

  return null;
}

function inferAutomaticDetectionFromAlarm(
  alarmCategory: string | null,
  fireAlarmSystem: string | null
): boolean | null {
  const joined = `${alarmCategory ?? ""} ${fireAlarmSystem ?? ""}`.trim().toLowerCase();
  if (!joined) return null;

  const detectionIndicators = [
    "l1",
    "l2",
    "l3",
    "l4",
    "l5",
    "ld1",
    "ld2",
    "ld3",
    "p1",
    "p2",
    "automatic fire detection",
    "automatic detection",
    "smoke detection",
    "smoke detector",
    "heat detector",
    "detector",
  ];

  return detectionIndicators.some((x) => joined.includes(x)) ? true : null;
}

function deriveDwellingType(
  facts: Record<string, any>,
  buildingUse: string | null,
  hasFlats: boolean | null,
  isDwellingFlag: boolean | null
): string | null {
  const existing = firstNonNull(
    toStringOrNull(facts.dwellingType),
    toStringOrNull(facts.dwellingtype)
  );
  if (existing) return existing;

  const use = (buildingUse ?? "").toLowerCase();

  if (hasFlats === true || use.includes("flat") || use.includes("apartment") || use.includes("maisonette")) {
    return "flat";
  }

  if (isDwellingFlag === true || use.includes("dwelling") || use.includes("house")) {
    return "dwellinghouse";
  }

  return null;
}

function enrichNormalizedFacts(input: unknown): EnrichedFacts {
  const source =
    input && typeof input === "object" ? (input as Record<string, any>) : {};
  const facts: Record<string, any> = { ...source };

  const buildingHeightM = firstNonNull(
    toNumberOrNull(facts.buildingHeightM),
    toNumberOrNull(facts.buildingHeightMeters),
    toNumberOrNull(facts.buildingheightm)
  );

  const topStoreyHeightM = firstNonNull(
    toNumberOrNull(facts.topStoreyHeightM),
    toNumberOrNull(facts.heightTopStorey_m),
    toNumberOrNull(facts.heightTopStoreyM),
    toNumberOrNull(facts.topStoreyHeightMeters),
    toNumberOrNull(facts.topstoreyheightm)
  );

  const storeys = firstNonNull(
    toNumberOrNull(facts.storeys),
    toNumberOrNull(facts.storeyCount),
    toNumberOrNull(facts.storeysCount),
    toNumberOrNull(facts.numberOfStoreys)
  );

  const numberOfStaircases = firstNonNull(
    toNumberOrNull(facts.numberOfStaircases),
    toNumberOrNull(facts.commonStairCount),
    toNumberOrNull(facts.stairCount),
    toNumberOrNull(facts.numberofstaircases)
  );

  const sprinklerSystemPresent = firstNonNull(
    toBooleanOrNull(facts.sprinklerSystemPresent),
    toBooleanOrNull(facts.sprinklersProvided),
    toBooleanOrNull(facts.sprinklersPresent),
    toBooleanOrNull(facts.sprinklerSystemFlag)
  );

  const fireMainsPresent = firstNonNull(
    toBooleanOrNull(facts.fireMainsPresent),
    toBooleanOrNull(facts.fireMainsProvided),
    toBooleanOrNull(facts.dryRiserPresent),
    toBooleanOrNull(facts.risingMainPresent)
  );

  const exitWidthMm = firstNonNull(
    toNumberOrNull(facts.exitWidthMm),
    toNumberOrNull(facts.exitWidthMM),
    toNumberOrNull(facts.finalExitWidthMm),
    toNumberOrNull(facts.storeyExitWidthMm),
    toNumberOrNull(facts.doorWidthMm)
  );

  const buildingUse = firstNonNull(
    toStringOrNull(facts.buildingUse),
    toStringOrNull(facts.buildingPurposeGroup),
    toStringOrNull(facts.purposeGroup)
  );

  const purposeGroup = firstNonNull(
    toStringOrNull(facts.purposeGroup),
    toStringOrNull(facts.buildingPurposeGroup)
  );

  const spaceType = firstNonNull(
    toStringOrNull(facts.spaceType),
    toStringOrNull(facts.spacetype)
  );

  const hasFlats = firstNonNull(
    toBooleanOrNull(facts.hasFlats),
    buildingUse && includesAny(buildingUse, ["flat", "flats", "apartment", "apartments", "maisonette"])
      ? true
      : null
  );

  const isDwellingFlag = firstNonNull(
    toBooleanOrNull(facts.isDwellingFlag),
    buildingUse && includesAny(buildingUse, ["dwelling", "house", "maisonette", "home"])
      ? true
      : null
  );

  const sleepingAccommodation = firstNonNull(
    toBooleanOrNull(facts.sleepingAccommodation),
    buildingUse &&
      includesAny(buildingUse, [
        "sleeping",
        "hotel",
        "hostel",
        "care home",
        "residential",
        "flat",
        "student accommodation",
      ])
      ? true
      : null
  );

  const commonCorridorPresent = firstNonNull(
    toBooleanOrNull(facts.commonCorridorPresent),
    spaceType && includesAny(spaceType, ["corridor"]) ? true : null
  );

  const commonLobbyPresent = firstNonNull(
    toBooleanOrNull(facts.commonLobbyPresent),
    spaceType && includesAny(spaceType, ["lobby"]) ? true : null
  );

  const relevantBuildingFlag = firstNonNull(
    toBooleanOrNull(facts.relevantBuildingFlag),
    topStoreyHeightM !== null && topStoreyHeightM >= 18
      ? true
      : buildingHeightM !== null && buildingHeightM >= 18
      ? true
      : null
  );

  const reg7AppliesFlag = firstNonNull(
    toBooleanOrNull(facts.reg7AppliesFlag),
    relevantBuildingFlag
  );

  const singleDirectionDistM = firstNonNull(
    toNumberOrNull(facts.singleDirectionDistM),
    toNumberOrNull(facts.singleDirectionDistanceM),
    toNumberOrNull(facts.singleDirectionTravelDistanceM),
    toNumberOrNull(facts.travelDistanceSingleDirectionM),
    toNumberOrNull(facts.travelDistanceM)
  );

  const travelDistanceNearestExitM = firstNonNull(
    toNumberOrNull(facts.travelDistanceNearestExitM),
    toNumberOrNull(facts.travelDistanceTwoDirectionM),
    toNumberOrNull(facts.commonEscapeRouteTravelDistanceM),
    toNumberOrNull(facts.commonEscapeTravelDistanceM),
    toNumberOrNull(facts.travelDistanceM)
  );

  const finalExitWidthMm = firstNonNull(
    toNumberOrNull(facts.finalExitWidthMm),
    exitWidthMm
  );

  const storeyExitWidthMm = firstNonNull(
    toNumberOrNull(facts.storeyExitWidthMm),
    exitWidthMm
  );

  const stairWidthMm = firstNonNull(
    toNumberOrNull(facts.stairWidthMm),
    toNumberOrNull(facts.stairwidthmm),
    toNumberOrNull(facts.exitWidthMm)
  );

  const corridorWidthMm = firstNonNull(
    toNumberOrNull(facts.corridorWidthMm),
    toNumberOrNull(facts.minApproachRouteWidthMm)
  );

  const doorWidthMm = firstNonNull(
    toNumberOrNull(facts.doorWidthMm),
    finalExitWidthMm,
    exitWidthMm
  );

  const largestCompartmentAreaM2 = firstNonNull(
    toNumberOrNull(facts.largestCompartmentAreaM2),
    toNumberOrNull(facts.compartmentSizeM2)
  );

  const fireResistanceMinutes = firstNonNull(
    toNumberOrNull(facts.fireResistanceMinutes),
    toNumberOrNull(facts.compartmentFireResistanceMinutes),
    toNumberOrNull(facts.structuralFireResistanceMinutes),
    toNumberOrNull(facts.requiredStructuralFrameFireResistanceMinutes),
    toNumberOrNull(facts.providedStructuralFrameFireResistanceMinutes)
  );

  const escapeRouteCount = firstNonNull(
    toNumberOrNull(facts.escapeRouteCount),
    toNumberOrNull(facts.finalExitCount),
    toNumberOrNull(facts.exitCount),
    numberOfStaircases
  );

  const smokeVentilationProvided = firstNonNull(
    toBooleanOrNull(facts.smokeVentilationProvided),
    toBooleanOrNull(facts.aovProvided)
  );

  const smokeVentilationType = firstNonNull(
    toStringOrNull(facts.smokeVentilationType),
    toStringOrNull(facts.smokeControlSystem),
    smokeVentilationProvided === true ? "aov" : null
  );

  const alarmCategory = firstNonNull(
    toStringOrNull(facts.alarmCategory),
    toStringOrNull(facts.fireAlarmSystem)
  );

  const sprinklerStandard = firstNonNull(
    toStringOrNull(facts.sprinklerStandard),
    sprinklerSystemPresent === true ? "present" : null
  );

  const hydrantDistanceM = firstNonNull(
    toNumberOrNull(facts.hydrantDistanceM),
    toNumberOrNull(facts.distanceToNearestPublicHydrantM)
  );

  const fireServiceAccessDistanceM = firstNonNull(
    toNumberOrNull(facts.fireServiceAccessDistanceM),
    toNumberOrNull(facts.fireEngineAccessDistanceM)
  );

  const evacuationStrategy = firstNonNull(
    toStringOrNull(facts.evacuationStrategy),
    toStringOrNull(facts.evacuationstrategy)
  );

  const stayPutStrategy = firstNonNull(
    toBooleanOrNull(facts.stayPutStrategy),
    evacuationStrategy && evacuationStrategy.toLowerCase().includes("stay put") ? true : null
  );

  const simultaneousEvacuation = firstNonNull(
    toBooleanOrNull(facts.simultaneousEvacuation),
    evacuationStrategy && evacuationStrategy.toLowerCase().includes("simultaneous") ? true : null
  );

  const staffPresencePattern = deriveStaffPresencePattern(facts, spaceType);
  const adjacencyToEscapeRoutes = deriveAdjacencyToEscapeRoutes(
    facts,
    spaceType,
    commonCorridorPresent,
    commonLobbyPresent
  );

  const automaticDetectionPresent = firstNonNull(
    toBooleanOrNull(facts.automaticDetectionPresent),
    toBooleanOrNull(facts.automaticDetectionProvided),
    toBooleanOrNull(facts.automaticDetectionAlarmRequired),
    inferAutomaticDetectionFromAlarm(
      alarmCategory,
      firstNonNull(
        toStringOrNull(facts.fireAlarmSystem),
        toStringOrNull(facts.alarmSystemType)
      )
    )
  );

  const twoDirectionsAvailableFlag = firstNonNull(
    toBooleanOrNull(facts.twoDirectionsAvailableFlag),
    toBooleanOrNull(facts.twoDirectionsAvailable),
    toBooleanOrNull(facts.alternativeEscapeRouteProvided)
  );

  const dwellingType = deriveDwellingType(
    facts,
    buildingUse,
    hasFlats,
    isDwellingFlag
  );

  const hazardLevel = firstNonNull(
    toStringOrNull(facts.hazardLevel),
    buildingUse &&
      includesAny(buildingUse, ["flat", "dwelling", "residential", "care", "hotel", "hostel"])
      ? "normal"
      : null
  );

  return {
    ...facts,

    buildingHeightM,
    buildingHeightMeters: buildingHeightM,

    heightTopStorey_m: topStoreyHeightM,
    heightTopStoreyM: topStoreyHeightM,
    topStoreyHeightM,
    topStoreyHeightMeters: topStoreyHeightM,

    storeys,
    storeyCount: storeys,
    storeysCount: storeys,
    storeysAboveGroundStorey:
      storeys !== null && storeys >= 1
        ? Math.max(storeys - 1, 0)
        : toNumberOrNull(facts.storeysAboveGroundStorey),

    purposeGroup,
    buildingPurposeGroup: purposeGroup,
    buildingUse,
    spaceType,
    dwellingType,
    hazardLevel,

    numberOfStaircases,
    commonStairCount: numberOfStaircases,
    stairCount: numberOfStaircases,

    sprinklerSystemPresent,
    sprinklersProvided: sprinklerSystemPresent,
    sprinklersPresent: sprinklerSystemPresent,
    sprinklerSystemFlag: sprinklerSystemPresent,
    sprinklerStandard,

    fireMainsPresent,
    fireMainsProvided: fireMainsPresent,
    dryRiserPresent: fireMainsPresent,

    exitWidthMm,
    exitWidthMM: exitWidthMm,
    finalExitWidthMm,
    storeyExitWidthMm,
    doorWidthMm,
    corridorWidthMm,
    stairWidthMm,
    minApproachRouteWidthMm: firstNonNull(
      toNumberOrNull(facts.minApproachRouteWidthMm),
      corridorWidthMm
    ),

    singleDirectionDistM,
    singleDirectionTravelDistanceM: singleDirectionDistM,
    singleDirectionDistanceM: singleDirectionDistM,
    travelDistanceSingleDirectionM: singleDirectionDistM,

    travelDistanceNearestExitM,
    travelDistanceTwoDirectionM: travelDistanceNearestExitM,

    commonCorridorPresent,
    commonLobbyPresent,
    commonEscapeTravelDistanceM: firstNonNull(
      toNumberOrNull(facts.commonEscapeTravelDistanceM),
      toNumberOrNull(facts.commonEscapeRouteTravelDistanceM)
    ),
    commonEscapeRouteTravelDistanceM: firstNonNull(
      toNumberOrNull(facts.commonEscapeRouteTravelDistanceM),
      toNumberOrNull(facts.commonEscapeTravelDistanceM)
    ),

    hasFlats,
    flatUnitFlag: firstNonNull(toBooleanOrNull(facts.flatUnitFlag), hasFlats),
    isDwellingFlag,
    sleepingAccommodation,

    fireServiceVehicleAccessProvided: firstNonNull(
      toBooleanOrNull(facts.fireServiceVehicleAccessProvided),
      toBooleanOrNull(facts.fireServiceAccessProvided)
    ),
    fireServiceAccessProvided: firstNonNull(
      toBooleanOrNull(facts.fireServiceAccessProvided),
      toBooleanOrNull(facts.fireServiceVehicleAccessProvided)
    ),
    fireServiceAccessDistanceM,

    largestCompartmentAreaM2,
    compartmentSizeM2: largestCompartmentAreaM2,
    fireResistanceMinutes,
    escapeRouteCount,
    smokeVentilationProvided,
    aovProvided: firstNonNull(toBooleanOrNull(facts.aovProvided), smokeVentilationProvided),
    smokeVentilationType,
    alarmCategory,
    hydrantDistanceM,

    staffPresencePattern,
    adjacencyToEscapeRoutes,
    automaticDetectionPresent,
    twoDirectionsAvailableFlag,

    protectedStairProvided: firstNonNull(
      toBooleanOrNull(facts.protectedStairProvided),
      toBooleanOrNull(facts.protectedStairFlag)
    ),
    protectedStairFlag: firstNonNull(
      toBooleanOrNull(facts.protectedStairFlag),
      toBooleanOrNull(facts.protectedStairProvided)
    ),
    lobbyProtectionProvided: firstNonNull(
      toBooleanOrNull(facts.lobbyProtectionProvided),
      commonLobbyPresent
    ),

    evacuationStrategy,
    stayPutStrategy,
    simultaneousEvacuation,

    relevantBuildingFlag,
    reg7AppliesFlag,
  };
}

function enrichEngineFacts(
  engineFactsInput: unknown,
  normalizedFacts: EnrichedFacts
): EnrichedFacts {
  const source =
    engineFactsInput && typeof engineFactsInput === "object"
      ? (engineFactsInput as Record<string, any>)
      : {};
  const engineFacts: Record<string, any> = { ...source };
  const normalized = enrichNormalizedFacts(normalizedFacts);

  return {
    ...engineFacts,
    ...normalized,
  };
}

export function extractFactsFromChunks(
  chunks: ChunkRow[],
  sourceDocument?: string
): ChunkFactExtractionResult {
  const { rawFacts, factRows } = mergeRawFactsFromChunks(chunks, sourceDocument);

  addGlobalFallbackFacts(rawFacts, factRows, chunks, sourceDocument);

  const normalizedFactsBase = buildNormalizedFactSet(rawFacts) as any;
  const normalizedFacts = enrichNormalizedFacts(normalizedFactsBase);

  const engineFactsBase = toEngineFacts(normalizedFactsBase as any) as any;
  const engineFacts = enrichEngineFacts(engineFactsBase, normalizedFacts);

  return {
    rawFacts,
    normalizedFacts,
    engineFacts,
    factRows,
  };
}
