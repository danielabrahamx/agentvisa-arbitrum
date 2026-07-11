import type { Address, Hex } from "viem";

/** Deployed GameRewardClaim on Arbitrum Sepolia — public address only. */
export const DEMO_REWARD_CLAIM_CHAIN_ID = 421_614;
export const DEMO_REWARD_CLAIM_CHAIN_NAME = "Arbitrum Sepolia";
export const DEMO_REWARD_CLAIM_RPC_URL = "https://sepolia-rollup.arbitrum.io/rpc";
export const DEMO_REWARD_CLAIM_EXPLORER = "https://sepolia.arbiscan.io";
export const DEMO_REWARD_CLAIM_CONTRACT = "0x0A93815977f7c8c2fE6126869254506B807C4E58" as Address;
export const DEMO_REWARD_CLAIM_AMOUNT = 100n;
export const DEMO_REWARD_CLAIM_TTL_SECONDS = 3_600n;

export const GAME_REWARD_CLAIM_ABI = [
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "authorization",
        type: "tuple",
        components: [
          { name: "version", type: "uint8" },
          { name: "stableApplicationId", type: "bytes32" },
          { name: "resultId", type: "bytes32" },
          { name: "claimId", type: "bytes32" },
          { name: "recipient", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "expiresAt", type: "uint64" },
        ],
      },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "claimConsumed",
    stateMutability: "view",
    inputs: [{ name: "claimId", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
] as const;

export interface DemoRewardClaimPublicConfig {
  readonly enabled: boolean;
  readonly chainId: number;
  readonly chainName: string;
  readonly contractAddress: Address;
  readonly rpcUrl: string;
  readonly explorerBaseUrl: string;
  readonly amount: string;
  readonly nativeCurrency: {
    readonly name: string;
    readonly symbol: string;
    readonly decimals: number;
  };
}

export function demoRewardClaimPublicConfig(enabled: boolean): DemoRewardClaimPublicConfig {
  return {
    enabled,
    chainId: DEMO_REWARD_CLAIM_CHAIN_ID,
    chainName: DEMO_REWARD_CLAIM_CHAIN_NAME,
    contractAddress: DEMO_REWARD_CLAIM_CONTRACT,
    rpcUrl: DEMO_REWARD_CLAIM_RPC_URL,
    explorerBaseUrl: DEMO_REWARD_CLAIM_EXPLORER,
    amount: DEMO_REWARD_CLAIM_AMOUNT.toString(),
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  };
}

export function explorerTxUrl(transactionHash: Hex): string {
  return `${DEMO_REWARD_CLAIM_EXPLORER}/tx/${transactionHash}`;
}
