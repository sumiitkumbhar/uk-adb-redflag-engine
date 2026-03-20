import type { RawExtractedFact } from "./factExtractor";

export type NormalizedFact = {
  value: string | number | boolean | null;
  confidence: number;
  sourceDocument?: string;
  sourceSnippet?: string;
};

export type NormalizedFactSet = Record<string, NormalizedFact>;
export type EngineFacts = Record<string, any>;

function normaliseBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;

  const s = String(value ?? "").trim().toLowerCase();
  if (!s) return undefined;

  if (["true", "yes", "y", "1"].includes(s)) return true;
  if (["false", "no", "n", "0"].includes(s)) return false;

  return undefined;
}

function normaliseNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const s = String(value ?? "").replace(/,/g, "").trim();
  if (!s) return undefined;

  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

function normaliseBuildingUse(value: unknown): string | undefined {
  const s = String(value ?? "").trim().toLowerCase();
  if (!s) return undefined;

  if (s.includes("block of flats") || s.includes("flat") || s.includes("apartment")) {
    return "flats";
  }

  if (
    s.includes("dwellinghouse") ||
    s.includes("dwelling house") ||
    s === "house" ||
    s.includes("single family")
  ) {
    return "dwellinghouse";
  }

  if (s.includes("mixed")) return "mixed_use";
  if (s.includes("office")) return "office";
  if (s.includes("hotel")) return "hotel";
  if (s.includes("care")) return "care_home";

  return s;
}

function normaliseSpaceType(value: unknown): string | undefined {
  const s = String(value ?? "").trim().toLowerCase();
  if (!s) return undefined;

  if (s.includes("common corridor")) return "common corridor";
  if (s.includes("protected lobby")) return "protected lobby";
  if (s.includes("lobby")) return "lobby";
  if (s.includes("stair")) return "stair";
  if (s.includes("flat")) return "flat";
  if (s.includes("plant")) return "plant room";

  return s;
}

export function buildNormalizedFactSet(rawFacts: RawExtractedFact[]): NormalizedFactSet {
  const out: NormalizedFactSet = {};

  for (const fact of rawFacts) {
    if (!out[fact.key] || fact.confidence > out[fact.key].confidence) {
      out[fact.key] = {
        value: fact.value,
        confidence: fact.confidence,
        sourceDocument: fact.sourceDocument,
        sourceSnippet: fact.sourceSnippet
      };
    }
  }

  // Derived aliases / normalised values
  if (out.buildingUse) {
    const value = normaliseBuildingUse(out.buildingUse.value);
    if (value) out.buildingUse.value = value;
  }

  if (out.spaceType) {
    const value = normaliseSpaceType(out.spaceType.value);
    if (value) out.spaceType.value = value;
  }

  for (const [key, fact] of Object.entries(out)) {
    if (
      key.endsWith("Flag") ||
      key.endsWith("Present") ||
      key.endsWith("Provided") ||
      key.startsWith("is") ||
      key.startsWith("has") ||
      key.startsWith("can") ||
      key.startsWith("reg")
    ) {
      const value = normaliseBoolean(fact.value);
      if (value !== undefined) fact.value = value;
    }

    if (
      key.endsWith("M") ||
      key.endsWith("Mm") ||
      key.endsWith("Minutes") ||
      key.endsWith("AreaM2") ||
      key.toLowerCase().includes("count") ||
      key.toLowerCase().includes("distance") ||
      key.toLowerCase().includes("height") ||
      key.toLowerCase().includes("load")
    ) {
      const value = normaliseNumber(fact.value);
      if (value !== undefined) fact.value = value;
    }
  }

  return out;
}

export function toEngineFacts(normalized: NormalizedFactSet): EngineFacts {
  const facts: EngineFacts = {};

  for (const [key, fact] of Object.entries(normalized)) {
    facts[key] = fact.value;
  }

  // Useful derived mappings for your existing engine
  if (facts.buildingUse === "flats") {
    facts.hasFlats = true;
    facts.isDwellingFlag = false;
  }

  if (facts.buildingUse === "dwellinghouse") {
    facts.isDwellingFlag = true;
    facts.hasFlats = false;
  }

  if (facts.numberOfStaircases !== undefined && facts.commonStairCount === undefined) {
    facts.commonStairCount = facts.numberOfStaircases;
  }

  if (facts.topStoreyHeightM !== undefined && facts.heightTopStoreyM === undefined) {
    facts.heightTopStoreyM = facts.topStoreyHeightM;
  }

  if (facts.heightTopStoreyM !== undefined && facts.topStoreyHeightM === undefined) {
    facts.topStoreyHeightM = facts.heightTopStoreyM;
  }

  if (
    facts.commonEscapeRouteTravelDistanceM !== undefined &&
    facts.commonEscapeTravelDistanceM === undefined
  ) {
    facts.commonEscapeTravelDistanceM = facts.commonEscapeRouteTravelDistanceM;
  }

  if (
    facts.commonEscapeTravelDistanceM !== undefined &&
    facts.commonEscapeRouteTravelDistanceM === undefined
  ) {
    facts.commonEscapeRouteTravelDistanceM = facts.commonEscapeTravelDistanceM;
  }

  return facts;
}