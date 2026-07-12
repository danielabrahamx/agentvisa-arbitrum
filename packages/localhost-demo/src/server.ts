import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { Address, Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { DEMO_REWARD_CLAIM_CHAIN_ID, DEMO_REWARD_CLAIM_CONTRACT } from "./claim-constants.js";
import { DemoApplication } from "./demo-application.js";
import { createDemoHttpServer } from "./http-server.js";
import { loadWorkspaceDotenv } from "./load-dotenv.js";

const EXPECTED_AUTHORIZER = "0x6ef4Ac0bdb72faB3c538aA2AacFf54376CabB538" as Address;
const packageRoot = fileURLToPath(new URL("..", import.meta.url));
loadWorkspaceDotenv(packageRoot);

const host =
  process.env.AGENTVISA_DEMO_HOST ??
  (process.env.PORT !== undefined && process.env.PORT.length > 0 ? "0.0.0.0" : "127.0.0.1");
const port = parsePort(process.env.AGENTVISA_DEMO_PORT ?? process.env.PORT);
const dataDirectory = resolve(process.env.AGENTVISA_DEMO_DATA_DIR ?? ".agentvisa-demo-data");
const rewardClaim = readRewardClaimConfiguration();
const application = new DemoApplication({
  dataDirectory,
  ...(rewardClaim === undefined ? {} : { rewardClaim }),
});
if (rewardClaim !== undefined) {
  const authorizerAddress = privateKeyToAccount(rewardClaim.authorizerPrivateKey).address;
  if (authorizerAddress.toLowerCase() !== EXPECTED_AUTHORIZER.toLowerCase()) {
    console.warn(
      `Warning: authorizer ${authorizerAddress} does not match deployed GameRewardClaim authorizer ${EXPECTED_AUTHORIZER}`,
    );
  }
}
const server = createDemoHttpServer(application);

server.listen(port, host, () => {
  const address = server.address();
  const resolvedPort = typeof address === "object" && address !== null ? address.port : port;
  const claimLabel = application.rewardClaimConfig.enabled
    ? "reward claims enabled (Arbitrum Sepolia)"
    : "reward claims disabled (set ARBITRUM_SEPOLIA_AUTHORIZER_PRIVATE_KEY)";
  const displayHost = host === "0.0.0.0" ? "127.0.0.1" : host;
  console.log(`AgentVisa synthetic demo: http://${displayHost}:${resolvedPort}/ (${claimLabel})`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => {
      application.close();
      process.exitCode = 0;
    });
  });
}

function readRewardClaimConfiguration():
  | {
      readonly authorizerPrivateKey: Hex;
      readonly chainId: bigint;
      readonly verifyingContract: Address;
    }
  | undefined {
  const authorizerPrivateKey = process.env.ARBITRUM_SEPOLIA_AUTHORIZER_PRIVATE_KEY;
  if (authorizerPrivateKey === undefined || authorizerPrivateKey.length === 0) {
    return undefined;
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(authorizerPrivateKey)) {
    throw new Error("ARBITRUM_SEPOLIA_AUTHORIZER_PRIVATE_KEY must be a 32-byte hex private key");
  }
  const contractAddress = process.env.AGENTVISA_REWARD_CLAIM_ADDRESS ?? DEMO_REWARD_CLAIM_CONTRACT;
  if (!/^0x[0-9a-fA-F]{40}$/.test(contractAddress)) {
    throw new Error("AGENTVISA_REWARD_CLAIM_ADDRESS must be a 20-byte hex address");
  }
  return {
    authorizerPrivateKey: authorizerPrivateKey as Hex,
    chainId: BigInt(DEMO_REWARD_CLAIM_CHAIN_ID),
    verifyingContract: contractAddress as Address,
  };
}

function parsePort(value: string | undefined): number {
  if (value === undefined) return 4173;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65_535) {
    throw new RangeError("AGENTVISA_DEMO_PORT must be an integer from 0 to 65535");
  }
  return parsed;
}
