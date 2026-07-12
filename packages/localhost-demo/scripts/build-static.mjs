import { readFileSync, writeFileSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";
import { getAddress } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { loadWorkspaceDotenv } from "../dist/load-dotenv.js";
import { renderStaticIndexHtml } from "../dist/static-pages.js";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const workspaceRoot = resolve(packageRoot, "../..");
const outputDirectory = resolve(packageRoot, "dist/public");
const admissionPath = resolve(workspaceRoot, "deployments/421614/admission.json");

loadWorkspaceDotenv(packageRoot);

await mkdir(outputDirectory, { recursive: true });

let admissionRecord;
try {
  admissionRecord = JSON.parse(readFileSync(admissionPath, "utf8"));
} catch {
  console.warn(
    `Warning: missing ${admissionPath}. Using placeholder config until deploy:admission-sepolia runs.`,
  );
  admissionRecord = {
    schemaVersion: 1,
    chainId: 421614,
    rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
    semaphore: "0x0000000000000000000000000000000000000000",
    admission: "0x0000000000000000000000000000000000000000",
    credentialGroupId: "0",
    stableApplicationId: "0x0000000000000000000000000000000000000000000000000000000000000000",
    enrollmentSourceId: "0x0000000000000000000000000000000000000000000000000000000000000000",
    enrollmentSigner: "0x0000000000000000000000000000000000000000",
    maximumValiditySeconds: "300",
  };
}

const admissionDeployment = JSON.stringify(admissionRecord);

const enrollmentSignerKey =
  process.env.VITE_DEMO_ENROLLMENT_SIGNER_PRIVATE_KEY ??
  process.env.ARBITRUM_SEPOLIA_ENROLLMENT_SIGNER_PRIVATE_KEY ??
  process.env.ARBITRUM_SEPOLIA_DEPLOYER_PRIVATE_KEY ??
  "0x0000000000000000000000000000000000000000000000000000000000000001";

if (
  admissionRecord.enrollmentSigner !== "0x0000000000000000000000000000000000000000" &&
  getAddress(privateKeyToAccount(enrollmentSignerKey).address) !==
    getAddress(admissionRecord.enrollmentSigner)
) {
  throw new Error(
    "Static demo build enrollment signer does not match deployments/421614/admission.json. Set ARBITRUM_SEPOLIA_DEPLOYER_PRIVATE_KEY or ARBITRUM_SEPOLIA_ENROLLMENT_SIGNER_PRIVATE_KEY in the workspace .env.",
  );
}

await build({
  entryPoints: [resolve(packageRoot, "src/static-client.ts")],
  outfile: resolve(outputDirectory, "client.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  sourcemap: false,
  minify: true,
  legalComments: "none",
  define: {
    __ADMISSION_DEPLOYMENT__: admissionDeployment,
    __DEMO_ENROLLMENT_SIGNER_PRIVATE_KEY__: JSON.stringify(enrollmentSignerKey),
  },
});

writeFileSync(resolve(outputDirectory, "index.html"), renderStaticIndexHtml(), "utf8");

for (const name of ["semaphore-1.wasm", "semaphore-1.zkey"]) {
  await copyFile(
    fileURLToPath(import.meta.resolve(`@zk-kit/semaphore-artifacts/${name}`)),
    resolve(outputDirectory, name),
  );
}

console.log(`Static demo built at ${outputDirectory}`);
