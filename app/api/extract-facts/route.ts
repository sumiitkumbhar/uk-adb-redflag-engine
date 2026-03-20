import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { extractFactsFromChunks } from "@/lib/extraction/extractFactsFromChunks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mustUuid(id: string | null) {
  if (!id) throw new Error("document_id required");
  if (!UUID_RE.test(id)) throw new Error("document_id must be UUID");
  return id;
}

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

function stripCodeFences(s: string) {
  return s.replace(/```json/gi, "").replace(/```/g, "").trim();
}

function extractJson(s: string) {
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1) return "{}";
  return s.slice(start, end + 1);
}

function repairJson(s: string) {
  return s
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

function safeParse(raw: string) {
  const cleaned = stripCodeFences(raw);
  const candidate = extractJson(cleaned);

  try {
    return JSON.parse(candidate);
  } catch {
    return JSON.parse(repairJson(candidate));
  }
}

function toNullableNumber(value: any): number | null {
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

function toNullableBoolean(value: any): boolean | null {
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
    ].includes(s)
  ) {
    return false;
  }

  return null;
}

function toNullableString(value: any): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s || null;
}

function toStringArray(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  }
  const s = String(value).trim();
  return s ? [s] : [];
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

function normalizeFacts(raw: any) {
  const notes = toStringArray(raw?.notes);

  const buildingHeightM = firstNonNull(
    toNullableNumber(raw?.buildingHeightM),
    toNullableNumber(raw?.buildingHeightMeters),
    toNullableNumber(raw?.buildingheightm)
  );

  const topStoreyHeightM = firstNonNull(
    toNullableNumber(raw?.topStoreyHeightM),
    toNullableNumber(raw?.heightTopStorey_m),
    toNullableNumber(raw?.heightTopStoreyM),
    toNullableNumber(raw?.topStoreyHeightMeters),
    toNullableNumber(raw?.topstoreyheightm)
  );

  const storeys = firstNonNull(
    toNullableNumber(raw?.storeys),
    toNullableNumber(raw?.storeyCount),
    toNullableNumber(raw?.storeysCount),
    toNullableNumber(raw?.numberOfStoreys)
  );

  const numberOfStaircases = firstNonNull(
    toNullableNumber(raw?.numberOfStaircases),
    toNullableNumber(raw?.commonStairCount),
    toNullableNumber(raw?.stairCount),
    toNullableNumber(raw?.numberofstaircases)
  );

  const sprinklerSystemPresent = firstNonNull(
    toNullableBoolean(raw?.sprinklerSystemPresent),
    toNullableBoolean(raw?.sprinklersProvided),
    toNullableBoolean(raw?.sprinklersPresent),
    toNullableBoolean(raw?.sprinklerSystemFlag)
  );

  const fireMainsPresent = firstNonNull(
    toNullableBoolean(raw?.fireMainsPresent),
    toNullableBoolean(raw?.fireMainsProvided),
    toNullableBoolean(raw?.dryRiserPresent),
    toNullableBoolean(raw?.risingMainPresent)
  );

  const exitWidthMm = firstNonNull(
    toNullableNumber(raw?.exitWidthMm),
    toNullableNumber(raw?.exitWidthMM),
    toNullableNumber(raw?.finalExitWidthMm),
    toNullableNumber(raw?.storeyExitWidthMm),
    toNullableNumber(raw?.storeyExitWidthsMm)
  );

  const buildingUse = firstNonNull(
    toNullableString(raw?.buildingUse),
    toNullableString(raw?.purposeGroup)
  );

  const hasFlats = firstNonNull(
    toNullableBoolean(raw?.hasFlats),
    buildingUse && includesAny(buildingUse, ["flat", "flats", "apartment", "apartments", "maisonette"])
      ? true
      : null
  );

  const isDwellingFlag = firstNonNull(
    toNullableBoolean(raw?.isDwellingFlag),
    buildingUse && includesAny(buildingUse, ["dwelling", "house", "maisonette", "home"])
      ? true
      : null
  );

  const sleepingAccommodation = firstNonNull(
    toNullableBoolean(raw?.sleepingAccommodation),
    toNullableBoolean(raw?.sleepingAccommodationFlag),
    toNullableBoolean(raw?.sleepingRiskFlag),
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

  const relevantBuildingFlag =
    toNullableBoolean(raw?.relevantBuildingFlag) ??
    ((topStoreyHeightM !== null && topStoreyHeightM >= 18) ||
    (buildingHeightM !== null && buildingHeightM >= 18)
      ? true
      : null);

  return {
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
      storeys !== null && storeys >= 1 ? Math.max(storeys - 1, 0) : toNullableNumber(raw?.storeysAboveGroundStorey),

    purposeGroup: toNullableString(raw?.purposeGroup),
    buildingPurposeGroup: toNullableString(raw?.buildingPurposeGroup),
    buildingUse,
    sleepingAccommodation,

    sprinklerSystemPresent,
    sprinklersPresent: sprinklerSystemPresent,
    sprinklersProvided: firstNonNull(
      toNullableBoolean(raw?.sprinklersProvided),
      sprinklerSystemPresent
    ),
    sprinklerSystemFlag: sprinklerSystemPresent,

    fireAlarmSystem: firstNonNull(
      toNullableString(raw?.fireAlarmSystem),
      toNullableString(raw?.alarmSystemType),
      toNullableString(raw?.alarmCategory)
    ),
    alarmSystemType: firstNonNull(
      toNullableString(raw?.alarmSystemType),
      toNullableString(raw?.fireAlarmSystem)
    ),
    smokeControlSystem: toNullableString(raw?.smokeControlSystem),
    firefightingLiftPresent: toNullableBoolean(raw?.firefightingLiftPresent),
    firefightingShaftPresent: firstNonNull(
      toNullableBoolean(raw?.firefightingShaftPresent),
      toNullableBoolean(raw?.protectedShaftProvidedFlag)
    ),
    protectedShaftProvidedFlag: firstNonNull(
      toNullableBoolean(raw?.protectedShaftProvidedFlag),
      toNullableBoolean(raw?.firefightingShaftPresent)
    ),

    fireMainsPresent,
    fireMainsProvided: firstNonNull(
      toNullableBoolean(raw?.fireMainsProvided),
      fireMainsPresent
    ),
    dryRiserPresent: firstNonNull(
      toNullableBoolean(raw?.dryRiserPresent),
      fireMainsPresent
    ),

    externalWallSystem: toNullableString(raw?.externalWallSystem),
    claddingMaterial: toNullableString(raw?.claddingMaterial),
    cavityBarriersPresent: toNullableBoolean(raw?.cavityBarriersPresent),
    spandrelHeightMm: toNullableNumber(raw?.spandrelHeightMm),
    minimumRequiredSpandrelHeightMm: toNullableNumber(raw?.minimumRequiredSpandrelHeightMm),

    commonCorridorPresent: toNullableBoolean(raw?.commonCorridorPresent),
    commonLobbyPresent: toNullableBoolean(raw?.commonLobbyPresent),
    commonCorridorTravelDistanceM: toNullableNumber(raw?.commonCorridorTravelDistanceM),
    commonEscapeRouteTravelDistanceM: toNullableNumber(raw?.commonEscapeRouteTravelDistanceM),
    commonEscapeTravelDistanceM: firstNonNull(
      toNullableNumber(raw?.commonEscapeTravelDistanceM),
      toNullableNumber(raw?.commonEscapeRouteTravelDistanceM)
    ),
    lobbyTravelDistanceM: toNullableNumber(raw?.lobbyTravelDistanceM),
    numberOfStaircases,
    commonStairCount: numberOfStaircases,
    stairCount: numberOfStaircases,
    occupantLoad: toNullableNumber(raw?.occupantLoad),
    hasFlats,
    flatUnitFlag: firstNonNull(toNullableBoolean(raw?.flatUnitFlag), hasFlats),
    isDwellingFlag,
    spaceType: toNullableString(raw?.spaceType),

    exitWidthMm,
    exitWidthMM: exitWidthMm,
    finalExitWidthMm: firstNonNull(toNullableNumber(raw?.finalExitWidthMm), exitWidthMm),
    storeyExitWidthMm: firstNonNull(toNullableNumber(raw?.storeyExitWidthMm), exitWidthMm),

    fireServiceVehicleAccessProvided: firstNonNull(
      toNullableBoolean(raw?.fireServiceVehicleAccessProvided),
      toNullableBoolean(raw?.fireServiceAccessProvided)
    ),
    fireServiceAccessProvided: firstNonNull(
      toNullableBoolean(raw?.fireServiceAccessProvided),
      toNullableBoolean(raw?.fireServiceVehicleAccessProvided)
    ),
    fireServiceAccessRoadWidthAdequate: toNullableBoolean(raw?.fireServiceAccessRoadWidthAdequate),
    fireServiceTurningProvisionAdequate: toNullableBoolean(raw?.fireServiceTurningProvisionAdequate),
    hardstandingProvided: toNullableBoolean(raw?.hardstandingProvided),
    accessObstructionsPresent: toNullableBoolean(raw?.accessObstructionsPresent),

    landingValveClearanceCompliant: toNullableBoolean(raw?.landingValveClearanceCompliant),
    dryRiserInletSignageVisible: toNullableBoolean(raw?.dryRiserInletSignageVisible),

    privateHydrantsProvided: toNullableBoolean(raw?.privateHydrantsProvided),
    distanceToNearestPublicHydrantM: toNullableNumber(raw?.distanceToNearestPublicHydrantM),
    largestCompartmentAreaM2: toNullableNumber(raw?.largestCompartmentAreaM2),

    relevantBuildingFlag,
    reg7AppliesFlag: firstNonNull(toNullableBoolean(raw?.reg7AppliesFlag), relevantBuildingFlag),

    keyFindings: toStringArray(raw?.keyFindings),
    nonCompliances: toStringArray(raw?.nonCompliances),
    improvementActions: toStringArray(raw?.improvementActions),
    notes,
  };
}

function removeNulls(obj: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined && value !== "") {
      out[key] = value;
    }
  }
  return out;
}

