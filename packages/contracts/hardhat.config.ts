import hardhatNodeTestRunner from "@nomicfoundation/hardhat-node-test-runner";
import hardhatViem from "@nomicfoundation/hardhat-viem";
import { configVariable, defineConfig } from "hardhat/config";

import { loadWorkspaceDotenv } from "./scripts/load-dotenv.js";

loadWorkspaceDotenv();

export default defineConfig({
  plugins: [hardhatViem, hardhatNodeTestRunner],
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  solidity: {
    compilers: [
      {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.23",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    ],
    overrides: {
      "contracts/upstream/Safe4337Imports.sol": {
        version: "0.8.23",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
    npmFilesToBuild: [
      "@semaphore-protocol/contracts/Semaphore.sol",
      "@semaphore-protocol/contracts/base/SemaphoreVerifier.sol",
      "poseidon-solidity/PoseidonT3.sol",
      "@account-abstraction/contracts/core/EntryPoint.sol",
      "@safe-global/safe-contracts/contracts/Safe.sol",
      "@safe-global/safe-contracts/contracts/proxies/SafeProxy.sol",
      "@safe-global/safe-contracts/contracts/proxies/SafeProxyFactory.sol",
      "@safe-global/safe-4337/contracts/Safe4337Module.sol",
      "@safe-global/safe-4337/contracts/SafeModuleSetup.sol",
    ],
  },
  networks: {
    arbitrumSepolia: {
      type: "http",
      chainType: "op",
      chainId: 421614,
      url: configVariable("ARBITRUM_SEPOLIA_RPC_URL"),
      accounts: [configVariable("ARBITRUM_SEPOLIA_DEPLOYER_PRIVATE_KEY")],
    },
  },
  test: {
    solidity: {
      fuzz: {
        runs: 256,
      },
    },
  },
});
