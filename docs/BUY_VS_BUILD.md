# Buy Versus Build Matrix

**Status:** Mandatory MVP implementation constraint

**Rule:** Reuse reviewed standards; build only the product seam.

## Reuse directly

| Capability | Reuse | Project responsibility |
|---|---|---|
| Anonymous identity and membership | Semaphore v4 identity and group packages | Keep the identity secret in the browser and administer a synthetic group |
| Proof generation and verification | Semaphore v4 proof package and verifier | Define application-specific message and scope |
| Merkle tree and root history | Semaphore group/contracts behavior | Mirror roots correctly and test history |
| Cryptography and trusted setup | Pinned Semaphore and zk-kit artifacts | Never modify circuits, verifier, or ceremony artifacts |
| EVM encoding and interaction | Viem | Centralize typed data and chain configuration |
| Contract build and tests | Existing Hardhat 3 toolchain | Keep native PowerShell and Linux support |
| Common Solidity primitives | OpenZeppelin when semantics match | Use the smallest pinned primitive |
| World staging request and verification | Supported IDKit, server signing, simulator, and hosted verification | Add only through the Uniqueness Source adapter |
| Durable uniqueness | Database transactions and unique constraints | Make duplicate outcomes deterministic |

No World package is required for the synthetic localhost MVP. Do not add one
until a staging integration uses a documented supported API.

## Phase 2 durable-store decision

Phase 2 uses Node's built-in `node:sqlite` `DatabaseSync` API behind the
`CredentialIssuanceStore` boundary.

- **Concrete need:** durable transactions, authoritative unique constraints,
  restart recovery, and native Windows/Linux support for synthetic issuance.
- **Licence and maintenance:** Node.js and its bundled SQLite support are
  MIT-licensed and maintained by the Node.js project. The repository's
  `>=22.14.0` runtime floor includes this API.
- **Release age:** the API predates this decision by more than seven days. It
  remains marked experimental in Node 22 and emits an experimental warning;
  that is accepted only for this local synthetic MVP behind a replaceable
  store interface.
- **Added dependencies:** none. Semaphore Group `4.14.2` and Viem `2.54.2`
  were already pinned and are reused unchanged.
- **Rejected alternatives:** an in-memory map is not durable; a JSON file has
  no database-enforced uniqueness or transaction isolation; `better-sqlite3`
  adds a native dependency and install surface without changing MVP
  semantics; a client/server database adds operations not needed for one
  localhost process.

Production remains gated on a supported durable database, migrations,
backups, monitoring, and load-tested transaction isolation.

## Phase 4 localhost application decision

Phase 4 uses Node's built-in HTTP server and Web Crypto APIs, plus the already
resolved `esbuild` `0.28.1` package to produce one local browser bundle.

- **Concrete need:** four localhost routes, JSON boundaries, browser-only
  Semaphore proof generation, a browser-held Login Key, and one bundle that
  works from native Windows and Linux without a production web framework.
- **Licence and maintenance:** Node.js is MIT-licensed and maintained by the
  Node.js project. `esbuild` is MIT-licensed and actively maintained by its
  established upstream project.
- **Release age:** `esbuild` `0.28.1` was published on 2026-06-11, more than
  seven days before this decision. All Semaphore, zk-kit, Viem, and workspace
  packages are the already pinned reviewed versions.
- **Added dependencies:** `esbuild` becomes a direct build dependency but was
  already present at exactly `0.28.1` in the lockfile. No runtime web framework,
  UI framework, router, cookie library, or server cryptography package is
  added.
- **Rejected alternatives:** Vite adds a development-server and plugin surface
  not needed by a deterministic built demo; React adds a rendering runtime for
  four thin pages; Express or Fastify duplicates sufficient built-in HTTP
  behavior; hand-written browser module graphs cannot resolve workspace and
  Semaphore package imports without a bundling step.

This is a localhost demonstration stack, not a production HTTP architecture.
Production remains gated on supported session transport, CSRF controls, rate
limits, observability, hardened key storage, and a reviewed deployment model.

## Phase 5 reward claim decision

Phase 5 reuses Viem EIP-712 helpers and OpenZeppelin `EIP712`/`ECDSA`
primitives already pinned in the workspace. No new packages are added beyond
the workspace `@agentvisa/policy` link used by contract tests to share the
typed Reward Authorization encoder.

- **Concrete need:** one fixed EIP-712 Reward Authorization, one minimal
  `GameRewardClaim` consumer, and one trusted authorizer that signs only for
  eligible local application results.
