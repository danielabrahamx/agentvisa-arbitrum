import { deriveApplicationRegistrationV1, type ApplicationRegistrationV1 } from "@agentvisa/policy";
import { keccak256, stringToHex, type Hex } from "viem";

import type { ApplicationRegistrationRequest, RegistrationProof } from "../src/index.js";

export const STABLE_APPLICATION_ID = keccak256(stringToHex("robot-rally"));
export const OTHER_APPLICATION_ID = keccak256(stringToHex("other-game"));
export const GROUP_ID = keccak256(stringToHex("agentvisa-credential-group"));
export const LOGIN_PUBLIC_KEY = keccak256(stringToHex("login-key"));
export const OTHER_LOGIN_PUBLIC_KEY = keccak256(stringToHex("other-login-key"));
export const CURRENT_ROOT = 12345n;
export const HISTORICAL_ROOT = 12344n;
export const REGISTRATION_NULLIFIER = 67890n;

export function createRegistration(
  change: Partial<ApplicationRegistrationV1> = {},
): ApplicationRegistrationV1 {
  return {
    version: 1,
    stableApplicationId: STABLE_APPLICATION_ID,
    loginPublicKey: LOGIN_PUBLIC_KEY,
    ...change,
  };
}

export function createProof(
  registration = createRegistration(),
  change: Partial<RegistrationProof> = {},
): RegistrationProof {
  const fields = deriveApplicationRegistrationV1(registration);
  return {
    merkleTreeDepth: 1,
    merkleTreeRoot: CURRENT_ROOT,
    nullifier: REGISTRATION_NULLIFIER,
    message: fields.message,
    scope: fields.scope,
    points: [1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n],
    ...change,
  };
}

export function createRequest(
  registration = createRegistration(),
  proof = createProof(registration),
  groupId: Hex = GROUP_ID,
): ApplicationRegistrationRequest {
  return { registration, groupId, proof };
}
