export type RawExtractedFact = {
  key: string;
  value: string | number | boolean;
  confidence: number;
  sourceDocument?: string;
  sourceSnippet?: string;
};

export type ExtractionInput = {
  text: string;
  sourceDocument?: string;
};

function cleanText(text: string): string {
  return String(text ?? "")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function addFact(results: RawExtractedFact[], fact: RawExtractedFact): void {
  const existing = results.find((r) => r.key === fact.key);

  if (!existing) {
    results.push({
      ...fact,
      confidence: clampConfidence(fact.confidence),
    });
    return;
  }

  if ((fact.confidence ?? 0) > (existing.confidence ?? 0)) {
    existing.value = fact.value;
    existing.confidence = clampConfidence(fact.confidence);
    existing.sourceDocument = fact.sourceDocument;
    existing.sourceSnippet = fact.sourceSnippet;
  }
}

function findSnippet(text: string, pattern: RegExp, radius = 180): string | undefined {
  const clone = new RegExp(pattern.source, pattern.flags);
  const match = clone.exec(text);
  if (!match || match.index == null) return undefined;

  const start = Math.max(0, match.index - radius);
  const end = Math.min(text.length, match.index + match[0].length + radius);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

function parseNumber(value: string): number | undefined {
  if (!value) return undefined;
  const n = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : undefined;
}

function parseIntegerWords(raw: string): number | undefined {
  const s = raw.trim().toLowerCase();

  if (/\bsingle\b|\bone\b/.test(s)) return 1;
  if (/\btwo\b/.test(s)) return 2;
  if (/\bthree\b/.test(s)) return 3;
  if (/\bfour\b/.test(s)) return 4;
  if (/\bfive\b/.test(s)) return 5;
  if (/\bsix\b/.test(s)) return 6;

  return parseNumber(raw);
}

function includesAny(text: string, needles: string[]): boolean {
  const lower = text.toLowerCase();
  return needles.some((needle) => lower.includes(needle.toLowerCase()));
}

function addBooleanFactFromTerms(
  results: RawExtractedFact[],
  text: string,
  key: string,
  positiveTerms: string[],
  negativeTerms: string[],
  sourceDocument: string | undefined,
  positiveConfidence = 0.9,
  negativeConfidence = 0.9
): void {
  for (const term of negativeTerms) {
    const pattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    if (pattern.test(text)) {
      addFact(results, {
        key,
        value: false,
        confidence: negativeConfidence,
        sourceDocument,
        sourceSnippet: findSnippet(text, pattern),
      });
      return;
    }
  }

  for (const term of positiveTerms) {
    const pattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    if (pattern.test(text)) {
      addFact(results, {
        key,
        value: true,
        confidence: positiveConfidence,
        sourceDocument,
        sourceSnippet: findSnippet(text, pattern),
      });
      return;
    }
  }
}

function extractPatternFact(
  results: RawExtractedFact[],
  text: string,
  key: string,
  patterns: RegExp[],
  confidence: number,
  sourceDocument?: string,
  post?: (raw: string) => string | number | boolean | undefined
): void {
  for (const pattern of patterns) {
    const clone = new RegExp(pattern.source, pattern.flags);
    const match = clone.exec(text);
    if (!match) continue;

    const raw = match[1] ?? match[0];
    const value = post ? post(raw) : raw;
    if (value === undefined) continue;

    addFact(results, {
      key,
      value,
      confidence,
      sourceDocument,
      sourceSnippet: findSnippet(text, pattern),
    });
    return;
  }
}

function addTextFact(
  results: RawExtractedFact[],
  text: string,
  key: string,
  pattern: RegExp,
  value: string,
  confidence: number,
  sourceDocument?: string
) {
  if (pattern.test(text)) {
    addFact(results, {
      key,
      value,
      confidence,
      sourceDocument,
      sourceSnippet: findSnippet(text, pattern),
    });
  }
}

function addBoolFact(
  results: RawExtractedFact[],
  text: string,
  key: string,
  pattern: RegExp,
  value: boolean,
  confidence: number,
  sourceDocument?: string
) {
  if (pattern.test(text)) {
    addFact(results, {
      key,
      value,
      confidence,
      sourceDocument,
      sourceSnippet: findSnippet(text, pattern),
    });
  }
}

/* ---------------- GENERAL BUILDING / USE ---------------- */

function extractBuildingMetrics(text: string, sourceDocument?: string): RawExtractedFact[] {
  const results: RawExtractedFact[] = [];

  extractPatternFact(
    results,
    text,
    "buildingHeightM",
    [
      /\bbuilding height\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)\s*m\b/i,
      /\boverall height\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)\s*m\b/i,
      /\bheight of building\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)\s*m\b/i,
      /\bbuilding rises to\s*([0-9]+(?:\.[0-9]+)?)\s*m\b/i,
    ],
    0.96,
    sourceDocument,
    parseNumber
  );

  extractPatternFact(
    results,
    text,
    "topStoreyHeightM",
    [
      /\btop storey (?:height|level)?\s*(?:is|of|at|:)?\s*([0-9]+(?:\.[0-9]+)?)\s*m\b/i,
      /\bheight to top storey\s*(?:is|of|at|:)?\s*([0-9]+(?:\.[0-9]+)?)\s*m\b/i,
      /\btop occupied floor\s*(?:is|of|at|:)?\s*([0-9]+(?:\.[0-9]+)?)\s*m\b/i,
      /\btopmost storey\s*(?:is|of|at|:)?\s*([0-9]+(?:\.[0-9]+)?)\s*m\b/i,
    ],
    0.95,
    sourceDocument,
    parseNumber
  );

  extractPatternFact(
    results,
    text,
    "storeys",
    [
      /\bnumber of storeys\s*[:\-]?\s*([0-9]+)\b/i,
      /\b([0-9]+)\s+storeys\b/i,
      /\b([0-9]+)\s+storey\b/i,
      /\bbuilding comprises\s*([0-9]+)\s+storeys\b/i,
    ],
    0.93,
    sourceDocument,
    parseNumber
  );

  return results;
}