- **Licence and maintenance:** Viem and OpenZeppelin Contracts are MIT-licensed
  and already maintained upstream dependencies of this repository.
- **Release age:** Viem `2.54.2`, OpenZeppelin Contracts `5.1.0`, and Hardhat
  `3.9.1` were already pinned more than seven days before this decision.
- **Added dependencies:** none outside the monorepo. `@agentvisa/policy` is
  linked into `@agentvisa/contracts` solely so adversarial contract tests share
  the published encoder and golden vectors.
- **Rejected alternatives:** reusing historical Mandate/Scope encodings would
  mix superseded smart-account semantics into reward claims; a custom Groth16
  or Semaphore claim verifier is out of scope and forbidden on-chain for this
  MVP; an ERC-20/treasury surface exceeds the synthetic points seam; a second
  EIP-712 library duplicates Viem/OpenZeppelin.

## Phase 6 Arbitrum Sepolia deployment decision

Phase 6 reuses the existing Hardhat 3 HTTP network support and Viem clients
already pinned in `@agentvisa/contracts`. No new packages are added.

- **Concrete need:** deploy `GameRewardClaim` to chain `421614`, write a
  verified deployment record, submit one Blair synthetic claim, and prove
  deterministic replay failure.
- **Licence and maintenance:** Hardhat and Viem are MIT-licensed and already
  maintained upstream dependencies of this repository.
- **Release age:** Hardhat `3.9.1` and Viem `2.54.2` were already pinned more
  than seven days before this decision.
- **Added dependencies:** none. A tiny local dotenv parser loads gitignored
  synthetic keys without introducing `dotenv`.
- **Rejected alternatives:** Hardhat Ignition adds a deployment framework not
  needed for one immutable contract; a second RPC/signing SDK duplicates Viem;
  deploying World/Semaphore verifiers exceeds the synthetic reward seam and is
  forbidden for this MVP; mainnet or real-value assets are forbidden.

World staging remains optional Phase 7.

## Build only the product seam

### Enrollment Authorization

Build a fixed, versioned signed object binding:

- source and uniqueness domain;
- opaque subject;
- Credential schema and assurance;
- Semaphore identity commitment;
- issued and expiry times;
- nonce.

Build source-policy validation, atomic nonce/subject consumption, and
idempotent Credential issuance.

### Application registration encoding

Build one versioned typed encoder for:

- scope derived from Stable Application ID;
- message derived from Stable Application ID and Login Key;
- conversion into Semaphore-compatible fields;
- cross-runtime golden vectors if Solidity later consumes the same values.

Do not build a custom proof system or global identity.

### Relying Party account seam

Build:

- proof verification orchestration;
- atomic Registration Nullifier consumption and account creation;
- application sessions;
- gaming adapter for play, win, and game-local ban state;
- redacted audit events.

Do not build a generic identity platform, moderation engine, or bot detector.

### Reward Authorization

Build one minimal EIP-712 format and Arbitrum Sepolia contract that:

- verifies one configured application signer;
- binds the complete claim context;
- rejects expiry and substitution;
- consumes each claim ID once;
- records synthetic points or emits an event.

Do not build a token, treasury, bridge, paymaster, wallet, or upgrade framework.

### Demo application

Build four routes in one localhost application:

- enrollment;
- one game;
- game operator;
- redacted audit timeline.

Keep core services platform-agnostic and isolate Robot Rally behavior in the
gaming adapter and UI.

## Do not build in the MVP

- World circuits, verifier, OPRF service, authenticator, registry, bridge,
  relay, or World App;
- a World-native third-party credential claim unsupported by current tooling;
- custom Semaphore circuit, verifier, Merkle tree, nullifier, or trusted setup;
- public identity registry or global gamer identifier;
- global bans or cross-platform moderation;
- credential recovery or reissuance;
- KYC, liveness, document, or biometric verification;
- bot detection;
- smart account, ERC-4337, Safe, Safe7579, Smart Sessions, session-key policy,
  bundler, paymaster, or relayer;
- token economics, real-value rewards, mainnet deployment, governance, or
  upgradeability;
- repeated personhood proofs for login, play, win, or claim.

## Dependency gate

Before adding a package or contract:

1. confirm it is needed by the active build phase;
2. inspect licence, maintenance, publication age, and exact version;
3. map relevant audits and known deployment provenance;
4. compare exact semantics with installed dependencies;
5. pin security-sensitive versions and update the dependency review;
6. run the full verification and audit suite.

Historical smart-account code may remain as tested repository material, but it
is not part of the active gaming-platform MVP and must not drive new work.
