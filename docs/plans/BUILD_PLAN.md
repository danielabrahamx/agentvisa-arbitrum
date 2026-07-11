# Gaming Platform MVP Build Plan

**Status:** Active

**Current phase:** Phase 7 — Optional World staging adapter (deferred)

**Rule:** Phases 0–6b are complete. Competition demo uses real Arbitrum Sepolia
for reward claims and a public HTTPS URL. Identity/enroll/play remain off-chain
synthetic for MVP. Optional World staging must not block the live claim demo.

## Acceptance journey

The MVP is complete when:

1. Alex receives a synthetic Enrollment Authorization bound to a locally
   generated Semaphore commitment.
2. AgentVisa consumes it once and issues an AgentVisa Semaphore Credential.
3. Alex registers for Robot Rally with Wallet A.
4. The game creates one pseudonymous Game Account after one Credential Proof.
5. Alex plays without another proof and is banned by the game operator.
6. Alex retries with Wallet B and another username; the same game nullifier
   resolves to the existing banned account.
7. Blair independently enrolls, registers, plays, wins, and receives one
   Reward Authorization.
8. Blair claims synthetic points on Arbitrum Sepolia; replay and substitution
   fail.
9. The audit route labels synthetic, trusted off-chain, locally verified, and
   Arbitrum-confirmed events without exposing global identity data.

Core enrollment, Credential, registration, account, and reward types must be
platform-agnostic. Robot Rally is the first Relying Party adapter.

## Phase 0: Canonical pivot and baseline

**Status:** Complete. Canonical documents were replaced or superseded, and all
root checks passed in native Windows PowerShell on 2026-07-11.

Deliver:

- canonical context, architecture, security, buy-versus-build, README, handoff,
  and ADRs describe the gaming-platform MVP;
- old smart-account continuation instructions are removed or superseded;
- existing uncommitted Safe4337 work is preserved as historical implementation
  unless separately removed;
- the current root verification suite is run and failures recorded.

Acceptance:

- no canonical document directs agents to continue Robinhood, Safe7579, Smart
  Sessions, Mandate, or session-key work;
- historical research remains clearly non-canonical;
- no secrets or production data are introduced.

## Phase 1: Typed enrollment and registration primitives

**Status:** Complete. Fixed-width Enrollment Authorization and application
registration encodings, source-policy validation, BN254 conversion, and normal,
boundary, malformed, and substitution vectors pass the root verification suite.

Test first, then implement:

- versioned Enrollment Authorization schema;
- deterministic signing digest and validation;
- source-policy validation;
- versioned application scope/message derivation;
- BN254 field conversion using the existing documented function;
- normal, boundary, malformed, and substitution vectors.

Acceptance:

- source, domain, schema, assurance, commitment, nonce, and time are bound;
- Stable Application ID and Login Key are bound;
- wallet, username, season, and attempt are absent from scope;
- no new cryptographic primitive is written.

## Phase 2: Atomic Credential issuance

**Status:** Complete. The synthetic source signs the typed authorization
digest with an injected development key; file-backed SQLite atomically enforces
nonce, opaque-subject, and commitment uniqueness; standard Semaphore v4 group
membership reconstructs deterministically after restart; and the browser module
persists the identity secret locally while exposing only its commitment.

Test first, then implement:

- synthetic Uniqueness Source adapter;
- local Semaphore identity creation with browser-only secret storage;
- durable Enrollment Authorization records;
- atomic nonce and opaque-subject consumption;
- idempotent admission to one AgentVisa Semaphore group;
- valid, replayed, expired, wrong-source, wrong-domain, wrong-signature, and
  substituted-commitment paths;
- concurrent duplicate enrollment.

Acceptance:

- one source authorization admits one commitment;
- races produce one success;
- only the commitment and required source metadata reach issuer state;
- the UI says “synthetic” and “AgentVisa Semaphore Credential.”

## Phase 3: Application registration and account lifecycle

**Status:** Complete. Application-scoped registration, atomic nullifier
consumption, opaque sessions, local bans, and the Robot Rally adapter pass the
root verification suite.

Test first, then implement platform-agnostic services for:

- one application-scoped Semaphore proof;
- local proof verification;
- atomic nullifier insertion and Application Account creation;
- Login Key authentication or opaque sessions;
- deterministic duplicate-account lookup;
- application-local status and session invalidation;
- redacted audit events.

