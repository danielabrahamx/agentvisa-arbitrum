# Architecture

**Status:** Accepted MVP architecture

**First integration:** Gaming platform

**On-chain target:** Arbitrum Sepolia, chain ID `421614`, for synthetic reward
claims only

## Objective

Issue a reusable AgentVisa Semaphore Credential after an approved enrollment,
then let an application create one pseudonymous account per Credential without
learning a global person identifier.

The first demo uses games, bans, wins, and rewards. Core enrollment,
registration, account, and claim boundaries use platform-agnostic types.

## System boundary

```text
Uniqueness Source adapter
  -> signed Enrollment Authorization

Credential Holder browser
  -> local Semaphore identity secret
  -> identity commitment only

AgentVisa Credential Issuer
  -> validates and consumes Enrollment Authorization
  -> admits commitment to AgentVisa Semaphore group

Relying Party
  -> requests application-scoped Credential Proof
  -> verifies proof and atomically consumes Registration Nullifier
  -> creates and operates Application Account

Reward Authorizer
  -> signs one narrow EIP-712 claim for an eligible result

Arbitrum Sepolia claim contract
  -> validates authorization and consumes claim ID
  -> records synthetic points or emits a claim event
```

## Deployment surfaces (Phase 6 / 6b)

Phase 6b is complete:

- **Demo UI / issuer / game account services** run as a Node process with
  SQLite (local or public HTTPS via tunnel). Enrollment uses a synthetic
  Uniqueness Source. These steps do not send transactions.
- **Reward claims** use the deployed `GameRewardClaim` on Arbitrum Sepolia
  `421614`. The browser wallet (MetaMask/Rabby) submits `claim`; the server
  signs EIP-712 Reward Authorizations only. Public demo URL is recorded in
  `HANDOFF.md` / `README.md`.

World verification infrastructure is not deployed on-chain for this MVP.

## Enrollment

1. The browser creates a Semaphore v4 identity locally.
2. A source adapter produces an Enrollment Authorization bound to the identity
   commitment.
3. The issuer validates the signature, source policy, uniqueness domain,
   schema, assurance, expiry, commitment binding, and nonce.
4. In one transaction or idempotent state machine, the issuer consumes the
   source nonce and admits the commitment to the configured Semaphore group.
5. The browser retains the identity secret; only the commitment enters issuer
   state.

The MVP starts with a synthetic source adapter. A World staging adapter may be
added without changing issuance semantics. It must keep a fixed enrollment
action and uniquely consume the World nullifier. This is not a World-native
AgentVisa credential.

## Application registration

For each Stable Application ID:

```text
scope = H("agentvisa.application-registration.v1", stableApplicationId)
message = H(
  "agentvisa.application-account.v1",
  stableApplicationId,
  loginPublicKey
)
```

The exact typed encoding and BN254 field conversion must be defined once and
covered by TypeScript golden vectors. A Stable Game ID is the gaming form of
the Stable Application ID.

Registration:

1. The browser generates a Credential Proof from its local identity and the
   accepted group.
2. The Relying Party validates all public inputs and verifies the standard
   Semaphore proof.
3. Proof verification, insertion of the Registration Nullifier, and creation
   of the Application Account occur atomically.
4. A database uniqueness constraint on
   `(stableApplicationId, registrationNullifier)` is authoritative.
5. A duplicate resolves to the existing account state. For a banned game
   account it returns an application-local banned response.

Wallet, username, season, payout address, and registration attempt are excluded
from scope. Changing them cannot create a second account.

## Account lifecycle

After registration, the Relying Party authenticates the Application Account
with its Login Key or an opaque application session. It does not request
another Semaphore or World proof for routine activity.

For the gaming demo:

- play and win events belong to the Game Account;
- a ban invalidates game sessions and blocks game-local eligibility;
- selecting another wallet does not change the Registration Nullifier;
- the operator sees game-scoped pseudonymous records only;
- credential revocation and game moderation remain separate decisions.

## Reward claim

An authenticated, eligible Application Account may receive one EIP-712 Reward
Authorization binding:

