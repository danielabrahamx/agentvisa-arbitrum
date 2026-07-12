import type { PublicClient } from "viem";

const FEE_BUFFER_PERCENT = 25n;
const MIN_MAX_FEE_PER_GAS = 50_000_000n;

export async function freshWalletGasFees(publicClient: PublicClient): Promise<{
  readonly maxFeePerGas: bigint;
  readonly maxPriorityFeePerGas: bigint;
}> {
  const estimate = await publicClient.estimateFeesPerGas();
  const baseMaxFee = estimate.maxFeePerGas ?? estimate.gasPrice ?? MIN_MAX_FEE_PER_GAS;
  const basePriority = estimate.maxPriorityFeePerGas ?? 1n;
  return {
    maxFeePerGas: bufferFee(baseMaxFee),
    maxPriorityFeePerGas: bufferFee(basePriority, 1n),
  };
}

function bufferFee(value: bigint, floor = MIN_MAX_FEE_PER_GAS): bigint {
  const buffered = value + (value * FEE_BUFFER_PERCENT) / 100n;
  return buffered >= floor ? buffered : floor;
}
