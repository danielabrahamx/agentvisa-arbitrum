# Dependency Review

**Reviewed:** 2026-07-10  
**Scope:** Direct dependencies and security overrides installed through Phase 1B

## Selection record

| Package | Version | Licence | Published (UTC) | Purpose and alternatives |
|---|---:|---|---|---|
| `@eslint/js` | 10.0.1 | MIT | 2026-02-06 | ESLint's official JavaScript rules. Corrects the nonexistent `10.6.0` pin; no separate rules package would reduce risk. |
| `@types/node` | 22.15.30 | MIT | 2025-06-05 | Types for the pinned Node 22 runtime. |
| `eslint` | 10.6.0 | MIT | 2026-06-26 | Cross-platform static checks. Biome would duplicate Prettier and TypeScript lint migration work. |
| `prettier` | 3.9.4 | MIT | 2026-06-30 | Deterministic cross-platform formatting. |
| `typescript` | 6.0.3 | Apache-2.0 | 2026-04-16 | Strict typed integration code and Hardhat configuration. |
| `typescript-eslint` | 8.62.0 | MIT | 2026-06-22 | Type-aware linting for TypeScript. |
| `vitest` | 4.1.9 | MIT | 2026-06-15 | Policy-package unit and golden-vector tests. Node's test runner was considered, but Vitest provides the existing workspace test interface and TypeScript support. |
| `@nomicfoundation/hardhat-node-test-runner` | 3.0.17 | MIT | 2026-06-04 | Official Hardhat 3 Node test runner. Selected directly instead of the toolbox to avoid unused Ignition and verification dependencies. |
| `@nomicfoundation/hardhat-viem` | 3.0.9 | MIT | 2026-06-04 | Official Hardhat 3 Viem integration. Selected directly instead of the toolbox to avoid unused plugins and a vulnerable verification dependency. |
| `hardhat` | 3.9.1 | MIT | 2026-07-02 | Native PowerShell and Linux contract build and test tool selected by ADR-0004. Foundry remains supplemental because it is not a native PowerShell workflow. |
| `viem` | 2.54.2 | MIT | 2026-07-03 | Typed EVM ABI encoding and interaction selected by ADR-0004. Ethers would duplicate the EVM client surface. |
| `@semaphore-protocol/contracts` | 4.14.2 | MIT | 2026-01-23 | Audited standard Semaphore verifier, group, root-history, and nullifier contracts required by ADR-0002. The upstream Hardhat plugin is not used because it only supports Hardhat 2. |
| `@semaphore-protocol/identity` | 4.14.2 | MIT | 2026-01-23 | Official Semaphore Identity implementation required by ADR-0002. |
| `@semaphore-protocol/group` | 4.14.2 | MIT | 2026-01-23 | Official LeanIMT group mirror required for standard proof generation and member-removal witnesses. |
| `@semaphore-protocol/proof` | 4.14.2 | MIT | 2026-01-23 | Official Semaphore proof generation and verification implementation. The aggregate core package was rejected because its NodeNext declaration surface omits runtime exports. |
| `@zk-kit/semaphore-artifacts` | 4.13.0 | MIT | 2025-08-26 | Trusted-setup WASM and zkey files selected by Semaphore 4.14.2 itself, pinned locally so tests do not fetch artifacts at runtime. |
| `@types/snarkjs` | 0.7.9 | MIT | 2025-01-06 | Declaration support for the pinned official proof package's SnarkJS dependency. |

Every direct version was published at least seven days before this review and is pinned exactly in `package.json` or a workspace package manifest.

## Security overrides

| Package | Version | Licence | Published (UTC) | Reason |
|---|---:|---|---|---|
| `lodash-es` | 4.18.0 | MIT | 2026-03-31 | Overrides the Hardhat Ignition transitive version affected by GHSA-r5fr-rjxr-66jc. The release is marked deprecated by npm but is the advisory's patched version. Remove the override when upstream pins a non-deprecated patched release. |
| `undici` | 6.27.0 | MIT | 2026-06-15 | Overrides the Actions HTTP client transitive version affected by three high-severity WebSocket advisories. |
| `snarkjs` | 0.7.6 | GPL-3.0 | 2026-01-12 | Replaces an obsolete transitive copy affected by GHSA-xp5g-jhg3-3rg2. It is proof-generation tooling and is not shipped in a contract. |
| `underscore` | 1.13.8 | MIT | 2026-02-19 | Replaces the vulnerable transitive version pulled by Semaphore artifact tooling. |
| `ws` | 8.21.0 | MIT | 2026-05-22 | Replaces the vulnerable transitive version pulled through ZK-Kit utilities. |

`esbuild` is the only dependency allowed to run an install script. Its platform-binary installation is required by Vitest's Vite dependency. The pnpm lockfile contains registry integrity hashes and no Git or remote-tarball resolutions.

## Audit result

`pnpm audit` reports no known vulnerabilities.
