import { describe, expect, it } from "vitest";

import {
  digestToField,
  hashMandateV1,
  hashScopeV1,
  type MandateV1,
  type ScopeV1,
} from "../src/index.js";
import boundaryVector from "../vectors/mandate-v1-boundary.json" with { type: "json" };
import vector from "../vectors/mandate-v1.json" with { type: "json" };

function mandateFromVector(input: typeof vector.mandate): MandateV1 {
  return {
    version: input.version as 1,
    chainId: BigInt(input.chainId),
    account: input.account as MandateV1["account"],
    authorization: input.authorization as MandateV1["authorization"],
    groupId: BigInt(input.groupId),
    permissionDigest: input.permissionDigest as MandateV1["permissionDigest"],
    sessionKey: input.sessionKey as MandateV1["sessionKey"],
    validAfter: BigInt(input.validAfter),
    validUntil: BigInt(input.validUntil),
    authorizationId: input.authorizationId as MandateV1["authorizationId"],
  };
}

const mandate = mandateFromVector(vector.mandate);

const scope: ScopeV1 = {
  version: mandate.version,
  chainId: mandate.chainId,
  account: mandate.account,
  authorization: mandate.authorization,
  groupId: mandate.groupId,
  permissionDigest: mandate.permissionDigest,
  authorizationId: mandate.authorizationId,
};

void describe("MandateV1", () => {
  void it("matches the published normal-case digest", () => {
    expect(hashMandateV1(mandate)).toBe(vector.expected.mandateDigest);
  });

  void it("binds the exact Permission Digest", () => {
    expect(
      hashMandateV1({
        ...mandate,
        permissionDigest: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      }),
    ).not.toBe(hashMandateV1(mandate));
  });

  void it("matches the separately domain-separated Scope digest", () => {
    expect(hashScopeV1(scope)).toBe(vector.expected.scopeDigest);
  });

  void it("maps the Mandate Digest into the BN254 scalar field", () => {
    expect(digestToField(hashMandateV1(mandate))).toBe(BigInt(vector.expected.mandateField));
  });

  void it("maps the Scope digest into the BN254 scalar field", () => {
    expect(digestToField(hashScopeV1(scope))).toBe(BigInt(vector.expected.scopeField));
  });

  void it("matches the published boundary vector", () => {
    const boundaryMandate = mandateFromVector(boundaryVector.mandate);
    const boundaryScope: ScopeV1 = {
      version: boundaryMandate.version,
      chainId: boundaryMandate.chainId,
      account: boundaryMandate.account,
      authorization: boundaryMandate.authorization,
      groupId: boundaryMandate.groupId,
      permissionDigest: boundaryMandate.permissionDigest,
      authorizationId: boundaryMandate.authorizationId,
    };

    expect(hashMandateV1(boundaryMandate)).toBe(boundaryVector.expected.mandateDigest);
    expect(digestToField(hashMandateV1(boundaryMandate))).toBe(
      BigInt(boundaryVector.expected.mandateField),
    );
    expect(hashScopeV1(boundaryScope)).toBe(boundaryVector.expected.scopeDigest);
    expect(digestToField(hashScopeV1(boundaryScope))).toBe(
      BigInt(boundaryVector.expected.scopeField),
    );
  });

  void it("reduces the maximum bytes32 value modulo the scalar field", () => {
    expect(digestToField(`0x${"f".repeat(64)}`)).toBe(
      6350874878119819312338956282401532410528162663560392320966563075034087161850n,
    );
  });

  void it("rejects malformed digests at the public boundary", () => {
    expect(() => digestToField("0x01")).toThrow("digest must be exactly 32 bytes");
  });

  void it("rejects unsupported Mandate versions at runtime", () => {
    expect(() => hashMandateV1({ ...mandate, version: 2 as 1 })).toThrow(
      "unsupported Mandate version",
    );
  });

  void it("rejects unsupported Scope versions at runtime", () => {
    expect(() => hashScopeV1({ ...scope, version: 2 as 1 })).toThrow("unsupported Scope version");
  });

  void it("rejects values outside uint48", () => {
    expect(() => hashMandateV1({ ...mandate, validUntil: 1n << 48n })).toThrow(
      "validUntil must fit uint48",
    );
  });

  void it("rejects malformed Permission Digests", () => {
    expect(() => hashMandateV1({ ...mandate, permissionDigest: "0x01" })).toThrow();
  });
});
