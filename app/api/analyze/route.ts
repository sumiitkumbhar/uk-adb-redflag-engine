import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { extractFactsFromChunks } from "@/lib/extraction/extractFactsFromChunks";
import { mergeFacts } from "@/lib/extraction/mergeFacts";
import { RULE_LOGIC } from "@/lib/ruleLogic";
import { riskRules } from "@/lib/riskRules";

export const runtime = "nodejs";
export const maxDuration = 300;

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

function cleanText(text: string): string {
  return String(text ?? "")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .trim();
}

function extractGlobalFacts(fullTextRaw: string): Record<string, any> {
  const fullText = cleanText(fullTextRaw);
  const facts: Record<string, any> = {};

  const stairPatterns: Array<{ pattern: RegExp; value: number }> = [
    { pattern: /\bsingle\s+(?:protected\s+)?stair(?:case)?\b/i, value: 1 },
    { pattern: /\bone\s+(?:protected\s+)?stair(?:case)?\b/i, value: 1 },
    { pattern: /\btwo\s+(?:protected\s+)?stairs?\b/i, value: 2 },
    { pattern: /\btwo\s+stair\s+cores?\b/i, value: 2 },
    { pattern: /\bthree\s+(?:protected\s+)?stairs?\b/i, value: 3 },
    { pattern: /\b([0-9]+)\s+(?:protected\s+)?staircases?\b/i, value: NaN },
    { pattern: /\bnumber of staircases\s*[:\-]?\s*([0-9]+)\b/i, value: NaN },
  ];

  for (const item of stairPatterns) {
    const m = fullText.match(item.pattern);
    if (!m) continue;

    const value = Number.isNaN(item.value) ? Number(m[1]) : item.value;
    if (Number.isFinite(value)) {
      facts.numberOfStaircases = value;
      facts.commonStairCount = value;
      facts.stairCount = value;
      break;
    }
  }

  const singleDirectionPatterns = [
    /\bsingle\s+direction\s+travel\s+distance\s*(?:is|of|:)?\s*([0-9]+(?:\.[0-9]+)?)\s*m\b/i,
    /\btravel\s+distance\s+in\s+one\s+direction\s*(?:is|of|:)?\s*([0-9]+(?:\.[0-9]+)?)\s*m\b/i,
    /\bmaximum\s+travel\s+distance.*?one\s+direction.*?([0-9]+(?:\.[0-9]+)?)\s*m\b/i,
  ];

  for (const pattern of singleDirectionPatterns) {
    const m = fullText.match(pattern);
    if (!m) continue;
    const value = Number(m[1]);
    if (Number.isFinite(value)) {
      facts.travelDistanceSingleDirectionM = value;
      facts.singleDirectionDistM = value;
      facts.singleDirectionTravelDistanceM = value;
      facts.singleDirectionDistanceM = value;
      break;
    }
  }

  const twoDirectionPatterns = [
    /\btwo\s+direction\s+travel\s+distance\s*(?:is|of|:)?\s*([0-9]+(?:\.[0-9]+)?)\s*m\b/i,
    /\btravel\s+distance\s*(?:in\s+)?two\s+directions\s*(?:is|of|:)?\s*([0-9]+(?:\.[0-9]+)?)\s*m\b/i,
    /\bmaximum\s+travel\s+distance.*?more\s+than\s+one\s+direction.*?([0-9]+(?:\.[0-9]+)?)\s*m\b/i,
  ];

  for (const pattern of twoDirectionPatterns) {
    const m = fullText.match(pattern);
    if (!m) continue;
    const value = Number(m[1]);
    if (Number.isFinite(value)) {
      facts.travelDistanceTwoDirectionM = value;
      facts.travelDistanceNearestExitM = value;
      break;
    }
  }

  if (
    /\btwo\s+directions\s+of\s+escape\b/i.test(fullText) ||
    /\bmore\s+than\s+one\s+direction\s+of\s+escape\b/i.test(fullText) ||
    /\balternative\s+directions\s+of\s+escape\b/i.test(fullText) ||
    /\balternative\s+escape\s+route\s+provided\b/i.test(fullText) ||
    /\bsecondary\s+escape\s+route\s+provided\b/i.test(fullText)
  ) {
    facts.twoDirectionsAvailableFlag = true;
    facts.alternativeEscapeRouteProvided = true;
  }

  if (
    /\bescape\s+initially\s+in\s+one\s+direction\s+only\b/i.test(fullText) ||
    /\bsingle\s+direction\s+of\s+escape\b/i.test(fullText) ||
    /\bonly\s+one\s+direction\s+of\s+escape\b/i.test(fullText)
  ) {
    facts.twoDirectionsAvailableFlag = false;
  }

  const purposeGroupPatterns = [
    /\bpurpose group\s*[:\-]?\s*(1\(a\)|1\(b\)|1\(c\)|2\(a\)|2\(b\)|3|4|5|6|7)\b/i,
    /\bpurpose groups?\s*(1\(a\)|1\(b\)|1\(c\)|2\(a\)|2\(b\)|3|4|5|6|7)\b/i,
  ];

  for (const pattern of purposeGroupPatterns) {
    const m = fullText.match(pattern);
    if (!m) continue;
    facts.purposeGroup = m[1];
    break;
  }

  const alarmCategoryPatterns = [
    /\balarm category\s*[:\-]?\s*(L1|L2|L3|L4|L5|M|P1|P2|LD1|LD2|LD3)\b/i,
    /\b(category\s*(L1|L2|L3|L4|L5|M|P1|P2|LD1|LD2|LD3))\b/i,
    /\b(Grade\s+[A-F]\s+LD[123])\b/i,
  ];

  for (const pattern of alarmCategoryPatterns) {
    const m = fullText.match(pattern);
    if (!m) continue;
    facts.alarmCategory = m[2] ?? m[1];
    break;
  }

  if (
    /\bautomatic fire detection\b/i.test(fullText) ||
    /\bautomatic detection\b/i.test(fullText) ||
    /\bsmoke detection throughout\b/i.test(fullText) ||
    /\bsmoke detector(s)?\b/i.test(fullText) ||
    /\bheat detector(s)?\b/i.test(fullText) ||
    /\bafd system\b/i.test(fullText) ||
    /\bl1 fire alarm system\b/i.test(fullText) ||
    /\bl2 fire alarm system\b/i.test(fullText) ||
    /\bl3 fire alarm system\b/i.test(fullText) ||
    /\bld1 system\b/i.test(fullText) ||
    /\bld2 system\b/i.test(fullText) ||
    /\bld3 system\b/i.test(fullText) ||
    /\balarm category\s*[:\-]?\s*(L1|L2|L3|L4|L5|LD1|LD2|LD3|P1|P2)\b/i.test(fullText)
  ) {
    facts.automaticDetectionPresent = true;
  }

  if (
    /\bplant room\b/i.test(fullText) ||
    /\bstorage room\b/i.test(fullText) ||
    /\bstore room\b/i.test(fullText) ||
    /\bbin store\b/i.test(fullText) ||
    /\brefuse store\b/i.test(fullText) ||
    /\bvoid\b/i.test(fullText) ||
    /\bservice riser\b/i.test(fullText) ||
    /\belectrical cupboard\b/i.test(fullText)
  ) {
    facts.staffPresencePattern = "unsupervised";
  }

  if (
    /\bcorridor\b/i.test(fullText) ||
    /\blobby\b/i.test(fullText) ||
    /\bstair\b/i.test(fullText) ||
    /\bescape route\b/i.test(fullText)
  ) {
    facts.adjacencyToEscapeRoutes = true;
  }

  if (
    /\bblock of flats\b/i.test(fullText) ||
    /\bflats\b/i.test(fullText) ||
    /\bapartment(s)?\b/i.test(fullText) ||
    /\bmaisonette(s)?\b/i.test(fullText)
  ) {
    facts.buildingUse = facts.buildingUse ?? "flats";
    facts.dwellingType = "flat";
    facts.hasFlats = true;
    facts.sleepingAccommodation = true;
    facts.hazardLevel = facts.hazardLevel ?? "normal";
  }

  if (
    /\bdwellinghouse\b/i.test(fullText) ||
    /\bdwelling house\b/i.test(fullText) ||
    /\bhouse\b/i.test(fullText)
  ) {
    facts.buildingUse = facts.buildingUse ?? "dwellinghouse";
    facts.dwellingType = facts.dwellingType ?? "dwellinghouse";
    facts.isDwellingFlag = true;
    facts.hazardLevel = facts.hazardLevel ?? "normal";
  }

  if (
    /\bstay put\b/i.test(fullText)
  ) {
    facts.evacuationStrategy = "stay put";
    facts.stayPutStrategy = true;
  } else if (
    /\bsimultaneous evacuation\b/i.test(fullText)
  ) {
    facts.evacuationStrategy = "simultaneous evacuation";
    facts.simultaneousEvacuation = true;
  } else if (
    /\bphased evacuation\b/i.test(fullText)
  ) {
    facts.evacuationStrategy = "phased evacuation";
  }

  return facts;
}

