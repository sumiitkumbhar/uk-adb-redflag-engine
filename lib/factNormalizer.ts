export type Facts = Record<string, unknown>;

/**
 * Normalize keys so evaluators receive consistent fact names.
 * - removes _ and -
 * - lowercases
 */
const norm = (k: string) => k.replace(/[_\-]/g, "").toLowerCase();

/**
 * Safe type coercion helpers
 */
const toBool = (v: unknown): boolean | undefined => {
  if (typeof v === "boolean") return v;

  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }

  return undefined;
};

const toNum = (v: unknown): number | undefined => {
  if (typeof v === "number" && Number.isFinite(v)) return v;

  if (typeof v === "string") {
    const n = Number(v.trim());
    if (Number.isFinite(n)) return n;
  }

  return undefined;
};

/**
 * Registry of aliases
 * If one alias exists we copy the value to all others.
 */
const FACT_ALIASES: Record<string, string[]> = {
  onEscapeRouteFlag: [
    "onEscapeRouteFlag",
    "on_escape_route_flag",
    "onescaperouteflag"
  ],

  securityLockType: [
    "securityLockType",
    "security_lock_type",
    "securitylocktype"
  ],

  evacuationStrategy: [
    "evacuationStrategy",
    "evacuation_strategy",
    "evacuationstrategy"
  ],

  fireMainsPresent: [
    "fireMainsPresent",
    "fire_mains_present",
    "fireMainPresent"
  ],

  refuseChutePresent: [
    "hasRefuseChuteOrStorageFlag",
    "has_refuse_chute_or_storage_flag",
    "refuseChutePresent"
  ],

  managedPopulationFlag: [
    "managedPopulationFlag",
    "managed_population_flag"
  ]
};

/**
 * Main normalization function
 */
export function normalizeFacts(raw: Facts): Facts {
  const normalized: Facts = {};
  const normMap: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(raw)) {
    const n = norm(key);
    normMap[n] = value;

    normalized[key] = value;

    const b = toBool(value);
    const num = toNum(value);

    if (b !== undefined) normalized[key] = b;
    if (num !== undefined) normalized[key] = num;
  }

  for (const aliasList of Object.values(FACT_ALIASES)) {
    let foundValue: unknown;

    for (const alias of aliasList) {
      const v = normMap[norm(alias)];
      if (v !== undefined) {
        foundValue = v;
        break;
      }
    }

    if (foundValue !== undefined) {
      for (const alias of aliasList) {
        normalized[alias] = foundValue;
      }
    }
  }

  return normalized;
}