Add a gaming adapter for:

- Robot Rally registration;
- play and win records;
- manual bot flag and game-local ban;
- payout-wallet replacement without account replacement.

Acceptance:

- a second wallet and username produce the same game nullifier;
- a banned account cannot re-enter;
- different Stable Application IDs are unlinkable at the nullifier layer;
- games never receive enrollment subjects or identity commitments;
- routine activity requests no additional Credential Proof.

## Phase 4: Localhost demo

**Status:** Complete. Thin Node `http` demo with `/enroll`,
`/games/robot-rally`, `/operator/robot-rally`, and `/audit`; deterministic Alex
and Blair journeys; prepared failure paths; and explicit trust/privacy labels
pass the root verification suite on native Windows PowerShell.

Build:

- `/enroll`;
- `/games/robot-rally`;
- `/operator/robot-rally`;
- `/audit`;
- prepared synthetic Alex and Blair journeys;
- explicit trust and privacy labels.

Acceptance:

- the complete flow runs from native Windows PowerShell;
- refresh and retry behavior is deterministic;
- secrets, raw proofs, and global identifiers are not printed;
- failures are prepared and demonstrable, not described only in prose.

## Phase 5: Reward claim

**Status:** Complete

Implemented:

- fixed EIP-712 Reward Authorization in `@agentvisa/policy` with golden
  vectors;
- minimal `GameRewardClaim` contract generalized internally by Stable
  Application ID;
- one trusted `RewardAuthorizer` over Robot Rally eligibility;
- claim expiry and one-time claim ID consumption;
- synthetic points plus `RewardClaimed` event;
- local Hardhat deployment and adversarial contract tests.

Required failures covered:

- replay;
- recipient substitution;
- signer substitution;
- wrong chain or contract;
- wrong application or result;
- changed amount;
- expiry;
- banned or ineligible account before authorization issuance.

Acceptance met:

- no identity or proof data is stored on-chain;
- state updates precede external interaction / signature return;
- no token, treasury, upgradeability, or arbitrary call surface exists.

## Phase 6: Arbitrum Sepolia

**Status:** Complete. `GameRewardClaim` is live on chain `421614` at
`0x0A93815977f7c8c2fE6126869254506B807C4E58` with records under
`deployments/421614/`, one Blair synthetic claim + replay rejection proven
on-chain, and public-RPC integration tests green. Source left unverified on
Arbiscan; bytecode hash is recorded. No World/Semaphore verifier or
personally identifying data was deployed.

After all local checks pass:

- obtain an explicitly synthetic deployer and test ETH;
- deploy the reward contract to chain `421614`;
- verify source and record bytecode, constructor data, transaction, and explorer
  links under `deployments/421614/`;
- submit Blair's synthetic claim and verify the receipt on-chain;
- show deterministic replay failure.

No World verifier, Semaphore proof, PII, or real-value asset is deployed.

## Phase 6b: Live Arbitrum Sepolia demo + public URL

**Status:** Complete.

Delivered:

- public HTTPS demo via Cloudflare quick tunnel (see `HANDOFF.md` for current URL);
- UI labels: identity off-chain / reward on Arbitrum Sepolia;
- browser MetaMask/Rabby on `421614` submits `GameRewardClaim.claim`;
- server EIP-712 authorizer from `.env`; fresh derived claim IDs per win;
- README wallet/browser/network/bridge instructions;
- root checks green.

## Phase 7: Optional World staging adapter

**Status:** Active only if the user requests it. Optional for MVP storytelling.

When staging credentials are available:

- configure Developer Portal staging `app_id`, `rp_id`, and server-held signing
  key;
- run the supported `proofOfHuman` simulator flow;
- forward the unmodified result to hosted verification;
- bind the browser commitment without varying the fixed enrollment action;
- map the verified result into the same Enrollment Authorization interface;
- test nullifier replay.

Do not claim or implement arbitrary production World credential issuance
without an officially supported end-to-end path.

## Deferred production work

- Credential and Game Account recovery that preserves bans;
- real World production and real-device integration;
- separated services, durable production transactions, HSM keys, monitoring,
  retention, appeals, and incident response;
- credential lending and multiple-source-identity abuse controls;
- throughput and availability engineering;
- real-value rewards, mainnet, and external security review.

## Required root checks

```text
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm test:integration
pnpm audit
```

All commands must remain usable from native Windows PowerShell and Linux CI.
