import type { DocumentSection } from "./documentSplitter";
import { classifyDocumentText } from "../extraction/documentClassifier";
import { extractFactsFromText, type RawExtractedFact } from "../extraction/factExtractor";

export type ParsedSection = {
  id: string;
  title: string;
  documentType: string;
  documentTypeConfidence: number;
  matchedSignals: string[];
  text: string;
  extractedFacts: RawExtractedFact[];
};

export type ParsedDocumentLayout = {
  sourceDocument?: string;
  sections: ParsedSection[];
};

export function parseDocumentLayout(
  sections: DocumentSection[],
  sourceDocument?: string
): ParsedDocumentLayout {
  const parsedSections: ParsedSection[] = sections.map((section) => {
    const classification = classifyDocumentText(section.title + "\n" + section.text);
    const extractedFacts = extractFactsFromText({
      text: section.text,
      sourceDocument
    });

    return {
      id: section.id,
      title: section.title,
      documentType: classification.documentType,
      documentTypeConfidence: classification.confidence,
      matchedSignals: classification.matchedSignals,
      text: section.text,
      extractedFacts
    };
  });

  return {
    sourceDocument,
    sections: parsedSections
  };
}