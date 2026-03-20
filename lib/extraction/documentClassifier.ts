export type DocumentType =
  | "fire_strategy"
  | "general_arrangement"
  | "section_elevation"
  | "specification"
  | "schedule"
  | "facade_detail"
  | "unknown";

export type DocumentClassification = {
  documentType: DocumentType;
  confidence: number;
  matchedSignals: string[];
};

function scoreMatches(
  text: string,
  signals: Array<{ pattern: RegExp; label: string; weight: number }>
): { score: number; matchedSignals: string[] } {
  let score = 0;
  const matchedSignals: string[] = [];

  for (const signal of signals) {
    if (signal.pattern.test(text)) {
      score += signal.weight;
      matchedSignals.push(signal.label);
    }
  }

  return { score, matchedSignals };
}

export function classifyDocumentText(text: string): DocumentClassification {
  const source = String(text ?? "").toLowerCase();

  const signalMap: Record<DocumentType, Array<{ pattern: RegExp; label: string; weight: number }>> = {
    fire_strategy: [
      { pattern: /\bfire strategy\b/i, label: "fire strategy", weight: 5 },
      { pattern: /\bmeans of escape\b/i, label: "means of escape", weight: 3 },
      { pattern: /\bcompartmentation\b/i, label: "compartmentation", weight: 3 },
      { pattern: /\bfirefighting access\b/i, label: "firefighting access", weight: 3 },
      { pattern: /\bapproved document b\b/i, label: "ADB reference", weight: 2 }
    ],
    general_arrangement: [
      { pattern: /\bgeneral arrangement\b/i, label: "general arrangement", weight: 5 },
      { pattern: /\bga drawing\b/i, label: "GA drawing", weight: 4 },
      { pattern: /\bfloor plan\b/i, label: "floor plan", weight: 3 },
      { pattern: /\bunit layout\b/i, label: "unit layout", weight: 2 }
    ],
    section_elevation: [
      { pattern: /\bsection\b/i, label: "section", weight: 4 },
      { pattern: /\belevation\b/i, label: "elevation", weight: 4 },
      { pattern: /\btop storey\b/i, label: "top storey", weight: 2 },
      { pattern: /\bheight\b/i, label: "height", weight: 2 }
    ],
    specification: [
      { pattern: /\bspecification\b/i, label: "specification", weight: 5 },
      { pattern: /\bmaterials\b/i, label: "materials", weight: 2 },
      { pattern: /\bperformance\b/i, label: "performance", weight: 2 },
      { pattern: /\bbs 9251\b/i, label: "BS 9251", weight: 2 }
    ],
    schedule: [
      { pattern: /\bschedule\b/i, label: "schedule", weight: 5 },
      { pattern: /\bdoor schedule\b/i, label: "door schedule", weight: 4 },
      { pattern: /\bwindow schedule\b/i, label: "window schedule", weight: 4 }
    ],
    facade_detail: [
      { pattern: /\bfacade\b/i, label: "facade", weight: 4 },
      { pattern: /\bspandrel\b/i, label: "spandrel", weight: 4 },
      { pattern: /\bcavity barrier\b/i, label: "cavity barrier", weight: 3 },
      { pattern: /\bexternal wall\b/i, label: "external wall", weight: 3 }
    ],
    unknown: []
  };

  let bestType: DocumentType = "unknown";
  let bestScore = 0;
  let bestSignals: string[] = [];

  for (const [docType, signals] of Object.entries(signalMap) as Array<
    [DocumentType, Array<{ pattern: RegExp; label: string; weight: number }>]
  >) {
    if (docType === "unknown") continue;

    const { score, matchedSignals } = scoreMatches(source, signals);
    if (score > bestScore) {
      bestScore = score;
      bestType = docType;
      bestSignals = matchedSignals;
    }
  }

  if (bestScore === 0) {
    return {
      documentType: "unknown",
      confidence: 0,
      matchedSignals: []
    };
  }

  const confidence = Math.min(1, bestScore / 10);

  return {
    documentType: bestType,
    confidence,
    matchedSignals: bestSignals
  };
}