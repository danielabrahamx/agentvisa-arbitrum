import { fileURLToPath } from "node:url";

import { deriveApplicationRegistrationV1 } from "@agentvisa/policy";
import { Group } from "@semaphore-protocol/group";
import { Identity } from "@semaphore-protocol/identity";
import { describe, expect, it } from "vitest";
import { keccak256, stringToHex } from "viem";

import {
  createEnrollmentCommitmentRequest,
  generateBrowserRegistrationProof,
  loadOrCreateBrowserLoginKey,
  loadOrCreateBrowserSemaphoreIdentity,
  signBrowserLoginChallenge,
  type BrowserIdentityStorage,
} from "../src/index.js";

class MemoryBrowserStorage implements BrowserIdentityStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("browser-only Semaphore identity", () => {
  it("creates and reloads a standard Semaphore v4 identity from browser-owned storage", () => {
    const storage = new MemoryBrowserStorage();

    const created = loadOrCreateBrowserSemaphoreIdentity(storage);
    const reloaded = loadOrCreateBrowserSemaphoreIdentity(storage);

    expect(created.commitment).toBeGreaterThan(0n);
    expect(reloaded).toEqual(created);
    expect(storage.values.size).toBe(1);
    const storedSecret = [...storage.values.values()][0];
    expect(storedSecret).toBeTypeOf("string");
    expect(Identity.import(storedSecret!).commitment).toBe(created.commitment);
  });

  it("exposes only the commitment to enrollment serialization", () => {
    const storage = new MemoryBrowserStorage();
    const identity = loadOrCreateBrowserSemaphoreIdentity(storage);
    const request = createEnrollmentCommitmentRequest(identity);
    const serialized = JSON.stringify(request, (_key, value: unknown) =>
      typeof value === "bigint" ? value.toString() : value,
    );
    const storedSecret = [...storage.values.values()][0];

    expect(Object.keys(identity)).toEqual(["commitment"]);
    expect(Object.keys(request)).toEqual(["semaphoreIdentityCommitment"]);
    expect(serialized).toContain(identity.commitment.toString());
    expect(serialized).not.toContain(storedSecret!);
  });

  it("fails closed when browser storage contains an invalid identity secret", () => {
    const storage = new MemoryBrowserStorage();
    storage.setItem("agentvisa.semaphore-identity.v1", "not-a-valid-export");

    expect(() => loadOrCreateBrowserSemaphoreIdentity(storage)).toThrow(
      "stored Semaphore identity is invalid",
    );
  });

  it("generates a standard registration proof without exposing the identity secret", async () => {
    const storage = new MemoryBrowserStorage();
    const identity = loadOrCreateBrowserSemaphoreIdentity(storage);
    const loginPublicKey = keccak256(stringToHex("browser-login-key"));
    const registration = {
      version: 1 as const,
      stableApplicationId: keccak256(stringToHex("robot-rally")),
      loginPublicKey,
    };
    const fields = deriveApplicationRegistrationV1(registration);
    const group = new Group([identity.commitment]);
    const proof = await generateBrowserRegistrationProof(
      storage,
      { members: group.members, root: group.root, size: group.size },
      registration,
      {
        wasm: fileURLToPath(import.meta.resolve("@zk-kit/semaphore-artifacts/semaphore-1.wasm")),
        zkey: fileURLToPath(import.meta.resolve("@zk-kit/semaphore-artifacts/semaphore-1.zkey")),
      },
    );
    const storedSecret = [...storage.values.values()][0]!;

    expect(proof.message).toBe(fields.message.toString());
    expect(proof.scope).toBe(fields.scope.toString());
    expect(JSON.stringify(proof)).not.toContain(storedSecret);
  }, 30_000);

  it("persists a WebCrypto Login Key and signs a server challenge without exposing it", async () => {
    const storage = new MemoryBrowserStorage();
    const first = await loadOrCreateBrowserLoginKey(storage);
    const second = await loadOrCreateBrowserLoginKey(storage);
    const authentication = await signBrowserLoginChallenge(storage, "synthetic-challenge");

    expect(first).toEqual(second);
    expect(first.loginPublicKey).toMatch(/^0x[0-9a-f]{64}$/);
    expect(authentication).toMatchObject({
      challenge: "synthetic-challenge",
      loginPublicKey: first.loginPublicKey,
    });
    expect(authentication.publicKeySpki).toBeTypeOf("string");
    expect(authentication.signature).toBeTypeOf("string");
    expect(JSON.stringify({ first, authentication })).not.toContain('"d":');
  });
});