- version and domain;
- chain ID and verifying contract;
- Stable Application ID;
- result ID and claim ID;
- recipient;
- synthetic amount or points;
- expiry.

The Arbitrum Sepolia contract verifies the configured signer, rejects malformed
or expired claims, consumes each claim ID once, and updates state before any
external interaction. It does not verify World or Semaphore proofs.

World verification, issuance, registration, accounts, moderation, results, and
eligibility remain off-chain.

## Logical state

The MVP store has:

- `enrollment_authorizations`, unique `(sourceId, nonce)`;
- `credentials`, keyed by group and identity commitment;
- `application_accounts`, unique
  `(stableApplicationId, registrationNullifier)`;
- `application_sessions`, storing hashed opaque tokens or Login Key bindings;
- `application_results`, keyed by stable result ID;
- `reward_claims`, keyed by globally unique claim ID;
- redacted `audit_events`.

One local process may implement these logical responsibilities for the demo.
Production separation is future work.

### Implemented Phase 2 issuance state

The local Phase 2 issuer uses a file-backed SQLite database through a narrow
store interface. One `BEGIN IMMEDIATE` transaction:

1. resolves an identical authorization digest to its existing Credential;
2. checks deterministic nonce, subject, then commitment conflicts;
3. inserts the authorization record, Credential, and ordered group membership;
4. commits all records together or rolls all records back.

Authoritative constraints are:

- `enrollment_authorizations.authorization_digest` primary key;
- unique `(source_id, nonce)`;
- unique `(source_id, uniqueness_domain, opaque_subject_digest)`;
- `credentials.credential_id` primary key;
- unique `credentials.authorization_digest`;
- unique `(group_id, identity_commitment)`;
- unique `(group_id, membership_index)`;
- `group_memberships` primary key `(group_id, leaf_index)`;
- unique `(group_id, identity_commitment)` and unique `credential_id`.

Membership rows are replayed by `leaf_index` into the unchanged Semaphore v4
`Group` implementation after restart. The issuer stores authorization metadata
and digest, but not the source signature, source signing key, source evidence,
or Semaphore identity secret.

## Privacy boundaries

- The source and AgentVisa may link enrollment to an identity commitment.
- A Relying Party sees only its application-scoped nullifier and account.
- Different Stable Application IDs produce unlinkable nullifiers, absent
  correlation through usernames, wallets, analytics, timing, or network data.
- Reward recipient and claim data are public on Arbitrum Sepolia.
- Never log or place on-chain identity secrets, World nullifiers, raw proofs,
  source evidence, PII, biometrics, or cross-application identity mappings.

## Reuse and constraints

Reuse unchanged:

- Semaphore v4 identity, group, proof, verifier, artifacts, and Merkle logic;
- Viem and the existing Hardhat 3 toolchain;
- IDKit request, signing, simulator, and hosted verification if the World
  staging adapter is enabled.

Build only:

- typed Enrollment Authorization and source adapter boundary;
- atomic enrollment and application registration state;
- application scope/message encoding;
- application account, moderation, result, and audit flows;
- narrow Reward Authorization and claim contract;
- localhost demo routes.

Do not build World circuits, authenticators, registries, bridges, relays,
custom Semaphore components, global identity, global bans, a bot detector,
wallet infrastructure, token economics, governance, or upgradeability.

## Demo routes

- `/enroll`: synthetic authorization inspection and Credential issuance;
- `/games/robot-rally`: register, play, win, change payout wallet, and claim;
- `/operator/robot-rally`: inspect pseudonymous accounts and apply a game-local
  ban;
- `/audit`: ordered redacted events with trust labels.

These gaming routes demonstrate platform-agnostic services; game-specific
behavior belongs at the Relying Party adapter boundary.

## Deferred production gates

Not required to complete the synthetic localhost MVP:

- World Developer Portal staging credentials and real-device testing;
- arbitrary third-party World credential support;
- identity and account recovery preserving bans;
- separate issuer, platform, moderation, and authorizer services;
- HSM-backed keys, retention policies, appeals, and incident response;
- exact audit-to-source provenance for every dependency;
- mainnet deployment or real-value rewards.
