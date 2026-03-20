import fs from "node:fs";
import path from "node:path";

type RiskRuleRow = {
  ruleId: string;
  title?: string;
  part?: string;
  volume?: number | null;
  evaluationType?: string;
  references: string[];
};

type CoverageRow = {
  ruleId: string;
  title: string;
  part: string;
  volume: number | "";
  evaluationType: string;
  implementedInRiskRules: boolean;
  implementedInRuleLogic: boolean;
  status: "implemented" | "metadata-only" | "logic-only";
  references: string;
  isVol2: boolean;
};

function readText(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

function writeText(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function csvEscape(value: unknown): string {
  const s = String(value ?? "");
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

/**
 * Extract object blocks from riskRules.ts by locating each ruleId and then
 * capturing the surrounding top-level object with brace counting.
 */
function extractRulesFromRiskRulesTS(source: string): RiskRuleRow[] {
  const rules: RiskRuleRow[] = [];
  const ruleIdRegex = /ruleId\s*:\s*"([^"]+)"/g;

  for (const match of source.matchAll(ruleIdRegex)) {
    const ruleId = match[1]?.trim();
    const matchIndex = match.index ?? -1;
    if (!ruleId || matchIndex < 0) continue;

    // Find the object start by walking backward to nearest "{"
    let start = matchIndex;
    while (start >= 0 && source[start] !== "{") start--;
    if (start < 0) continue;

    // Capture full object with brace counting
    let depth = 0;
    let end = -1;
    let inString = false;
    let escaped = false;

    for (let i = start; i < source.length; i++) {
      const ch = source[i];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (ch === "\\") {
          escaped = true;
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }

      if (ch === '"') {
        inString = true;
        continue;
      }

      if (ch === "{") depth++;
      if (ch === "}") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }

    if (end < 0) continue;

    const block = source.slice(start, end + 1);

    const title = block.match(/title\s*:\s*"([^"]+)"/)?.[1];
    const part = block.match(/part\s*:\s*"([^"]+)"/)?.[1];
    const evaluationType = block.match(/evaluationType\s*:\s*"([^"]+)"/)?.[1];

    const volumeRaw =
      block.match(/volume\s*:\s*(\d+)/)?.[1] ??
      block.match(/volume\s*:\s*"(\d+)"/)?.[1] ??
      null;

    const volume = volumeRaw ? Number(volumeRaw) : null;

    const references = uniqueStrings(
      Array.from(block.matchAll(/ref\s*:\s*"([^"]+)"/g)).map((m) => m[1])
    );

    rules.push({
      ruleId,
      title,
      part,
      volume,
      evaluationType,
      references,
    });
  }

  // Deduplicate by ruleId just in case
  const deduped = new Map<string, RiskRuleRow>();
  for (const rule of rules) {
    deduped.set(rule.ruleId, rule);
  }

  return Array.from(deduped.values()).sort((a, b) =>
    a.ruleId.localeCompare(b.ruleId)
  );
}

function extractRuleLogicKeys(source: string): Set<string> {
  const keys = new Set<string>();

  const patterns = [
    /"([A-Z0-9_-]+)"\s*:\s*\(/g,
    /"([A-Z0-9_-]+)"\s*:\s*function\s*\(/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      keys.add(match[1]);
    }
  }

  return keys;
}

function isVol2Rule(rule: RiskRuleRow): boolean {
  if (rule.volume === 2) return true;
  return rule.references.some((ref) => /Vol\s*2|Volume\s*2/i.test(ref));
}

function buildCoverageRows(
  rules: RiskRuleRow[],
  logicKeys: Set<string>
): CoverageRow[] {
  const ruleIdsFromMetadata = new Set(rules.map((r) => r.ruleId));
  const allIds = Array.from(
    new Set([...ruleIdsFromMetadata, ...Array.from(logicKeys)])
  ).sort();

  return allIds.map((ruleId) => {
    const rule = rules.find((r) => r.ruleId === ruleId);

    const inRiskRules = ruleIdsFromMetadata.has(ruleId);
    const inRuleLogic = logicKeys.has(ruleId);

    let status: CoverageRow["status"];
    if (inRiskRules && inRuleLogic) status = "implemented";
    else if (inRiskRules) status = "metadata-only";
    else status = "logic-only";

    const vol2 = rule ? isVol2Rule(rule) : false;

    return {
      ruleId,
      title: rule?.title ?? "",
      part: rule?.part ?? "",
      volume: rule?.volume ?? "",
      evaluationType: rule?.evaluationType ?? "",
      implementedInRiskRules: inRiskRules,
      implementedInRuleLogic: inRuleLogic,
      status,
      references: (rule?.references ?? []).join(" | "),
      isVol2: vol2,
    };
  });
}

function summarizeByPart(rows: CoverageRow[]) {
  const summary: Record<
    string,
    { total: number; implemented: number; metadataOnly: number; logicOnly: number }
  > = {};

  for (const row of rows) {
    const key = row.part || "UNKNOWN";
    if (!summary[key]) {
      summary[key] = {
        total: 0,
        implemented: 0,
        metadataOnly: 0,
        logicOnly: 0,
      };
    }

    summary[key].total += 1;
    if (row.status === "implemented") summary[key].implemented += 1;
    if (row.status === "metadata-only") summary[key].metadataOnly += 1;
    if (row.status === "logic-only") summary[key].logicOnly += 1;
  }

  return summary;
}

function toCsv(rows: CoverageRow[]): string {
  const headers: (keyof CoverageRow)[] = [
    "ruleId",
    "title",
    "part",
    "volume",
    "evaluationType",
    "implementedInRiskRules",
    "implementedInRuleLogic",
    "status",
    "references",
    "isVol2",
  ];

  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((h) => csvEscape(row[h])).join(",")
    ),
  ];

  return lines.join("\n");
}

