import { encodeAbiParameters, keccak256, stringToHex, type Hex } from "viem";

import { digestToField } from "./field.js";
import { requireNonzeroBytes32, requireRecord, requireVersionOne } from "./fixed-width.js";

export const APPLICATION_REGISTRATION_V1_DOMAIN_TEXT = "agentvisa.application-registration.v1";
export const APPLICATION_REGISTRATION_V1_DOMAIN = keccak256(
  stringToHex(APPLICATION_REGISTRATION_V1_DOMAIN_TEXT),
);
export const APPLICATION_ACCOUNT_V1_DOMAIN_TEXT = "agentvisa.application-account.v1";
export const APPLICATION_ACCOUNT_V1_DOMAIN = keccak256(
  stringToHex(APPLICATION_ACCOUNT_V1_DOMAIN_TEXT),
);

export interface ApplicationRegistrationV1 {
  readonly version: 1;
  readonly stableApplicationId: Hex;
  readonly loginPublicKey: Hex;
}

export interface ApplicationRegistrationFieldsV1 {
  readonly scopeDigest: Hex;
  readonly scope: bigint;
  readonly messageDigest: Hex;
  readonly message: bigint;
}

export function parseApplicationRegistrationV1(input: unknown): ApplicationRegistrationV1 {
  const value = requireRecord(input, "Application Registration");

  return {
    version: requireVersionOne(value.version, "Application Registration"),
    stableApplicationId: requireNonzeroBytes32(value.stableApplicationId, "stableApplicationId"),
    loginPublicKey: requireNonzeroBytes32(value.loginPublicKey, "loginPublicKey"),
  };
}

export function deriveApplicationRegistrationV1(
  input: ApplicationRegistrationV1,
): ApplicationRegistrationFieldsV1 {
  const registration = parseApplicationRegistrationV1(input);
  const scopeDigest = keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "bytes32" }],
      [APPLICATION_REGISTRATION_V1_DOMAIN, registration.stableApplicationId],
    ),
  );
  const messageDigest = keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "bytes32" }, { type: "bytes32" }],
      [
        APPLICATION_ACCOUNT_V1_DOMAIN,
        registration.stableApplicationId,
        registration.loginPublicKey,
      ],
    ),
  );

  return {
    scopeDigest,
    scope: digestToField(scopeDigest),
    messageDigest,
    message: digestToField(messageDigest),
  };
}
