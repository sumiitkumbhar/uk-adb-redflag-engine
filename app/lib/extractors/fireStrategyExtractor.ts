import type { FactClaim, FactExtractor, ExtractorContext, TextChunk } from "./types";

function nowIso(): string {
  return new Date().toISOString();
}

function makeClaim(
  key: string,
  value: FactClaim["value"],
  confidence: number,
  chunk: TextChunk,
  evidence: string
): FactClaim {
  return {
    key,
    value,
    confidence,
    sourceType: "pdf",
    sourceRef: chunk.id,
    evidence: [evidence],
    extractor: "fire_strategy.v1",
    timestamp: nowIso(),
  };
}

function pushBoolIfMatched(
  out: FactClaim[],
  key: string,
  patterns: RegExp[],
  text: string,
  chunk: TextChunk,
  confidence = 0.82
) {
  if (patterns.some((p) => p.test(text))) {
    out.push(makeClaim(key, true, confidence, chunk, text));
  }
}

function pushEnumIfMatched(
  out: FactClaim[],
  key: string,
  options: Array<{ value: string; patterns: RegExp[]; confidence?: number }>,
  text: string,
  chunk: TextChunk
) {
  for (const option of options) {
    if (option.patterns.some((p) => p.test(text))) {
      out.push(makeClaim(key, option.value, option.confidence ?? 0.85, chunk, text));
      return;
    }
  }
}

