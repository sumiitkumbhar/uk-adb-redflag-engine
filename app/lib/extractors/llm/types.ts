export type ProposedFact = {
  key: string;
  value: boolean | number | string | string[] | null;
  confidence: number;
  evidence: string[];
  rationale?: string;
};