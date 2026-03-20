import type { FactClaim, FactGraph } from "../facts/types";
import { getClaims } from "../facts/factGraph";
import { resolveFact } from "../facts/claimResolver";

function nowIso(): string {
  return new Date().toISOString();
}

function resolvedValue<T = any>(graph: FactGraph, key: string): T | undefined {
  const claims = getClaims(graph, key);
  const resolved = resolveFact(claims);
  return resolved?.value as T | undefined;
}

function claim(
  key: string,
  value: FactClaim["value"],
  confidence: number,
  sourceRef: string,
  evidence: string[]
): FactClaim {
  return {
    key,
    value,
    confidence,
    sourceType: "derived",
    sourceRef,
    evidence,
    extractor: "derived.v1",
    timestamp: nowIso(),
  };
}

export function deriveFacts(graph: FactGraph): FactClaim[] {
  const out: FactClaim[] = [];

  // ── Stair count normalization ───────────────────────────────────────────────
  const stairCount =
    resolvedValue<number>(graph, "stairCount") ??
    resolvedValue<number>(graph, "numberOfStaircases") ??
    resolvedValue<number>(graph, "escapeStairCount") ??
    resolvedValue<number>(graph, "commonStairCount");

  if (stairCount !== undefined) {
    out.push(claim("numberOfStaircases", stairCount, 0.9, "derived:stairCount", ["Normalized stair count"]));
    out.push(claim("number_of_staircases", stairCount, 0.88, "derived:stairCount", ["Snake_case alias"]));
    out.push(claim("stairCount", stairCount, 0.9, "derived:stairCount", ["Normalized stair count"]));
    out.push(claim("escapeStairCount", stairCount, 0.85, "derived:stairCount", ["Alias"]));

    if (stairCount === 1) {
      out.push(claim("singleStairFlag", true, 0.92, "derived:stairCount", ["Derived from stairCount = 1"]));
      out.push(claim("singleStaircaseBuilding", true, 0.92, "derived:stairCount", ["Derived from stairCount = 1"]));
    } else {
      out.push(claim("singleStairFlag", false, 0.92, "derived:stairCount", [`Derived from stairCount = ${stairCount}`]));
      out.push(claim("singleStaircaseBuilding", false, 0.92, "derived:stairCount", [`Derived from stairCount = ${stairCount}`]));
    }
  }

  // ── Sprinkler normalization ────────────────────────────────────────────────
  const sprinklersPresent =
    resolvedValue<boolean>(graph, "sprinklersPresent") ??
    resolvedValue<boolean>(graph, "sprinklersProvided") ??
    resolvedValue<boolean>(graph, "sprinklerSystemProvided") ??
    resolvedValue<boolean>(graph, "hasSprinklerSystem");

  if (sprinklersPresent !== undefined) {
    const keys = [
      "sprinklersProvided", "sprinklersProvidedFlag", "sprinklerSystemProvided",
      "sprinklersPresent", "sprinklersPresentFlag", "sprinklerSystemPresent",
      "sprinklerSystemFlag", "sprinklerProvided",
    ];
    for (const k of keys) {
      out.push(claim(k, sprinklersPresent, 0.85, "derived:sprinklers", ["Derived from sprinkler facts"]));
    }
  }

  // ── Fire main normalization ────────────────────────────────────────────────
  const fireMain =
    resolvedValue<boolean>(graph, "fireMainPresent") ??
    resolvedValue<boolean>(graph, "fireMainsPresent") ??
    resolvedValue<boolean>(graph, "risingMainPresent") ??
    resolvedValue<boolean>(graph, "dryRiserPresent");

  if (fireMain !== undefined) {
    const keys = [
      "fireMainPresent", "fire_mains_present", "fire_mains_provided",
      "fireMainsProvided", "fireMainsPresent", "risingMainPresent", "fireMainProvided",
    ];
    for (const k of keys) {
      out.push(claim(k, fireMain, 0.84, "derived:fireMain", ["Derived from fireMain facts"]));
    }
  }

  // ── AOV normalization ──────────────────────────────────────────────────────
  const aov =
    resolvedValue<boolean>(graph, "aovProvided") ??
    resolvedValue<boolean>(graph, "aovPresent") ??
    resolvedValue<boolean>(graph, "smokeVentilationProvided");

  if (aov !== undefined) {
    out.push(claim("aovPresent", aov, 0.9, "derived:aov", ["Derived from aov facts"]));
    out.push(claim("aovProvided", aov, 0.9, "derived:aov", ["Derived from aov facts"]));
    out.push(claim("smokeVentilationProvided", aov, 0.85, "derived:aov", ["Alias"]));
    out.push(claim("smokeControlProvided", aov, 0.82, "derived:aov", ["Alias"]));
  }

  // ── Protected stair normalization ──────────────────────────────────────────
  const protectedStair =
    resolvedValue<boolean>(graph, "protectedStairFlag") ??
    resolvedValue<boolean>(graph, "protectedStairPresentFlag") ??
    resolvedValue<boolean>(graph, "protectedStairProvidedFlag") ??
    resolvedValue<boolean>(graph, "protectedStairPresent");

  if (protectedStair !== undefined) {
    const keys = [
      "protectedStairPresent", "protectedStairFlag", "protected_stair_flag",
      "protectedStairPresentFlag", "protectedStairProvidedFlag",
    ];
    for (const k of keys) {
      out.push(claim(k, protectedStair, 0.88, "derived:protectedStair", ["Derived from protected stair facts"]));
    }
  }

  // ── On escape route normalization ──────────────────────────────────────────
  const onEscapeRoute =
    resolvedValue<boolean>(graph, "onEscapeRouteFlag") ??
    resolvedValue<boolean>(graph, "escapeRoutePresent");

  if (onEscapeRoute !== undefined) {
    out.push(claim("onEscapeRouteFlag", onEscapeRoute, 0.85, "derived:escapeRoute", ["Alias"]));
    out.push(claim("on_escape_route_flag", onEscapeRoute, 0.83, "derived:escapeRoute", ["Alias"]));
    out.push(claim("escapeRoutePresent", onEscapeRoute, 0.83, "derived:escapeRoute", ["Alias"]));
    out.push(claim("onEscapeRoute", onEscapeRoute, 0.82, "derived:escapeRoute", ["Alias"]));
  }

  // ── twoDirectionsOfEscape normalization ────────────────────────────────────
  const twoDirs =
    resolvedValue<boolean>(graph, "twoDirectionsOfEscape") ??
    resolvedValue<boolean>(graph, "twoDirectionsAvailableFlag");

  if (twoDirs !== undefined) {
    out.push(claim("twoDirectionsOfEscape", twoDirs, 0.88, "derived:twoDirs", ["Normalized"]));
    out.push(claim("twoDirectionsAvailableFlag", twoDirs, 0.86, "derived:twoDirs", ["Alias"]));
  }

  // ── Evacuation strategy normalization ──────────────────────────────────────
  const evacStrat =
    resolvedValue<string>(graph, "evacuationStrategy") ??
    resolvedValue<string>(graph, "evacuation_strategy");

  if (evacStrat !== undefined) {
    out.push(claim("evacuationStrategy", evacStrat, 0.88, "derived:evacuation", ["Normalized"]));
    out.push(claim("evacuation_strategy", evacStrat, 0.85, "derived:evacuation", ["Alias"]));
    out.push(claim("evacuationstrategy", evacStrat, 0.83, "derived:evacuation", ["Alias"]));
    out.push(claim("stayPutStrategy", evacStrat.toLowerCase().includes("stay put"), 0.9, "derived:evacuation", ["Derived"]));
    out.push(claim("stayPut", evacStrat.toLowerCase().includes("stay put"), 0.88, "derived:evacuation", ["Derived"]));
    out.push(claim("stayPutEvacuation", evacStrat.toLowerCase().includes("stay put"), 0.88, "derived:evacuation", ["Derived"]));
    out.push(claim("simultaneousEvacuation", evacStrat.toLowerCase().includes("simultaneous"), 0.88, "derived:evacuation", ["Derived"]));
    out.push(claim("phasedEvacuation", evacStrat.toLowerCase().includes("phased"), 0.88, "derived:evacuation", ["Derived"]));
  }

  // ── Building height normalization ──────────────────────────────────────────
  const buildingHeight =
    resolvedValue<number>(graph, "buildingHeightM") ??
    resolvedValue<number>(graph, "heightTopStoreyM");

  if (buildingHeight !== undefined) {
    out.push(claim("buildingHeight_m", buildingHeight, 0.83, "derived:buildingHeightM", ["Snake_case alias"]));
    out.push(claim("buildingHeightM", buildingHeight, 0.86, "derived:buildingHeightM", ["Normalized"]));
    out.push(claim("buildingHeightMeters", buildingHeight, 0.8, "derived:buildingHeightM", ["Alias"]));
    out.push(claim("buildingHeightOver18m", buildingHeight >= 18, 0.9, "derived:buildingHeightM", ["Threshold check >= 18m"]));
    out.push(claim("buildingHeightOver11m", buildingHeight >= 11, 0.9, "derived:buildingHeightM", ["Threshold check >= 11m"]));
    out.push(claim("highRiseFlag", buildingHeight >= 18, 0.9, "derived:buildingHeightM", ["Derived high rise flag"]));
    out.push(claim("heightTopStoreyM", buildingHeight, 0.82, "derived:buildingHeightM", ["Alias"]));
    out.push(claim("height_top_storey_m", buildingHeight, 0.8, "derived:buildingHeightM", ["Alias"]));
    out.push(claim("maxStoreyAboveFRSAccessLevelM", buildingHeight, 0.75, "derived:buildingHeightM", ["Alias"]));
    out.push(claim("storeyHeightMax_m", buildingHeight, 0.73, "derived:buildingHeightM", ["Alias"]));
  }

  // ── Boundary distance normalization ────────────────────────────────────────
  const boundaryMm =
    resolvedValue<number>(graph, "boundaryDistanceMm") ??
    resolvedValue<number>(graph, "distanceToRelevantBoundary_mm");

  if (boundaryMm !== undefined) {
    out.push(claim("boundaryDistance_mm", boundaryMm, 0.83, "derived:boundaryDistanceMm", ["Snake_case alias"]));
    out.push(claim("distanceToRelevantBoundary_mm", boundaryMm, 0.85, "derived:boundaryDistanceMm", ["Alias"]));
    out.push(claim("distanceToRelevantBoundaryM", boundaryMm / 1000, 0.83, "derived:boundaryDistanceMm", ["Converted to metres"]));
    out.push(claim("boundaryDistanceM", boundaryMm / 1000, 0.83, "derived:boundaryDistanceMm", ["Converted to metres"]));
    out.push(claim("boundaryDistanceMeters", boundaryMm / 1000, 0.8, "derived:boundaryDistanceMm", ["Alias"]));
    out.push(claim("distance_to_boundary_m", boundaryMm / 1000, 0.8, "derived:boundaryDistanceMm", ["Alias"]));
  }

  const boundaryM =
    resolvedValue<number>(graph, "distanceToBoundaryM") ??
    resolvedValue<number>(graph, "distanceToRelevantBoundaryM") ??
    resolvedValue<number>(graph, "boundaryDistanceM");

  if (boundaryM !== undefined && boundaryMm === undefined) {
    out.push(claim("distanceToRelevantBoundary_mm", Math.round(boundaryM * 1000), 0.83, "derived:boundaryDistanceM", ["Converted to mm"]));
    out.push(claim("boundaryDistanceMm", Math.round(boundaryM * 1000), 0.83, "derived:boundaryDistanceM", ["Converted to mm"]));
    out.push(claim("distanceToBoundaryM", boundaryM, 0.85, "derived:boundaryDistanceM", ["Normalized"]));
    out.push(claim("distanceToRelevantBoundaryM", boundaryM, 0.85, "derived:boundaryDistanceM", ["Alias"]));
  }

  // ── Opening area normalization ─────────────────────────────────────────────
  const openingArea = resolvedValue<number>(graph, "openingAreaM2");
  if (openingArea !== undefined) {
    out.push(claim("openingArea_m2", openingArea, 0.83, "derived:openingAreaM2", ["Snake_case alias"]));
  }

  const maxUnprotected = resolvedValue<number>(graph, "calculatedMaxUnprotectedAreaM2");
  if (maxUnprotected !== undefined) {
    out.push(claim("calculatedMaxUnprotectedArea_m2", maxUnprotected, 0.83, "derived:calculatedMaxUnprotectedAreaM2", ["Snake_case alias"]));
  }

  // ── Automatic detection normalization ──────────────────────────────────────
  const autoDetection =
    resolvedValue<boolean>(graph, "automaticDetectionPresent") ??
    resolvedValue<boolean>(graph, "automaticDetectionProvided") ??
    resolvedValue<boolean>(graph, "automaticDetectionAlarmProvided");

  if (autoDetection !== undefined) {
    out.push(claim("automaticDetectionPresent", autoDetection, 0.86, "derived:detection", ["Normalized"]));
    out.push(claim("automaticDetectionProvided", autoDetection, 0.84, "derived:detection", ["Alias"]));
    out.push(claim("automaticDetectionAlarmProvided", autoDetection, 0.84, "derived:detection", ["Alias"]));
  }

  // ── dwellingType normalization ─────────────────────────────────────────────
  const dwellingType = resolvedValue<string>(graph, "dwellingType");
  if (dwellingType !== undefined) {
    out.push(claim("dwellingType", dwellingType, 0.85, "derived:dwellingType", ["Normalized"]));
    out.push(claim("dwelling_type", dwellingType, 0.82, "derived:dwellingType", ["Snake_case alias"]));
    const isFlat = /flat|apartment|maisonette/i.test(dwellingType);
    out.push(claim("isDwellingFlag", true, 0.82, "derived:dwellingType", ["Derived from dwellingType"]));
    out.push(claim("flatUnitFlag", isFlat, 0.82, "derived:dwellingType", ["Derived from dwellingType"]));
    out.push(claim("hasFlats", isFlat, 0.80, "derived:dwellingType", ["Derived from dwellingType"]));
    out.push(claim("dwellinghouseFlag", /house|bungalow|dwellinghouse/i.test(dwellingType), 0.82, "derived:dwellingType", ["Derived"]));
  }

  return out;
}