function extractPurposeAndUse(text: string, sourceDocument?: string): RawExtractedFact[] {
  const results: RawExtractedFact[] = [];

  extractPatternFact(
    results,
    text,
    "purposeGroup",
    [
      /\bpurpose group\s*[:\-]?\s*(1\(a\)|1\(b\)|1\(c\)|2\(a\)|2\(b\)|3|4|5|6|7)\b/i,
      /\bpurpose groups?\s*(1\(a\)|1\(b\)|1\(c\)|2\(a\)|2\(b\)|3|4|5|6|7)\b/i,
      /\bgroup\s*(1\(a\)|1\(b\)|1\(c\)|2\(a\)|2\(b\)|3|4|5|6|7)\b/i,
    ],
    0.95,
    sourceDocument,
    (raw) => {
      const m = String(raw).match(/(1\(a\)|1\(b\)|1\(c\)|2\(a\)|2\(b\)|3|4|5|6|7)/i);
      return m ? m[1] : undefined;
    }
  );

  const useCandidates: Array<{ pattern: RegExp; value: string; confidence: number }> = [
    { pattern: /\bblock of flats\b/i, value: "flats", confidence: 0.98 },
    { pattern: /\bflats\b/i, value: "flats", confidence: 0.95 },
    { pattern: /\bapartment(s)?\b/i, value: "flats", confidence: 0.92 },
    { pattern: /\bmaisonette(s)?\b/i, value: "flats", confidence: 0.92 },
    { pattern: /\bdwellinghouse\b/i, value: "dwellinghouse", confidence: 0.98 },
    { pattern: /\bdwelling house\b/i, value: "dwellinghouse", confidence: 0.95 },
    { pattern: /\bsingle[- ]family house\b/i, value: "dwellinghouse", confidence: 0.92 },
    { pattern: /\bcare home\b/i, value: "care_home", confidence: 0.95 },
    { pattern: /\bstudent accommodation\b/i, value: "student_accommodation", confidence: 0.95 },
    { pattern: /\bhotel\b/i, value: "hotel", confidence: 0.95 },
    { pattern: /\bhostel\b/i, value: "hostel", confidence: 0.95 },
    { pattern: /\boffice\b/i, value: "office", confidence: 0.90 },
    { pattern: /\bmixed[- ]use\b/i, value: "mixed_use", confidence: 0.95 },
    { pattern: /\bretail\b/i, value: "retail", confidence: 0.88 },
    { pattern: /\bindustrial\b/i, value: "industrial", confidence: 0.88 },
    { pattern: /\bcommercial building\b/i, value: "commercial", confidence: 0.90 },
  ];

  for (const candidate of useCandidates) {
    if (candidate.pattern.test(text)) {
      addFact(results, {
        key: "buildingUse",
        value: candidate.value,
        confidence: candidate.confidence,
        sourceDocument,
        sourceSnippet: findSnippet(text, candidate.pattern),
      });
      break;
    }
  }

  return results;
}

