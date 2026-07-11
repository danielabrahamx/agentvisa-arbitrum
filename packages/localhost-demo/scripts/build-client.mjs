import { copyFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const outputDirectory = fileURLToPath(new URL("../dist/public/", import.meta.url));
await mkdir(outputDirectory, { recursive: true });

await build({
  entryPoints: [fileURLToPath(new URL("../src/client.ts", import.meta.url))],
  outfile: fileURLToPath(new URL("../dist/public/client.js", import.meta.url)),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "es2022",
  sourcemap: false,
  minify: true,
  legalComments: "none",
});

for (const name of ["semaphore-1.wasm", "semaphore-1.zkey"]) {
  await copyFile(
    fileURLToPath(import.meta.resolve(`@zk-kit/semaphore-artifacts/${name}`)),
    fileURLToPath(new URL(`../dist/public/${name}`, import.meta.url)),
  );
}
