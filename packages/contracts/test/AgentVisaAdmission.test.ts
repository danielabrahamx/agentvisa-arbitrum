import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hashEnrollmentAuthorizationV1 } from "@agentvisa/policy";
import hre from "hardhat";
import { getAddress, keccak256, stringToHex, type Address, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const SOURCE_ID = keccak256(stringToHex("agentvisa.synthetic-localhost-source.v1"));
const UNIQUENESS_DOMAIN = keccak256(stringToHex("agentvisa.synthetic-localhost-people.v1"));
const CREDENTIAL_SCHEMA_ID = keccak256(stringToHex("agentvisa.semaphore-credential.v1"));
const ASSURANCE_ID = keccak256(stringToHex("agentvisa.synthetic-localhost-assurance.v1"));
const MAX_VALIDITY_SECONDS = 300n;
const GROUP_DURATION_SECONDS = 3_600n;

async function deploySemaphoreStack(viem: Awaited<ReturnType<typeof hre.network.create>>["viem"]) {
  const verifier = await viem.deployContract("SemaphoreVerifier");
  const poseidon = await viem.deployContract("PoseidonT3");
  const semaphore = await viem.deployContract("Semaphore", [verifier.address], {
    libraries: { PoseidonT3: poseidon.address },
  });
  return semaphore;
}

function authorization(
  commitment: bigint,
  change: Partial<{
    nonce: Hex;
    opaqueSubjectDigest: Hex;
    issuedAt: bigint;
    expiresAt: bigint;
  }> = {},
) {
  const issuedAt = change.issuedAt ?? BigInt(Math.floor(Date.now() / 1000) - 60);
  const expiresAt = change.expiresAt ?? issuedAt + 300n;
  return {
    version: 1 as const,
    sourceId: SOURCE_ID,
    uniquenessDomain: UNIQUENESS_DOMAIN,
    opaqueSubjectDigest:
      change.opaqueSubjectDigest ??
      keccak256(stringToHex(`opaque-subject-${commitment.toString()}`)),
    credentialSchemaId: CREDENTIAL_SCHEMA_ID,
    assuranceId: ASSURANCE_ID,
    semaphoreIdentityCommitment: commitment,
    issuedAt,
    expiresAt,
    nonce: change.nonce ?? keccak256(stringToHex(`nonce-${commitment.toString()}`)),
  };
}

void describe("AgentVisaAdmission", () => {
  void it("enrolls one commitment and rejects replayed nonce or subject", async () => {
    const { viem } = await hre.network.create();
    const [admin] = await viem.getWalletClients();
    assert.ok(admin?.account);

    const signerAccount = privateKeyToAccount(generatePrivateKey());
    const semaphore = await deploySemaphoreStack(viem);
    const admission = await viem.deployContract("AgentVisaAdmission", [
      semaphore.address,
      0n,
      SOURCE_ID,
      UNIQUENESS_DOMAIN,
      CREDENTIAL_SCHEMA_ID,
      ASSURANCE_ID,
      MAX_VALIDITY_SECONDS,
      signerAccount.address,
    ]);

    await semaphore.write.createGroup!([admission.address, GROUP_DURATION_SECONDS]);

    const commitment = 12_345_678_901_234_567_890n;
    const auth = authorization(commitment);
    const digest = hashEnrollmentAuthorizationV1(auth);
    const signature = await signerAccount.sign({ hash: digest });

    await admission.write.enroll!([auth, signature]);
    assert.equal(await semaphore.read.getMerkleTreeSize!([0n]), 1n);
    assert.equal(await admission.read.nonceConsumed!([auth.nonce]), true);
    assert.equal(await admission.read.opaqueSubjectConsumed!([auth.opaqueSubjectDigest]), true);

    await assert.rejects(admission.write.enroll!([auth, signature]));
  });

  void it("rejects a wrong enrollment signer", async () => {
    const { viem } = await hre.network.create();
    const signerAccount = privateKeyToAccount(generatePrivateKey());
    const impostor = privateKeyToAccount(generatePrivateKey());
    const semaphore = await deploySemaphoreStack(viem);
    const admission = await viem.deployContract("AgentVisaAdmission", [
      semaphore.address,
      0n,
      SOURCE_ID,
      UNIQUENESS_DOMAIN,
      CREDENTIAL_SCHEMA_ID,
      ASSURANCE_ID,
      MAX_VALIDITY_SECONDS,
      signerAccount.address,
    ]);
    await semaphore.write.createGroup!([admission.address, GROUP_DURATION_SECONDS]);

    const commitment = 98_765_432_109_876_543_210n;
    const auth = authorization(commitment);
    const digest = hashEnrollmentAuthorizationV1(auth);
    const signature = await impostor.sign({ hash: digest });

    await assert.rejects(admission.write.enroll!([auth, signature]));
  });

  void it("stores immutable policy and signer metadata", async () => {
    const { viem } = await hre.network.create();
    const signerAccount = privateKeyToAccount(generatePrivateKey());
    const semaphore = await deploySemaphoreStack(viem);
    const admission = await viem.deployContract("AgentVisaAdmission", [
      semaphore.address,
      0n,
      SOURCE_ID,
      UNIQUENESS_DOMAIN,
      CREDENTIAL_SCHEMA_ID,
      ASSURANCE_ID,
      MAX_VALIDITY_SECONDS,
      signerAccount.address,
    ]);

    assert.equal(
      getAddress((await admission.read.semaphore!()) as Address),
      getAddress(semaphore.address),
    );
    assert.equal(await admission.read.credentialGroupId!(), 0n);
    assert.equal(await admission.read.sourceId!(), SOURCE_ID);
    assert.equal(
      getAddress((await admission.read.enrollmentSigner!()) as Address),
      getAddress(signerAccount.address),
    );
  });
});