function mergeFacts(baseFacts: Record<string, any>, enrichmentFacts: Record<string, any>) {
  const out: Record<string, any> = { ...baseFacts };

  for (const [key, value] of Object.entries(enrichmentFacts)) {
    const existing = out[key];

    const existingEmpty =
      existing === null ||
      existing === undefined ||
      existing === "" ||
      (Array.isArray(existing) && existing.length === 0);

    if (existingEmpty) {
      out[key] = value;
      continue;
    }

    if (Array.isArray(existing) && Array.isArray(value)) {
      out[key] = Array.from(new Set([...existing.map(String), ...value.map(String)]));
    }
  }

  return out;
}

function asNumber(value: any): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function getChunkText(row: any): string {
  return String(row?.content ?? row?.text ?? row?.chunk_text ?? row?.body ?? "");
}

function getChunkIndex(row: any): number | null {
  return (
    asNumber(row?.chunk_index) ??
    asNumber(row?.idx) ??
    asNumber(row?.chunk_idx) ??
    asNumber(row?.position) ??
    null
  );
}

function getChunkPage(row: any): number | null {
  return (
    asNumber(row?.page) ??
    asNumber(row?.page_number) ??
    asNumber(row?.page_num) ??
    asNumber(row?.pageIndex) ??
    asNumber(row?.metadata?.page) ??
    null
  );
}