/* ---------------- ESCAPE / STAIRS / ALARM ---------------- */

function extractStairsAndEscape(text: string, sourceDocument?: string): RawExtractedFact[] {
  const results: RawExtractedFact[] = [];

  extractPatternFact(
    results,
    text,
    "numberOfStaircases",
    [
      /\bnumber of staircases\s*[:\-]?\s*([0-9]+)\b/i,
      /\b([0-9]+)\s+(?:protected\s+)?staircases?\b/i,
      /\b([0-9]+)\s+stair\s+cores?\b/i,
      /\b(single stair)\b/i,
      /\b(single stair core)\b/i,
      /\b(one stair core)\b/i,
      /\b(two stairs?)\b/i,
      /\b(two stair cores?)\b/i,
    ],
    0.94,
    sourceDocument,
    parseIntegerWords
  );

  extractPatternFact(
    results,
    text,
    "escapeRouteCount",
    [
      /\b([0-9]+)\s+escape routes?\b/i,
      /\bnumber of escape routes?\s*[:\-]?\s*([0-9]+)\b/i,
      /\b([0-9]+)\s+final exits?\b/i,
      /\bnumber of exits?\s*[:\-]?\s*([0-9]+)\b/i,
    ],
    0.88,
    sourceDocument,
    parseNumber
  );

  addBooleanFactFromTerms(
    results,
    text,
    "twoDirectionsAvailableFlag",
    [
      "two directions of escape",
      "more than one direction of escape",
      "alternative directions of escape",
      "alternative escape route provided",
      "secondary escape route provided",
      "two means of escape",
    ],
    [
      "single direction of escape",
      "only one direction of escape",
      "escape initially in one direction only",
    ],
    sourceDocument,
    0.90,
    0.90
  );

  extractPatternFact(
    results,
    text,
    "singleDirectionDistM",
    [
      /\bsingle direction(?: travel)? distance\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)\s*m\b/i,
      /\bone direction(?: travel)? distance\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)\s*m\b/i,
      /\btravel distance in one direction\s*(?:is|of|:)?\s*([0-9]+(?:\.[0-9]+)?)\s*m\b/i,
      /\bmaximum travel distance.*?one direction.*?([0-9]+(?:\.[0-9]+)?)\s*m\b/i,
    ],
    0.91,
    sourceDocument,
    parseNumber
  );

  extractPatternFact(
    results,
    text,
    "travelDistanceNearestExitM",
    [
      /\btravel distance to nearest exit\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)\s*m\b/i,
      /\btravel distance in two directions\s*(?:is|of|:)?\s*([0-9]+(?:\.[0-9]+)?)\s*m\b/i,
      /\btravel distance(?: where escape is possible)? in more than one direction\s*(?:is|of|:)?\s*([0-9]+(?:\.[0-9]+)?)\s*m\b/i,
    ],
    0.88,
    sourceDocument,
    parseNumber
  );

  extractPatternFact(
    results,
    text,
    "exitWidthMm",
    [
      /\bexit width\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)\s*mm\b/i,
      /\bclear width of exit\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)\s*mm\b/i,
    ],
    0.88,
    sourceDocument,
    parseNumber
  );

  extractPatternFact(
    results,
    text,
    "finalExitWidthMm",
    [/\bfinal exit width\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)\s*mm\b/i],
    0.88,
    sourceDocument,
    parseNumber
  );

  extractPatternFact(
    results,
    text,
    "storeyExitWidthMm",
    [/\bstorey exit width\s*[:=]?\s*([0-9]+(?:\.[0-9]+)?)\s*mm\b/i],
    0.85,
    sourceDocument,
    parseNumber
  );

  addBooleanFactFromTerms(
    results,
    text,
    "automaticDetectionPresent",
    [
      "automatic fire detection",
      "automatic detection",
      "smoke detection",
      "heat detection",
      "detectors provided",
    ],
    [
      "no automatic fire detection",
      "automatic fire detection not provided",
      "detection not provided",
    ],
    sourceDocument,
    0.88,
    0.90
  );

  extractPatternFact(
    results,
    text,
    "alarmCategory",
    [
      /\balarm category\s*[:\-]?\s*(L1|L2|L3|L4|L5|M|P1|P2|LD1|LD2|LD3)\b/i,
      /\b(Grade\s+[A-F]\s+LD[123])\b/i,
      /\b(Category\s+L[1-5])\b/i,
    ],
    0.90,
    sourceDocument,
    (raw) => String(raw).trim()
  );

  if (/\bstay put\b/i.test(text)) {
    addFact(results, {
      key: "evacuationStrategy",
      value: "stay put",
      confidence: 0.90,
      sourceDocument,
      sourceSnippet: findSnippet(text, /\bstay put\b/i),
    });
  } else if (/\bsimultaneous evacuation\b/i.test(text)) {
    addFact(results, {
      key: "evacuationStrategy",
      value: "simultaneous evacuation",
      confidence: 0.90,
      sourceDocument,
      sourceSnippet: findSnippet(text, /\bsimultaneous evacuation\b/i),
    });
  } else if (/\bphased evacuation\b/i.test(text)) {
    addFact(results, {
      key: "evacuationStrategy",
      value: "phased evacuation",
      confidence: 0.88,
      sourceDocument,
      sourceSnippet: findSnippet(text, /\bphased evacuation\b/i),
    });
  }

  return results;
}

