import type { TextChunk } from "../facts/types";

export type SectionTag =
  | "overview"
  | "building_geometry"
  | "means_of_escape"
  | "fire_strategy"
  | "alarm_detection"
  | "external_wall"
  | "firefighting_access"
  | "tables"
  | "appendix"
  | "unknown";

export type SectionedChunk = TextChunk & {
  sectionTag: SectionTag;
};

const SECTION_RULES: Array<{ tag: SectionTag; patterns: RegExp[] }> = [
  {
    tag: "building_geometry",
    patterns: [
      /\bbuilding description\b/i,
      /\bbuilding geometry\b/i,
      /\bheight\b/i,
      /\bstoreys?\b/i,
      /\bstorey area\b/i,
      /\bgeneral arrangement\b/i,
    ],
  },
  {
    tag: "means_of_escape",
    patterns: [
      /\bmeans of escape\b/i,
      /\btravel distance\b/i,
      /\bfinal exit\b/i,
      /\bescape route\b/i,
      /\bstair(?:case|way)?\b/i,
      /\bdead end\b/i,
    ],
  },
  {
    tag: "fire_strategy",
    patterns: [
      /\bfire strategy\b/i,
      /\bevacuation strategy\b/i,
      /\bstay put\b/i,
      /\bphased evacuation\b/i,
      /\bsimultaneous evacuation\b/i,
    ],
  },
  {
    tag: "alarm_detection",
    patterns: [
      /\bfire alarm\b/i,
      /\bdetection\b/i,
      /\bsmoke detection\b/i,
      /\bheat detection\b/i,
      /\bbs 5839\b/i,
    ],
  },
  {
    tag: "external_wall",
    patterns: [
      /\bexternal wall\b/i,
      /\bcladding\b/i,
      /\bregulation 7\b/i,
      /\bspandrel\b/i,
      /\brelevant boundary\b/i,
      /\bunprotected area\b/i,
      /\broof covering\b/i,
    ],
  },
  {
    tag: "firefighting_access",
    patterns: [
      /\bfirefighting\b/i,
      /\bfire fighting\b/i,
      /\bdry riser\b/i,
      /\bwet riser\b/i,
      /\brising main\b/i,
      /\bappliance access\b/i,
      /\bhydrant\b/i,
    ],
  },
  {
    tag: "tables",
    patterns: [
      /\btable\b/i,
      /\bschedule\b/i,
      /\bdesign criteria\b/i,
      /\bsummary of\b/i,
    ],
  },
  {
    tag: "appendix",
    patterns: [
      /\bappendix\b/i,
      /\bannex\b/i,
    ],
  },
];

export function classifyChunkSection(chunk: TextChunk): SectionTag {
  const text = `${chunk.section ?? ""}\n${chunk.text}`;

  for (const rule of SECTION_RULES) {
    if (rule.patterns.some((p) => p.test(text))) return rule.tag;
  }

  return "unknown";
}

export function classifyChunks(chunks: TextChunk[]): SectionedChunk[] {
  return chunks.map((chunk) => ({
    ...chunk,
    sectionTag: classifyChunkSection(chunk),
  }));
}

export function chunkMatchesSection(
  chunk: Pick<SectionedChunk, "sectionTag">,
  allowed: SectionTag[]
): boolean {
  return allowed.includes(chunk.sectionTag);
}