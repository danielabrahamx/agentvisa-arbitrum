import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import hre from "hardhat";
import { getAddress, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import {
  ARBITRUM_SEPOLIA_CHAIN_ID,
  assertNoIdentitySurfaceInBytecode,
  admissionBundlePath,
  admissionDeploymentRecordPath,
  buildAdmissionBundle,
  CREDENTIAL_GROUP_DURATION_SECONDS,
  DEMO_SOURCE_POLICY,
  explorerAddressUrl,
  hashBytecode,
  resolveEnrollmentSignerKey,
  semaphoreDeploymentRecordPath,
  workspaceRoot,
  writeJsonFile,
  type AdmissionDeploymentRecordV1,
  type SemaphoreDeploymentRecordV1,
} from "./admission-shared.js";
import { loadWorkspaceDotenv } from "./load-dotenv.js";

loadWorkspaceDotenv();

async function waitForReceipt(
  publicClient: Awaited<
    ReturnType<Awaited<ReturnType<typeof hre.network.connect>>["viem"]["getPublicClient"]>
  >,
  hash: Hex,
) {
  return publicClient.waitForTransactionReceipt({ hash, timeout: 180_000 }).catch(async () => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try {
        return await publicClient.getTransactionReceipt({ hash });
      } catch {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 4_000));
      }
    }
    throw new Error(`transaction ${hash} not found after retries`);
  });
}

async function findContractCreationTx(
  publicClient: Awaited<
    ReturnType<Awaited<ReturnType<typeof hre.network.connect>>["viem"]["getPublicClient"]>
  >,
  contractAddress: Address,
  deployer: Address,
): Promise<Hex> {
  const latestBlock = await publicClient.getBlockNumber();
  for (let offset = 0n; offset < 80n; offset += 1n) {
    const blockNumber = latestBlock - offset;
    if (blockNumber < 0n) break;
    const block = await publicClient.getBlock({
      blockNumber,
      includeTransactions: true,
    });
    for (const transaction of block.transactions) {
      if (typeof transaction !== "object" || getAddress(transaction.from) !== deployer) {
        continue;
      }
      const receipt = await publicClient.getTransactionReceipt({ hash: transaction.hash });
      if (
        receipt.contractAddress !== null &&
        receipt.contractAddress !== undefined &&
        getAddress(receipt.contractAddress) === getAddress(contractAddress)
      ) {
        return transaction.hash;
      }
    }
  }
  throw new Error(`creation transaction not found for ${contractAddress}`);
}

