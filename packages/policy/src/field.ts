import type { Hex } from "viem";

export const SNARK_SCALAR_FIELD =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export function digestToField(digest: Hex): bigint {
  if (!/^0x[0-9a-fA-F]{64}$/.test(digest)) {
    throw new RangeError("digest must be exactly 32 bytes");
  }

  return BigInt(digest) % SNARK_SCALAR_FIELD;
}