/* ---------------- HYDRANT / EXTERNAL ---------------- */

function extractHydrantAndExternal(text: string, sourceDocument?: string): RawExtractedFact[] {
  const results: RawExtractedFact[] = [];

  extractPatternFact(
    results,
    text,
    "distanceToNearestPublicHydrantM",
    [
      /\bdistance to nearest public hydrant\s*(?:is|of|:)?\s*([0-9]+(?:\.[0-9]+)?)\s*m\b/i,
      /\bnearest public hydrant\s*(?:is )?([0-9]+(?:\.[0-9]+)?)\s*m\b/i,
    ],
    0.88,
    sourceDocument,
    parseNumber
  );

  addBooleanFactFromTerms(
    results,
    text,
    "privateHydrantsProvided",
    ["private hydrant", "private hydrants"],
    ["no private hydrant", "no private hydrants"],
    sourceDocument,
    0.86,
    0.86
  );

  const claddingKeywords = [
    "aluminium composite material",
    "brick cladding",
    "brick slip",
    "render system",
    "mineral wool",
    "timber",
    "acm",
    "hpl",
    "high-pressure laminate",
    "high pressure laminate",
  ];

  for (const keyword of claddingKeywords) {
    const pattern = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (pattern.test(text)) {
      let value = keyword;
      if (/^acm$/i.test(keyword) || /aluminium composite material/i.test(keyword)) value = "ACM";
      if (/^hpl$/i.test(keyword) || /high[- ]pressure laminate/i.test(keyword)) value = "HPL";
      if (/brick cladding/i.test(keyword)) value = "brick cladding";

      addFact(results, {
        key: "claddingMaterial",
        value,
        confidence: 0.88,
        sourceDocument,
        sourceSnippet: findSnippet(text, pattern),
      });
      break;
    }
  }

  extractPatternFact(
    results,
    text,
    "externalWallMaterialClass",
    [
      /\bclass\s*(A1|A2-s1,\s*d0|B-s\d,\s*d\d|C-s\d,\s*d\d)\b/i,
      /\b(Class 0)\b/i,
      /\b(Euro class\s+[A-Z0-9,\- ]+)\b/i,
    ],
    0.84,
    sourceDocument,
    (raw) => String(raw).replace(/\s+/g, " ").trim()
  );

  addBooleanFactFromTerms(
    results,
    text,
    "cavityBarriersPresent",
    ["cavity barriers are installed", "cavity barriers installed", "cavity barriers provided"],
    ["no cavity barriers", "cavity barriers missing", "missing cavity barriers"],
    sourceDocument,
    0.88,
    0.90
  );

  return results;
}

/* ---------------- NEGATIVE FINDINGS / DEFICIENCIES ---------------- */