async function deployAdmissionStack(): Promise<void> {
  const root = workspaceRoot();
  const enrollmentSignerKey = resolveEnrollmentSignerKey();
  const enrollmentSigner = getAddress(privateKeyToAccount(enrollmentSignerKey).address);

  const { networkName, viem } = await hre.network.connect("arbitrumSepolia");
  assert.equal(networkName, "arbitrumSepolia");

  const publicClient = await viem.getPublicClient();
  const chainId = await publicClient.getChainId();
  assert.equal(chainId, ARBITRUM_SEPOLIA_CHAIN_ID);

  const [deployerWallet] = await viem.getWalletClients();
  assert.ok(deployerWallet?.account);
  const deployer = getAddress(deployerWallet.account.address);

  const balance = await publicClient.getBalance({ address: deployer });
  assert.ok(
    balance > 0n,
    `synthetic deployer ${deployer} has zero Arbitrum Sepolia ETH; fund it with test ETH only`,
  );

  if (
    existsSync(semaphoreDeploymentRecordPath(root)) &&
    existsSync(admissionDeploymentRecordPath(root)) &&
    existsSync(admissionBundlePath(root))
  ) {
    const admissionRecord = JSON.parse(
      readFileSync(admissionDeploymentRecordPath(root), "utf8"),
    ) as AdmissionDeploymentRecordV1;
    if (getAddress(admissionRecord.enrollmentSigner) === enrollmentSigner) {
      const code = await publicClient.getCode({ address: admissionRecord.address });
      if (code && code !== "0x") {
        console.log(`Reusing existing AgentVisaAdmission at ${admissionRecord.address}`);
        return;
      }
    }
  }

  const verifier = await viem.deployContract("SemaphoreVerifier");
  const poseidon = await viem.deployContract("PoseidonT3");
  const semaphore = await viem.deployContract("Semaphore", [verifier.address], {
    libraries: { PoseidonT3: poseidon.address },
  });
  const semaphoreBytecode = await publicClient.getCode({ address: semaphore.address });
  assert.ok(semaphoreBytecode && semaphoreBytecode !== "0x");
  assertNoIdentitySurfaceInBytecode(semaphoreBytecode);
  const semaphoreTx = await findContractCreationTx(publicClient, semaphore.address, deployer);

  const credentialGroupId = 0n;
  const admission = await viem.deployContract("AgentVisaAdmission", [
    semaphore.address,
    credentialGroupId,
    DEMO_SOURCE_POLICY.sourceId,
    DEMO_SOURCE_POLICY.uniquenessDomain,
    DEMO_SOURCE_POLICY.credentialSchemaId,
    DEMO_SOURCE_POLICY.acceptedAssuranceId,
    Number(DEMO_SOURCE_POLICY.maximumValiditySeconds),
    enrollmentSigner,
  ]);
  const admissionBytecode = await publicClient.getCode({ address: admission.address });
  assert.ok(admissionBytecode && admissionBytecode !== "0x");
  assertNoIdentitySurfaceInBytecode(admissionBytecode);
  const admissionTx = await findContractCreationTx(publicClient, admission.address, deployer);

  const createGroupHash = await semaphore.write.createGroup!(
    [admission.address, CREDENTIAL_GROUP_DURATION_SECONDS],
    { account: deployerWallet.account },
  );
  const createGroupReceipt = await waitForReceipt(publicClient, createGroupHash);
  assert.equal(createGroupReceipt.status, "success");
  assert.equal(await semaphore.read.groupCounter!(), 1n);
  assert.equal(
    getAddress((await semaphore.read.getGroupAdmin!([credentialGroupId])) as Address),
    getAddress(admission.address),
  );

  const semaphoreRecord: SemaphoreDeploymentRecordV1 = {
    schemaVersion: 1,
    chainId: ARBITRUM_SEPOLIA_CHAIN_ID,
    contractName: "Semaphore",
    address: getAddress(semaphore.address),
    bytecodeHash: hashBytecode(semaphoreBytecode),
    deployer,
    transactionHash: semaphoreTx,
    explorerUrl: explorerAddressUrl(getAddress(semaphore.address)),
    credentialGroupId: credentialGroupId.toString(),
    verificationStatus: "unverified",
  };

  const admissionRecord: AdmissionDeploymentRecordV1 = {
    schemaVersion: 1,
    chainId: ARBITRUM_SEPOLIA_CHAIN_ID,
    contractName: "AgentVisaAdmission",
    address: getAddress(admission.address),
    bytecodeHash: hashBytecode(admissionBytecode),
    deployer,
    enrollmentSigner,
    semaphore: getAddress(semaphore.address),
    credentialGroupId: credentialGroupId.toString(),
    transactionHash: admissionTx,
    explorerUrl: explorerAddressUrl(getAddress(admission.address)),
    verificationStatus: "unverified",
  };

  const bundle = buildAdmissionBundle({
    semaphore: getAddress(semaphore.address),
    admission: getAddress(admission.address),
    credentialGroupId,
    enrollmentSigner,
  });

  writeJsonFile(semaphoreDeploymentRecordPath(root), semaphoreRecord);
  writeJsonFile(admissionDeploymentRecordPath(root), admissionRecord);
  writeJsonFile(admissionBundlePath(root), bundle);

  console.log(`Wrote ${semaphoreDeploymentRecordPath(root)}`);
  console.log(`Wrote ${admissionDeploymentRecordPath(root)}`);
  console.log(`Wrote ${admissionBundlePath(root)}`);
  console.log(JSON.stringify(bundle, null, 2));
}

await deployAdmissionStack();
