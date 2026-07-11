import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  REWARD_AUTHORIZATION_V1_TYPEHASH,
  hashRewardAuthorizationV1,
  rewardAuthorizationTypedDataV1,
  type RewardAuthorizationV1,
} from "@agentvisa/policy";
import hre from "hardhat";
import {
  getAddress,
  keccak256,
  stringToHex,
  type Address,
  type Hex,
  type WalletClient,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const STABLE_APPLICATION_ID = keccak256(stringToHex("agentvisa.robot-rally.v1"));
const OTHER_APPLICATION_ID = keccak256(stringToHex("agentvisa.other-game.v1"));
const RESULT_ID = keccak256(stringToHex("blair-win-1"));
const CLAIM_ID = keccak256(stringToHex("blair-claim-1"));
const AMOUNT = 100n;

function authorization(
  change: Partial<RewardAuthorizationV1> = {},
  expiresAt = BigInt(Math.floor(Date.now() / 1000) + 3_600),
): RewardAuthorizationV1 {
  return {
    version: 1,
    stableApplicationId: STABLE_APPLICATION_ID,
    resultId: RESULT_ID,
    claimId: CLAIM_ID,
    recipient: "0x4444444444444444444444444444444444444444",
    amount: AMOUNT,
    expiresAt,
    ...change,
  };
}

async function signAuthorization(
  wallet: WalletClient,
  verifyingContract: Address,
  chainId: bigint,
  message: RewardAuthorizationV1,
): Promise<Hex> {
  assert.ok(wallet.account);
  const typedData = rewardAuthorizationTypedDataV1(message, {
    chainId,
    verifyingContract,
  });
  return wallet.signTypedData({
    account: wallet.account,
    ...typedData,
  });
}

void describe("GameRewardClaim", () => {
  void it("accepts one valid synthetic claim and stores only points state", async () => {
    const { viem } = await hre.network.create();
    const [deployer, recipient] = await viem.getWalletClients();
    assert.ok(deployer?.account);
    assert.ok(recipient?.account);

    const authorizerAccount = privateKeyToAccount(generatePrivateKey());
    const contract = await viem.deployContract("GameRewardClaim", [authorizerAccount.address]);
    const publicClient = await viem.getPublicClient();
    const chainId = await publicClient.getChainId();

    const message = authorization({
      recipient: getAddress(recipient.account.address),
      claimId: keccak256(stringToHex("valid-claim")),
    });
    const signature = await authorizerAccount.signTypedData(
      rewardAuthorizationTypedDataV1(message, {
        chainId: BigInt(chainId),
        verifyingContract: contract.address,
      }),
    );

    await contract.write.claim!([message, signature]);

    assert.equal(await contract.read.claimConsumed!([message.claimId]), true);
    assert.equal(
      await contract.read.syntheticPoints!([message.stableApplicationId, message.recipient]),
      AMOUNT,
    );
    assert.equal(await contract.read.authorizer!(), getAddress(authorizerAccount.address));

    const bytecode = await publicClient.getCode({ address: contract.address });
    assert.ok(bytecode);
    assert.equal(bytecode.includes(stringToHex("nullifier").slice(2)), false);
    assert.equal(bytecode.includes(stringToHex("identityCommitment").slice(2)), false);
    assert.equal(bytecode.includes(stringToHex("opaqueSubject").slice(2)), false);
  });

  void it("rejects replay of the same claim ID", async () => {
    const { viem } = await hre.network.create();
    const authorizerAccount = privateKeyToAccount(generatePrivateKey());
    const contract = await viem.deployContract("GameRewardClaim", [authorizerAccount.address]);
    const publicClient = await viem.getPublicClient();
    const chainId = BigInt(await publicClient.getChainId());
    const message = authorization({ claimId: keccak256(stringToHex("replay-claim")) });
    const signature = await authorizerAccount.signTypedData(
      rewardAuthorizationTypedDataV1(message, {
        chainId,
        verifyingContract: contract.address,
      }),
    );

    await contract.write.claim!([message, signature]);
    await assert.rejects(contract.write.claim!([message, signature]));
  });

  void it("rejects recipient substitution", async () => {
    const { viem } = await hre.network.create();
    const [, alternate] = await viem.getWalletClients();
    assert.ok(alternate?.account);
    const authorizerAccount = privateKeyToAccount(generatePrivateKey());
    const contract = await viem.deployContract("GameRewardClaim", [authorizerAccount.address]);
    const publicClient = await viem.getPublicClient();
    const chainId = BigInt(await publicClient.getChainId());
    const message = authorization({ claimId: keccak256(stringToHex("recipient-claim")) });
    const signature = await authorizerAccount.signTypedData(
      rewardAuthorizationTypedDataV1(message, {
        chainId,
        verifyingContract: contract.address,
      }),
    );
    const substituted = {
      ...message,
      recipient: getAddress(alternate.account.address),
    };

    await assert.rejects(contract.write.claim!([substituted, signature]));
  });

  void it("rejects signer substitution", async () => {
    const { viem } = await hre.network.create();
    const [deployer] = await viem.getWalletClients();
    assert.ok(deployer);
    const authorizerAccount = privateKeyToAccount(generatePrivateKey());
    const contract = await viem.deployContract("GameRewardClaim", [authorizerAccount.address]);
    const publicClient = await viem.getPublicClient();
    const chainId = BigInt(await publicClient.getChainId());
    const message = authorization({ claimId: keccak256(stringToHex("signer-claim")) });
    const wrongSignature = await signAuthorization(deployer, contract.address, chainId, message);

    await assert.rejects(contract.write.claim!([message, wrongSignature]));
  });

  void it("rejects wrong chain or verifying contract bindings", async () => {
    const { viem } = await hre.network.create();
    const authorizerAccount = privateKeyToAccount(generatePrivateKey());
    const contract = await viem.deployContract("GameRewardClaim", [authorizerAccount.address]);
    const publicClient = await viem.getPublicClient();
    const chainId = BigInt(await publicClient.getChainId());
    const message = authorization({ claimId: keccak256(stringToHex("domain-claim")) });

    const wrongChainSignature = await authorizerAccount.signTypedData(
      rewardAuthorizationTypedDataV1(message, {
        chainId: chainId + 1n,
        verifyingContract: contract.address,
      }),
    );
    await assert.rejects(contract.write.claim!([message, wrongChainSignature]));

    const wrongContractSignature = await authorizerAccount.signTypedData(
      rewardAuthorizationTypedDataV1(message, {
        chainId,
        verifyingContract: "0x5555555555555555555555555555555555555555",
      }),
    );
    await assert.rejects(contract.write.claim!([message, wrongContractSignature]));
  });

  void it("rejects wrong application, result, and amount bindings", async () => {
    const { viem } = await hre.network.create();
    const authorizerAccount = privateKeyToAccount(generatePrivateKey());
    const contract = await viem.deployContract("GameRewardClaim", [authorizerAccount.address]);
    const publicClient = await viem.getPublicClient();
    const chainId = BigInt(await publicClient.getChainId());
    const message = authorization({ claimId: keccak256(stringToHex("bind-claim")) });
    const signature = await authorizerAccount.signTypedData(
      rewardAuthorizationTypedDataV1(message, {
        chainId,
        verifyingContract: contract.address,
      }),
    );

    await assert.rejects(
      contract.write.claim!([{ ...message, stableApplicationId: OTHER_APPLICATION_ID }, signature]),
    );
    await assert.rejects(
      contract.write.claim!([
        { ...message, resultId: keccak256(stringToHex("other-result")) },
        signature,
      ]),
    );
    await assert.rejects(contract.write.claim!([{ ...message, amount: AMOUNT + 1n }, signature]));
  });

  void it("rejects expired claims", async () => {
    const { viem } = await hre.network.create();
    const authorizerAccount = privateKeyToAccount(generatePrivateKey());
    const contract = await viem.deployContract("GameRewardClaim", [authorizerAccount.address]);
    const publicClient = await viem.getPublicClient();
    const chainId = BigInt(await publicClient.getChainId());
    const message = authorization({ claimId: keccak256(stringToHex("expired-claim")) }, 1n);
    const signature = await authorizerAccount.signTypedData(
      rewardAuthorizationTypedDataV1(message, {
        chainId,
        verifyingContract: contract.address,
      }),
    );

    await assert.rejects(contract.write.claim!([message, signature]));
  });

  void it("matches the published policy typehash and golden digest", () => {
    assert.equal(
      REWARD_AUTHORIZATION_V1_TYPEHASH,
      keccak256(
        stringToHex(
          "RewardAuthorizationV1(uint8 version,bytes32 stableApplicationId,bytes32 resultId,bytes32 claimId,address recipient,uint256 amount,uint64 expiresAt)",
        ),
      ),
    );
    assert.equal(
      hashRewardAuthorizationV1(
        {
          version: 1,
          stableApplicationId: "0x1111111111111111111111111111111111111111111111111111111111111111",
          resultId: "0x2222222222222222222222222222222222222222222222222222222222222222",
          claimId: "0x3333333333333333333333333333333333333333333333333333333333333333",
          recipient: "0x4444444444444444444444444444444444444444",
          amount: 100n,
          expiresAt: 1700003600n,
        },
        {
          chainId: 31337n,
          verifyingContract: "0x5555555555555555555555555555555555555555",
        },
      ),
      "0x7a2d30c01cc3590fe29b51bdc2a210ed0d467f44fa30e2d30e1780bb0e205876",
    );
  });
});
