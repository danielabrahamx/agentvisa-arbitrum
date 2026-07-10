# AgentVisa Arbitrum Handoff

**Saved:** 2026-07-10  
**Status:** In progress  
**Branch:** `main`, no commits yet  
**Current phase:** Phase 1C Robinhood infrastructure write tracer bullet pending

## Start here

Repository:

```text
C:\Users\danie\agentvisa-arbitrum
```

Read in this order before changing anything:

1. `AGENTS.md`
2. `CONTEXT.md`
3. `README.md`
4. `docs/ARCHITECTURE.md`
5. `docs/SECURITY.md`
6. `docs/BUY_VS_BUILD.md`
7. `docs/adr/0001` through `0005`
8. `docs/plans/BUILD_PLAN.md`
9. `docs/research/2026-07-10-implementation-options.md`
10. `docs/research/2026-07-10-phase-1c-infrastructure-probe.md`
11. `docs/dependencies/phase-0-review.md`
12. `deployments/46630/infrastructure-probe.json`

Do not restart broad research. Continue the ordered executable tracer bullets.

## Product and non-negotiable security model

AgentVisa lets people automate self-custodial Smart Accounts without giving AI agents unrestricted authority, then lets those agents privately prove owner attributes when a trusted issuer and relying party support them.

- Identity evidence, PII, liveness media, legal documents, payments, and private keys stay off-chain.
- The Account Owner retains normal Safe ownership and recovery authority.
- The Agent receives only a constrained Session Key.
- Account Owner authorization and a Credential Proof are both required and bind the same Permission Digest.
- A Credential Proof never replaces normal Safe authorization.
- Standard Semaphore v4 provides anonymous approved-Operator membership.
- Do not build a Smart Account, EntryPoint, session framework, generic policy engine, bundler, paymaster, relayer, ZK circuit, Groth16 verifier, Merkle contract, wallet, KYC system, bridge, oracle, or custom chain.
- No production AgentVisa data, real funds, mainnet action, commit, or push is authorized.

ADR-0003 remains proposed. Safe plus Safe7579 plus Smart Sessions is not accepted until all Phase 1 gates pass.

## Completed work

### Phase 0 repository foundation

Completed and verified in native Windows PowerShell:

- pnpm workspace with Node `22.14.0` and pnpm `10.26.0`.
- Hardhat `3.9.1`, strict TypeScript, ESLint, Prettier, Vitest, and Viem.
- Root format, lint, typecheck, build, unit-test, integration-test, and audit commands.
- Windows and Linux GitHub Actions matrix in `.github/workflows/ci.yml`.
- Deployment-record JSON Schema in `deployments/deployment-record.schema.json`.
- Dependency licence, publication-age, rationale, and override review.
- Frozen-lockfile install succeeds.
- `pnpm audit` reports no known vulnerabilities.

Remote GitHub Actions have not run because no commit or push was requested. Do not claim Linux CI execution until it actually runs.

### Phase 1A typed policy digest

Implemented in TypeScript and Solidity:

- Fixed-size `MandateV1`.
- Exact Permission Digest binding.
- Separately domain-separated `ScopeV1`.
- BN254 scalar-field modulo conversion using Semaphore's pinned constant.
- Runtime version checks and malformed input rejection.
- Normal and boundary golden vectors.

Relevant files:

```text
packages/policy/src/field.ts
packages/policy/src/mandate-v1.ts
packages/policy/src/scope-v1.ts
packages/policy/vectors/mandate-v1.json
packages/policy/vectors/mandate-v1-boundary.json
packages/policy/vectors/mandate-v1-malformed.json
packages/policy/test/mandate-v1.test.ts
packages/contracts/contracts/libraries/MandateHashing.sol
packages/contracts/test/MandateHashing.t.sol
```

The published normal vector produces:

```text
Mandate Digest: 0xa57057412f32a509c42fc4bb67ed599d6d0a334fc5ced7f346cee3ef67cd7a04
Mandate Field: 9165380481275523325084094523019935225519179123998821192473183492942139849217
Scope Digest: 0x3b5ce215c968c43393e85fc8f4846a2aa40b21975c7bbf0d5d48b9fabb9454f1
Scope Field: 4962325506577176755166674703931804088394211299624358087955212963012580496624
```

Any digest change is a protocol-version change. Do not use JSON as a commitment encoding or replace `abi.encode` with packed dynamic encoding.

### Phase 1B local Semaphore

Completed with pinned standard upstream components:

- `@semaphore-protocol/contracts@4.14.2`.
- Separate `identity`, `group`, and `proof` packages at `4.14.2`.
- Trusted-setup artifacts `@zk-kit/semaphore-artifacts@4.13.0`, which Semaphore 4.14.2 selects internally.
- Standard Semaphore verifier and group contracts compiled through Hardhat 3 `npmFilesToBuild`.
- Standard Poseidon library deployed and linked locally.
- Synthetic Operator group creation, member addition, and member removal.
- Message and Scope binding.
- Nullifier replay rejection.
- Historical-root acceptance before expiry and rejection after expiry.
- No custom verifier, circuit, Merkle contract, or nullifier store.

