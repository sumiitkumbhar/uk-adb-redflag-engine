import type { TextChunk } from "../facts/types";

export function looksTabular(text: string): boolean {
  const pipeCount = (text.match(/\|/g) ?? []).length;
  const multiSpaceColumns = /\S+\s{3,}\S+/.test(text);
  const repeatedUnits = /(\d+(\.\d+)?)\s*(mm|m|m2|m²|minutes)\b/i.test(text);

  return pipeCount >= 2 || multiSpaceColumns || repeatedUnits;
}

export function splitPseudoColumns(line: string): string[] {
  if (line.includes("|")) {
    return line
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return line
    .split(/\s{3,}/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function extractTableRows(chunk: TextChunk): string[][] {
  const lines = chunk.text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const rows: string[][] = [];

  for (const line of lines) {
    const cols = splitPseudoColumns(line);
    if (cols.length >= 2) rows.push(cols);
  }

  return rows;
}

export function findTableValue(
  rows: string[][],
  rowMatcher: RegExp,
  valueMatcher?: RegExp
): string | undefined {
  for (const row of rows) {
    const joined = row.join(" | ");
    if (!rowMatcher.test(joined)) continue;

    if (!valueMatcher) {
      return row[row.length - 1];
    }

    for (const cell of row) {
      const match = cell.match(valueMatcher);
      if (match?.[1]) return match[1];
    }
  }

  return undefined;
}

export function extractNumericFromCell(cell: string): number | undefined {
  const match = cell.match(/([\d.]+)/);
  if (!match?.[1]) return undefined;

  const n = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}