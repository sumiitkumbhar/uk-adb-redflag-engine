import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { riskRules } from "@/lib/riskRules";
import * as ruleLogicModule from "@/lib/ruleLogic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RuleStatus = "PASS" | "FAIL" | "UNKNOWN";

type RuleRow = {
  ruleId: string;
  title: string;
  part: string;
  family: string;
  severity: "critical" | "high" | "medium" | "low" | string;
  status: RuleStatus;
  compliant: boolean;
  score: number;
  reason: string;
  evidenceUsed: string[];
  mitigation: string[] | string | null;
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function errToJson(e: any) {
  return {
    name: e?.name,
    message: e?.message,
    stack: e?.stack,
    code: e?.code,
    cause: e?.cause,
  };
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!url) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
  if (!key) {
    throw new Error(
      "Missing env: SUPABASE_SERVICE_ROLE_KEY (recommended) or SUPABASE_SERVICE_KEY"
    );
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function mustUuid(v: string | null) {
  if (!v) throw new Error("document_id is required");
  if (!UUID_RE.test(v)) throw new Error("document_id must be a UUID");
  return v;
}

function getRuleLogic(): Record<string, any> {
  const m: any = ruleLogicModule;
  return (m.RULE_LOGIC ?? m.ruleLogic ?? m.default ?? {}) as Record<string, any>;
}

function scoreFrom(severity: string, status: RuleStatus) {
  const baseFail: Record<string, number> = {
    critical: 95,
    high: 85,
    medium: 65,
    low: 35,
  };

  const baseUnknown: Record<string, number> = {
    critical: 55,
    high: 45,
    medium: 30,
    low: 15,
  };

  if (status === "PASS") return 0;
  if (status === "UNKNOWN") return baseUnknown[severity] ?? 30;
  return baseFail[severity] ?? 75;
}

function computeOverallCompliance(results: RuleRow[]) {
  if (!results.length) return 0;
  const avgRisk =
    results.reduce((sum, r) => sum + (Number(r.score) || 0), 0) / results.length;

  return Math.max(0, Math.min(100, Math.round(100 - avgRisk)));
}

function normalizeMitigation(out: any, rule: any): string[] | string | null {
  const candidate =
    out?.missingMitigation ??
    out?.missingMitigations ??
    out?.mitigationMissing ??
    out?.mitigation ??
    rule?.mitigationSteps ??
    null;

  if (!candidate) return null;

  if (Array.isArray(candidate)) {
    return candidate
      .map((x) => String(x ?? "").trim())
      .filter(Boolean);
  }

  if (typeof candidate === "string") {
    return candidate.trim() || null;
  }

  return null;
}

/* ---------------- RULE FAMILY HELPER ---------------- */

function getRuleFamily(ruleId: string): string {
  const id = String(ruleId || "").toUpperCase();

  if (
    [
      "B4-V1-UNPROTECTED-AREAS-01",
      "B4-UNPROTECTED-AREAS-SMALL-01",
      "B4-DW-EXTWALL-BOUNDARY-01",
    ].includes(id)
  ) {
    return "Unprotected Areas";
  }

  if (
    [
      "B5-VEHICLE-ACCESS-01",
      "B5-VEHICLE-DISTANCE-01",
      "B5-ACCESS-VEHICLE-01",
      "B5-V1-VEHICLE-ACCESS-01",
    ].includes(id)
  ) {
    return "Vehicle Access";
  }

  if (
    [
      "B4-ROOF-COVERING-CLASS-01",
      "B4-ROOF-SEPARATION-01",
      "B4-ROOF-EDGE-SEPARATION-01",
      "B4-DW-ROOF-BOUNDARY-01",
      "B4-V1-ROOF-SPREAD-01",
    ].includes(id)
  ) {
    return "Roof Spread";
  }

  if (
    [
      "B4-EXTWALL-REG7-01",
      "B4-EXTWALL-COMBUSTIBILITY-01",
      "B4-EXT-SURFACE-SPREAD-01",
      "B4-EXTWALL-NONCOMB-11M-RES-01",
      "B4-EXTWALL-ACM-01",
      "B4-EXTWALL-HPL-01",
      "B4-NONRES-EXTWALL-BR135-01",
    ].includes(id)
  ) {
    return "External Wall / Reg 7";
  }

  return "Other";
}

function buildFamilySummary(rows: RuleRow[]) {
  const grouped = new Map<
    string,
    { total: number; fail: number; unknown: number; pass: number }
  >();

  for (const row of rows) {
    const family = row.family || "Other";
    const current = grouped.get(family) ?? {
      total: 0,
      fail: 0,
      unknown: 0,
      pass: 0,
    };

    current.total += 1;
    if (row.status === "FAIL") current.fail += 1;
    else if (row.status === "UNKNOWN") current.unknown += 1;
    else if (row.status === "PASS") current.pass += 1;

    grouped.set(family, current);
  }

  return Array.from(grouped.entries())
    .map(([family, counts]) => ({
      family,
      ...counts,
    }))
    .sort((a, b) => {
      if (b.fail !== a.fail) return b.fail - a.fail;
      if (b.unknown !== a.unknown) return b.unknown - a.unknown;
      return a.family.localeCompare(b.family);
    });
}

/* ---------------- BASIC HELPERS ---------------- */

function text(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function lower(v: unknown): string {
  return text(v).toLowerCase();
}

function boolOrUndefined(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") {
    if (v === 1) return true;
    if (v === 0) return false;
  }
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (
      [
        "true",
        "yes",
        "y",
        "1",
        "present",
        "provided",
        "compliant",
        "adequate",
        "required",
      ].includes(s)
    ) {
      return true;
    }
    if (
      [
        "false",
        "no",
        "n",
        "0",
        "absent",
        "not provided",
        "non-compliant",
        "inadequate",
        "not required",
      ].includes(s)
    ) {
      return false;
    }
  }
  return undefined;
}

function numOrUndefined(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const raw = v.trim();
    if (!raw) return undefined;
    const cleaned = raw.replace(/[^\d.-]/g, "");
    const n = Number(cleaned);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function strArray(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) {
    return v.map((x) => String(x ?? "").trim()).filter(Boolean);
  }
  const s = String(v).trim();
  return s ? [s] : [];
}

function firstDefined<T>(...values: Array<T | undefined | null>): T | undefined {
  for (const v of values) {
    if (v !== undefined && v !== null && v !== ("" as any)) return v as T;
  }
  return undefined;
}

function includesAny(haystack: string, needles: string[]) {
  const lc = haystack.toLowerCase();
  return needles.some((n) => lc.includes(n.toLowerCase()));
}

function coerceEnum<T extends string>(
  value: unknown,
  allowed: readonly T[]
): T | undefined {
  const s = lower(value);
  if (!s) return undefined;
  return allowed.find((x) => x.toLowerCase() === s);
}

function asMmFromM(n?: number) {
  if (n === undefined) return undefined;
  return Math.round(n * 1000);
}

function asMFromMm(n?: number) {
  if (n === undefined) return undefined;
  return Number((n / 1000).toFixed(3));
}

/* ---------------- DERIVATION HELPERS ---------------- */

function deriveBuildingType(
  buildingUse: string
): "commercial" | "dwelling" | "flats" | "mixed_use" | "unknown" {
  const u = buildingUse.toLowerCase();

  if (!u) return "unknown";
  if (u.includes("mixed")) return "mixed_use";
  if (u.includes("flat") || u.includes("apartment") || u.includes("maisonette"))
    return "flats";
  if (
    u.includes("dwelling") ||
    u.includes("house") ||
    u.includes("residential")
  ) {
    return "dwelling";
  }
  if (
    u.includes("commercial") ||
    u.includes("office") ||
    u.includes("retail") ||
    u.includes("shop") ||
    u.includes("industrial") ||
    u.includes("warehouse") ||
    u.includes("restaurant") ||
    u.includes("hotel") ||
    u.includes("assembly") ||
    u.includes("school")
  ) {
    return "commercial";
  }
  return "unknown";
}

function derivePurposeGroup(buildingUse: string): string | null {
  const u = buildingUse.toLowerCase();

  if (!u) return null;

  if (u.includes("hospital") || u.includes("care home")) return "2(a)";
  if (
    u.includes("hotel") ||
    u.includes("hostel") ||
    u.includes("boarding") ||
    u.includes("residential institution")
  ) {
    return "2(a)";
  }
  if (
    u.includes("residential") ||
    u.includes("flat") ||
    u.includes("apartment") ||
    u.includes("dwelling") ||
    u.includes("house")
  ) {
    return "1";
  }
  if (u.includes("office")) return "3";
  if (u.includes("shop") || u.includes("retail") || u.includes("commercial"))
    return "4";
  if (
    u.includes("assembly") ||
    u.includes("recreation") ||
    u.includes("restaurant") ||
    u.includes("bar") ||
    u.includes("pub") ||
    u.includes("school")
  ) {
    return "5";
  }
  if (
    u.includes("industrial") ||
    u.includes("warehouse") ||
    u.includes("factory")
  ) {
    return "6";
  }

  return null;
}

function deriveRelevantBuildingFlag(
  buildingUse: string,
  heightTopStoreyM?: number
): boolean {
  const u = buildingUse.toLowerCase();
  const hasResidentialUse =
    u.includes("flat") ||
    u.includes("apartment") ||
    u.includes("residential") ||
    u.includes("dwelling") ||
    u.includes("student") ||
    u.includes("care home") ||
    u.includes("hospital");

  if (!hasResidentialUse) return false;

  if (heightTopStoreyM === undefined) return hasResidentialUse;
  return heightTopStoreyM >= 11;
}

function deriveBuildingType12_1(input: {
  buildingUse: string;
  buildingType: string;
  relevantBuildingFlag: boolean;
}): string | null {
  const u = input.buildingUse.toLowerCase();

  if (input.relevantBuildingFlag) return "relevant_building_reg7_4";

  if (
    u.includes("residential") ||
    u.includes("dwelling") ||
    u.includes("flat") ||
    u.includes("apartment") ||
    u.includes("house")
  ) {
    return "residential_purpose_groups_1_2";
  }

  if (
    u.includes("assembly") ||
    u.includes("recreation") ||
    u.includes("restaurant") ||
    u.includes("school") ||
    u.includes("cinema") ||
    u.includes("theatre")
  ) {
    return "assembly_and_recreation";
  }

  if (
    input.buildingType === "commercial" ||
    u.includes("commercial") ||
    u.includes("office") ||
    u.includes("retail") ||
    u.includes("industrial") ||
    u.includes("warehouse")
  ) {
    return "any_other";
  }

  return null;
}

function deriveHazardLevel(input: {
  buildingUse: string;
  textCorpus: string;
}): "low" | "normal" | "high" | undefined {
  const u = input.buildingUse.toLowerCase();
  const c = input.textCorpus.toLowerCase();

  if (
    includesAny(c, [
      "high hazard",
      "high-risk",
      "high risk",
      "flammable",
      "solvent",
      "paint store",
      "fuel store",
      "chemical store",
      "explosive",
      "high fire load",
    ])
  ) {
    return "high";
  }

  if (
    includesAny(c, [
      "low hazard",
      "low-risk",
      "low risk",
      "office only",
      "light office",
      "admin area",
    ])
  ) {
    return "low";
  }

  if (
    includesAny(u, [
      "office",
      "retail",
      "commercial",
      "shop",
      "restaurant",
      "school",
      "assembly",
      "warehouse",
      "industrial",
    ])
  ) {
    return "normal";
  }

  return undefined;
}

function deriveSpaceType(input: {
  buildingUse: string;
  textCorpus: string;
}): string | undefined {
  const c = input.textCorpus.toLowerCase();

  if (includesAny(c, ["corridor", "lobby", "stair", "escape route"])) {
    return "circulation";
  }
  if (includesAny(c, ["plant room", "generator room", "electrical room"])) {
    return "plant_room";
  }
  if (includesAny(c, ["toilet", "wc"])) return "toilet";
  if (includesAny(c, ["shop", "retail"])) return "retail";
  if (includesAny(c, ["office"])) return "office";
  if (includesAny(c, ["store room", "storage"])) return "store";
  if (includesAny(c, ["bedroom"])) return "bedroom";
  return undefined;
}

function deriveSprinklersProvided(textCorpus: string): boolean | undefined {
  const c = textCorpus.toLowerCase();

  if (
    includesAny(c, [
      "sprinklers provided",
      "sprinkler system provided",
      "sprinklered",
      "bs 9251",
      "bs9251",
      "bs en 12845",
      "sprinkler installation",
    ])
  ) {
    return true;
  }

  if (
    includesAny(c, [
      "no sprinklers",
      "sprinklers not provided",
      "unsprinklered",
      "without sprinklers",
    ])
  ) {
    return false;
  }

  return undefined;
}

function deriveNumberOfStaircases(input: {
  raw: Record<string, any>;
  textCorpus: string;
}): number | undefined {
  const r = input.raw;
  const c = input.textCorpus.toLowerCase();

  const direct = firstDefined<number>(
    numOrUndefined(r.numberOfStaircases),
    numOrUndefined(r.number_of_staircases),
    numOrUndefined(r.stairCount),
    numOrUndefined(r.escapeStairCount),
    numOrUndefined(r.commonStairCount),
    numOrUndefined(r.protectedStairCount)
  );
  if (direct !== undefined) return direct;

  if (includesAny(c, ["single stair", "single staircase", "one stair"])) return 1;
  if (includesAny(c, ["two stairs", "two staircases", "2 stairs"])) return 2;

  return undefined;
}

function deriveProtectedStairFlag(input: {
  raw: Record<string, any>;
  textCorpus: string;
}): boolean | undefined {
  const r = input.raw;
  const explicit = firstDefined<boolean>(
    boolOrUndefined(r.protectedStairFlag),
    boolOrUndefined(r.protected_stair_flag),
    boolOrUndefined(r.protectedStairPresent),
    boolOrUndefined(r.protectedStairPresentFlag)
  );
  if (explicit !== undefined) return explicit;

  const c = input.textCorpus.toLowerCase();
  if (includesAny(c, ["protected stair", "protected stairway"])) return true;
  if (includesAny(c, ["external stair only"])) return false;
  return undefined;
}

function deriveOnEscapeRouteFlag(input: {
  raw: Record<string, any>;
  textCorpus: string;
}): boolean | undefined {
  const r = input.raw;
  const explicit = firstDefined<boolean>(
    boolOrUndefined(r.onEscapeRouteFlag),
    boolOrUndefined(r.on_escape_route_flag),
    boolOrUndefined(r.onEscapeRoute),
    boolOrUndefined(r.escapeRoutePresent),
    boolOrUndefined(r.escapeRouteFlag)
  );
  if (explicit !== undefined) return explicit;

  const c = input.textCorpus.toLowerCase();
  if (
    includesAny(c, [
      "escape route",
      "means of escape",
      "protected corridor",
      "protected lobby",
      "final exit",
      "escape stair",
    ])
  ) {
    return true;
  }

  return undefined;
}

function deriveBoundaryDistanceM(input: {
  raw: Record<string, any>;
}): number | undefined {
  const r = input.raw;

  return firstDefined<number>(
    numOrUndefined(r.distanceToRelevantBoundary_m),
    numOrUndefined(r.distanceToRelevantBoundaryM),
    numOrUndefined(r.distance_to_relevant_boundary_m),
    numOrUndefined(r.distance_to_boundary_m),
    numOrUndefined(r.boundaryDistance_m),
    numOrUndefined(r.boundaryDistanceMeters),
    numOrUndefined(r.boundaryDistanceMeters),
    asMFromMm(
      firstDefined<number>(
        numOrUndefined(r.distanceToRelevantBoundary_mm),
        numOrUndefined(r.distanceToRelevantBoundaryMm),
        numOrUndefined(r.distance_to_relevant_boundary_mm),
        numOrUndefined(r.boundaryDistance_mm),
        numOrUndefined(r.boundaryDistanceMm),
        numOrUndefined(r.distanceToBoundary_mm)
      )
    )
  );
}

function deriveExternalWallMaterialClass(textCorpus: string): string | undefined {
  const c = textCorpus.toLowerCase();

  if (includesAny(c, ["a1"])) return "A1";
  if (includesAny(c, ["a2-s1,d0", "a2 s1 d0"])) return "A2-s1,d0";
  if (includesAny(c, ["b-s3,d2", "b s3 d2"])) return "B-s3,d2";
  if (includesAny(c, ["c-s3,d2", "c s3 d2"])) return "C-s3,d2";

  return undefined;
}

/* ---------------- FACT NORMALIZATION ---------------- */

function normalizeFacts(rawFacts: Record<string, any>): Record<string, any> {
  const facts = { ...rawFacts };

  const notes = strArray(facts.notes);
  const findings = strArray(facts.keyFindings);
  const nonCompliances = strArray(facts.nonCompliances);
  const actions = strArray(facts.improvementActions);
  const observations = strArray(facts.observations);
  const issues = strArray(facts.issues);

  const corpus = [
    text(facts.externalWallSystem),
    text(facts.claddingMaterial),
    text(facts.buildingUse),
    text(facts.description),
    text(facts.summary),
    text(facts.fireStrategySummary),
    ...notes,
    ...findings,
    ...nonCompliances,
    ...actions,
    ...observations,
    ...issues,
  ].join(" | ");

  const buildingUse =
    text(facts.buildingUse) ||
    text(facts.building_use) ||
    text(facts.use) ||
    text(facts.occupancyType) ||
    text(facts.primaryUse);

  const buildingType = text(facts.buildingType) || deriveBuildingType(buildingUse);

  const buildingHeightM = firstDefined<number>(
    numOrUndefined(facts.buildingHeightM),
    numOrUndefined(facts.buildingHeight_m),
    numOrUndefined(facts.buildingHeightMeters),
    numOrUndefined(facts.buildingheightmeters),
    numOrUndefined(facts.buildingHeight),
    numOrUndefined(facts.height_m)
  );

  const heightTopStoreyM = firstDefined<number>(
    numOrUndefined(facts.heightTopStorey_m),
    numOrUndefined(facts.heightTopStoreyM),
    numOrUndefined(facts.height_top_storey_m),
    numOrUndefined(facts.heightTopFloor_m),
    numOrUndefined(facts.topStoreyHeight_m),
    numOrUndefined(facts.topStoreyHeightM),
    buildingHeightM
  );

  const storeysAboveGroundCount = firstDefined<number>(
    numOrUndefined(facts.storeysAboveGroundCount),
    numOrUndefined(facts.storeysAboveGround),
    numOrUndefined(facts.storeyCount),
    numOrUndefined(facts.storeys),
    numOrUndefined(facts.numberOfStoreys),
    numOrUndefined(facts.floorsAboveGround)
  );

  const numberOfStaircases = deriveNumberOfStaircases({
    raw: facts,
    textCorpus: corpus,
  });

  const purposeGroup =
    text(facts.purposeGroup) ||
    text(facts.purpose_group) ||
    derivePurposeGroup(buildingUse) ||
    null;

  const relevantBuildingFlag = firstDefined<boolean>(
    boolOrUndefined(facts.relevantBuildingFlag),
    boolOrUndefined(facts.relevant_building_flag),
    deriveRelevantBuildingFlag(buildingUse, heightTopStoreyM)
  );

  const buildingType12_1 =
    text(facts.buildingType12_1) ||
    deriveBuildingType12_1({
      buildingUse,
      buildingType,
      relevantBuildingFlag: Boolean(relevantBuildingFlag),
    }) ||
    null;

  const hazardLevel =
    coerceEnum(facts.hazardLevel, ["low", "normal", "high"] as const) ||
    coerceEnum(facts.fireHazardLevel, ["low", "normal", "high"] as const) ||
    deriveHazardLevel({ buildingUse, textCorpus: corpus });

  const onEscapeRouteFlag = deriveOnEscapeRouteFlag({
    raw: facts,
    textCorpus: corpus,
  });

  const protectedStairFlag = deriveProtectedStairFlag({
    raw: facts,
    textCorpus: corpus,
  });

  const spaceType =
    text(facts.spaceType) ||
    text(facts.roomType) ||
    text(facts.areaType) ||
    deriveSpaceType({ buildingUse, textCorpus: corpus });

  const sprinklersProvided = firstDefined<boolean>(
    boolOrUndefined(facts.sprinklersProvided),
    boolOrUndefined(facts.sprinklersProvidedFlag),
    boolOrUndefined(facts.sprinklerProvided),
    boolOrUndefined(facts.sprinklerSystemProvided),
    deriveSprinklersProvided(corpus)
  );

  const boundaryDistanceM = deriveBoundaryDistanceM({ raw: facts });
  const boundaryDistanceMm = asMmFromM(boundaryDistanceM);

  const distanceToRelevantBoundaryM = firstDefined<number>(
    numOrUndefined(facts.distanceToRelevantBoundary_m),
    numOrUndefined(facts.distanceToRelevantBoundaryM),
    boundaryDistanceM
  );
  const distanceToRelevantBoundaryMm = firstDefined<number>(
    numOrUndefined(facts.distanceToRelevantBoundary_mm),
    numOrUndefined(facts.distanceToRelevantBoundaryMm),
    boundaryDistanceMm
  );

  const externalWallMaterialClass =
    text(facts.externalWallMaterialClass) ||
    text(facts.externalWallSurfaceEuroclass) ||
    text(facts.materialClass) ||
    deriveExternalWallMaterialClass(corpus) ||
    "";

  facts.buildingUse = buildingUse;
  facts.use ??= buildingUse;
  facts.buildingType = buildingType;
  facts.purposeGroup = purposeGroup;
  facts.purpose_group ??= purposeGroup;

  facts.buildingHeightM = buildingHeightM;
  facts.buildingHeight_m ??= buildingHeightM;
  facts.buildingHeightMeters ??= buildingHeightM;
  facts.buildingheightmeters ??= buildingHeightM;
  facts.buildingHeight ??= buildingHeightM;
  facts.buildingHeight_meters ??= buildingHeightM;

  facts.heightTopStoreyM = heightTopStoreyM;
  facts.heightTopStorey_m = heightTopStoreyM;
  facts.height_top_storey_m = heightTopStoreyM;
  facts.topStoreyHeight_m ??= heightTopStoreyM;
  facts.topStoreyHeightM ??= heightTopStoreyM;
  facts.height_top_storey_meters ??= heightTopStoreyM;
  facts.storeyHeightMax_m ??= heightTopStoreyM;
  facts.storeyHeightMaxM ??= heightTopStoreyM;
  facts.height_top_storey_m ??= heightTopStoreyM;

  facts.storeysAboveGroundCount = storeysAboveGroundCount;
  facts.storeysAboveGround ??= storeysAboveGroundCount;
  facts.storeyCount ??= storeysAboveGroundCount;
  facts.storeys ??= storeysAboveGroundCount;
  facts.numberOfStoreys ??= storeysAboveGroundCount;
  facts.floorsAboveGround ??= storeysAboveGroundCount;

  facts.numberOfStaircases = numberOfStaircases;
  facts.number_of_staircases ??= numberOfStaircases;
  facts.stairCount ??= numberOfStaircases;
  facts.escapeStairCount ??= numberOfStaircases;
  facts.commonStairCount ??= numberOfStaircases;

  facts.relevantBuildingFlag = Boolean(relevantBuildingFlag);
  facts.relevant_building_flag ??= Boolean(relevantBuildingFlag);
  facts.relevantBuilding_reg7_4 ??= Boolean(relevantBuildingFlag);
  facts.reg7AppliesFlag ??= Boolean(relevantBuildingFlag);

  facts.buildingType12_1 = buildingType12_1;

  facts.hazardLevel = hazardLevel;
  facts.fireHazardLevel ??= hazardLevel;

  facts.onEscapeRouteFlag ??= onEscapeRouteFlag;
  facts.on_escape_route_flag ??= onEscapeRouteFlag;
  facts.onEscapeRoute ??= onEscapeRouteFlag;
  facts.escapeRouteFlag ??= onEscapeRouteFlag;
  facts.escapeRoutePresent ??= onEscapeRouteFlag;

  facts.protectedStairFlag ??= protectedStairFlag;
  facts.protected_stair_flag ??= protectedStairFlag;
  facts.protectedStairPresent ??= protectedStairFlag;
  facts.protectedStairPresentFlag ??= protectedStairFlag;

  facts.spaceType ??= spaceType;
  facts.roomType ??= spaceType;
  facts.areaType ??= spaceType;

  facts.sprinklersProvided ??= sprinklersProvided;
  facts.sprinklersProvidedFlag ??= sprinklersProvided;
  facts.sprinklerProvided ??= sprinklersProvided;
  facts.sprinklerSystemProvided ??= sprinklersProvided;
  facts.sprinklersPresent ??= sprinklersProvided;
  facts.sprinklersPresentFlag ??= sprinklersProvided;
  facts.sprinklersProvidedFlag ??= sprinklersProvided;

  facts.boundaryDistance_m ??= boundaryDistanceM;
  facts.boundaryDistanceMeters ??= boundaryDistanceM;
  facts.distance_to_boundary_m ??= boundaryDistanceM;
  facts.boundaryDistance_mm ??= boundaryDistanceMm;
  facts.boundaryDistanceMm ??= boundaryDistanceMm;

  facts.distanceToRelevantBoundary_m ??= distanceToRelevantBoundaryM;
  facts.distanceToRelevantBoundaryM ??= distanceToRelevantBoundaryM;
  facts.distance_to_relevant_boundary_m ??= distanceToRelevantBoundaryM;
  facts.distanceToRelevantBoundary_mm ??= distanceToRelevantBoundaryMm;
  facts.distanceToRelevantBoundaryMm ??= distanceToRelevantBoundaryMm;
  facts.distance_to_relevant_boundary_mm ??= distanceToRelevantBoundaryMm;
  facts.distanceToBoundary_mm ??= distanceToRelevantBoundaryMm;

  facts.externalWallMaterialClass ??= externalWallMaterialClass || undefined;
  facts.externalWallSurfaceEuroclass ??= externalWallMaterialClass || undefined;
  facts.materialClass ??= externalWallMaterialClass || undefined;

  const deriveEuroclassFromText = (s: string): string | undefined => {
    const c = lower(s).replace(/\s+/g, " ");
    const patterns: Array<[RegExp, string]> = [
      [/\ba1\b/, "A1"],
      [/\ba2\s*[-, ]?s1\s*[-, ]?d0\b/, "A2-s1,d0"],
      [/\ba2\s*[-, ]?s2\s*[-, ]?d0\b/, "A2-s2,d0"],
      [/\bb\s*[-, ]?s1\s*[-, ]?d0\b/, "B-s1,d0"],
      [/\bb\s*[-, ]?s2\s*[-, ]?d0\b/, "B-s2,d0"],
      [/\bb\s*[-, ]?s3\s*[-, ]?d2\b/, "B-s3,d2"],
      [/\bc\s*[-, ]?s3\s*[-, ]?d2\b/, "C-s3,d2"],
      [/\bd\s*[-, ]?s3\s*[-, ]?d2\b/, "D-s3,d2"],
      [/\bclass\s*0\b/, "Class 0"],
      [/\bclass\s*1\b/, "Class 1"],
    ];
    for (const [re, val] of patterns) {
      if (re.test(c)) return val;
    }
    return undefined;
  };

  const internalFloorAreaM2 = firstDefined<number>(
    numOrUndefined(facts.internalFloorAreaM2),
    numOrUndefined(facts.internalflooraream2),
    numOrUndefined(facts.internalFloorArea),
    numOrUndefined(facts.internalfloorarea),
    numOrUndefined(facts.spaceFloorArea_m2),
    numOrUndefined(facts.space_floor_area_m2),
    numOrUndefined(facts.spaceFloorArea),
    numOrUndefined(facts.spacefloorarea),
    numOrUndefined(facts.roomAreaM2),
    numOrUndefined(facts.room_area_m2),
    numOrUndefined(facts.roomArea),
    numOrUndefined(facts.floorAreaM2),
    numOrUndefined(facts.floor_area_m2),
    numOrUndefined(facts.floorArea),
    numOrUndefined(facts.areaM2),
    numOrUndefined(facts.area_m2),
    numOrUndefined(facts.internal_area_m2),
    numOrUndefined(facts.grossInternalAreaM2),
    numOrUndefined(facts.gia_m2),
    numOrUndefined(facts.netInternalAreaM2),
    numOrUndefined(facts.nia_m2)
  );

  const isResidentialAccommodation = firstDefined<boolean>(
    boolOrUndefined(facts.isResidentialAccommodation),
    boolOrUndefined(facts.isresidentialaccommodation),
    boolOrUndefined(facts.residentialAccommodationFlag),
    boolOrUndefined(facts.residentialaccommodationflag),
    boolOrUndefined(facts.sleepingAccommodationFlag),
    boolOrUndefined(facts.sleepingaccommodationflag),
    boolOrUndefined(facts.sleepingAccommodation),
    boolOrUndefined(facts.sleepingaccommodation),
    boolOrUndefined(facts.residentialUseFlag),
    boolOrUndefined(facts.residentialuseflag),
    buildingType === "dwelling" || buildingType === "flats"
      ? true
      : buildingType === "commercial"
      ? false
      : undefined
  );

  const isCirculationSpace = firstDefined<boolean>(
    boolOrUndefined(facts.isCirculationSpace),
    boolOrUndefined(facts.iscirculationspace),
    boolOrUndefined(facts.circulationSpaceFlag),
    boolOrUndefined(facts.circulationspaceflag),
    boolOrUndefined(facts.isCirculation),
    boolOrUndefined(facts.iscirculation),
    boolOrUndefined(facts.commonCirculationFlag),
    boolOrUndefined(facts.commoncirculationflag),
    spaceType
      ? [
          "circulation",
          "corridor",
          "lobby",
          "stair",
          "common_circulation",
          "common circulation",
        ].includes(lower(spaceType))
      : undefined
  );

  const wallLiningClass = firstDefined<string>(
    text(facts.wallLiningClass),
    text(facts.wallliningclass),
    text(facts.wall_lining_class),
    text(facts.wallReactionToFireClass),
    text(facts.wallreactiontofireclass),
    text(facts.wall_reaction_to_fire_class),
    text(facts.wallEuroclass),
    text(facts.wall_euroclass),
    text(facts.wallFinishClass),
    text(facts.wall_finish_class),
    text(facts.wallSurfaceClass),
    text(facts.wall_surface_class),
    text(facts.internalWallLiningClass),
    text(facts.internal_wall_lining_class),
    deriveEuroclassFromText(corpus)
  ) || undefined;

  const ceilingLiningClass = firstDefined<string>(
    text(facts.ceilingLiningClass),
    text(facts.ceilingliningclass),
    text(facts.ceiling_lining_class),
    text(facts.ceilingReactionToFireClass),
    text(facts.ceilingreactiontofireclass),
    text(facts.ceiling_reaction_to_fire_class),
    text(facts.ceilingEuroclass),
    text(facts.ceiling_euroclass),
    text(facts.ceilingFinishClass),
    text(facts.ceiling_finish_class),
    text(facts.ceilingSurfaceClass),
    text(facts.ceiling_surface_class),
    text(facts.soffitLiningClass),
    text(facts.soffit_lining_class),
    deriveEuroclassFromText(corpus)
  ) || undefined;

  const liningClassification = firstDefined<string>(
    text(facts.liningClassification),
    text(facts.liningclassification),
    text(facts.liningClass),
    text(facts.liningclass),
    text(facts.lining_classification),
    text(facts.lining_class),
    text(facts.reactionToFireClassification),
    text(facts.reaction_to_fire_classification),
    text(facts.internalLiningClass),
    text(facts.internal_lining_class),
    wallLiningClass,
    ceilingLiningClass,
    deriveEuroclassFromText(corpus)
  ) || undefined;

  const allowanceAppliedFlag = firstDefined<boolean>(
    boolOrUndefined(facts.allowanceAppliedFlag),
    boolOrUndefined(facts.allowanceappliedflag),
    boolOrUndefined(facts.allowanceApplied),
    boolOrUndefined(facts.allowanceapplied),
    boolOrUndefined(facts.lowerPerformanceAllowanceApplied),
    boolOrUndefined(facts.lowerperformanceallowanceapplied),
    boolOrUndefined(facts.lowerPerformanceAllowanceFlag),
    boolOrUndefined(facts.lowerperformanceallowanceflag)
  );

  const allowanceJustification = firstDefined<string>(
    text(facts.allowanceJustification),
    text(facts.allowancejustification),
    text(facts.lowerPerformanceAllowanceJustification),
    text(facts.lowerperformanceallowancejustification),
    text(facts.liningAllowanceJustification),
    text(facts.lining_allowance_justification)
  ) || undefined;

  facts.internalFloorAreaM2 = internalFloorAreaM2;
  facts.internalflooraream2 ??= internalFloorAreaM2;
  facts.internalFloorArea ??= internalFloorAreaM2;
  facts.internalfloorarea ??= internalFloorAreaM2;
  facts.spaceFloorArea_m2 ??= internalFloorAreaM2;
  facts.space_floor_area_m2 ??= internalFloorAreaM2;
  facts.spaceFloorArea ??= internalFloorAreaM2;
  facts.spacefloorarea ??= internalFloorAreaM2;
  facts.roomAreaM2 ??= internalFloorAreaM2;
  facts.roomArea ??= internalFloorAreaM2;
  facts.floorAreaM2 ??= internalFloorAreaM2;
  facts.floorArea ??= internalFloorAreaM2;

  if (isResidentialAccommodation !== undefined) {
    facts.isResidentialAccommodation = isResidentialAccommodation;
    facts.isresidentialaccommodation ??= isResidentialAccommodation;
    facts.residentialAccommodationFlag ??= isResidentialAccommodation;
    facts.residentialaccommodationflag ??= isResidentialAccommodation;
    facts.sleepingAccommodationFlag ??= isResidentialAccommodation;
    facts.sleepingaccommodationflag ??= isResidentialAccommodation;
  }

  if (isCirculationSpace !== undefined) {
    facts.isCirculationSpace = isCirculationSpace;
    facts.iscirculationspace ??= isCirculationSpace;
    facts.circulationSpaceFlag ??= isCirculationSpace;
    facts.circulationspaceflag ??= isCirculationSpace;
    facts.isCirculation ??= isCirculationSpace;
    facts.iscirculation ??= isCirculationSpace;
  }

  facts.wallLiningClass = wallLiningClass;
  facts.wallliningclass ??= wallLiningClass;
  facts.wallReactionToFireClass ??= wallLiningClass;
  facts.wallreactiontofireclass ??= wallLiningClass;
  facts.wall_reaction_to_fire_class ??= wallLiningClass;
  facts.wallEuroclass ??= wallLiningClass;
  facts.wall_euroclass ??= wallLiningClass;
  facts.wall_lining_class ??= wallLiningClass;
  facts.wallFinishClass ??= wallLiningClass;
  facts.wall_finish_class ??= wallLiningClass;
  facts.wallSurfaceClass ??= wallLiningClass;
  facts.wall_surface_class ??= wallLiningClass;
  facts.internalWallLiningClass ??= wallLiningClass;
  facts.internal_wall_lining_class ??= wallLiningClass;

  facts.ceilingLiningClass = ceilingLiningClass;
  facts.ceilingliningclass ??= ceilingLiningClass;
  facts.ceilingReactionToFireClass ??= ceilingLiningClass;
  facts.ceilingreactiontofireclass ??= ceilingLiningClass;
  facts.ceiling_reaction_to_fire_class ??= ceilingLiningClass;
  facts.ceilingEuroclass ??= ceilingLiningClass;
  facts.ceiling_euroclass ??= ceilingLiningClass;
  facts.ceiling_lining_class ??= ceilingLiningClass;
  facts.ceilingFinishClass ??= ceilingLiningClass;
  facts.ceiling_finish_class ??= ceilingLiningClass;
  facts.ceilingSurfaceClass ??= ceilingLiningClass;
  facts.ceiling_surface_class ??= ceilingLiningClass;
  facts.soffitLiningClass ??= ceilingLiningClass;
  facts.soffit_lining_class ??= ceilingLiningClass;

  facts.liningClassification = liningClassification;
  facts.liningclassification ??= liningClassification;
  facts.liningClass ??= liningClassification;
  facts.liningclass ??= liningClassification;
  facts.lining_classification ??= liningClassification;
  facts.lining_class ??= liningClassification;
  facts.reactionToFireClassification ??= liningClassification;
  facts.reaction_to_fire_classification ??= liningClassification;
  facts.internalLiningClass ??= liningClassification;
  facts.internal_lining_class ??= liningClassification;

  if (allowanceAppliedFlag !== undefined) {
    facts.allowanceAppliedFlag = allowanceAppliedFlag;
    facts.allowanceappliedflag ??= allowanceAppliedFlag;
    facts.allowanceApplied ??= allowanceAppliedFlag;
    facts.allowanceapplied ??= allowanceAppliedFlag;
    facts.lowerPerformanceAllowanceApplied ??= allowanceAppliedFlag;
    facts.lowerperformanceallowanceapplied ??= allowanceAppliedFlag;
  }

  if (allowanceJustification !== undefined) {
    facts.allowanceJustification = allowanceJustification;
    facts.allowancejustification ??= allowanceJustification;
    facts.lowerPerformanceAllowanceJustification ??= allowanceJustification;
    facts.lowerperformanceallowancejustification ??= allowanceJustification;
  }

  facts.fireMainPresent ??= facts.fireMainsPresent;
  facts.fire_mains_present ??= facts.fireMainsPresent;
  facts.fireMainsProvided ??= facts.fireMainsPresent;
  facts.fireMainsProvidedFlag ??= facts.fireMainsPresent;
  facts.fireMainsPresentFlag ??= facts.fireMainsPresent;

  facts.vehicleAccessProvided ??= facts.fireServiceVehicleAccessProvided;
  facts.fireServiceAccessProvided ??= facts.fireServiceVehicleAccessProvided;
  facts.fireServiceVehicleAccessProvidedFlag ??=
    facts.fireServiceVehicleAccessProvided;

  facts.hardstandingPresent ??= facts.hardstandingProvided;
  facts.hardstandingFlag ??= facts.hardstandingProvided;

  facts.accessRouteObstructed ??= facts.accessObstructionsPresent;
  facts.accessRouteObstructedFlag ??= facts.accessObstructionsPresent;

  if (boolOrUndefined(facts.fireServiceAccessRoadWidthAdequate) === true) {
    facts.accessRoadWidth_m ??= 3.7;
  }

  if (boolOrUndefined(facts.fireServiceTurningProvisionAdequate) === true) {
    facts.turningProvisionPresent ??= true;
    facts.turningProvisionAdequate ??= true;
    facts.turningRadius_m ??= 16.8;
  }

  const landingValveClearanceCompliant = boolOrUndefined(
    facts.landingValveClearanceCompliant
  );
  if (landingValveClearanceCompliant !== undefined) {
    facts.clearance_issue_reported ??= !landingValveClearanceCompliant;
    facts.clearanceIssueReported ??= !landingValveClearanceCompliant;
    facts.landingValveClearanceIssue ??= !landingValveClearanceCompliant;
  }

  const signageVisible = boolOrUndefined(facts.dryRiserInletSignageVisible);
  if (signageVisible !== undefined) {
    facts.visibilityFromRoad ??= signageVisible;
    facts.signageVisible ??= signageVisible;
    facts.signageQuality ??= signageVisible ? "adequate" : "inadequate";
  }

  if (facts.visibilityFromRoad === false && !facts.signageQuality) {
    facts.signageQuality = "inadequate";
  }

  facts.claddingType ??=
    text(facts.claddingMaterial) || text(facts.externalWallSystem);

  const acmPresent = includesAny(corpus, ["acm", "aluminium composite"]);
  const hplPresent = includesAny(corpus, [
    "high-pressure laminate",
    "high pressure laminate",
    "hpl",
  ]);

  facts.acmPresentFlag ??= acmPresent;
  facts.hplPresentFlag ??= hplPresent;
  facts.acmCladdingPresent ??= acmPresent;
  facts.hplCladdingPresent ??= hplPresent;

  if (!facts.claddingType) {
    if (acmPresent && hplPresent) facts.claddingType = "ACM and HPL";
    else if (acmPresent) facts.claddingType = "ACM";
    else if (hplPresent) facts.claddingType = "HPL";
  }

  facts.cavityBarriersPresentFlag ??= facts.cavityBarriersPresent;
  facts.cavityBarrierPresentFlag ??= facts.cavityBarriersPresent;
  facts.cavityPresentFlag ??=
    includesAny(corpus, ["cavity", "cladding", "rainscreen"]) ||
    facts.cavityBarriersPresent === true;

  facts.buildingUseClass ??= buildingType;
  facts.mixedUseFlag ??=
    buildingType === "mixed_use" ||
    includesAny(buildingUse, ["mixed use", "mixed-use"]);
  facts.mixedUse ??= facts.mixedUseFlag;

  facts.isDwellingFlag ??=
    buildingType === "dwelling" ||
    includesAny(buildingUse, ["dwelling", "house", "residential"]);

  facts.flatUnitFlag ??=
    buildingType === "flats" ||
    includesAny(buildingUse, ["flat", "apartment", "maisonette"]);

  facts.hasFlats ??= facts.flatUnitFlag;

  facts.buildingOtherThanDwellingsFlag ??=
    buildingType === "commercial" || buildingType === "mixed_use";

  facts.sleepingAccommodationFlag ??= facts.sleepingAccommodation;
  facts.sleepingRiskFlag ??= facts.sleepingAccommodation;

  const joinedIssues = [...findings, ...nonCompliances, ...actions, ...notes]
    .join(" | ")
    .toLowerCase();

  if (joinedIssues.includes("valve") && joinedIssues.includes("clearance")) {
    facts.clearance_issue_reported ??= true;
    facts.landingValveClearanceIssue ??= true;
  }

  if (joinedIssues.includes("signage") && joinedIssues.includes("riser")) {
    facts.signageQuality ??= "inadequate";
    facts.visibilityFromRoad ??= false;
  }

  if (joinedIssues.includes("acm")) {
    facts.acmPresentFlag ??= true;
  }

  if (
    joinedIssues.includes("high-pressure laminate") ||
    joinedIssues.includes("high pressure laminate") ||
    joinedIssues.includes("hpl")
  ) {
    facts.hplPresentFlag ??= true;
  }

  facts._normalizationEvidence = {
    derived: {
      buildingUse: facts.buildingUse,
      buildingType: facts.buildingType,
      purposeGroup: facts.purposeGroup,
      buildingHeightM: facts.buildingHeightM,
      heightTopStoreyM: facts.heightTopStoreyM,
      storeysAboveGroundCount: facts.storeysAboveGroundCount,
      numberOfStaircases: facts.numberOfStaircases,
      hazardLevel: facts.hazardLevel,
      onEscapeRouteFlag: facts.onEscapeRouteFlag,
      protectedStairFlag: facts.protectedStairFlag,
      spaceType: facts.spaceType,
      sprinklersProvided: facts.sprinklersProvided,
      relevantBuildingFlag: facts.relevantBuildingFlag,
      buildingType12_1: facts.buildingType12_1,
      distanceToRelevantBoundary_m: facts.distanceToRelevantBoundary_m,
      distanceToRelevantBoundary_mm: facts.distanceToRelevantBoundary_mm,
      boundaryDistance_m: facts.boundaryDistance_m,
      boundaryDistance_mm: facts.boundaryDistance_mm,
      externalWallMaterialClass: facts.externalWallMaterialClass,
      fireMainPresent: facts.fireMainPresent,
      accessRoadWidth_m: facts.accessRoadWidth_m,
      hardstandingPresent: facts.hardstandingPresent,
      accessRouteObstructed: facts.accessRouteObstructed,
      clearance_issue_reported: facts.clearance_issue_reported,
      visibilityFromRoad: facts.visibilityFromRoad,
      claddingType: facts.claddingType,
      acmPresentFlag: facts.acmPresentFlag,
      hplPresentFlag: facts.hplPresentFlag,
      wallLiningClass: facts.wallLiningClass,
      ceilingLiningClass: facts.ceilingLiningClass,
      liningClassification: facts.liningClassification,
      internalFloorAreaM2: facts.internalFloorAreaM2,
      isResidentialAccommodation: facts.isResidentialAccommodation,
      isCirculationSpace: facts.isCirculationSpace,
      allowanceAppliedFlag: facts.allowanceAppliedFlag,
      allowanceJustification: facts.allowanceJustification,
    },
  };

  return facts;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const document_id = mustUuid(searchParams.get("document_id"));
    const debugSkipSave =
      ["1", "true", "yes"].includes(
        String(searchParams.get("debug_skip_save") ?? "").toLowerCase()
      );

    console.log("[risk-scores] START", { document_id, debugSkipSave });

    const supabase = getSupabaseAdmin();

    let facts: Record<string, any> = {};
    const { data: factsRow, error: factsError } = await supabase
      .from("document_facts")
      .select("facts")
      .eq("document_id", document_id)
      .maybeSingle();

    if (factsError) {
      return json(
        {
          ok: false,
          message: "Failed to load document_facts",
          details: factsError,
        },
        500
      );
    }

    console.log("[risk-scores] facts loaded", {
      hasFacts: Boolean(factsRow?.facts),
    });

    if (factsRow?.facts && typeof factsRow.facts === "object") {
      facts = factsRow.facts as Record<string, any>;
    }

    const normalizedFacts = normalizeFacts(facts);
    console.log("[risk-scores] facts normalized");

    const logic = getRuleLogic();
    console.log("[risk-scores] starting rule evaluation", {
      ruleCount: riskRules.length,
    });

    const rows: RuleRow[] = (riskRules as any[]).map((rule, index) => {
      console.log("[risk-scores] evaluating rule", {
        index,
        ruleId: rule.ruleId,
      });

      const fn = logic[rule.ruleId];

      if (!fn) {
        const status: RuleStatus = "UNKNOWN";
        return {
          ruleId: rule.ruleId,
          title: rule.title,
          part: rule.part,
          family: getRuleFamily(rule.ruleId),
          severity: rule.severity,
          status,
          compliant: false,
          score: scoreFrom(rule.severity, status),
          reason: "Rule logic not implemented.",
          evidenceUsed: [],
          mitigation: normalizeMitigation({}, rule),
        };
      }

      try {
        const out = fn(normalizedFacts, rule) ?? {};

        const status: RuleStatus = (() => {
          const raw = String(
            out.status ??
              (out.compliant === true
                ? "PASS"
                : out.compliant === false
                ? "FAIL"
                : "UNKNOWN")
          ).toUpperCase();

          if (raw === "PASS" || raw === "FAIL" || raw === "UNKNOWN") {
            return raw;
          }
          return "UNKNOWN";
        })();

        const evidence =
          out.evidenceUsed ?? out.evidence ?? out.evidence_used ?? [];

        return {
          ruleId: rule.ruleId,
          title: rule.title,
          part: rule.part,
          family: getRuleFamily(rule.ruleId),
          severity: rule.severity,
          status,
          compliant: status === "PASS",
          score:
            typeof out.score === "number"
              ? Number(out.score)
              : scoreFrom(rule.severity, status),
          reason: String(out.reason ?? "No reason provided."),
          evidenceUsed: Array.isArray(evidence)
            ? evidence.map((x: unknown) => String(x))
            : [],
          mitigation: normalizeMitigation(out, rule),
        };
      } catch (e: any) {
        const status: RuleStatus = "UNKNOWN";
        console.error("[risk-scores] evaluator crashed", {
          ruleId: rule.ruleId,
          message: e?.message ?? String(e),
          stack: e?.stack,
        });

        return {
          ruleId: rule.ruleId,
          title: rule.title,
          part: rule.part,
          family: getRuleFamily(rule.ruleId),
          severity: rule.severity,
          status,
          compliant: false,
          score: scoreFrom(rule.severity, status),
          reason: `Evaluator crashed: ${e?.message ?? String(e)}`,
          evidenceUsed: [e?.message ?? String(e)],
          mitigation: normalizeMitigation({}, rule),
        };
      }
    });

    console.log("[risk-scores] rows built", { count: rows.length });

    const summary = {
      total: rows.length,
      fail: rows.filter((r) => r.status === "FAIL").length,
      unknown: rows.filter((r) => r.status === "UNKNOWN").length,
      pass: rows.filter((r) => r.status === "PASS").length,
    };

    const family_summary = buildFamilySummary(rows);
    const overall_score = computeOverallCompliance(rows);

    const reportPayload = {
      document_id,
      generatedAt: new Date().toISOString(),
      overall_score,
      summary,
      family_summary,
      results: rows,
    };

    if (!debugSkipSave) {
      console.log("[risk-scores] saving report");

      const { error: saveErr } = await supabase
        .from("risk_reports")
        .upsert(
          {
            document_id,
            results: reportPayload,
          },
          { onConflict: "document_id" }
        );

      if (saveErr) {
        return json(
          {
            ok: false,
            message: "Failed to write risk_reports",
            document_id,
            supabaseError: saveErr,
          },
          500
        );
      }

      console.log("[risk-scores] report saved");
    } else {
      console.log("[risk-scores] debugSkipSave enabled - skipping risk_reports upsert");
    }

    console.log("[risk-scores] DONE");

    return json({
      ok: true,
      document_id,
      overall_score,
      summary,
      family_summary,
      count: rows.length,
      rows,
      normalized_facts_preview: {
        buildingUse: normalizedFacts.buildingUse,
        buildingType: normalizedFacts.buildingType,
        purposeGroup: normalizedFacts.purposeGroup,
        buildingHeightM: normalizedFacts.buildingHeightM,
        heightTopStoreyM: normalizedFacts.heightTopStoreyM,
        storeysAboveGroundCount: normalizedFacts.storeysAboveGroundCount,
        numberOfStaircases: normalizedFacts.numberOfStaircases,
        hazardLevel: normalizedFacts.hazardLevel,
        onEscapeRouteFlag: normalizedFacts.onEscapeRouteFlag,
        protectedStairFlag: normalizedFacts.protectedStairFlag,
        spaceType: normalizedFacts.spaceType,
        sprinklersProvided: normalizedFacts.sprinklersProvided,
        relevantBuildingFlag: normalizedFacts.relevantBuildingFlag,
        buildingType12_1: normalizedFacts.buildingType12_1,
        distanceToRelevantBoundary_m:
          normalizedFacts.distanceToRelevantBoundary_m,
        distanceToRelevantBoundary_mm:
          normalizedFacts.distanceToRelevantBoundary_mm,
        boundaryDistance_m: normalizedFacts.boundaryDistance_m,
        boundaryDistance_mm: normalizedFacts.boundaryDistance_mm,
        externalWallMaterialClass: normalizedFacts.externalWallMaterialClass,
        fireMainPresent: normalizedFacts.fireMainPresent,
        accessRoadWidth_m: normalizedFacts.accessRoadWidth_m,
        hardstandingPresent: normalizedFacts.hardstandingPresent,
        accessRouteObstructed: normalizedFacts.accessRouteObstructed,
        clearance_issue_reported: normalizedFacts.clearance_issue_reported,
        visibilityFromRoad: normalizedFacts.visibilityFromRoad,
        claddingType: normalizedFacts.claddingType,
        acmPresentFlag: normalizedFacts.acmPresentFlag,
        hplPresentFlag: normalizedFacts.hplPresentFlag,
        wallLiningClass: normalizedFacts.wallLiningClass,
        ceilingLiningClass: normalizedFacts.ceilingLiningClass,
        liningClassification: normalizedFacts.liningClassification,
        internalFloorAreaM2: normalizedFacts.internalFloorAreaM2,
        isResidentialAccommodation:
          normalizedFacts.isResidentialAccommodation,
        isCirculationSpace: normalizedFacts.isCirculationSpace,
        allowanceAppliedFlag: normalizedFacts.allowanceAppliedFlag,
        allowanceJustification: normalizedFacts.allowanceJustification,
      },
    });
  } catch (e: any) {
    console.error("[risk-scores] RUN_FAILED", errToJson(e));
    return json(
      {
        ok: false,
        message: "RUN_FAILED",
        details: errToJson(e),
      },
      500
    );
  }
}