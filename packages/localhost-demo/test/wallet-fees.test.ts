import { describe, expect, it } from "vitest";

import { freshWalletGasFees } from "../src/wallet-fees.js";

describe("freshWalletGasFees", () => {
  it("buffers RPC fee estimates above the wallet minimum", async () => {
    const publicClient = {
      estimateFeesPerGas: async () => ({
        maxFeePerGas: 20_002_000n,
        maxPriorityFeePerGas: 1n,
      }),
    };

    const fees = await freshWalletGasFees(publicClient as never);
    expect(fees.maxFeePerGas).toBeGreaterThan(20_002_000n);
    expect(fees.maxPriorityFeePerGas).toBeGreaterThanOrEqual(1n);
  });
});