function main() {
  const root = process.cwd();

  const riskRulesPath = path.join(root, "lib", "riskRules.ts");
  const ruleLogicPath = path.join(root, "lib", "ruleLogic.ts");

  if (!fs.existsSync(riskRulesPath)) {
    throw new Error(`Missing file: ${riskRulesPath}`);
  }
  if (!fs.existsSync(ruleLogicPath)) {
    throw new Error(`Missing file: ${ruleLogicPath}`);
  }

  const riskRulesSrc = readText(riskRulesPath);
  const ruleLogicSrc = readText(ruleLogicPath);

  const rules = extractRulesFromRiskRulesTS(riskRulesSrc);
  const logicKeys = extractRuleLogicKeys(ruleLogicSrc);

  const allRows = buildCoverageRows(rules, logicKeys);
  const vol2Rows = allRows.filter((r) => r.isVol2);

  const allSummary = summarizeByPart(allRows);
  const vol2Summary = summarizeByPart(vol2Rows);

  const artifactsDir = path.join(root, "artifacts");
  fs.mkdirSync(artifactsDir, { recursive: true });

  const allJsonPath = path.join(artifactsDir, "coverage-matrix-all.json");
  const allCsvPath = path.join(artifactsDir, "coverage-matrix-all.csv");
  const vol2JsonPath = path.join(artifactsDir, "coverage-matrix-vol2.json");
  const vol2CsvPath = path.join(artifactsDir, "coverage-matrix-vol2.csv");
  const summaryJsonPath = path.join(artifactsDir, "coverage-summary.json");

  writeText(
    allJsonPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalRules: allRows.length,
        summaryByPart: allSummary,
        rows: allRows,
      },
      null,
      2
    )
  );

  writeText(allCsvPath, toCsv(allRows));

  writeText(
    vol2JsonPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalRules: vol2Rows.length,
        summaryByPart: vol2Summary,
        rows: vol2Rows,
      },
      null,
      2
    )
  );

  writeText(vol2CsvPath, toCsv(vol2Rows));

  writeText(
    summaryJsonPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        all: {
          total: allRows.length,
          implemented: allRows.filter((r) => r.status === "implemented").length,
          metadataOnly: allRows.filter((r) => r.status === "metadata-only").length,
          logicOnly: allRows.filter((r) => r.status === "logic-only").length,
          summaryByPart: allSummary,
        },
        vol2: {
          total: vol2Rows.length,
          implemented: vol2Rows.filter((r) => r.status === "implemented").length,
          metadataOnly: vol2Rows.filter((r) => r.status === "metadata-only").length,
          logicOnly: vol2Rows.filter((r) => r.status === "logic-only").length,
          summaryByPart: vol2Summary,
        },
      },
      null,
      2
    )
  );

  console.log("COVERAGE MATRIX GENERATED");
  console.log(
    JSON.stringify(
      {
        all: {
          total: allRows.length,
          implemented: allRows.filter((r) => r.status === "implemented").length,
          metadataOnly: allRows.filter((r) => r.status === "metadata-only").length,
          logicOnly: allRows.filter((r) => r.status === "logic-only").length,
        },
        vol2: {
          total: vol2Rows.length,
          implemented: vol2Rows.filter((r) => r.status === "implemented").length,
          metadataOnly: vol2Rows.filter((r) => r.status === "metadata-only").length,
          logicOnly: vol2Rows.filter((r) => r.status === "logic-only").length,
        },
        files: {
          allJsonPath,
          allCsvPath,
          vol2JsonPath,
          vol2CsvPath,
          summaryJsonPath,
        },
      },
      null,
      2
    )
  );
}

main();