// scripts/audit-missing-facts.ts

import { createClient } from "@supabase/supabase-js";
import { riskRules } from "../lib/riskRules";
import { evaluateAll } from "../lib/evaluateAll";
import { enrichFacts } from "../lib/factEnricher";
import fs from "fs";
import path from "path";

function loadLocalEnv() {
  const envPaths = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), ".env"),
  ];

  for (const envPath of envPaths) {
    if (!fs.existsSync(envPath)) continue;

    const content = fs.readFileSync(envPath, "utf8");
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;

      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

loadLocalEnv();

type FactSource = {
  confidence: number | null;
  page: number | null;
  chunk_id: string | null;
  source_snippet: string | null;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing env: ${name}`);
  }
  return value;
}

function getSupabaseAdmin() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!key || !key.trim()) {
    throw new Error(
      "Missing env: SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY"
    );
  }

  return createClient(url, key, { auth: { persistSession: false } });
}

function parseStoredFacts(raw: unknown): Record<string, any> {
  if (!raw) return {};

  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, any>;
  }

  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, any>;
      }
    } catch {
      return {};
    }
  }

  return {};
}

function parseFactValue(raw: unknown): any {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== "string") return raw;

  const trimmed = raw.trim();
  if (!trimmed) return "";

  if (trimmed === "true") return true;
  if (trimmed === "false") return false;

  if (!Number.isNaN(Number(trimmed))) return Number(trimmed);

  try {
    return JSON.parse(trimmed);
  } catch {
    return trimmed;
  }
}

function compactObject(obj: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && v !== undefined && v !== "") {
      out[k] = v;
    }
  }
  return out;
}

function buildFactSources(rows: any[]) {
  const factSources: Record<string, FactSource> = {};
  const factValues: Record<string, any> = {};

  for (const row of rows) {
    const key = String(row.fact_key ?? "").trim();
    if (!key) continue;

    const nextConfidence =
      typeof row.confidence === "number" ? row.confidence : 0;

    const current = factSources[key];
    const currentConfidence =
      typeof current?.confidence === "number" ? current.confidence : -1;

    if (!current || nextConfidence > currentConfidence) {
      factSources[key] = {
        confidence: typeof row.confidence === "number" ? row.confidence : null,
        page: typeof row.page === "number" ? row.page : null,
        chunk_id: row.chunk_id ? String(row.chunk_id) : null,
        source_snippet: row.source_snippet
          ? String(row.source_snippet)
          : null,
      };

      factValues[key] = parseFactValue(row.fact_value);
    }
  }

  return { factSources, factValues };
}

function parseMissingFacts(reason: string): string[] {
  const text = String(reason || "").trim();
  if (!/^Missing\s+/i.test(text)) return [];

  return text
    .replace(/^Missing\s+/i, "")
    .split(/\s*(?:,|\/| and )\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

async function loadFactsForDocument(documentId: string) {
  const supabase = getSupabaseAdmin();

  const { data: factRow, error: factError } = await supabase
    .from("document_facts")
    .select("document_id, facts, updated_at")
    .eq("document_id", documentId)
    .maybeSingle();

  if (factError) {
    throw new Error(`document_facts query failed: ${factError.message}`);
  }

  if (!factRow?.facts) {
    throw new Error(`No document_facts found for document_id=${documentId}`);
  }

  const storedFacts = compactObject(parseStoredFacts(factRow.facts));

  const { data: evidenceRows, error: evidenceError } = await supabase
    .from("building_facts")
    .select("fact_key, fact_value, confidence, page, chunk_id, source_snippet")
    .eq("document_id", documentId);

  if (evidenceError) {
    throw new Error(`building_facts query failed: ${evidenceError.message}`);
  }

  const { factValues } = buildFactSources(evidenceRows ?? []);

  const merged = compactObject({
    ...factValues,
    ...storedFacts,
  });

  return enrichFacts(merged);
}

async function main() {
  const documentId = process.argv[2]?.trim();

  if (!documentId) {
    throw new Error(
      "Usage: npx tsx scripts/audit-missing-facts.ts <document_id>"
    );
  }

  const facts = await loadFactsForDocument(documentId);
  const results = evaluateAll(riskRules, facts);

  const unknownRules = results.filter((r) => r.status === "UNKNOWN");
  const passRules = results.filter((r) => r.status === "PASS");
  const failRules = results.filter((r) => r.status === "FAIL");

  const missingFactCounts = new Map<string, number>();
  const rulesByMissingFact = new Map<string, string[]>();

  for (const rule of unknownRules) {
    const missing = parseMissingFacts(rule.reason);

    for (const fact of missing) {
      missingFactCounts.set(fact, (missingFactCounts.get(fact) ?? 0) + 1);

      const current = rulesByMissingFact.get(fact) ?? [];
      current.push(rule.ruleId);
      rulesByMissingFact.set(fact, current);
    }
  }

  const leaderboard = [...missingFactCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([fact, count]) => ({
      fact,
      count,
      sampleRuleIds: [...new Set(rulesByMissingFact.get(fact) ?? [])].slice(
        0,
        5
      ),
    }));

  const presentFactKeys = Object.keys(facts).sort();

  console.log("\n=== FACT AUDIT ===");
  console.log(`document_id: ${documentId}`);
  console.log(`facts present: ${presentFactKeys.length}`);
  console.log(`rules total: ${results.length}`);
  console.log(`PASS: ${passRules.length}`);
  console.log(`FAIL: ${failRules.length}`);
  console.log(`UNKNOWN: ${unknownRules.length}`);

  console.log("\n=== PRESENT FACT KEYS ===");
  console.log(presentFactKeys.join(", "));

  console.log("\n=== TOP MISSING FACTS ===");
  if (leaderboard.length === 0) {
    console.log("No missing-fact reasons found.");
  } else {
    leaderboard.slice(0, 20).forEach((row, idx) => {
      console.log(
        `${idx + 1}. ${row.fact} — ${row.count} UNKNOWN rules` +
          (row.sampleRuleIds.length
            ? ` | sample rules: ${row.sampleRuleIds.join(", ")}`
            : "")
      );
    });
  }

  console.log("\n=== SAMPLE UNKNOWN RULES ===");
  unknownRules.slice(0, 20).forEach((r, idx) => {
    console.log(`${idx + 1}. ${r.ruleId} | ${r.reason}`);
  });
}

main().catch((err) => {
  console.error("\nERROR:", err.message);
  process.exit(1);
});