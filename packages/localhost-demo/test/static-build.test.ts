import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const publicRoot = resolve(packageRoot, "dist/public");

describe("static demo build output", () => {
  it("ships index.html, client bundle, and snark artifacts", () => {
    expect(existsSync(resolve(publicRoot, "index.html"))).toBe(true);
    expect(existsSync(resolve(publicRoot, "client.js"))).toBe(true);
    expect(existsSync(resolve(publicRoot, "semaphore-1.wasm"))).toBe(true);
    expect(existsSync(resolve(publicRoot, "semaphore-1.zkey"))).toBe(true);

    const html = readFileSync(resolve(publicRoot, "index.html"), "utf8");
    expect(html).toContain("Get credential");
    expect(html).toContain("Join Robot Rally");
    expect(html).toContain("Sybil check");
    expect(html).toContain("Start over");
    expect(html).not.toContain("Claim on Arbitrum");

    const client = readFileSync(resolve(publicRoot, "client.js"), "utf8");
    expect(client.length).toBeGreaterThan(1_000);
  });

  it("does not JSON.parse the esbuild-inlined admission deployment", () => {
    const source = readFileSync(resolve(packageRoot, "src/static-client.ts"), "utf8");
    expect(source).not.toMatch(/JSON\.parse\(__ADMISSION_DEPLOYMENT__\)/);
  });
});