Relevant files:

```text
packages/contracts/contracts/upstream/SemaphoreImports.sol
packages/contracts/test/integration/local-semaphore.integration.test.ts
packages/contracts/hardhat.config.ts
```

Native Windows caveat: Semaphore's SnarkJS proof generation leaves worker `MessagePort` handles open after proofs complete. The integration test records pre-existing handles and closes only new SnarkJS worker ports in its `after` hook. This is test-process cleanup and does not modify proof inputs, outputs, circuits, or verification. Local artifact paths are passed explicitly, so tests do not fetch trusted-setup files at runtime.

The aggregate `@semaphore-protocol/core` package was removed because its NodeNext declaration surface omitted exports that exist at runtime. The separate official packages have the same pinned implementation and pass strict type checking.

## Phase 1C read-only probe result

Read-only probing against `https://rpc.testnet.chain.robinhood.com` confirmed:

- Chain ID `46630`.
- EntryPoint v0.6, v0.7, and v0.8 bytecode.
- Pimlico's public bundler supports the deployed EntryPoints.
- Safe 1.4.1 singleton and proxy-factory bytecode hashes match `safe-global/safe-deployments`.
- Safe module setup v0.3.0 and Safe4337 module v0.3.0 are deployed.

Missing on Robinhood testnet:

- Safe7579 adapter and launchpad.
- Smart Sessions and compatibility fallback.
- Required standard Smart Sessions policies.

Rhinestone's supported Smart Account Infra chain list does not include Robinhood testnet. See:

- `docs/research/2026-07-10-phase-1c-infrastructure-probe.md`
- `deployments/46630/infrastructure-probe.json`

The probe manifest is an observation, not an AgentVisa deployment record. No transaction was sent.

## Immediate next steps

Continue Phase 1C in this order:

1. Re-run the full root verification commands before making changes.
2. Review current audited Safe7579 and Smart Sessions source revisions, licences, audits, and release ages.
3. Reject floating Git dependencies in the current `smartsessions` package manifest. Pin reproducible source revisions and record provenance before compilation.
4. Reproduce Safe7579, Smart Sessions, and only the required standard policies on a local Hardhat network.
5. Create a Safe and execute one owner-authorized local UserOperation through the pinned EntryPoint.
6. Prove direct Account Owner execution and revocation without a bundler or paymaster.
7. Reproduce and record the exact Smart Sessions Permission Digest in Phase 1D.
8. Test the mandatory external policy hook in Phase 1E, including initialization callback safety.
9. Only after local gates pass, obtain an explicitly synthetic testnet deployer and test ETH for the Robinhood write tracer bullet.

Stop for unavailable authentication, unavailable testnet secrets or funds, any mainnet action, real funds, production data, destructive operations, or a genuinely product-defining decision.

Do not write `AgentVisaAuthorization` or `AgentVisaCredentialPolicy` before Phase 1D and 1E pass.

## Dependency and audit state

Direct versions and security overrides are documented in `docs/dependencies/phase-0-review.md`. Important points:

- `@eslint/js` is `10.0.1`; the original `10.6.0` pin did not exist.
- The broad Hardhat Viem toolbox was replaced by exact Viem and Node test plugins to remove unused vulnerable verification dependencies.
- Semaphore packages are pinned to `4.14.2`; `4.14.3` was too new under repository policy.
- Security overrides patch transitive `circom_tester>snarkjs`, `underscore`, `undici`, `ws`, and `lodash-es` paths.
- `esbuild` is the only install script explicitly allowed by pnpm.
- The lockfile contains registry integrity hashes and no Git or remote-tarball resolutions.

Re-run `pnpm audit` after every dependency change. Do not suppress advisories or weaken repository security policy.

## Verification commands

Always use an explicit repository path in this environment:

```powershell
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" install --frozen-lockfile
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" format:check
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" lint
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" typecheck
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" build
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" test
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" test:integration
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" audit
```

The shell is Windows PowerShell 5.1, so `&&` is not a valid command separator. Package scripts themselves are cross-platform and must remain free of shell-specific syntax.

## Working tree

- Branch: `main`.
- No commits exist.
- Everything remains untracked because the remote repository was empty and no commit was requested.
- Repository-local `node_modules` and `pnpm-lock.yaml` now exist.
- No AgentVisa product contract or testnet deployment exists.
- Do not commit or push unless Daniel explicitly requests it.

Before any future commit, run every verification command and inspect the complete tree for secrets, accidental production data, and scope growth.