function getChunkId(row: any): string {
  return String(row?.id ?? crypto.randomUUID());
}

function uniqueStrings(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function selectRelevantText(chunks: Array<{ content?: string }>) {
  const allChunks = chunks
    .map((chunk) => String(chunk?.content ?? "").trim())
    .filter(Boolean);

  const fullText = allChunks.join("\n---\n");

  const keywords = [
    "height",
    "top storey",
    "storey height",
    "storeys",
    "purpose group",
    "use class",
    "building use",
    "staircase",
    "stair",
    "common stair",
    "alarm",
    "fire alarm",
    "bs 5839",
    "sprinkler",
    "sprinklers",
    "cladding",
    "external wall",
    "fire main",
    "dry riser",
    "wet riser",
    "rising main",
    "exit width",
    "door width",
    "final exit",
    "escape width",
    "means of escape",
    "travel distance",
    "corridor",
    "lobby",
    "hydrant",
    "shaft",
    "firefighting",
    "vehicle access",
    "hardstanding",
  ];

  const targeted = allChunks.filter((chunk) => {
    const lc = chunk.toLowerCase();
    return keywords.some((keyword) => lc.includes(keyword));
  });

  const combined = uniqueStrings([...targeted, ...allChunks.slice(0, 10)])
    .join("\n---\n")
    .slice(0, 24000);

  return {
    fullText: fullText.slice(0, 24000),
    targetedText: combined || fullText.slice(0, 24000),
  };
}

function pickFirstNumber(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const n = Number(String(match[1]).replace(/,/g, ""));
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function pickFirstString(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const value = match[1].trim().replace(/\s+/g, " ");
      if (value) return value;
    }
  }
  return null;
}

