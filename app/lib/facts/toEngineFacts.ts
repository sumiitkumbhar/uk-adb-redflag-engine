import type { FactGraph, FactValue } from "./types";
import { resolveFactGraph } from "./claimResolver";

export type EngineFacts = Record<string, FactValue>;

export function toEngineFacts(graph: FactGraph): EngineFacts {
  const resolved = resolveFactGraph(graph);

  return Object.fromEntries(
    Object.entries(resolved).map(([key, item]) => [key, item.value])
  );
}