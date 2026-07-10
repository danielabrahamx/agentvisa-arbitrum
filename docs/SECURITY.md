# Security Model

**Status:** Required invariants and MVP threat model  
**Scope:** Synthetic identities and test assets only

## Security objective

A compromised or mistaken Agent must not exceed the exact permission approved by both an accepted Credential holder and the Smart Account Owner.

The primary protected assets are:

- Smart Account funds.
- Account ownership and recovery authority.
- Operator privacy.
- Credential integrity.
- Mandate and Permission Digest integrity.
- Revocation availability.

## Principal threats

### Agent compromise

The Agent may be manipulated by prompts, tools, model output, dependencies, or an attacker holding its Session Key.

Control: the Session Key has default-deny policies and never becomes an owner or recovery key.

### Credential-proof substitution

An attacker may reuse a valid proof with a different account, permission, session key, chain, or authorization contract.

Control: every value is bound into a typed Mandate Digest and Scope. The contract recomputes both.

### Account takeover through credential proof

Any accepted Semaphore member could target another person's account if the proof replaced account-owner authorization.

Control: normal Safe owner approval remains mandatory. A Credential Proof is an additional requirement, never an owner signature.

### Replay

An attacker may replay proof installation or a signed agent action.

Control: Semaphore consumes a scope-specific installation nullifier. Smart Account and ERC-4337 nonces protect routine actions. EIP-712 domains include chain and verifying contract.

### Policy bypass

An allowed target or selector may contain parameters that permit a larger or different action than intended.

Control: the first policy supports one known target and selector with explicit parameter decoding. Unknown or malformed calldata reverts.

### Module privilege escalation

A session module, policy, fallback handler, batch executor, or delegatecall target could mutate account ownership or bypass checks.

Control: pin audited dependencies, deny administrative functions, disable wildcards and unsafe execution modes, and test exact deployed bytecode.

### Revocation failure

A compromised Session Key or revoked Credential may remain usable.

Control: Account Owner revocation is immediate and independent. Credential Authorization Records are short-lived. Group removal prevents new authorization after historical-root expiry.

### Privacy correlation

Public account, proof message field, scope, nullifier, permission, timing, and action patterns may be correlated.

Control: no PII or universal identifier is published, nullifiers are scope-specific, and relaying avoids requiring the Operator's ordinary wallet as fee payer. The system does not claim transaction-graph privacy.

### Issuer compromise

A compromised group administrator can add unauthorized commitments, remove valid members, or revoke known Authorization Records.

Control: synthetic test issuer for MVP. Before production, use a Safe-controlled issuer, documented incident response, monitoring, and bounded authorization lifetimes.

### Infrastructure failure

RPC, bundler, paymaster, or sequencer services may censor, delay, fail, or return false data.

Control: authorization and revocation support direct transaction submission. Do not trust provider responses without on-chain confirmation. Do not make bridge operations part of MVP.

## Required invariants

### Ownership

- A Credential Proof cannot add, remove, or replace an Account Owner.
- A Session Key cannot install another Session Key.
- A Session Key cannot change modules, fallback handlers, guards, recovery, or threshold.
- The Agent never receives owner or recovery secrets.

### Authorization

- Every active session has a matching owner-approved Permission Digest.
- Every AgentVisa-protected session has a matching active Authorization Record.
- Authorization Record account, permission, chain, and contract cannot be substituted.
- Authorization lifetime never exceeds the configured maximum.

### Proofs

- Semaphore group ID and contract are pinned.
- Proof message equals the recomputed Mandate Field.
- Proof scope equals the recomputed Scope Field.
- Each installation nullifier is consumed once.
- Historical-root behavior is explicitly tested.

### Policies

- Default outcome is deny.
- Only one exact target and selector are accepted in v1.
- Calldata shorter than four bytes is rejected.
- Malformed or non-canonical parameters are rejected.
- Per-action and cumulative limits cannot overflow.
- Cumulative state updates before external execution and rolls back if execution fails.
- Expired or revoked sessions cannot execute.

### Execution

- No arbitrary delegatecall.
- No wildcard target or selector.
- No arbitrary batch or nested call.
- No native value.
- No fallback authorization.
- No approval or permit path.
- No external callback during credential-policy initialization.

### Privacy

- No name, email, liveness artifact, payment record, legal document, biometric hash, or identity-to-account mapping is stored on-chain.
- No universal nullifier or stable cross-application Operator identifier exists.
- Logs contain only values required for auditability and integration.

## MVP adversarial tests

### Credential authorization

- Valid proof and matching Mandate succeeds once.
- Replayed proof fails.
- Wrong group, root, message, scope, chain, account, authorization contract, Permission Digest, Session Key, authorization ID, or time window fails.
- Expired historical root fails according to configured duration.
- Removed member cannot create authorization after root expiry.
- Authorization exceeding maximum lifetime fails.

### Owner authorization

- Credential proof without owner signature cannot enable a session.
- Owner signature without credential authorization cannot enable the protected session.
- Different owner-approved permission with the same proof fails.
- Signature from Session Key cannot enable or modify permissions.

### Session execution

- Correct Session Key, target, selector, parameters, and limits succeeds.
- Wrong signer, target, selector, asset, recipient, or account fails.
- Empty, short, malformed, appended, and non-canonical calldata fails.
- Amount above per-action limit fails.
- Several allowed actions above cumulative limit fail.
- Exact boundary amounts behave as specified.
- Expired, revoked, and uninstalled sessions fail.
- Reentrant target cannot exceed limits or reuse state.

### Privilege escalation

- Session cannot call Safe ownership, module, guard, fallback, threshold, recovery, or delegatecall paths.
- Session cannot use batch execution to hide a forbidden call.
- Session cannot install a new policy or validator.
- Session cannot approve token spending or grant Permit2 authority.

### Availability

- Owner can revoke directly without bundler or paymaster.
- A failed external action does not consume cumulative allowance unless the whole operation succeeds.
- Provider failure does not create a false local success state.

## Dependency and deployment controls

- Pin exact package and contract-source versions.
- Record dependency licences and audits.
- Exclude releases younger than seven days unless explicitly approved.
- Commit lockfiles and verify clean reproducible installs.
- Verify deployed bytecode against recorded build artifacts.
- Verify source on Blockscout.
- Never load deployer or owner keys from tracked files.
- Use synthetic keys for tests and documented secret injection for deployment.

## Security gates

Before Robinhood testnet deployment:

- Unit, integration, negative, fuzz, and cross-language vector tests pass.
- Static analysis reports no unresolved high or critical findings.
- Dependency audit is reviewed.
- Threat model matches implemented features.
- Deployment script is tested against a fresh local chain.

Before any mainnet deployment:

- Explicit approval is recorded.
- External review or audit is complete.
- Issuer and Account Owner key management are documented.
- Emergency revocation is rehearsed.
- Monitoring and incident response are operational.
- No production PII or credential evidence enters public state.

## Reporting

Do not publish exploitable vulnerabilities in public issues. Until a dedicated security contact is established, report privately to the repository owner.