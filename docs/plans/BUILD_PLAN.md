# Build Plan

**Status:** Active  
**Current phase:** Phase 1C Robinhood infrastructure write tracer bullet pending  
**Rule:** Complete phases in order. Do not implement later-phase features to avoid an earlier gate.

## Product acceptance

The first product is complete only when a synthetic approved Operator can authorize a constrained Agent Session on Robinhood Chain testnet, the Agent can execute one permitted action, and all relevant forbidden actions fail on-chain.

## Phase 0: Repository foundation

**Status:** Complete in native Windows PowerShell. Linux workflow is configured and awaits its first remote CI run because no commit or push was requested.

### Deliverables

- pnpm workspace with pinned Node and package-manager versions.
- Hardhat 3 contract package.
- TypeScript strict mode.
- Formatting, lint, typecheck, build, unit-test, integration-test, and audit commands.
- Native Windows PowerShell verification.
- Linux GitHub Actions verification.
- Dependency licence and release-age review.
- Initial deployment-record schema.

### Acceptance

From a fresh clone on Windows and Linux:

```text
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```

All commands pass without WSL-only assumptions.

## Phase 1: Architecture tracer bullets

This phase resolves every proposed dependency before product contracts depend on it.

### 1A. Policy digest

**Status:** Complete. TypeScript and Solidity match the published normal and boundary vectors, and malformed inputs are tested.

Implement `MandateV1`, typed hashing, hash-to-field conversion, and Scope Field conversion in TypeScript and Solidity.

Acceptance:

- Published golden vectors match in both languages.
- Boundary values and malformed inputs are tested.
- No JSON or packed dynamic encoding exists.

### 1B. Local Semaphore

**Status:** Complete in native Windows PowerShell with pinned Semaphore 4.14.2 contracts and SDK packages.

Deploy pinned Semaphore v4 contracts locally, create a group, add and remove test members, generate proofs, and validate them on-chain.

Acceptance:

- Message and scope binding pass.
- Replay fails.
- Historical-root duration behavior is captured in tests.
- No custom verifier code exists.

### 1C. Robinhood infrastructure probe

**Status:** Read-only probe complete. EntryPoint, Safe, Safe4337, and a public bundler are available. Safe7579, Smart Sessions, and required policies are absent. Local reproduction and the write tracer bullet remain pending.

On Robinhood testnet, verify exact addresses and behavior for:

- EntryPoint.
- Safe singleton and factory.
- Safe4337 module.
- Safe7579 adapter and launchpad.
- Smart Sessions and required policies.
- Bundler and optional paymaster.

Acceptance:

- A deployment manifest records bytecode hashes and source provenance.
- A Safe executes one owner-authorized UserOperation.
- Direct owner execution and revocation work without bundler dependence.

### 1D. Smart Sessions permission

Create one owner-approved session with one target, selector, amount, cumulative limit, and expiry.

Acceptance:

- Allowed action succeeds.
- Every denied action in the v1 matrix fails.
- The exact Permission Digest is reproducible and recorded.

### 1E. AgentVisa policy hook

Prove that a mandatory Smart Sessions policy can check an external AgentVisa Authorization Record safely.

Acceptance:

- No unsafe external callback occurs during policy initialization.
- Missing, expired, revoked, wrong-account, and wrong-permission records fail.
- If the hook is not viable, stop and write an ADR for a narrow Safe-native module.

## Phase 2: Authorization contracts

### Deliverables

- `AgentVisaAuthorization`.
- `AgentVisaCredentialPolicy` if Phase 1E passes.
- `MandateHashing` Solidity library.
- Role and expiry configuration for synthetic test issuer.
- Events and custom errors.

### Contract surface

Minimum expected behavior:

```text
authorizeMandate(mandate, semaphoreProof)
revokeAuthorization(account, permissionDigest)
isAuthorizationActive(account, permissionDigest)
```

The actual interface is fixed only after Phase 1.

### Acceptance

- All invariants in `docs/SECURITY.md` pass.
- Test coverage includes every public state transition and failure mode.
- Fuzz and invariant tests cover digest binding, replay, time, and revocation.
- Contracts stay below repository size limits.

## Phase 3: Operator and account SDK

### Packages

- `policy`: typed Mandate and golden-vector implementation.
- `prover`: Semaphore identity, group mirror, and proof generation.
- `sdk`: Safe, Smart Sessions, authorization, bundler, and deployment clients.

### Acceptance

- No package accesses production AgentVisa data.
- Operator secrets remain local.
- SDK rejects network, address, digest, and deployment mismatches.
- A direct transaction fallback exists for owner revocation.
- Package interfaces use `CONTEXT.md` terms.

## Phase 4: End-to-end CLI

### Demo flow

```text
create-test-operator
add-test-member
create-safe
create-session-key
define-mandate
prove-mandate
authorize-mandate
enable-session
execute-allowed-action
execute-denied-actions
revoke-session
```

Commands may be consolidated, but each state transition must remain inspectable.

### Acceptance

- Fresh synthetic identity completes the full flow.
- Secrets are never printed by default.
- Every transaction links to the testnet explorer.
- Re-running commands is safe or fails with a clear state-specific error.
- The demo can run from PowerShell.

## Phase 5: Robinhood testnet release

### Deliverables

- Verified contracts.
- Deployment records under `deployments/46630/`.
- Reproducible deployment guide.
- Working demo script.
- Architecture diagram.
- Gas report.
- Security review report.

### Acceptance

- Repository and explorer state agree.
- No mainnet or production AgentVisa dependency exists.
- A clean reviewer can reproduce the demo.
- The demo shows allowed execution, policy violations, proof replay, expiry, and revocation.

## Phase 6: Product validation

Before adding credential standards or broader wallet policies, interview or integrate one design partner that operates agents with financially consequential permissions.

Questions to validate:

- Would bounded session keys solve a current risk?
- Does anonymous approved-human membership change access decisions?
- Which limits are actually required?
- Who is the buyer and who operates revocation?
- Is Safe or another account model required?

Acceptance:

- One written design-partner requirement set.
- A decision to continue, narrow, pivot, or stop.

## Later phases, not MVP

### Attribute credentials

Only after an issuer and relying party define a real claim:

- Issuer and schema registry.
- Predicate-proof adapter.
- Freshness and revocation.
- Beneficial-owner-to-Agent delegation.
- Offering and jurisdiction binding.

### Expanded policies

Each requires a separate ADR and security plan:

- Multiple targets or selectors.
- ERC-20 transfer and recipient controls.
- Token approvals or Permit2.
- Native value.
- Batch execution.
- Periodic budgets.
- Oracle-priced limits.
- Slippage policies.
- Cross-chain permissions.

### Production

Production AgentVisa integration, mainnet deployment, real funds, and regulated credentials are separate projects requiring explicit approval.