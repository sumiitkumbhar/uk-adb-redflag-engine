export type FactPrimitive = boolean | number | string | null;
export type FactValue = FactPrimitive | string[];

export type FactSourceType = "pdf" | "manual" | "derived" | "rule";

export type FactClaim = {
  key: string;                 // canonical ontology key
  value: FactValue;
  confidence: number;          // 0..1
  sourceType: FactSourceType;
  sourceRef?: string;          // page / chunk / section id
  evidence?: string[];         // snippets
  extractor?: string;          // geometry.v1, fire_strategy.v1
  timestamp: string;           // ISO string
};

export type FactGraph = {
  claims: Record<string, FactClaim[]>;
};

export type ResolvedFact = {
  key: string;
  value: FactValue;
  confidence: number;
  chosenFrom: FactClaim;
  alternatives?: FactClaim[];
};

export type ResolvedFactMap = Record<string, ResolvedFact>;

export type TextChunk = {
  id: string;
  text: string;
  page?: number;
  section?: string;
};

export type ExtractorContext = {
  documentId: string;
  fullText: string;
  chunks: TextChunk[];
};

export type FactExtractor = {
  id: string;
  run(ctx: ExtractorContext): Promise<FactClaim[]>;
};