import { encodeAbiParameters, keccak256, stringToHex, type Address, type Hex } from "viem";

export const MANDATE_V1_TYPE =
  "MandateV1(uint8 version,uint256 chainId,address account,address authorization,uint256 groupId,bytes32 permissionDigest,address sessionKey,uint48 validAfter,uint48 validUntil,bytes32 authorizationId)";

export const MANDATE_V1_TYPEHASH = keccak256(stringToHex(MANDATE_V1_TYPE));

export interface MandateV1 {
  readonly version: 1;
  readonly chainId: bigint;
  readonly account: Address;
  readonly authorization: Address;
  readonly groupId: bigint;
  readonly permissionDigest: Hex;
  readonly sessionKey: Address;
  readonly validAfter: bigint;
  readonly validUntil: bigint;
  readonly authorizationId: Hex;
}

const UINT48_MAX = (1n << 48n) - 1n;

function uint48ToNumber(value: bigint, field: string): number {
  if (value < 0n || value > UINT48_MAX) {
    throw new RangeError(`${field} must fit uint48`);
  }

  return Number(value);
}

export function hashMandateV1(mandate: MandateV1): Hex {
  if (mandate.version !== 1) {
    throw new RangeError("unsupported Mandate version");
  }

  const validAfter = uint48ToNumber(mandate.validAfter, "validAfter");
  const validUntil = uint48ToNumber(mandate.validUntil, "validUntil");

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
        { type: "address" },
        { type: "uint48" },
        { type: "uint48" },
        { type: "bytes32" },
      ],
      [
        MANDATE_V1_TYPEHASH,
        mandate.version,
        mandate.chainId,
        mandate.account,
        mandate.authorization,
        mandate.groupId,
        mandate.permissionDigest,
        mandate.sessionKey,
        validAfter,
        validUntil,
        mandate.authorizationId,
      ],
    ),
  );
}