function textContainsAny(text: string, terms: string[]) {
  const lc = text.toLowerCase();
  return terms.some((term) => lc.includes(term.toLowerCase()));
}

function inferFactsFromText(text: string) {
  const t = text.replace(/\r/g, "\n");

  const buildingHeightM = pickFirstNumber(t, [
    /building height\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)\s*m/iu,
    /overall height\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)\s*m/iu,
    /height of building\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)\s*m/iu,
  ]);

  const topStoreyHeightM = pickFirstNumber(t, [
    /top storey height\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)\s*m/iu,
    /height to top storey\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)\s*m/iu,
    /topmost storey\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)\s*m/iu,
  ]);

  const storeys = pickFirstNumber(t, [
    /number of storeys\s*[:\-]?\s*([0-9]+)/iu,
    /storeys\s*[:\-]?\s*([0-9]+)/iu,
    /([0-9]+)\s+storeys/iu,
  ]);

  const numberOfStaircases = pickFirstNumber(t, [
    /number of staircases\s*[:\-]?\s*([0-9]+)/iu,
    /([0-9]+)\s+(?:common\s+)?staircases/iu,
    /([0-9]+)\s+(?:common\s+)?stairs/iu,
  ]);

  const purposeGroup = pickFirstString(t, [
    /purpose group\s*[:\-]?\s*(2\(a\)|2\(b\)|1\(a\)|1\(b\)|[1-7](?:\([a-z]\))?)/iu,
    /purpose group(?:s)?\s*(2\(a\)|2\(b\)|1\(a\)|1\(b\)|[1-7](?:\([a-z]\))?)/iu,
  ]);

  const fireAlarmSystem = pickFirstString(t, [
    /fire alarm system\s*[:\-]?\s*([A-Za-z0-9 ,.\/()\-]+)/iu,
    /alarm system\s*[:\-]?\s*([A-Za-z0-9 ,.\/()\-]+)/iu,
    /bs\s*5839(?:-1|-6)?[^.\n]*?(category\s*[A-Z0-9\-]+)/iu,
  ]);

  const claddingMaterial = pickFirstString(t, [
    /cladding material\s*[:\-]?\s*([A-Za-z0-9 ,.\/()\-]+)/iu,
    /external wall(?: system)?[^.\n]*?cladding[^.\n]*?([A-Za-z0-9 ,.\/()\-]+)/iu,
    /\b(acm|aluminium composite material|brick slip|timber|hpl|high-pressure laminate|mineral wool|render system)\b/iu,
  ]);

  const exitWidthMm = pickFirstNumber(t, [
    /exit width\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)\s*mm/iu,
    /final exit width\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)\s*mm/iu,
    /door width\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)\s*mm/iu,
    /clear width\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?)\s*mm/iu,
  ]);

  let sprinklerSystemPresent: boolean | null = null;
  if (textContainsAny(t, ["sprinkler system provided", "sprinklers provided", "sprinklered"])) {
    sprinklerSystemPresent = true;
  } else if (textContainsAny(t, ["no sprinklers", "sprinklers not provided", "no sprinkler system"])) {
    sprinklerSystemPresent = false;
  }

  let fireMainsPresent: boolean | null = null;
  if (
    textContainsAny(t, [
      "dry riser provided",
      "wet riser provided",
      "fire mains provided",
      "rising main provided",
    ])
  ) {
    fireMainsPresent = true;
  } else if (
    textContainsAny(t, [
      "no dry riser",
      "no wet riser",
      "fire mains not provided",
      "rising main not provided",
    ])
  ) {
    fireMainsPresent = false;
  }

  const normalizedStairCount =
    numberOfStaircases ?? (t.toLowerCase().includes("single stair") ? 1 : null);

  return normalizeFacts({
    buildingHeightM,
    topStoreyHeightM,
    heightTopStorey_m: topStoreyHeightM,
    storeys,
    purposeGroup,
    buildingUse: purposeGroup,
    numberOfStaircases: normalizedStairCount,
    commonStairCount: normalizedStairCount,
    stairCount: normalizedStairCount,
    fireAlarmSystem,
    sprinklerSystemPresent,
    sprinklersProvided: sprinklerSystemPresent,
    claddingMaterial,
    fireMainsPresent,
    fireMainsProvided: fireMainsPresent,
    dryRiserPresent: fireMainsPresent,
    exitWidthMm,
    finalExitWidthMm: exitWidthMm,
    storeyExitWidthMm: exitWidthMm,
    notes: [],
  });
}

