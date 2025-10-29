/**
 * Centralized feature flags for the application.
 * Server-only: reads from process.env and returns typed flags.
 */

export type FeatureFlags = {
  /**
   * When true, once a seller reaches Results, they cannot go back
   * and server actions enforce completion.
   */
  lockResultsNav: boolean;
};

function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (value == null) return defaultValue;
  const v = value.trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return defaultValue;
}

export function getServerFeatureFlags(): FeatureFlags {
  return {
    // Default ON for safety. Toggle via env: LOCK_RESULTS_NAV=false
    lockResultsNav: parseBooleanEnv(process.env.LOCK_RESULTS_NAV, true),
  };
}

