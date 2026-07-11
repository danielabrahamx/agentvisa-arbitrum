import { createHash, createPublicKey, randomBytes, verify } from "node:crypto";

import type { LoginKeyAuthenticator } from "@agentvisa/application-service";
import type { Hex } from "viem";

interface PendingChallenge {
  readonly loginPublicKey: Hex;
  readonly expiresAt: bigint;
}

interface LoginAuthentication {
  readonly challenge: string;
  readonly loginPublicKey: Hex;
  readonly publicKeySpki: string;
  readonly signature: string;
}

const AUTHENTICATION_FIELDS = new Set([
  "challenge",
  "loginPublicKey",
  "publicKeySpki",
  "signature",
]);

export class BrowserLoginKeyAuthenticator implements LoginKeyAuthenticator {
  readonly #challenges = new Map<string, PendingChallenge>();

  constructor(
    readonly currentTime: () => bigint,
    readonly challengeFactory: () => string = () => randomBytes(32).toString("base64url"),
  ) {}

  createChallenge(loginPublicKey: Hex): string {
    const challenge = this.challengeFactory();
    if (challenge.length < 16 || challenge.length > 512) {
      throw new Error("Login Key challenge factory returned an invalid challenge");
    }
    this.#challenges.set(challenge, {
      loginPublicKey: loginPublicKey.toLowerCase() as Hex,
      expiresAt: this.currentTime() + 120n,
    });
    return challenge;
  }

  authenticate(loginPublicKey: Hex, input: unknown): Promise<boolean> {
    return Promise.resolve(this.#authenticate(loginPublicKey, input));
  }

  #authenticate(loginPublicKey: Hex, input: unknown): boolean {
    const authentication = parseAuthentication(input);
    if (authentication === undefined) return false;
    const pending = this.#challenges.get(authentication.challenge);
    this.#challenges.delete(authentication.challenge);
    if (
      pending === undefined ||
      pending.expiresAt < this.currentTime() ||
      !equalsHex(pending.loginPublicKey, loginPublicKey) ||
      !equalsHex(authentication.loginPublicKey, loginPublicKey)
    ) {
      return false;
    }

    try {
      const spki = decodeBase64Url(authentication.publicKeySpki);
      const derived: Hex = `0x${createHash("sha256").update(spki).digest("hex")}`;
      if (!equalsHex(derived, loginPublicKey)) return false;
      const publicKey = createPublicKey({ key: spki, format: "der", type: "spki" });
      return verify(
        "sha256",
        Buffer.from(authentication.challenge, "utf8"),
        { key: publicKey, dsaEncoding: "ieee-p1363" },
        decodeBase64Url(authentication.signature),
      );
    } catch {
      return false;
    }
  }
}

function parseAuthentication(input: unknown): LoginAuthentication | undefined {
  if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined;
  const value = input as Record<string, unknown>;
  const keys = Object.keys(value);
  if (
    keys.length !== AUTHENTICATION_FIELDS.size ||
    !keys.every((key) => AUTHENTICATION_FIELDS.has(key))
  ) {
    return undefined;
  }
  if (
    typeof value.challenge !== "string" ||
    value.challenge.length < 16 ||
    value.challenge.length > 512 ||
    typeof value.loginPublicKey !== "string" ||
    !/^0x[0-9a-fA-F]{64}$/.test(value.loginPublicKey) ||
    typeof value.publicKeySpki !== "string" ||
    value.publicKeySpki.length > 512 ||
    typeof value.signature !== "string" ||
    value.signature.length > 256
  ) {
    return undefined;
  }
  return value as unknown as LoginAuthentication;
}

function decodeBase64Url(value: string): Buffer {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("invalid base64url");
  return Buffer.from(value, "base64url");
}

function equalsHex(left: Hex, right: Hex): boolean {
  return left.toLowerCase() === right.toLowerCase();
}
