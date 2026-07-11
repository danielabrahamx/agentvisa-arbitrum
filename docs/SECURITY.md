# Security Model

**Status:** Required MVP invariants

**Scope:** Synthetic identities, application data, and rewards only

## Objective

One accepted enrollment may issue at most one configured Credential, and one
Credential may create at most one account for each Stable Application ID.
Neither wallet changes nor concurrent requests may bypass those limits.

## Trust model

Trusted in the MVP:

- the configured synthetic Uniqueness Source key;
- AgentVisa issuance and Semaphore group administration;
- the Relying Party database, moderation, result, and eligibility decisions;
- the Reward Authorizer key;
- Arbitrum Sepolia consensus for confirmed claim state.

Validated at boundaries:

- browser payloads and commitments;
- Enrollment Authorizations and signatures;
- Semaphore proofs and public inputs;
- Login Keys, sessions, usernames, and payout addresses;
- timestamps, RPC responses, and EIP-712 claim data;
- concurrent enrollment, registration, and claim submissions.

## Principal threats and controls

### Enrollment replay or substitution

An attacker may replay an authorization or replace its source, domain, schema,
commitment, nonce, or expiry.

Control: sign every field, enforce source policy, reject expiry, and atomically
consume a unique `(sourceId, nonce)`.

### Multiple credentials from one source identity

Concurrent or repeated enrollment may bind one accepted source event to
multiple Semaphore identities.

Control: the source adapter exposes a stable opaque subject or nullifier, the
issuer binds the commitment, and durable uniqueness constraints make one
enrollment authoritative.

### Registration replay or wallet switching

A holder may retry with another wallet, username, or request to evade an
existing application account or ban.

Control: Semaphore scope contains only the Stable Application ID. Proof
verification, nullifier insertion, and account creation are one transaction
with a unique `(stableApplicationId, registrationNullifier)` constraint.

### Cross-application correlation

A global scope, identifier, wallet, username, analytics ID, or logs may link a
holder across applications.

Control: derive a distinct nullifier per Stable Application ID; never expose
the enrollment subject or identity commitment to Relying Parties; redact logs.
The MVP does not claim network- or transaction-graph privacy.

### Login-key substitution

An intercepted proof could create an account controlled by another Login Key.

Control: the proof message binds the Stable Application ID and Login Key.
Validate canonical key encoding before proof verification.

### Moderation bypass

Changing payout or login wallets could reset account state.

Control: moderation belongs to the Application Account keyed by the consumed
Registration Nullifier, not to a wallet or username.

### Credential loss and reissuance

Issuing membership to a replacement Semaphore identity creates new
application nullifiers and may evade old bans.

Control: the MVP has no recovery or reissuance. Production recovery is blocked
until continuity across existing Application Accounts is designed.

### Reward forgery and replay

An attacker may alter result, application, recipient, amount, chain, contract,
expiry, claim ID, or signer.

Control: bind every value in EIP-712, pin the authorizer, reject expiry, consume
claim IDs once, and update state before external interaction.

### Issuer or platform compromise

The issuer can add unauthorized members; a platform can falsify moderation or
results; an authorizer can sign invalid rewards.

Control: disclose these trust assumptions. Use synthetic data and points only.
Production requires separated duties, hardened keys, monitoring, and incident
response.

## Required invariants

Enrollment:

- the identity secret never leaves the browser;
- every accepted authorization has a valid configured source signature;
- source, uniqueness domain, schema, assurance, commitment, nonce, and expiry
  cannot be substituted;
- each source nonce and accepted opaque subject is consumed at most once;
- concurrent duplicates produce one success and deterministic duplicate
  responses.

Credential proofs:

- standard pinned Semaphore v4 packages are used unchanged;
- group, root, message, and scope are validated;
- the message binds Stable Application ID and Login Key;
- the scope binds only the intended Stable Application ID and versioned domain;
- no universal or cross-application nullifier exists;
- historical-root behavior is explicit and tested.

Application accounts:

- proof verification, nullifier insertion, and account creation are atomic;
- `(stableApplicationId, registrationNullifier)` is unique in durable state;
- routine activity does not require repeated personhood proofs;
- wallet or username changes cannot create another account;
- bans and sessions are application-local;
- games never receive source nullifiers or identity commitments.

Reward claims:

- only the configured signer can authorize a claim;
- chain, contract, application, result, claim ID, recipient, amount, and expiry
  are bound;
- each claim ID succeeds at most once;
- wrong signer, recipient, chain, contract, application, result, amount, or
  expiry fails;
- no World or Semaphore identifier is stored on-chain;
- rewards are synthetic and carry no real value.

Privacy:

- no PII, biometric data, liveness artifact, source evidence, raw proof,
  identity secret, or cross-application mapping is logged or stored on-chain;
- operator and audit views expose application-scoped pseudonyms only;
- public payout correlation is disclosed.

## Required adversarial tests

- valid enrollment succeeds once;
- replayed, expired, wrong-source, wrong-domain, wrong-schema, wrong-signature,
  and substituted-commitment enrollment fails;
- racing enrollment requests admit one commitment;
- valid application registration succeeds once;
- replay, wrong group, root, message, scope, Login Key, or Stable Application ID
  fails;
- changing wallet or username produces the same Registration Nullifier;
- racing registrations create one Application Account;
- a banned account cannot re-register or receive a reward;
- valid Reward Authorization succeeds once;
- replay, expiry, signer substitution, recipient substitution, wrong chain,
  wrong contract, wrong application, wrong result, and changed amount fail;
- provider failure cannot create false confirmed state.

## Dependency and deployment controls

- pin security-sensitive dependencies and keep the lockfile;
- use releases at least seven days old unless explicitly justified;
- map licences, maintenance, audits, and exact source provenance;
- verify deployed bytecode and transaction receipts;
- keep signing keys out of tracked files, browser bundles, and logs;
- run formatting, lint, type checking, builds, tests, integration tests, and
  dependency audit before claiming completion.

No production identity, mainnet deployment, or real-value reward is authorized.