export const fireStrategyExtractor: FactExtractor = {
  id: "fire_strategy.v1",

  async run(ctx: ExtractorContext): Promise<FactClaim[]> {
    const claims: FactClaim[] = [];

    for (const chunk of ctx.chunks) {
      const text = chunk.text;

      // ── Evacuation strategy ───────────────────────────────────────────────
      pushEnumIfMatched(
        claims,
        "evacuationStrategy",
        [
          { value: "stay put", patterns: [/\bstay[- ]?put\b/i] },
          {
            value: "simultaneous evacuation",
            patterns: [/\bsimultaneous evacuation\b/i, /\bfull evacuation\b/i],
          },
          {
            value: "phased evacuation",
            patterns: [/\bphased evacuation\b/i, /\bstaged evacuation\b/i],
          },
          {
            value: "progressive horizontal evacuation",
            patterns: [/\bprogressive horizontal evacuation\b/i],
          },
          {
            value: "defend in place",
            patterns: [/\bdefend in place\b/i],
          },
        ],
        text,
        chunk
      );

      // Aliases for evacuationStrategy
      pushEnumIfMatched(
        claims,
        "evacuation_strategy",
        [
          { value: "stay put", patterns: [/\bstay[- ]?put\b/i] },
          { value: "simultaneous evacuation", patterns: [/\bsimultaneous evacuation\b/i] },
          { value: "phased evacuation", patterns: [/\bphased evacuation\b/i] },
        ],
        text,
        chunk
      );

      // ── Stay put / simultaneous direct flags ──────────────────────────────
      pushBoolIfMatched(claims, "stayPutStrategy", [/\bstay[- ]?put\b/i], text, chunk, 0.88);
      pushBoolIfMatched(claims, "stayPut", [/\bstay[- ]?put\b/i], text, chunk, 0.85);
      pushBoolIfMatched(claims, "stayPutEvacuation", [/\bstay[- ]?put\b/i], text, chunk, 0.85);
      pushBoolIfMatched(
        claims,
        "simultaneousEvacuation",
        [/\bsimultaneous evacuation\b/i, /\bfull building evacuation\b/i],
        text, chunk, 0.85
      );
      pushBoolIfMatched(
        claims,
        "phasedEvacuation",
        [/\bphased evacuation\b/i, /\bstaged evacuation\b/i],
        text, chunk, 0.85
      );

      // ── Alarm system ──────────────────────────────────────────────────────
      pushEnumIfMatched(
        claims,
        "fireAlarmSystem",
        [
          { value: "L1", patterns: [/\bL1\b/] },
          { value: "L2", patterns: [/\bL2\b/] },
          { value: "L3", patterns: [/\bL3\b/] },
          { value: "L4", patterns: [/\bL4\b/] },
          { value: "L5", patterns: [/\bL5\b/] },
          { value: "M1", patterns: [/\bM1\b/] },
          { value: "M2", patterns: [/\bM2\b/] },
          { value: "P1", patterns: [/\bP1\b/] },
          { value: "P2", patterns: [/\bP2\b/] },
          {
            value: "LD1",
            patterns: [/\bLD1\b/, /\bgrade LD1\b/i, /\bcategory LD1\b/i],
          },
          {
            value: "LD2",
            patterns: [/\bLD2\b/, /\bgrade LD2\b/i, /\bcategory LD2\b/i],
          },
          {
            value: "LD3",
            patterns: [/\bLD3\b/, /\bgrade LD3\b/i, /\bcategory LD3\b/i],
          },
        ],
        text,
        chunk
      );

      pushEnumIfMatched(
        claims,
        "alarmGrade",
        [
          { value: "Grade A", patterns: [/\bGrade A\b/i, /\bGrade:? A\b/i] },
          { value: "Grade B", patterns: [/\bGrade B\b/i] },
          { value: "Grade C", patterns: [/\bGrade C\b/i] },
          { value: "Grade D", patterns: [/\bGrade D\b/i] },
          { value: "Grade E", patterns: [/\bGrade E\b/i] },
          { value: "Grade F", patterns: [/\bGrade F\b/i] },
        ],
        text,
        chunk
      );

      // ── Automatic detection ───────────────────────────────────────────────
      pushBoolIfMatched(
        claims,
        "automaticDetectionPresent",
        [
          /\bautomatic (?:fire )?detection\b/i,
          /\bsmoke detectors?\b/i,
          /\bheat detectors?\b/i,
          /\bdetection and alarm\b/i,
          /\bdetectors? provided\b/i,
          /\bAFD\b/,
          /\bautomatic fire detector\b/i,
        ],
        text, chunk, 0.84
      );
      pushBoolIfMatched(
        claims,
        "automaticDetectionProvided",
        [
          /\bautomatic detection\b/i,
          /\bsmoke detectors?\b/i,
          /\bheat detectors?\b/i,
          /\bdetectors? provided\b/i,
        ],
        text, chunk, 0.8
      );
      pushBoolIfMatched(
        claims,
        "automaticDetectionAlarmProvided",
        [/\bautomatic detection\b/i, /\bAFD\b/, /\bdetection and alarm\b/i],
        text, chunk, 0.82
      );

      // ── Staff presence pattern ────────────────────────────────────────────
      pushEnumIfMatched(
        claims,
        "staffPresencePattern",
        [
          {
            value: "24h",
            patterns: [
              /\b24[- ]hour staff\b/i,
              /\bstaff present 24\b/i,
              /\boccupied 24\b/i,
              /\bround the clock\b/i,
            ],
          },
          {
            value: "day only",
            patterns: [
              /\bday[- ]time staff\b/i,
              /\bstaff during (?:the )?day\b/i,
              /\bnot occupied at night\b/i,
            ],
          },
          {
            value: "unsupervised",
            patterns: [
              /\bunsupervised\b/i,
              /\bunattended\b/i,
              /\bno staff\b/i,
              /\bno permanent staff\b/i,
              /\binfrequently visited\b/i,
              /\brarely visited\b/i,
            ],
          },
        ],
        text,
        chunk
      );

      // ── Management procedures ─────────────────────────────────────────────
      pushBoolIfMatched(
        claims,
        "managementProceduresPresent",
        [
          /\bfire management procedure\b/i,
          /\bfire action plan\b/i,
          /\bfire emergency plan\b/i,
          /\bmanagement procedure\b/i,
        ],
        text, chunk, 0.8
      );

      // ── Sprinklers ────────────────────────────────────────────────────────
      pushBoolIfMatched(
        claims,
        "sprinklersPresent",
        [
          /\bsprinklers?\b/i,
          /\bsprinkler system\b/i,
          /\bautomatic sprinkler\b/i,
          /\bAWS\b/,
        ],
        text, chunk, 0.82
      );
      pushBoolIfMatched(
        claims,
        "sprinklersProvided",
        [
          /\bsprinkler system provided\b/i,
          /\bsprinklers? provided\b/i,
          /\bsprinkler protection\b/i,
        ],
        text, chunk, 0.84
      );
      pushBoolIfMatched(
        claims,
        "sprinklerSystemProvided",
        [
          /\bsprinkler system provided\b/i,
          /\bautomatic sprinkler system\b/i,
        ],
        text, chunk, 0.85
      );

      // ── Protected stair ───────────────────────────────────────────────────
      pushBoolIfMatched(
        claims,
        "protectedStairFlag",
        [
          /\bprotected stair(?:way|case)?\b/i,
          /\benclosed stair\b/i,
        ],
        text, chunk, 0.82
      );
      pushBoolIfMatched(
        claims,
        "protectedStairProvidedFlag",
        [/\bprotected stair(?:way|case)?\b/i],
        text, chunk, 0.8
      );

      // ── Smoke control / AOV ───────────────────────────────────────────────
      pushBoolIfMatched(
        claims,
        "smokeVentilationProvided",
        [
          /\bsmoke ventilation\b/i,
          /\bsmoke vent\b/i,
          /\baov\b/i,
          /\bautomatic opening vent\b/i,
          /\bsmoke exhaust\b/i,
          /\bsmoke control\b/i,
        ],
        text, chunk, 0.82
      );
      pushBoolIfMatched(
        claims,
        "aovProvided",
        [
          /\baov\b/i,
          /\bautomatic opening vent\b/i,
          /\bautomatic opening vents\b/i,
        ],
        text, chunk, 0.88
      );
      pushBoolIfMatched(
        claims,
        "aovPresent",
        [/\baov\b/i, /\bautomatic opening vent\b/i],
        text, chunk, 0.86
      );
      pushBoolIfMatched(
        claims,
        "smokeControlProvided",
        [
          /\bsmoke control system\b/i,
          /\bsmoke control provided\b/i,
          /\bsmoke management\b/i,
        ],
        text, chunk, 0.84
      );
      pushBoolIfMatched(
        claims,
        "smokeDetectionPresent",
        [/\bsmoke detectors?\b/i, /\bsmoke detection\b/i],
        text, chunk, 0.82
      );

      // ── Fire mains / risers ───────────────────────────────────────────────
      pushBoolIfMatched(
        claims,
        "fireMainPresent",
        [
          /\bfire main\b/i,
          /\bdry riser\b/i,
          /\bwet riser\b/i,
          /\brising main\b/i,
        ],
        text, chunk, 0.86
      );
      pushBoolIfMatched(
        claims,
        "fireMainsPresent",
        [
          /\bfire mains\b/i,
          /\bdry riser\b/i,
          /\bwet riser\b/i,
          /\brising main\b/i,
        ],
        text, chunk, 0.8
      );
      pushBoolIfMatched(
        claims,
        "dryRiserPresent",
        [/\bdry riser\b/i],
        text, chunk, 0.92
      );

      // ── Firefighting shaft / lift ─────────────────────────────────────────
      pushBoolIfMatched(
        claims,
        "firefightingShaftPresent",
        [/\bfirefighting shaft\b/i, /\bfire fighting shaft\b/i],
        text, chunk, 0.9
      );
      pushBoolIfMatched(
        claims,
        "firefightingShaftProvided",
        [/\bfirefighting shaft\b/i, /\bfire fighting shaft\b/i],
        text, chunk, 0.88
      );
      pushBoolIfMatched(
        claims,
        "firefightingLiftProvided",
        [/\bfirefighting lift\b/i, /\bfire fighting lift\b/i],
        text, chunk, 0.9
      );

      // ── Dwelling type ─────────────────────────────────────────────────────
      pushEnumIfMatched(
        claims,
        "dwellingType",
        [
          { value: "flat", patterns: [/\bflats?\b/i, /\bapartments?\b/i, /\bmaisonettes?\b/i] },
          {
            value: "dwellinghouse",
            patterns: [/\bdwelling[- ]?house\b/i, /\bhouse\b/i, /\bbungalow\b/i],
          },
          { value: "sheltered housing", patterns: [/\bsheltered housing\b/i] },
          { value: "care home", patterns: [/\bcare home\b/i, /\bnursing home\b/i] },
          { value: "student accommodation", patterns: [/\bstudent accommodation\b/i] },
          { value: "hotel", patterns: [/\bhotel\b/i, /\bmotel\b/i] },
        ],
        text,
        chunk
      );

      // ── Relevant building flag (BSA 2022) ─────────────────────────────────
      pushBoolIfMatched(
        claims,
        "relevantBuildingFlag",
        [
          /\brelevant building\b/i,
          /\bbuilding safety act\b/i,
          /\bBSA 2022\b/i,
          /\bHRRB\b/i,
          /\bhigher[- ]risk residential building\b/i,
        ],
        text, chunk, 0.84
      );

      // ── BS 9990 / fire main design ────────────────────────────────────────
      pushBoolIfMatched(
        claims,
        "bs9990ReferencedInFireMainSpecFlag",
        [/\bBS 9990\b/i, /\bBS9990\b/i],
        text, chunk, 0.92
      );

      // ── Emergency lighting ────────────────────────────────────────────────
      pushBoolIfMatched(
        claims,
        "emergencyLightingPresent",
        [
          /\bemergency lighting\b/i,
          /\bescape lighting\b/i,
          /\bemergency escape lighting\b/i,
        ],
        text, chunk, 0.84
      );

      // ── Wayfinding / signage ──────────────────────────────────────────────
      pushBoolIfMatched(
        claims,
        "wayfindingSignageProvided",
        [
          /\bwayfinding\b/i,
          /\bdirectional signage\b/i,
          /\bescape signage\b/i,
          /\bfire exit sign\b/i,
        ],
        text, chunk, 0.78
      );

      // ── Secure info box ───────────────────────────────────────────────────
      pushBoolIfMatched(
        claims,
        "secureInfoBoxProvided",
        [/\bsecure information box\b/i, /\bpremises information box\b/i],
        text, chunk, 0.86
      );

      // ── Refuse chute ──────────────────────────────────────────────────────
      pushBoolIfMatched(
        claims,
        "hasRefuseChuteOrStorageFlag",
        [/\brefuse chute\b/i, /\bwaste chute\b/i, /\bbin store\b/i],
        text, chunk, 0.8
      );
      pushBoolIfMatched(
        claims,
        "refuseChutePresent",
        [/\brefuse chute\b/i, /\bwaste chute\b/i],
        text, chunk, 0.82
      );
    }

    return claims;
  },
};
