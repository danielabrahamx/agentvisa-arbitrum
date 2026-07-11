import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Loads KEY=VALUE pairs from a dotenv file without adding a dependency.
 * Existing process.env values win.
 */
export function loadDotenv(filePath: string): void {
  if (!existsSync(filePath)) {
    return;
  }

  for (const rawLine of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith("#")) {
      continue;
    }

    const separator = line.indexOf("=");
    if (separator <= 0) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] ??= value;
  }
}

export function loadWorkspaceDotenv(): void {
  const contractsRoot = resolve(import.meta.dirname, "..");
  const workspaceRoot = resolve(contractsRoot, "../..");
  loadDotenv(resolve(workspaceRoot, ".env"));
  loadDotenv(resolve(contractsRoot, ".env"));
}
