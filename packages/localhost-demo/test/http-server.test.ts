import type { AddressInfo } from "node:net";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DemoApplication, createDemoHttpServer } from "../src/index.js";

describe("localhost demo HTTP boundary", () => {
  let directory: string;
  let application: DemoApplication;
  let server: ReturnType<typeof createDemoHttpServer>;
  let origin: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "agentvisa-http-demo-"));
    application = new DemoApplication({
      dataDirectory: directory,
      currentTime: () => 1_750_000_000n,
      proofVerifier: () => Promise.resolve(true),
    });
    server = createDemoHttpServer(application);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;
    origin = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error === undefined ? resolve() : reject(error))),
    );
    application.close();
    await rm(directory, { recursive: true, force: true });
  });

  it.each(["/enroll", "/games/robot-rally", "/operator/robot-rally", "/audit"])(
    "serves the thin %s page with synthetic trust and privacy labels",
    async (path) => {
      const response = await fetch(`${origin}${path}`);
      const html = await response.text();

      expect(response.status).toBe(200);
      expect(html).toContain("Synthetic demo");
      expect(html).toContain("identity off-chain");
      expect(html).toContain("Arbitrum Sepolia");
      expect(html).toContain("Trusted component");
      expect(html).toContain("Privacy");
      expect(html).toContain("On-chain reward");
      expect(html).toContain("Does not prove");
      expect(html).not.toMatch(/0x[0-9a-f]{64}/i);
    },
  );

  it("returns deterministic JSON projections and never reflects sensitive request fields", async () => {
    const first = await post("/api/enroll", {
      semaphoreIdentityCommitment: "123",
    });
    const retry = await post("/api/enroll", {
      semaphoreIdentityCommitment: "123",
    });
    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    expect(await retry.json()).toMatchObject({ status: "existing" });

    const malformed = await fetch(`${origin}/api/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        identitySecret: "must-never-be-reflected",
        rawProof: "must-never-be-reflected",
      }),
    });
    const malformedBody = await malformed.text();
    expect(malformed.status).toBe(400);
    expect(malformedBody).not.toContain("must-never-be-reflected");
    expect(malformedBody).not.toMatch(/identitySecret|rawProof/i);

    const audit = await fetch(`${origin}/api/audit`);
    expect(await audit.text()).not.toMatch(
      /identity|commitment|nullifier|proof|enrollment|subject|session-token/i,
    );
  });

  it("starts from the built server entrypoint on native Windows", async () => {
    const dataDirectory = await mkdtemp(join(tmpdir(), "agentvisa-startup-demo-"));
    const serverPath = fileURLToPath(new URL("../dist/server.js", import.meta.url));
    const child = spawn(process.execPath, [serverPath], {
      cwd: fileURLToPath(new URL("..", import.meta.url)),
      env: {
        ...process.env,
        AGENTVISA_DEMO_PORT: "0",
        AGENTVISA_DEMO_DATA_DIR: dataDirectory,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    try {
      const startupLine = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("demo server did not start")), 15_000);
        child.stdout?.on("data", (chunk: Buffer) => {
          const line = chunk.toString("utf8");
          if (line.includes("http://127.0.0.1:")) {
            clearTimeout(timeout);
            resolve(line.trim());
          }
        });
        child.on("exit", (code) => {
          clearTimeout(timeout);
          reject(new Error(`demo server exited early with code ${code ?? "unknown"}`));
        });
      });
      const origin = /http:\/\/127\.0\.0\.1:\d+\/enroll/
        .exec(startupLine)?.[0]
        ?.replace(/\/enroll$/, "");
      expect(origin).toBeTypeOf("string");
      const response = await fetch(`${origin}/enroll`);
      expect(response.status).toBe(200);
      expect(await response.text()).toContain("Synthetic demo");
    } finally {
      child.kill();
      await new Promise<void>((resolve) => child.once("exit", () => resolve()));
      await rm(dataDirectory, { recursive: true, force: true });
    }
  });

  function post(path: string, body: unknown): Promise<Response> {
    return fetch(`${origin}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }
});
