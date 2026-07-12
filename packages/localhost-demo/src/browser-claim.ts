import {
  createPublicClient,
  createWalletClient,
  custom,
  getAddress,
  http,
  type Address,
  type Hex,
} from "viem";
import { arbitrumSepolia } from "viem/chains";

import {
  DEMO_REWARD_CLAIM_CHAIN_ID,
  DEMO_REWARD_CLAIM_CONTRACT,
  DEMO_REWARD_CLAIM_EXPLORER,
  DEMO_REWARD_CLAIM_RPC_URL,
  GAME_REWARD_CLAIM_ABI,
  explorerTxUrl,
  type DemoRewardClaimPublicConfig,
} from "./claim-constants.js";
import { freshWalletGasFees } from "./wallet-fees.js";

interface EthereumProvider {
  request(args: {
    readonly method: string;
    readonly params?: readonly unknown[];
  }): Promise<unknown>;
}

interface IssuedClaimAuthorization {
  readonly authorization: {
    readonly version: number;
    readonly stableApplicationId: Hex;
    readonly resultId: Hex;
    readonly claimId: Hex;
    readonly recipient: Address;
    readonly amount: string;
    readonly expiresAt: string;
  };
  readonly signature: Hex;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export async function connectArbitrumSepoliaWallet(
  config: DemoRewardClaimPublicConfig,
): Promise<Address> {
  const provider = requireEthereumProvider();
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  const account = accounts[0];
  if (account === undefined || !/^0x[0-9a-fA-F]{40}$/.test(account)) {
    throw new Error("wallet_account_unavailable");
  }
  await ensureArbitrumSepolia(provider, config);
  return getAddress(account);
}

export async function submitGameRewardClaim(
  config: DemoRewardClaimPublicConfig,
  issued: IssuedClaimAuthorization,
): Promise<{ readonly transactionHash: Hex; readonly explorerUrl: string }> {
  const provider = requireEthereumProvider();
  await ensureArbitrumSepolia(provider, config);
  const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
  const account = accounts[0];
  if (account === undefined) throw new Error("wallet_account_unavailable");
  const recipient = getAddress(account);
  if (getAddress(issued.authorization.recipient) !== recipient) {
    throw new Error("recipient_mismatch");
  }

  const walletClient = createWalletClient({
    account: recipient,
    chain: arbitrumSepolia,
    transport: custom(provider),
  });
  const publicClient = createPublicClient({
    chain: arbitrumSepolia,
    transport: http(config.rpcUrl || DEMO_REWARD_CLAIM_RPC_URL),
  });

  const authorization = {
    version: Number(issued.authorization.version),
    stableApplicationId: issued.authorization.stableApplicationId,
    resultId: issued.authorization.resultId,
    claimId: issued.authorization.claimId,
    recipient: getAddress(issued.authorization.recipient),
    amount: BigInt(issued.authorization.amount),
    expiresAt: BigInt(issued.authorization.expiresAt),
  };

  const gasFees = await freshWalletGasFees(publicClient);
  const hash = await walletClient.writeContract({
    address: config.contractAddress || DEMO_REWARD_CLAIM_CONTRACT,
    abi: GAME_REWARD_CLAIM_ABI,
    functionName: "claim",
    args: [authorization, issued.signature],
    ...gasFees,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  return {
    transactionHash: hash,
    explorerUrl: explorerTxUrl(hash),
  };
}

async function ensureArbitrumSepolia(
  provider: EthereumProvider,
  config: DemoRewardClaimPublicConfig,
): Promise<void> {
  const chainIdHex = `0x${DEMO_REWARD_CLAIM_CHAIN_ID.toString(16)}`;
  const current = (await provider.request({ method: "eth_chainId" })) as string;
  if (current.toLowerCase() === chainIdHex.toLowerCase()) return;

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? Number(error.code)
        : undefined;
    if (code !== 4902) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: chainIdHex,
          chainName: config.chainName,
          nativeCurrency: config.nativeCurrency,
          rpcUrls: [config.rpcUrl || DEMO_REWARD_CLAIM_RPC_URL],
          blockExplorerUrls: [config.explorerBaseUrl || DEMO_REWARD_CLAIM_EXPLORER],
        },
      ],
    });
  }
}

function requireEthereumProvider(): EthereumProvider {
  if (window.ethereum === undefined) {
    throw new Error("install_metamask_or_rabby");
  }
  return window.ethereum;
}
