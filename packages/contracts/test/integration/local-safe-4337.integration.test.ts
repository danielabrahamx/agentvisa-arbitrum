import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  concat,
  decodeEventLog,
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  pad,
  parseAbiParameters,
  parseEther,
  toHex,
  zeroAddress,
} from "viem";
import { privateKeyToAccount, signMessage } from "viem/accounts";
import hre from "hardhat";

const OWNER_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const DOMAIN_SEPARATOR_TYPEHASH =
  "0x47e79534a245952e8b16893a336b85a3d9ea9fa8c573f3d803afb92a79469218" as const;
const SAFE_OP_TYPEHASH =
  "0xc03dfc11d8b10bf9cf703d558958c8c42777f785d998c62060d85a4f0ef6ea7f" as const;
const SAFE_TX_TYPEHASH =
  "0xbb8310d486368db6bd6f849402fdd73ad53d316b5a4b2644ad6efe0f941286d8" as const;
const SENTINEL_MODULES = "0x0000000000000000000000000000000000000001" as `0x${string}`;

function packU128Pair(high: bigint, low: bigint): `0x${string}` {
  return concat([pad(toHex(high), { size: 16 }), pad(toHex(low), { size: 16 })]);
}

function parseSignature(hexSignature: string): {
  r: `0x${string}`;
  s: `0x${string}`;
  v: number;
} {
  const sigHex = hexSignature.slice(2);
  return {
    r: `0x${sigHex.slice(0, 64)}`,
    s: `0x${sigHex.slice(64, 128)}`,
    v: parseInt(sigHex.slice(128, 130), 16),
  };
}

