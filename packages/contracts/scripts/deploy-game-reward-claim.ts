import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import hre from "hardhat";
import { getAddress, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import {
  ARBITRUM_SEPOLIA_CHAIN_ID,
  assertNoIdentitySurfaceInBytecode,
  deploymentRecordPath,
  explorerAddressUrl,
  hashBytecode,
  readValidatedDeploymentRecord,
  writeJsonFile,
  type DeploymentRecordV1,
} from "./deployment-records.js";
import { loadWorkspaceDotenv } from "./load-dotenv.js";

loadWorkspaceDotenv();

function requirePrivateKey(name: string): Hex {
  const value = process.env[name];
  assert.ok(value, `${name} must be set for synthetic Sepolia deployment`);
  assert.match(value, /^0x[0-9a-fA-F]{64}$/, `${name} must be a 32-byte hex private key`);
  return value as Hex;
}

function workspaceRoot(): string {
  return resolve(import.meta.dirname, "../../..");
}

function packageVersion(): string {
  const packageJson = JSON.parse(
    readFileSync(resolve(import.meta.dirname, "../package.json"), "utf8"),
  ) as { version: string };
  return packageJson.version;
}

async function deployOrReuse(): Promise<DeploymentRecordV1> {
  const authorizerKey = requirePrivateKey("ARBITRUM_SEPOLIA_AUTHORIZER_PRIVATE_KEY");
  const authorizer = getAddress(privateKeyToAccount(authorizerKey).address);
  const recordFile = deploymentRecordPath(workspaceRoot());

  const { networkName, viem } = await hre.network.connect("arbitrumSepolia");
  assert.equal(networkName, "arbitrumSepolia");

  const publicClient = await viem.getPublicClient();
  const chainId = await publicClient.getChainId();
  assert.equal(chainId, ARBITRUM_SEPOLIA_CHAIN_ID);

  const [deployerWallet] = await viem.getWalletClients();
  assert.ok(deployerWallet?.account);
  const deployer = getAddress(deployerWallet.account.address);

  try {
    const existing = readValidatedDeploymentRecord(workspaceRoot());
    const code = await publicClient.getCode({ address: existing.address });
    if (
      code &&
      code !== "0x" &&
      existing.authorizer === authorizer &&
      existing.deployer === deployer
    ) {
      console.log(`Reusing existing GameRewardClaim at ${existing.address}`);
      return existing;
    }
  } catch {
    // No valid prior record; deploy fresh.
  }

  const balance = await publicClient.getBalance({ address: deployer });
  assert.ok(
    balance > 0n,
    `synthetic deployer ${deployer} has zero Arbitrum Sepolia ETH; fund it with test ETH only`,
  );

  const { contract, deploymentTransaction } = await viem.sendDeploymentTransaction(
    "GameRewardClaim",
    [authorizer],
  );

  // Public Sepolia RPCs occasionally drop the tx from the mempool view right
  // after broadcast; retry receipt lookup before treating deploy as failed.
  const receipt = await publicClient
    .waitForTransactionReceipt({
      hash: deploymentTransaction.hash,
      timeout: 120_000,
    })
    .catch(async () => {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        try {
          return await publicClient.getTransactionReceipt({
            hash: deploymentTransaction.hash,
          });
        } catch {
          await new Promise((resolveDelay) => setTimeout(resolveDelay, 3_000));
        }
      }
      throw new Error(`deployment tx ${deploymentTransaction.hash} not found after retries`);
    });

  assert.equal(receipt.status, "success");
  assert.ok(receipt.contractAddress);
  assert.equal(getAddress(receipt.contractAddress), getAddress(contract.address));

  const bytecode = await publicClient.getCode({ address: contract.address });
  assert.ok(bytecode && bytecode !== "0x");
  assertNoIdentitySurfaceInBytecode(bytecode);

  const onChainAuthorizer = getAddress((await contract.read.authorizer!()) as Address);
  assert.equal(onChainAuthorizer, authorizer);

  const record: DeploymentRecordV1 = {
    schemaVersion: 1,
    chainId: ARBITRUM_SEPOLIA_CHAIN_ID,
    contractName: "GameRewardClaim",
    address: getAddress(contract.address),
    bytecodeHash: hashBytecode(bytecode),
    source: {
      kind: "local",
      name: "packages/contracts/contracts/GameRewardClaim.sol",
      version: packageVersion(),
    },
    constructorArguments: [authorizer],
    authorizer,
    deployer,
    transactionHash: receipt.transactionHash,
    explorerUrl: explorerAddressUrl(getAddress(contract.address)),
    verificationStatus: "unverified",
  };

  writeJsonFile(recordFile, record);
  console.log(`Wrote deployment record to ${recordFile}`);
  console.log(JSON.stringify(record, null, 2));
  return record;
}

const record = await deployOrReuse();
assert.equal(record.chainId, ARBITRUM_SEPOLIA_CHAIN_ID);
