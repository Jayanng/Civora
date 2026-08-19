import { readFileSync } from "node:fs";
import path from "node:path";

export interface GmiConfig {
  key: string;
  model: string;
  baseUrl: string;
}

/**
 * Shared GMI config loader for the underwrite and monitor routes.
 * Prefers real env vars; falls back to parsing the repo-root .env only for
 * local development (serverless deploys must set GMI_API_KEY as an env var).
 */
export function loadGmiConfig(): GmiConfig {
  const key = process.env.GMI_API_KEY;
  if (key) {
    return {
      key,
      model: process.env.GMI_MODEL || "deepseek-ai/DeepSeek-V4-Flash",
      baseUrl: process.env.GMI_BASE_URL || "https://api.gmi-serving.com/v1",
    };
  }
  try {
    const raw = readFileSync(path.resolve(process.cwd(), "../../.env"), "utf8");
    const get = (name: string) => {
      const m = raw.match(new RegExp(`^${name}=(.+)$`, "m"));
      return m ? m[1].trim().replace(/^["']|["']$/g, "") : undefined;
    };
    const key2 = get("GMI_API_KEY");
    if (!key2) return { key: "", model: "", baseUrl: "" };
    return {
      key: key2,
      model: get("GMI_MODEL") || "deepseek-ai/DeepSeek-V4-Flash",
      baseUrl: get("GMI_BASE_URL") || "https://api.gmi-serving.com/v1",
    };
  } catch {
    return { key: "", model: "", baseUrl: "" };
  }
}