async function callGroq(text: string) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const model = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

  const body = {
    model,
    temperature: 0.1,
    max_tokens: 2200,
    messages: [
      {
        role: "system",
        content: `
Return ONLY valid JSON.
No markdown.
No explanations.
Unknown values must be null.
Do not invent facts.
If a document says something exists, do not mark it false.
If a document says something is compliant except for one defect, mark the broad system as present and the specific defect field as false.

Extract facts for a fire-safety compliance engine.
Prioritise these ten fields because they unlock the most rules:
buildingHeightM
topStoreyHeightM
storeys
purposeGroup
numberOfStaircases
fireAlarmSystem
sprinklerSystemPresent
claddingMaterial
fireMainsPresent
exitWidthMm

Schema:
{
  "buildingHeightM": number|null,
  "buildingHeightMeters": number|null,
  "heightTopStorey_m": number|null,
  "heightTopStoreyM": number|null,
  "topStoreyHeightM": number|null,
  "topStoreyHeightMeters": number|null,
  "storeys": number|null,
  "storeyCount": number|null,
  "storeysCount": number|null,
  "storeysAboveGroundStorey": number|null,
  "purposeGroup": string|null,
  "buildingPurposeGroup": string|null,
  "buildingUse": string|null,
  "sleepingAccommodation": boolean|null,
  "sprinklerSystemPresent": boolean|null,
  "sprinklersPresent": boolean|null,
  "sprinklersProvided": boolean|null,
  "sprinklerSystemFlag": boolean|null,
  "fireAlarmSystem": string|null,
  "alarmSystemType": string|null,
  "smokeControlSystem": string|null,
  "firefightingLiftPresent": boolean|null,
  "firefightingShaftPresent": boolean|null,
  "protectedShaftProvidedFlag": boolean|null,
  "fireMainsPresent": boolean|null,
  "fireMainsProvided": boolean|null,
  "dryRiserPresent": boolean|null,
  "externalWallSystem": string|null,
  "claddingMaterial": string|null,
  "cavityBarriersPresent": boolean|null,
  "spandrelHeightMm": number|null,
  "minimumRequiredSpandrelHeightMm": number|null,
  "commonCorridorPresent": boolean|null,
  "commonLobbyPresent": boolean|null,
  "commonCorridorTravelDistanceM": number|null,
  "commonEscapeRouteTravelDistanceM": number|null,
  "commonEscapeTravelDistanceM": number|null,
  "lobbyTravelDistanceM": number|null,
  "numberOfStaircases": number|null,
  "commonStairCount": number|null,
  "stairCount": number|null,
  "occupantLoad": number|null,
  "hasFlats": boolean|null,
  "flatUnitFlag": boolean|null,
  "isDwellingFlag": boolean|null,
  "spaceType": string|null,
  "exitWidthMm": number|null,
  "exitWidthMM": number|null,
  "finalExitWidthMm": number|null,
  "storeyExitWidthMm": number|null,
  "fireServiceVehicleAccessProvided": boolean|null,
  "fireServiceAccessProvided": boolean|null,
  "fireServiceAccessRoadWidthAdequate": boolean|null,
  "fireServiceTurningProvisionAdequate": boolean|null,
  "hardstandingProvided": boolean|null,
  "accessObstructionsPresent": boolean|null,
  "landingValveClearanceCompliant": boolean|null,
  "dryRiserInletSignageVisible": boolean|null,
  "privateHydrantsProvided": boolean|null,
  "distanceToNearestPublicHydrantM": number|null,
  "largestCompartmentAreaM2": number|null,
  "relevantBuildingFlag": boolean|null,
  "reg7AppliesFlag": boolean|null,
  "keyFindings": string[],
  "nonCompliances": string[],
  "improvementActions": string[],
  "notes": string[]
}

Extraction rules:
- Use null when not stated.
- Use boolean false only when the document clearly indicates absence or non-compliance.
- Prefer exact values over vague summaries.
- Capture dimensions with units normalised to meters for M fields and millimetres for Mm fields.
- purposeGroup should be a value like "1(a)", "2(a)", "2(b)", etc only if explicitly stated or very clearly inferable from the report wording.
- fireAlarmSystem should preserve a useful label such as "Grade A LD2", "L1", "L2", "BS 5839-1 system", etc.
- claddingMaterial should be concise, for example "ACM", "brick slip", "timber", "HPL", "mineral wool", "render system".
- exitWidthMm should be the main cited escape or final exit width if a single clear width is stated.
- If vehicle access exists but one sub-condition is defective, keep the broad field true and the sub-field false.
- If fire mains or dry riser are installed but there is a landing-valve or signage issue, keep the system present as true and mark only the defective sub-field false.
- Do not invent storeys, travel distances, or sprinkler presence.
`,
      },
      {
        role: "user",
        content: text,
      },
    ],
  };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data: any = await res.json();
      const content = data?.choices?.[0]?.message?.content ?? "{}";
      return normalizeFacts(safeParse(content));
    }

    if (res.status === 429) {
      await sleep(15000);
      continue;
    }

    const err = await res.text();
    throw new Error(err);
  }

  throw new Error("Groq rate limit persists");
}