function chooseRuleEvaluator(rule: any) {
  return RULE_LOGIC[rule.ruleId] ?? RULE_LOGIC[rule.logic?.evaluationId];
}

export async function POST(req: Request) {
  try {
    const { document_id } = await req.json();

    if (!document_id) {
      return NextResponse.json({ error: "document_id required" }, { status: 400 });
    }

    const supabase = supabaseAdmin();

    const { data: chunks, error: chunkError } = await supabase
      .from("chunks")
      .select("id, idx, page, text")
      .eq("document_id", document_id)
      .order("idx", { ascending: true });

    if (chunkError) throw chunkError;

    if (!chunks || chunks.length === 0) {
      return NextResponse.json(
        { error: "No chunks found for this document" },
        { status: 404 }
      );
    }

    const extracted = extractFactsFromChunks(
      chunks.map((c) => ({
        id: c.id,
        idx: c.idx ?? null,
        page: c.page ?? null,
        text: c.text,
      })),
      document_id
    );

    const mergedFacts = mergeFacts(extracted.rawFacts);
    const globalFacts = extractGlobalFacts(chunks.map((c) => c.text ?? "").join("\n\n"));

    const buildingFacts = {
      ...mergedFacts,
      ...globalFacts,
    };

    const ruleResults = riskRules.map((rule) => {
      const evalFn = chooseRuleEvaluator(rule);

      if (!evalFn) {
        return {
          document_id,
          rule_id: rule.ruleId,
          rule_name: (rule as any).name ?? rule.ruleId,
          worst_severity: (rule as any).severity ?? "medium",
          status: "UNKNOWN",
          reason: "No deterministic evaluator implemented",
          evidence: [],
        };
      }

      const res = evalFn(buildingFacts, rule);

      return {
        document_id,
        rule_id: rule.ruleId,
        rule_name: (rule as any).name ?? rule.ruleId,
        worst_severity: (rule as any).severity ?? "medium",
        status: res.status,
        reason: res.reason,
        evidence: res.evidence,
      };
    });

    await supabase.from("risk_scores").delete().eq("document_id", document_id);

    if (ruleResults.length > 0) {
      const { error: insertError } = await supabase
        .from("risk_scores")
        .insert(ruleResults);

      if (insertError) throw insertError;
    }

    const summary = {
      PASS: ruleResults.filter((r) => r.status === "PASS").length,
      FAIL: ruleResults.filter((r) => r.status === "FAIL").length,
      UNKNOWN: ruleResults.filter((r) => r.status === "UNKNOWN").length,
    };

    return NextResponse.json({
      success: true,
      chunks_processed: chunks.length,
      rules_evaluated: riskRules.length,
      extracted_fact_count: extracted.rawFacts.length,
      buildingFacts,
      summary,
      results: ruleResults,
    });
  } catch (error: any) {
    console.error("Analysis error:", error);

    return NextResponse.json(
      { error: error?.message || "Server error" },
      { status: 500 }
    );
  }
}
