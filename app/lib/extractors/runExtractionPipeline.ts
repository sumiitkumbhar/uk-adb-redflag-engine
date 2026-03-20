    import type { ExtractorContext, FactExtractor } from "../facts/types";
    import { buildFactGraph, addClaims } from "../facts/factGraph";
    import { classifyChunks } from "./sectionClassifier";
    import { geometryExtractor } from "./geometryExtractor";
    import { fireStrategyExtractor } from "./fireStrategyExtractor";
    import { escapeExtractor } from "./escapeExtractor";
    import { externalWallExtractor } from "./externalWallExtractor";
    import { firefightingAccessExtractor } from "./firefightingAccessExtractor";
    import { deriveFacts } from "./derivedFacts";
    import { buildingUseExtractor } from "./buildingUseExtractor";

    /**
     * Optional LLM extractor can be injected from the app layer.
     * Keep this file deterministic by default.
     */
    export async function runExtractionPipeline(
    ctx: ExtractorContext,
    options?: {
        extraExtractors?: FactExtractor[];
    }
    ) {
    const sectionedCtx: ExtractorContext = {
        ...ctx,
        chunks: classifyChunks(ctx.chunks),
    };

    const extractors: FactExtractor[] = [
        geometryExtractor,
        buildingUseExtractor,
        fireStrategyExtractor,
        escapeExtractor,
        externalWallExtractor,
        firefightingAccessExtractor,
      ];

    const results = await Promise.all(
        extractors.map((extractor) => extractor.run(sectionedCtx))
    );

    const initialClaims = results.flat();
    let graph = buildFactGraph(initialClaims);

    // Derived compatibility and normalization facts
    const derived = deriveFacts(graph);
    graph = addClaims(graph, derived);
    console.log("EXTRACTION FACT KEYS:", Object.keys(graph.claims).length);
console.log(
  "EXTRACTION TOTAL CLAIMS:",
  Object.values(graph.claims).reduce(
    (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
    0
  )
);
    return graph;
    }