async function handle(document_id: string) {
  const db = supabase();

  const { data: rawChunks, error } = await db
    .from("document_chunks")
    .select("*")
    .eq("document_id", document_id)
    .limit(80);

  if (error) {
    throw new Error(error.message);
  }

  if (!rawChunks?.length) {
    return {
      ok: true,
      document_id,
      facts: {},
      engineFacts: {},
      normalizedFacts: {},
      rawFactsFound: 0,
      extracted_from_chunks: 0,
      groq_used: false,
    };
  }

  const chunks = rawChunks
    .map((chunk: any) => ({
      id: getChunkId(chunk),
      idx: getChunkIndex(chunk),
      page: getChunkPage(chunk),
      text: getChunkText(chunk),
    }))
    .filter((chunk) => chunk.text.trim().length > 0)
    .sort((a, b) => {
      const ai = a.idx ?? Number.MAX_SAFE_INTEGER;
      const bi = b.idx ?? Number.MAX_SAFE_INTEGER;
      return ai - bi;
    });

  const localExtraction = extractFactsFromChunks(chunks, `document:${document_id}`);
  const localFacts = removeNulls(normalizeFacts(localExtraction.engineFacts ?? {}));

  const { targetedText } = selectRelevantText(
    rawChunks.map((chunk: any) => ({ content: getChunkText(chunk) }))
  );

  const deterministicTextFacts = removeNulls(inferFactsFromText(targetedText));
  const groqFacts = await callGroq(targetedText);
  const groqClean = removeNulls(normalizeFacts(groqFacts ?? {}));

  const mergedFacts = mergeFacts(
    mergeFacts(localFacts, deterministicTextFacts),
    groqClean
  );

  const upsertFacts = await db.from("document_facts").upsert(
    {
      document_id,
      facts: mergedFacts,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "document_id" }
  );

  if (upsertFacts.error) {
    throw new Error(upsertFacts.error.message);
  }

  const deleteEvidence = await db
    .from("building_facts")
    .delete()
    .eq("document_id", document_id);

  if (deleteEvidence.error) {
    throw new Error(deleteEvidence.error.message);
  }

  const factRows = localExtraction.factRows.map((row) => ({
    document_id,
    fact_key: row.fact_key,
    fact_value:
      typeof row.fact_value === "string"
        ? row.fact_value
        : JSON.stringify(row.fact_value),
    confidence: row.confidence,
    page: row.page,
    chunk_id: row.chunk_id,
    source_snippet: row.source_snippet ?? null,
  }));

  if (factRows.length > 0) {
    const insertEvidence = await db.from("building_facts").insert(factRows);
    if (insertEvidence.error) {
      throw new Error(insertEvidence.error.message);
    }
  }

  return {
    ok: true,
    document_id,
    facts: mergedFacts,
    engineFacts: localExtraction.engineFacts,
    normalizedFacts: localExtraction.normalizedFacts,
    rawFactsFound: localExtraction.rawFacts.length,
    extracted_from_chunks: chunks.length,
    groq_used: Boolean(process.env.GROQ_API_KEY),
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const document_id = mustUuid(searchParams.get("document_id"));
    const result = await handle(document_id);
    return json(result);
  } catch (e: any) {
    return json({ ok: false, message: e?.message ?? "Internal error" }, 500);
  }
}

export async function POST(req: Request) {
  try {
    const { document_id } = await req.json();
    const validDocumentId = mustUuid(document_id);
    const result = await handle(validDocumentId);
    return json(result);
  } catch (e: any) {
    return json({ ok: false, message: e?.message ?? "Internal error" }, 500);
  }
}
