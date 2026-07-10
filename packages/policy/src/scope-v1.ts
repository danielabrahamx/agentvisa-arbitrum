import { encodeAbiParameters, keccak256, stringToHex, type Address, type Hex } from "viem";

export const SCOPE_V1_TYPE =
  "ScopeV1(uint8 version,uint256 chainId,address account,address authorization,uint256 groupId,bytes32 permissionDigest,bytes32 authorizationId)";

export const SCOPE_V1_TYPEHASH = keccak256(stringToHex(SCOPE_V1_TYPE));

export interface ScopeV1 {
  readonly version: 1;
  readonly chainId: bigint;
  readonly account: Address;
  readonly authorization: Address;
  readonly groupId: bigint;
  readonly permissionDigest: Hex;
  readonly authorizationId: Hex;
}

export function hashScopeV1(scope: ScopeV1): Hex {
  if (scope.version !== 1) {
    throw new RangeError("unsupported Scope version");
  }

  return keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32" },
        { type: "uint8" },
        { type: "uint256" },
        { type: "address" },
        { type: "address" },
        { type: "uint256" },
        { type: "bytes32" },
        { type: "bytes32" },
      ],
      [
        SCOPE_V1_TYPEHASH,
        scope.version,
        scope.chainId,
        scope.account,
        scope.authorization,
        scope.groupId,
        scope.permissionDigest,
        scope.authorizationId,
      ],
    ),
  );
}