void describe("local Safe4337 integration", () => {
  void it("deploys Safe and executes an owner-authorized UserOp through EntryPoint", async () => {
    const { viem } = await hre.network.create();
    const [ownerWallet, beneficiaryWallet] = await viem.getWalletClients();
    assert.ok(ownerWallet);
    assert.ok(beneficiaryWallet);
    const publicClient = await viem.getPublicClient();
    const owner = privateKeyToAccount(OWNER_PRIVATE_KEY);

    const entryPoint = await viem.deployContract("EntryPoint");
    const safeSingleton = await viem.deployContract("Safe");
    const factory = await viem.deployContract("SafeProxyFactory");
    const safe4337 = await viem.deployContract("Safe4337Module", [entryPoint.address]);
    const moduleSetup = await viem.deployContract("SafeModuleSetup");

    const enableModuleCalldata = encodeFunctionData({
      abi: moduleSetup.abi,
      functionName: "enableModules",
      args: [[safe4337.address]],
    });
    const setupCalldata = encodeFunctionData({
      abi: safeSingleton.abi,
      functionName: "setup",
      args: [
        [owner.address],
        1n,
        moduleSetup.address,
        enableModuleCalldata,
        safe4337.address,
        zeroAddress,
        0n,
        zeroAddress,
      ],
    });

    const proxyTxHash = await factory.write.createProxyWithNonce!([
      safeSingleton.address,
      setupCalldata,
      0n,
    ]);
    const proxyReceipt = await publicClient.waitForTransactionReceipt({ hash: proxyTxHash });
    const proxyCreationLog = proxyReceipt.logs.find(
      (log) => log.topics[0] === keccak256("ProxyCreation(address,address)" as `0x${string}`),
    );
    assert.ok(proxyCreationLog, "ProxyCreation event not found");
    const decoded = decodeEventLog({
      abi: factory.abi,
      topics: proxyCreationLog.topics,
      data: proxyCreationLog.data,
    });
    const safeAddress = (decoded.args as unknown as { proxy: `0x${string}` }).proxy;
    assert.ok(safeAddress, "Safe proxy address not found in event");

    await ownerWallet.sendTransaction({
      account: ownerWallet.account,
      to: safeAddress,
      value: parseEther("1"),
    });

    const recipient = beneficiaryWallet.account.address;
    const transferAmount = parseEther("0.1");

    const callData = encodeFunctionData({
      abi: safe4337.abi,
      functionName: "executeUserOp",
      args: [recipient, transferAmount, "0x", 0],
    });

    const nonce = (await entryPoint.read.getNonce!([safeAddress, 0n])) as bigint;

    const verificationGasLimit = 1_000_000n;
    const callGasLimit = 1_000_000n;
    const preVerificationGas = 100_000n;
    const maxPriorityFeePerGas = 1_000_000_000n;
    const maxFeePerGas = 1_000_000_000n;

    const accountGasLimits = packU128Pair(verificationGasLimit, callGasLimit);
    const gasFees = packU128Pair(maxPriorityFeePerGas, maxFeePerGas);

    const chainId = await publicClient.getChainId();
    const domainSeparator = keccak256(
      encodeAbiParameters(parseAbiParameters("bytes32, uint256, address"), [
        DOMAIN_SEPARATOR_TYPEHASH,
        BigInt(chainId),
        safe4337.address,
      ]),
    );

    const safeOpStructHash = keccak256(
      encodeAbiParameters(
        parseAbiParameters(
          "bytes32, address, uint256, bytes32, bytes32, uint128, uint128, uint256, uint128, uint128, bytes32, uint48, uint48, address",
        ),
        [
          SAFE_OP_TYPEHASH,
          safeAddress,
          nonce,
          keccak256("0x"),
          keccak256(callData),
          verificationGasLimit,
          callGasLimit,
          preVerificationGas,
          maxPriorityFeePerGas,
          maxFeePerGas,
          keccak256("0x"),
          0,
          0,
          entryPoint.address,
        ],
      ),
    );

    const operationData = concat([
      toHex(0x19, { size: 1 }),
      toHex(0x01, { size: 1 }),
      domainSeparator,
      safeOpStructHash,
    ]);
    const operationDataHash = keccak256(operationData);

    const hexSignature = await signMessage({
      privateKey: OWNER_PRIVATE_KEY,
      message: { raw: operationDataHash },
    });
    const { r, s, v } = parseSignature(hexSignature);
    const adjustedV = v + 4;

    const packedSignature = concat([
      toHex(0n, { size: 6 }),
      toHex(0n, { size: 6 }),
      r,
      s,
      toHex(adjustedV, { size: 1 }),
    ]);

    const userOp = {
      sender: safeAddress,
      nonce,
      initCode: "0x" as `0x${string}`,
      callData,
      accountGasLimits,
      preVerificationGas,
      gasFees,
      paymasterAndData: "0x" as `0x${string}`,
      signature: packedSignature,
    };

    await entryPoint.write.handleOps!([[userOp], beneficiaryWallet.account.address]);

    const recipientBalance = await publicClient.getBalance({ address: recipient });
    assert.ok(
      recipientBalance >= transferAmount,
      "Recipient should have received at least the transfer amount",
    );
  });

  void it("proves direct owner execution and module revocation without bundler or paymaster", async () => {
    const { viem } = await hre.network.create();
    const [ownerWallet, beneficiaryWallet] = await viem.getWalletClients();
    assert.ok(ownerWallet);
    assert.ok(beneficiaryWallet);
    const publicClient = await viem.getPublicClient();
    const owner = privateKeyToAccount(OWNER_PRIVATE_KEY);

    const entryPoint = await viem.deployContract("EntryPoint");
    const safeSingleton = await viem.deployContract("Safe");
    const factory = await viem.deployContract("SafeProxyFactory");
    const safe4337 = await viem.deployContract("Safe4337Module", [entryPoint.address]);
    const moduleSetup = await viem.deployContract("SafeModuleSetup");

    const enableModuleCalldata = encodeFunctionData({
      abi: moduleSetup.abi,
      functionName: "enableModules",
      args: [[safe4337.address]],
    });
    const setupCalldata = encodeFunctionData({
      abi: safeSingleton.abi,
      functionName: "setup",
      args: [
        [owner.address],
        1n,
        moduleSetup.address,
        enableModuleCalldata,
        safe4337.address,
        zeroAddress,
        0n,
        zeroAddress,
      ],
    });

    const proxyTxHash = await factory.write.createProxyWithNonce!([
      safeSingleton.address,
      setupCalldata,
      0n,
    ]);
    const proxyReceipt = await publicClient.waitForTransactionReceipt({ hash: proxyTxHash });
    const proxyCreationLog = proxyReceipt.logs.find(
      (log) => log.topics[0] === keccak256("ProxyCreation(address,address)" as `0x${string}`),
    );
    assert.ok(proxyCreationLog, "ProxyCreation event not found");
    const decoded = decodeEventLog({
      abi: factory.abi,
      topics: proxyCreationLog.topics,
      data: proxyCreationLog.data,
    });
    const safeAddress = (decoded.args as unknown as { proxy: `0x${string}` }).proxy;
    assert.ok(safeAddress, "Safe proxy address not found in event");

    await ownerWallet.sendTransaction({
      account: ownerWallet.account,
      to: safeAddress,
      value: parseEther("1"),
    });

    const safeProxy = await viem.getContractAt("Safe", safeAddress);
    const recipient = beneficiaryWallet.account.address;
    const transferAmount = parseEther("0.2");

    // 1. Direct owner execution via execTransaction (no EntryPoint, no bundler, no paymaster).
    const chainId = await publicClient.getChainId();
    const safeDomainSeparator = keccak256(
      encodeAbiParameters(parseAbiParameters("bytes32, uint256, address"), [
        DOMAIN_SEPARATOR_TYPEHASH,
        BigInt(chainId),
        safeAddress,
      ]),
    );

    const safeTxHash = keccak256(
      encodeAbiParameters(
        parseAbiParameters(
          "bytes32, address, uint256, bytes32, uint8, uint256, uint256, uint256, address, address, uint256",
        ),
        [
          SAFE_TX_TYPEHASH,
          recipient,
          transferAmount,
          keccak256("0x"),
          0,
          0n,
          0n,
          0n,
          zeroAddress,
          zeroAddress,
          0n,
        ],
      ),
    );

    const safeTxData = concat([
      toHex(0x19, { size: 1 }),
      toHex(0x01, { size: 1 }),
      safeDomainSeparator,
      safeTxHash,
    ]);
    const safeTxDataHash = keccak256(safeTxData);

    const hexSignature = await signMessage({
      privateKey: OWNER_PRIVATE_KEY,
      message: { raw: safeTxDataHash },
    });
    const { r, s, v } = parseSignature(hexSignature);
    const adjustedV = v + 4;
    const signatures = concat([r, s, toHex(adjustedV, { size: 1 })]);

    await safeProxy.write.execTransaction!([
      recipient,
      transferAmount,
      "0x",
      0,
      0n,
      0n,
      0n,
      zeroAddress,
      zeroAddress,
      signatures,
    ]);

    const recipientBalance = await publicClient.getBalance({ address: recipient });
    assert.ok(
      recipientBalance >= transferAmount,
      "Direct owner execution should transfer ETH to recipient",
    );

    // 2. Revoke the Safe4337Module by disabling it as a module via execTransaction.
    //    disableModule has the `authorized` modifier (msg.sender == address(this)),
    //    so it must be called through a Safe transaction, not directly.
    const isModuleEnabledBefore = (await safeProxy.read.isModuleEnabled!([
      safe4337.address,
    ])) as boolean;
    assert.ok(isModuleEnabledBefore, "Safe4337Module should be enabled before revocation");

    const disableModuleCalldata = encodeFunctionData({
      abi: safeSingleton.abi,
      functionName: "disableModule",
      args: [SENTINEL_MODULES, safe4337.address],
    });

    const revokeTxNonce = 1n;
    const revokeTxHash = keccak256(
      encodeAbiParameters(
        parseAbiParameters(
          "bytes32, address, uint256, bytes32, uint8, uint256, uint256, uint256, address, address, uint256",
        ),
        [
          SAFE_TX_TYPEHASH,
          safeAddress,
          0n,
          keccak256(disableModuleCalldata),
          0,
          0n,
          0n,
          0n,
          zeroAddress,
          zeroAddress,
          revokeTxNonce,
        ],
      ),
    );
    const revokeTxData = concat([
      toHex(0x19, { size: 1 }),
      toHex(0x01, { size: 1 }),
      safeDomainSeparator,
      revokeTxHash,
    ]);
    const revokeTxDataHash = keccak256(revokeTxData);

    const revokeSig = await signMessage({
      privateKey: OWNER_PRIVATE_KEY,
      message: { raw: revokeTxDataHash },
    });
    const revokeParsed = parseSignature(revokeSig);
    const revokeSignatures = concat([
      revokeParsed.r,
      revokeParsed.s,
      toHex(revokeParsed.v + 4, { size: 1 }),
    ]);

    await safeProxy.write.execTransaction!([
      safeAddress,
      0n,
      disableModuleCalldata,
      0,
      0n,
      0n,
      0n,
      zeroAddress,
      zeroAddress,
      revokeSignatures,
    ]);

    const isModuleEnabledAfter = (await safeProxy.read.isModuleEnabled!([
      safe4337.address,
    ])) as boolean;
    assert.ok(!isModuleEnabledAfter, "Safe4337Module should be disabled after revocation");
  });
});