function extractNegativeFindings(text: string, sourceDocument?: string): RawExtractedFact[] {
  const results: RawExtractedFact[] = [];
  const t = cleanText(text);

  // Internal linings / spread
  extractPatternFact(
    results,
    t,
    "wallLiningClass",
    [
      /\bbasement walls?:\s*class\s*([0-9]+)\b/i,
      /\bclass\s*([0-9]+)\s*polystyrene\b/i,
      /\bwall linings?.*?euro class\s*([A-Z]-s[0-9],\s*d[0-9])\b/i,
    ],
    0.93,
    sourceDocument,
    (raw) => {
      const s = String(raw).trim();
      return /^\d+$/.test(s) ? `Class ${s}` : s.replace(/\s+/g, " ");
    }
  );

  addBoolFact(
    results,
    t,
    "wallLiningNonCompliantFlag",
    /\b(non-compliant|significant fire spread risk)\b/i,
    true,
    0.96,
    sourceDocument
  );

  // Structural fire resistance
  extractPatternFact(
    results,
    t,
    "fireResistanceMinutes",
    [
      /\bmezzanine floor.*?([0-9]+)-minute fire resistance\b/i,
      /\bmezzanine floor.*?([0-9]+)\s*minute fire resistance\b/i,
    ],
    0.94,
    sourceDocument,
    parseNumber
  );

  extractPatternFact(
    results,
    t,
    "requiredFireResistanceMinutes",
    [
      /\brequired\s*([0-9]+)\s*minutes?\b/i,
      /\brequires\s*([0-9]+)\s*minutes?\b/i,
    ],
    0.92,
    sourceDocument,
    parseNumber
  );

  addBoolFact(
    results,
    t,
    "structuralFireResistanceDeficientFlag",
    /\b(deficient|below the required)\b/i,
    true,
    0.95,
    sourceDocument
  );

  // Fire stopping / compartmentation
  addBoolFact(
    results,
    t,
    "servicesPresent",
    /\b(service ducts|service penetrations|cable tray penetrations|pipes|ducts|cables)\b/i,
    true,
    0.88,
    sourceDocument
  );

  addBoolFact(
    results,
    t,
    "firestoppingPresent",
    /\b(missing fire stopping|unsealed .* penetrations|gaps around service ducts)\b/i,
    false,
    0.97,
    sourceDocument
  );

  addBoolFact(
    results,
    t,
    "voidContinuous",
    /\b(suspended ceiling void|ceiling void)\b/i,
    true,
    0.85,
    sourceDocument
  );

  addBoolFact(
    results,
    t,
    "cavityBarriersPresent",
    /\bmissing fire stopping in (the )?suspended ceiling void\b/i,
    false,
    0.94,
    sourceDocument
  );

  addBoolFact(
    results,
    t,
    "compartmentationDeficiencyFlag",
    /\b(inadequate compartmentation|critical deficiencies|unsealed .* compartment wall)\b/i,
    true,
    0.96,
    sourceDocument
  );

  addBoolFact(
    results,
    t,
    "fireDoorDamagedFlag",
    /\bdamaged intumescent strip\b/i,
    true,
    0.96,
    sourceDocument
  );

  // External wall / cladding
  addBoolFact(
    results,
    t,
    "acmPresentFlag",
    /\b(aluminum|aluminium) composite material\s*\(?(ACM)?\)?\b/i,
    true,
    0.96,
    sourceDocument
  );

  addBoolFact(
    results,
    t,
    "acmRequiresAssessmentFlag",
    /\bACM.*?(requires assessment|post-?Grenfell)\b/i,
    true,
    0.95,
    sourceDocument
  );

  addBoolFact(
    results,
    t,
    "hplPresentFlag",
    /\b(high-pressure laminate|high pressure laminate|HPL)\b/i,
    true,
    0.95,
    sourceDocument
  );

  addBoolFact(
    results,
    t,
    "externalWallMayNotMeetRequirementsFlag",
    /\bmay not meet current fire performance requirements\b/i,
    true,
    0.94,
    sourceDocument
  );

  // Fire mains / signage / clearance
  addBooleanFactFromTerms(
    results,
    t,
    "fireMainsPresent",
    ["dry rising main is installed", "dry rising main installed", "dry riser is installed", "dry rising main"],
    ["no dry rising main", "no dry riser", "fire main not provided"],
    sourceDocument,
    0.93,
    0.93
  );

  addBoolFact(
    results,
    t,
    "landingValveClearanceCompliant",
    /\b(inadequate clearance for hose connection|valve .* inadequate clearance)\b/i,
    false,
    0.97,
    sourceDocument
  );

  addBoolFact(
    results,
    t,
    "clearance_issue_reported",
    /\b(inadequate clearance for hose connection|valve .* inadequate clearance)\b/i,
    true,
    0.97,
    sourceDocument
  );

  addBoolFact(
    results,
    t,
    "dryRiserInletSignageVisible",
    /\b(signage .* needs to be improved|requires improvement for visibility|poor visibility from the access road)\b/i,
    false,
    0.95,
    sourceDocument
  );

  addBoolFact(
    results,
    t,
    "visibilityFromRoad",
    /\b(signage .* needs to be improved|requires improvement for visibility|poor visibility from the access road)\b/i,
    false,
    0.95,
    sourceDocument
  );

  // Vehicle / facilities
  addBoolFact(
    results,
    t,
    "fireServiceVehicleAccessProvided",
    /\b(vehicle access .* provided|hard standing suitable for .* appliance|within 45m of all building entrances)\b/i,
    true,
    0.90,
    sourceDocument
  );

  extractPatternFact(
    results,
    t,
    "buildingHeightM",
    [/\bbuilding height\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)\s*m\b/i],
    0.95,
    sourceDocument,
    parseNumber
  );

  return results;
}

