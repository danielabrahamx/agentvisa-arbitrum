import {
  hashTypedData,
  keccak256,
  stringToHex,
  type Address,
  type Hex,
  type TypedDataDefinition,
} from "viem";

import {
  requireNonzeroAddress,
  requireNonzeroBytes32,
  requireRecord,
  requireUint,
  requireVersionOne,
} from "./fixed-width.js";

export const REWARD_AUTHORIZATION_V1_NAME = "agentvisa.reward-authorization.v1";
export const REWARD_AUTHORIZATION_V1_VERSION = "1";

export const REWARD_AUTHORIZATION_V1_TYPE =
  "RewardAuthorizationV1(uint8 version,bytes32 stableApplicationId,bytes32 resultId,bytes32 claimId,address recipient,uint256 amount,uint64 expiresAt)";

export const REWARD_AUTHORIZATION_V1_TYPEHASH = keccak256(
  stringToHex(REWARD_AUTHORIZATION_V1_TYPE),
);

export const REWARD_AUTHORIZATION_V1_TYPES = {
  RewardAuthorizationV1: [
    { name: "version", type: "uint8" },
    { name: "stableApplicationId", type: "bytes32" },
    { name: "resultId", type: "bytes32" },
    { name: "claimId", type: "bytes32" },
    { name: "recipient", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "expiresAt", type: "uint64" },
  ],
} as const;

export interface RewardAuthorizationV1 {
  readonly version: 1;
  readonly stableApplicationId: Hex;
  readonly resultId: Hex;
  readonly claimId: Hex;
  readonly recipient: Address;
  readonly amount: bigint;
  readonly expiresAt: bigint;
}

export interface RewardAuthorizationDomainV1 {
  readonly chainId: bigint;
  readonly verifyingContract: Address;
}

export function parseRewardAuthorizationV1(input: unknown): RewardAuthorizationV1 {
  const value = requireRecord(input, "Reward Authorization");

  return {
    version: requireVersionOne(value.version, "Reward Authorization"),
    stableApplicationId: requireNonzeroBytes32(value.stableApplicationId, "stableApplicationId"),
    resultId: requireNonzeroBytes32(value.resultId, "resultId"),
    claimId: requireNonzeroBytes32(value.claimId, "claimId"),
    recipient: requireNonzeroAddress(value.recipient, "recipient"),
    amount: requireUint(value.amount, 256, "amount"),
    expiresAt: requireUint(value.expiresAt, 64, "expiresAt"),
  };
}

export function parseRewardAuthorizationDomainV1(input: unknown): RewardAuthorizationDomainV1 {
  const value = requireRecord(input, "Reward Authorization domain");

  return {
    chainId: requireUint(value.chainId, 256, "chainId"),
    verifyingContract: requireNonzeroAddress(value.verifyingContract, "verifyingContract"),
  };
}

export function rewardAuthorizationTypedDataV1(
  authorization: RewardAuthorizationV1,
  domain: RewardAuthorizationDomainV1,
): TypedDataDefinition<typeof REWARD_AUTHORIZATION_V1_TYPES, "RewardAuthorizationV1"> {
  const message = parseRewardAuthorizationV1(authorization);
  const eip712Domain = parseRewardAuthorizationDomainV1(domain);

  return {
    domain: {
      name: REWARD_AUTHORIZATION_V1_NAME,
      version: REWARD_AUTHORIZATION_V1_VERSION,
      chainId: eip712Domain.chainId,
      verifyingContract: eip712Domain.verifyingContract,
    },
    types: REWARD_AUTHORIZATION_V1_TYPES,
    primaryType: "RewardAuthorizationV1",
    message: {
      version: message.version,
      stableApplicationId: message.stableApplicationId,
      resultId: message.resultId,
      claimId: message.claimId,
      recipient: message.recipient,
      amount: message.amount,
      expiresAt: message.expiresAt,
    },
  };
}

export function hashRewardAuthorizationV1(
  authorization: RewardAuthorizationV1,
  domain: RewardAuthorizationDomainV1,
): Hex {
  return hashTypedData(rewardAuthorizationTypedDataV1(authorization, domain));
}
