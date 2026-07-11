import { describe, expect, expectTypeOf, it } from "vitest";

import {
  APPLICATION_ACCOUNT_V1_DOMAIN,
  APPLICATION_REGISTRATION_V1_DOMAIN,
  SNARK_SCALAR_FIELD,
  deriveApplicationRegistrationV1,
  parseApplicationRegistrationV1,
  type ApplicationRegistrationV1,
} from "../src/index.js";
import boundaryVector from "../vectors/application-registration-v1-boundary.json" with { type: "json" };
import malformedVectors from "../vectors/application-registration-v1-malformed.json" with { type: "json" };
import vector from "../vectors/application-registration-v1.json" with { type: "json" };

function registrationFromVector(
  input: typeof vector.registration | typeof boundaryVector.registration,
): ApplicationRegistrationV1 {
  return {
    version: input.version as 1,
    stableApplicationId:
      input.stableApplicationId as ApplicationRegistrationV1["stableApplicationId"],
    loginPublicKey: input.loginPublicKey as ApplicationRegistrationV1["loginPublicKey"],
  };
}

const registration = registrationFromVector(vector.registration);

describe("Application Registration V1", () => {
  it("matches the published normal vector", () => {
    const result = deriveApplicationRegistrationV1(registration);

    expect(APPLICATION_REGISTRATION_V1_DOMAIN).toBe(vector.expected.scopeDomainSeparator);
    expect(APPLICATION_ACCOUNT_V1_DOMAIN).toBe(vector.expected.messageDomainSeparator);
    expect(result).toEqual({
      scopeDigest: vector.expected.scopeDigest,
      scope: BigInt(vector.expected.scopeField),
      messageDigest: vector.expected.messageDigest,
      message: BigInt(vector.expected.messageField),
    });
  });

  it("matches the published boundary vector", () => {
    const result = deriveApplicationRegistrationV1(
      registrationFromVector(boundaryVector.registration),
    );

    expect(result).toEqual({
      scopeDigest: boundaryVector.expected.scopeDigest,
      scope: BigInt(boundaryVector.expected.scopeField),
      messageDigest: boundaryVector.expected.messageDigest,
      message: BigInt(boundaryVector.expected.messageField),
    });
  });

  it("binds a changed Stable Application ID in scope and message", () => {
    const changed = deriveApplicationRegistrationV1({
      ...registration,
      stableApplicationId: `0x${"a".repeat(64)}`,
    });
    const original = deriveApplicationRegistrationV1(registration);

    expect(changed.scopeDigest).not.toBe(original.scopeDigest);
    expect(changed.messageDigest).not.toBe(original.messageDigest);
  });

  it("binds the Login Key in the message without adding it to scope", () => {
    const changed = deriveApplicationRegistrationV1({
      ...registration,
      loginPublicKey: `0x${"a".repeat(64)}`,
    });
    const original = deriveApplicationRegistrationV1(registration);

    expect(changed.scopeDigest).toBe(original.scopeDigest);
    expect(changed.messageDigest).not.toBe(original.messageDigest);
  });

  it("is deterministic and maps both digests inside the BN254 scalar field", () => {
    const first = deriveApplicationRegistrationV1(registration);
    const second = deriveApplicationRegistrationV1(registration);

    expect(first).toEqual(second);
    expect(first.scope).toBeGreaterThanOrEqual(0n);
    expect(first.scope).toBeLessThan(SNARK_SCALAR_FIELD);
    expect(first.message).toBeGreaterThanOrEqual(0n);
    expect(first.message).toBeLessThan(SNARK_SCALAR_FIELD);
  });

  it("separates scope from message and rejects unsupported versions", () => {
    expect(APPLICATION_REGISTRATION_V1_DOMAIN).not.toBe(APPLICATION_ACCOUNT_V1_DOMAIN);
    expect(() => deriveApplicationRegistrationV1({ ...registration, version: 2 as 1 })).toThrow(
      "unsupported Application Registration version",
    );
  });

  it.each(malformedVectors.cases)("rejects malformed vector $name", ({ field, value, error }) => {
    const input: Record<string, unknown> = { ...vector.registration, [field]: value };

    expect(() => parseApplicationRegistrationV1(input)).toThrow(error);
  });

  it("does not accept wallet, username, season, payout, or attempt inputs", () => {
    expectTypeOf<ApplicationRegistrationV1>().not.toHaveProperty("wallet");
    expectTypeOf<ApplicationRegistrationV1>().not.toHaveProperty("username");
    expectTypeOf<ApplicationRegistrationV1>().not.toHaveProperty("season");
    expectTypeOf<ApplicationRegistrationV1>().not.toHaveProperty("payoutAddress");
    expectTypeOf<ApplicationRegistrationV1>().not.toHaveProperty("registrationAttempt");
    expect(Object.keys(registration).sort()).toEqual([
      "loginPublicKey",
      "stableApplicationId",
      "version",
    ]);
  });
});
