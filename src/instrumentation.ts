/**
 * Next runs `register()` once at server startup. We validate the environment
 * here so a misconfigured deploy fails fast with a readable message instead of
 * crashing deep inside the first request. Node runtime only — the Edge runtime
 * (middleware) has a restricted env and its own subset of vars.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("@/lib/env");
    validateEnv();
  }
}