/* ---------------- DERIVED FACTS ---------------- */

function extractDerivedFacts(text: string, sourceDocument?: string): RawExtractedFact[] {
  const results: RawExtractedFact[] = [];
  const snippet = text.slice(0, Math.min(text.length, 220)).replace(/\s+/g, " ").trim();

  if (
    includesAny(text, [
      "sleeping accommodation",
      "hotel",
      "hostel",
      "care home",
      "residential",
      "flats",
      "student accommodation",
    ])
  ) {
    addFact(results, {
      key: "sleepingAccommodation",
      value: true,
      confidence: 0.82,
      sourceDocument,
      sourceSnippet: snippet,
    });
  }

  if (includesAny(text, ["flats", "block of flats", "apartments", "maisonettes", "residential floors"])) {
    addFact(results, {
      key: "hasFlats",
      value: true,
      confidence: 0.84,
      sourceDocument,
      sourceSnippet: snippet,
    });
    addFact(results, {
      key: "dwellingType",
      value: "flat",
      confidence: 0.84,
      sourceDocument,
      sourceSnippet: snippet,
    });
  }

  if (includesAny(text, ["dwellinghouse", "house"])) {
    addFact(results, {
      key: "isDwellingFlag",
      value: true,
      confidence: 0.84,
      sourceDocument,
      sourceSnippet: snippet,
    });
  }

  if (includesAny(text, ["corridor", "lobby", "stair", "escape route"])) {
    addFact(results, {
      key: "adjacencyToEscapeRoutes",
      value: true,
      confidence: 0.80,
      sourceDocument,
      sourceSnippet: snippet,
    });
  }

  if (includesAny(text, ["plant room", "storage area", "storage room", "void", "refuse"])) {
    addFact(results, {
      key: "staffPresencePattern",
      value: "unsupervised",
      confidence: 0.84,
      sourceDocument,
      sourceSnippet: snippet,
    });
  }

  return results;
}

/* ---------------- PUBLIC API ---------------- */

export function extractFactsFromText(input: ExtractionInput): RawExtractedFact[] {
  const text = cleanText(input.text);
  const sourceDocument = input.sourceDocument;

  if (!text) return [];

  const results: RawExtractedFact[] = [];

  const groups = [
    extractBuildingMetrics(text, sourceDocument),
    extractPurposeAndUse(text, sourceDocument),
    extractStairsAndEscape(text, sourceDocument),
    extractHydrantAndExternal(text, sourceDocument),
    extractNegativeFindings(text, sourceDocument),
    extractDerivedFacts(text, sourceDocument),
  ];

  for (const group of groups) {
    for (const fact of group) {
      addFact(results, fact);
    }
  }

  return results.sort(
    (a, b) => b.confidence - a.confidence || a.key.localeCompare(b.key)
  );
}