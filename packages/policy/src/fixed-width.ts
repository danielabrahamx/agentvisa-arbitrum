import type { Address, Hex } from "viem";

const ZERO_BYTES32 = `0x${"0".repeat(64)}`;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export function requireRecord(input: unknown, name: string): Record<string, unknown> {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new TypeError(`${name} must be an object`);
  }

  return input as Record<string, unknown>;
}

export function requireVersionOne(value: unknown, name: string): 1 {
  if (value !== 1) {
    throw new RangeError(`unsupported ${name} version`);
  }

  return 1;
}

export function requireBytes32(value: unknown, field: string): Hex {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new RangeError(`${field} must be exactly 32 bytes`);
  }

  return value as Hex;
}

export function requireNonzeroBytes32(value: unknown, field: string): Hex {
  const bytes = requireBytes32(value, field);

  if (bytes.toLowerCase() === ZERO_BYTES32) {
    throw new RangeError(`${field} must not be zero`);
  }

  return bytes;
}

export function requireUint(value: unknown, bits: number, field: string): bigint {
  if (typeof value !== "bigint" || value < 0n || value >= 1n << BigInt(bits)) {
    throw new RangeError(`${field} must fit uint${bits}`);
  }

  return value;
}

export function requireAddress(value: unknown, field: string): Address {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new RangeError(`${field} must be a 20-byte address`);
  }

  return value.toLowerCase() as Address;
}

export function requireNonzeroAddress(value: unknown, field: string): Address {
  const address = requireAddress(value, field);

  if (address === ZERO_ADDRESS) {
    throw new RangeError(`${field} must not be zero`);
  }

  return address;
}
