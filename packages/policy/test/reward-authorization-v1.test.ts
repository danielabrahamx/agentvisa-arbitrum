import { describe, expect, it } from "vitest";

import {
  REWARD_AUTHORIZATION_V1_NAME,
  REWARD_AUTHORIZATION_V1_TYPEHASH,
  REWARD_AUTHORIZATION_V1_VERSION,
  hashRewardAuthorizationV1,
  parseRewardAuthorizationV1,
  type RewardAuthorizationDomainV1,
  type RewardAuthorizationV1,
} from "../src/index.js";
import boundaryVector from "../vectors/reward-authorization-v1-boundary.json" with { type: "json" };
import malformedVectors from "../vectors/reward-authorization-v1-malformed.json" with { type: "json" };
import vector from "../vectors/reward-authorization-v1.json" with { type: "json" };

function authorizationFromVector(
  input: typeof vector.authorization | typeof boundaryVector.authorization,
): RewardAuthorizationV1 {
  return {
    version: input.version as 1,
    stableApplicationId: input.stableApplicationId as RewardAuthorizationV1["stableApplicationId"],
    resultId: input.resultId as RewardAuthorizationV1["resultId"],
    claimId: input.claimId as RewardAuthorizationV1["claimId"],
    recipient: input.recipient as RewardAuthorizationV1["recipient"],
    amount: BigInt(input.amount),
    expiresAt: BigInt(input.expiresAt),
  };
}

function domainFromVector(
  input: typeof vector.domain | typeof boundaryVector.domain,
): RewardAuthorizationDomainV1 {
  return {
    chainId: BigInt(input.chainId),
    verifyingContract: input.verifyingContract as RewardAuthorizationDomainV1["verifyingContract"],
  };
}

const authorization = authorizationFromVector(vector.authorization);
const domain = domainFromVector(vector.domain);

describe("Reward Authorization V1", () => {
  it("matches the published typehash and normal EIP-712 signing digest", () => {
    expect(REWARD_AUTHORIZATION_V1_NAME).toBe("agentvisa.reward-authorization.v1");
    expect(REWARD_AUTHORIZATION_V1_VERSION).toBe("1");
    expect(REWARD_AUTHORIZATION_V1_TYPEHASH).toBe(vector.expected.typehash);
    expect(hashRewardAuthorizationV1(authorization, domain)).toBe(vector.expected.signingDigest);
  });

  it("matches the published uint boundary vector", () => {
    expect(
      hashRewardAuthorizationV1(
        authorizationFromVector(boundaryVector.authorization),
        domainFromVector(boundaryVector.domain),
      ),
    ).toBe(boundaryVector.expected.signingDigest);
  });

  it.each([
    ["stableApplicationId", { stableApplicationId: `0x${"a".repeat(64)}` }],
    ["resultId", { resultId: `0x${"a".repeat(64)}` }],
    ["claimId", { claimId: `0x${"a".repeat(64)}` }],
    ["recipient", { recipient: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }],
    ["amount", { amount: authorization.amount + 1n }],
    ["expiresAt", { expiresAt: authorization.expiresAt + 1n }],
  ] as const)("binds %s", (_field, change) => {
    expect(hashRewardAuthorizationV1({ ...authorization, ...change }, domain)).not.toBe(
      vector.expected.signingDigest,
    );
  });

  it.each([
    ["chainId", { chainId: domain.chainId + 1n }],
    ["verifyingContract", { verifyingContract: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }],
  ] as const)("binds domain %s", (_field, change) => {
    expect(hashRewardAuthorizationV1(authorization, { ...domain, ...change })).not.toBe(
      vector.expected.signingDigest,
    );
  });

  it("rejects unsupported versions", () => {
    expect(() => hashRewardAuthorizationV1({ ...authorization, version: 2 as 1 }, domain)).toThrow(
      "unsupported Reward Authorization version",
    );
  });

  it.each(malformedVectors.cases)("rejects malformed vector $name", ({ field, value, error }) => {
    const input: Record<string, unknown> = {
      ...vector.authorization,
      amount: BigInt(vector.authorization.amount),
      expiresAt: BigInt(vector.authorization.expiresAt),
    };
    if (field === "amount" || field === "expiresAt") {
      input[field] = BigInt(String(value));
    } else {
      input[field] = value;
    }

    expect(() => parseRewardAuthorizationV1(input)).toThrow(error);
  });

  it("does not include identity or proof fields", () => {
    expect(authorization).not.toHaveProperty("nullifier");
    expect(authorization).not.toHaveProperty("identityCommitment");
    expect(authorization).not.toHaveProperty("proof");
    expect(authorization).not.toHaveProperty("opaqueSubjectDigest");
  });
});
