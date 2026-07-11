import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { rewardAuthorizationTypedDataV1, type RewardAuthorizationV1 } from "@agentvisa/policy";
import hre from "hardhat";
import { getAddress, keccak256, stringToHex, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import {
  ARBITRUM_SEPOLIA_CHAIN_ID,
  assertNoIdentitySurfaceInBytecode,
  blairClaimProofPath,
  explorerTxUrl,
  readValidatedBlairClaimProof,
  readValidatedDeploymentRecord,
  validateBlairClaimProof,
  writeJsonFile,
  type BlairClaimProofV1,
} from "./deployment-records.js";
import { loadWorkspaceDotenv } from "./load-dotenv.js";

loadWorkspaceDotenv();

const STABLE_APPLICATION_ID = keccak256(stringToHex("agentvisa.robot-rally.v1"));
const RESULT_ID = keccak256(stringToHex("blair-win-sepolia-1"));
const CLAIM_ID = keccak256(stringToHex("blair-claim-sepolia-1"));
const AMOUNT = 100n;

function requirePrivateKey(name: string): Hex {
  const value = process.env[name];
  assert.ok(value, `${name} must be set`);
  assert.match(value, /^0x[0-9a-fA-F]{64}$/);
  return value as Hex;
}

function workspaceRoot(): string {
  return resolve(import.meta.dirname, "../../..");
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

async function main(): Promise<BlairClaimProofV1> {
  const record = readValidatedDeploymentRecord(workspaceRoot());
  const authorizerKey = requirePrivateKey("ARBITRUM_SEPOLIA_AUTHORIZER_PRIVATE_KEY");
  const authorizerAccount = privateKeyToAccount(authorizerKey);
  assert.equal(getAddress(authorizerAccount.address), record.authorizer);

  const { networkName, viem } = await hre.network.connect("arbitrumSepolia");
  assert.equal(networkName, "arbitrumSepolia");

  const publicClient = await viem.getPublicClient();
  assert.equal(await publicClient.getChainId(), ARBITRUM_SEPOLIA_CHAIN_ID);

  const contract = await viem.getContractAt("GameRewardClaim", record.address);
  const onChainAuthorizer = getAddress((await contract.read.authorizer!()) as Address);
  assert.equal(onChainAuthorizer, record.authorizer);

  const bytecode = await publicClient.getCode({ address: record.address });
  assert.ok(bytecode && bytecode !== "0x");
  assertNoIdentitySurfaceInBytecode(bytecode);

  const [claimer] = await viem.getWalletClients();
  assert.ok(claimer?.account);
  const recipient = getAddress(claimer.account.address);

  const proofPath = blairClaimProofPath(workspaceRoot());
  const alreadyConsumed = Boolean(await contract.read.claimConsumed!([CLAIM_ID]));
  if (alreadyConsumed) {
    let previous: BlairClaimProofV1;
    if (existsSync(proofPath)) {
      previous = readValidatedBlairClaimProof(workspaceRoot());
      assert.equal(previous.claimId, CLAIM_ID);
      assert.equal(previous.contractAddress, record.address);
    } else {
      // Recover after a successful claim whose proof write failed validation.
      const claimTxHash = process.env.BLAIR_CLAIM_TX_HASH as Hex | undefined;
      assert.ok(
        claimTxHash && /^0x[0-9a-fA-F]{64}$/.test(claimTxHash),
        "claim consumed but proof missing; set BLAIR_CLAIM_TX_HASH to rebuild",
      );
      const points = await contract.read.syntheticPoints!([STABLE_APPLICATION_ID, recipient]);
      assert.equal(points, AMOUNT);

      let replayError = "ClaimAlreadyConsumed";
      try {
        const authorization: RewardAuthorizationV1 = {
          version: 1,
          stableApplicationId: STABLE_APPLICATION_ID,
          resultId: RESULT_ID,
          claimId: CLAIM_ID,
          recipient,
          amount: AMOUNT,
          expiresAt: BigInt(Math.floor(Date.now() / 1000) + 3_600),
        };
        const signature = await authorizerAccount.signTypedData(
          rewardAuthorizationTypedDataV1(authorization, {
            chainId: BigInt(ARBITRUM_SEPOLIA_CHAIN_ID),
            verifyingContract: record.address,
          }),
        );
        await contract.write.claim!([authorization, signature]);
        assert.fail("expected replay to fail");
      } catch (error) {
        replayError = extractErrorMessage(error);
        assert.match(replayError, /ClaimAlreadyConsumed|reverted/i);
      }

      previous = validateBlairClaimProof({
        schemaVersion: 1,
        chainId: ARBITRUM_SEPOLIA_CHAIN_ID,
        contractAddress: record.address,
        authorizer: record.authorizer,
        recipient,
        stableApplicationId: STABLE_APPLICATION_ID,
        resultId: RESULT_ID,
        claimId: CLAIM_ID,
        amount: AMOUNT.toString(),
        expiresAt: "0",
        claimTransactionHash: claimTxHash.toLowerCase(),
        claimExplorerUrl: explorerTxUrl(claimTxHash.toLowerCase() as Hex),
        replayRejected: true,
        replayError,
        syntheticPointsAfterClaim: points.toString(),
        notes: [
          "Blair synthetic claim on Arbitrum Sepolia.",
          "On-chain state stores claim consumption and synthetic points only.",
          "No World verifier, Semaphore proof, or personally identifying data was deployed.",
        ],
      });
      writeJsonFile(proofPath, previous);
      console.log(`Recovered blair claim proof at ${proofPath}`);
      return previous;
    }

    await assert.rejects(async () => {
      const authorization: RewardAuthorizationV1 = {
        version: 1,
        stableApplicationId: STABLE_APPLICATION_ID,
        resultId: RESULT_ID,
        claimId: CLAIM_ID,
        recipient: previous.recipient,
        amount: AMOUNT,
        expiresAt: BigInt(Math.floor(Date.now() / 1000) + 3_600),
      };
      const signature = await authorizerAccount.signTypedData(
        rewardAuthorizationTypedDataV1(authorization, {
          chainId: BigInt(ARBITRUM_SEPOLIA_CHAIN_ID),
          verifyingContract: record.address,
        }),
      );
      await contract.write.claim!([authorization, signature]);
    });

    console.log("Claim already proven; replay rejection reconfirmed.");
    return previous;
  }

  const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 3_600);
  const authorization: RewardAuthorizationV1 = {
    version: 1,
    stableApplicationId: STABLE_APPLICATION_ID,
    resultId: RESULT_ID,
    claimId: CLAIM_ID,
    recipient,
    amount: AMOUNT,
    expiresAt,
  };

  const signature = await authorizerAccount.signTypedData(
    rewardAuthorizationTypedDataV1(authorization, {
      chainId: BigInt(ARBITRUM_SEPOLIA_CHAIN_ID),
      verifyingContract: record.address,
    }),
  );

  const claimHash = await contract.write.claim!([authorization, signature]);
  const claimReceipt = await publicClient.waitForTransactionReceipt({ hash: claimHash });
  assert.equal(claimReceipt.status, "success");

  assert.equal(await contract.read.claimConsumed!([CLAIM_ID]), true);
  const points = await contract.read.syntheticPoints!([STABLE_APPLICATION_ID, recipient]);
  assert.equal(points, AMOUNT);

  let replayError = "ClaimAlreadyConsumed";
  try {
    await contract.write.claim!([authorization, signature]);
    assert.fail("expected replay to fail");
  } catch (error) {
    replayError = extractErrorMessage(error);
    assert.match(replayError, /ClaimAlreadyConsumed|reverted/i);
  }

  const proof = validateBlairClaimProof({
    schemaVersion: 1,
    chainId: ARBITRUM_SEPOLIA_CHAIN_ID,
    contractAddress: record.address,
    authorizer: record.authorizer,
    recipient,
    stableApplicationId: STABLE_APPLICATION_ID,
    resultId: RESULT_ID,
    claimId: CLAIM_ID,
    amount: AMOUNT.toString(),
    expiresAt: expiresAt.toString(),
    claimTransactionHash: claimReceipt.transactionHash,
    claimExplorerUrl: explorerTxUrl(claimReceipt.transactionHash),
    replayRejected: true,
    replayError,
    syntheticPointsAfterClaim: points.toString(),
    notes: [
      "Blair synthetic claim on Arbitrum Sepolia.",
      "On-chain state stores claim consumption and synthetic points only.",
      "No World verifier, Semaphore proof, or personally identifying data was deployed.",
    ],
  });

  writeJsonFile(proofPath, proof);
  console.log(JSON.stringify(proof, null, 2));
  return proof;
}

await main();
