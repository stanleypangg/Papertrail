/**
 * Hardcoded fallback defaults so the demo runs without any .env.local file.
 * In production these should come from real environment variables.
 */
const DEMO_DEFAULTS: Record<string, string> = {
  SLEUTH_MODEL_PROSE: "gemini-2.0-flash",
  SLEUTH_MODEL_FAST: "gemini-2.0-flash",
  SLEUTH_SECRET: "demo-secret",
  BACKBOARD_API_KEY: "",
  OPENAI_API_KEY: "",
  WLT_API_KEY: "",
  SLEUTH_WORLD_PROVIDER: "mock",
};

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (value && value.length > 0) {
    return value;
  }

  const fallback = DEMO_DEFAULTS[name];
  if (fallback !== undefined) {
    return fallback;
  }

  throw new Error(`Missing required env var: ${name}. Set it in .env.local.`);
}
