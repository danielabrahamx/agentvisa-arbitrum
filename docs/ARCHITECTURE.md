# Architecture

**Status:** Proposed architecture with explicit foundation gates  
**Target:** Robinhood Chain testnet, chain ID 46630

## System objective

Allow an approved Operator to authorize an Agent Session Key for a narrowly constrained Smart Account permission without exposing the Operator's identity on-chain.

The system combines two independent authorizations:

1. Credential authorization: a Semaphore proof shows that an accepted group member bound a specific Permission Digest to the account.
2. Account authorization: the Account Owner approves the same permission through the account's normal signature path.

Neither authorization is sufficient alone.

## Trust model

### Trusted

- AgentVisa or a future Credential Issuer verifies eligibility and administers its credential group.
- The Account Owner controls Safe ownership and recovery.
- Accepted Semaphore contracts implement the audited v4 protocol.
- Accepted Smart Account and session modules implement their documented behavior.

### Untrusted

- The Agent and its Session Key.
- Prompts, tools, models, relayers, bundlers, paymasters, RPC providers, and transaction submitters.
- All calldata, policy input, proofs, signatures, deployment records, and network responses until validated.

### Not solved

- Credential lending or collusion between two humans.
- Privacy of the full transaction graph.
- Legal identity, KYC, AML, suitability, or beneficial-ownership duties unless a qualified issuer and relying party explicitly support them.
- Safety or correctness of the Agent's reasoning.

## Proposed component model

```text
Operator wallet
  - Semaphore identity secret
  - generates Credential Proof

AgentVisa Semaphore group
  - approved identity commitments
  - group administrator controlled by AgentVisa test issuer

AgentVisaAuthorization
  - validates Semaphore proof
  - binds proof message to Mandate Digest
  - consumes scoped nullifier
  - stores short-lived Authorization Record
  - supports explicit record revocation

Safe Smart Account
  - owner and recovery authority
  - normal owner signature remains mandatory
  - Safe7579 adapter, subject to spike

Smart Sessions
  - installs Session Key permission
  - standard target, selector, amount, cumulative, and time policies

AgentVisaCredentialPolicy
  - mandatory Smart Sessions policy
  - checks matching active Authorization Record

Agent
  - holds Session Key only
  - signs routine actions

Bundler or direct submitter
  - transports signed operations
  - has no authorization power
```

## Authorization flow

### 1. Identity approval

1. Operator creates a Semaphore v4 identity locally.
2. Only the identity commitment is submitted to the test issuer.
3. AgentVisa approves the synthetic test Operator.
4. The group administrator adds the commitment to the AgentVisa group.

No identity secret enters this repository's server or contracts.

### 2. Permission construction

1. The account integration constructs one Smart Sessions permission.
2. The permission contains one Session Key and narrowly scoped policies.
3. Smart Sessions produces the canonical Permission Digest.
4. The Account Owner reviews and signs the normal enable object.

The project must use the module's exact canonical digest. Reconstructing an approximation is forbidden.

### 3. Credential authorization

The Operator constructs `MandateV1`:

```text
version
chainId
account
agentVisaAuthorization
semaphoreGroupId
permissionDigest
sessionKey
validAfter
validUntil
authorizationId
```

The Mandate Digest is a domain-separated typed hash. The Semaphore message is the Mandate Digest mapped into the BN254 scalar field.

The Semaphore scope binds:

```text
version
chainId
account
agentVisaAuthorization
semaphoreGroupId
permissionDigest
authorizationId
```

`AgentVisaAuthorization.authorizeMandate`:

1. Recomputes Mandate Digest and Scope Field.
2. Checks chain, contract, group, time, and lifetime limits.
3. Requires proof message and scope to match.
4. Calls the pinned Semaphore contract to validate the proof and consume the nullifier.
5. Stores an Authorization Record keyed by account and Permission Digest.

### 4. Session enablement

The Account Owner enables the same permission through Safe and Smart Sessions.

`AgentVisaCredentialPolicy` is mandatory. It receives or derives the Permission Digest and checks that the Authorization Record:

- Exists for the same account.
- Matches the permission.
- Has started.
- Has not expired.
- Has not been revoked.

The exact policy hook is an architecture gate. It must be proven against the current Smart Sessions implementation before this design is accepted.

### 5. Agent execution

1. Agent signs an operation with the Session Key.
2. Bundler or submitter transports it.
3. Smart Sessions validates the Session Key.
4. AgentVisaCredentialPolicy validates current credential authorization.
5. Standard action policies validate target, selector, amount, cumulative use, and time.
6. Safe executes only if every check passes.

### 6. Revocation and expiry

Account safety revocation:

- Account Owner immediately revokes the permission or uninstalls the session module.
- This path must work without AgentVisa, a bundler, or a paymaster.

Credential authorization revocation:

- Authorization Records have short maximum lifetimes.
- AgentVisa may revoke a known Authorization Record.
- Removing a group member prevents new proofs after accepted historical roots expire.

Privacy limitation:

Semaphore does not let the issuer discover every anonymous Authorization Record created by a removed identity. Existing records may remain valid until their own expiry unless their identifier is known. The MVP must use short lifetimes and state this honestly.

## Typed hashing

### Mandate Digest

Use a fixed-size `MandateV1` struct. Do not include dynamic arrays in v1.

```text
MANDATE_TYPEHASH = keccak256(
  "MandateV1(uint8 version,uint256 chainId,address account,address authorization,uint256 groupId,bytes32 permissionDigest,address sessionKey,uint48 validAfter,uint48 validUntil,bytes32 authorizationId)"
)
```

The exact digest construction is specified and tested in the policy package and Solidity library.

### Hash to BN254 field

One shared function maps a digest to a Semaphore field:

```text
field = uint256(digest) mod SNARK_SCALAR_FIELD
```

Requirements:

- Pin the exact scalar-field constant from the accepted Semaphore version.
- Domain-separate Mandate and Scope hashes.
- Publish TypeScript and Solidity golden vectors.
- Reject zero if the underlying protocol or integration requires a non-zero value.
- Never use truncation, floating-point conversion, packed dynamic values, or JSON serialization.

## MVP policy surface

The first end-to-end permission supports:

- One Session Key.
- One target.
- One selector.
- One action asset or class if the target policy requires it.
- One maximum amount per action.
- One cumulative maximum.
- One validity window.

The first version forbids:

- Wildcard targets or selectors.
- Arbitrary batch or nested calls.
- Delegatecall.
- Fallback authorization.
- Native value transfer.
- ERC-20 approve, permit, Permit2, or arbitrary transfer.
- Oracle-priced limits.
- Calendar reset periods.
- Cross-chain permission reuse.

Each additional capability requires its own ADR and adversarial tests.

## Repository modules

Planned structure:

```text
apps/
  demo-cli/                 test identity, proof, authorization, session, action
packages/
  contracts/                Hardhat project and Solidity contracts
  policy/                   Mandate types, typed hashing, field conversion
  prover/                   Semaphore identity, group mirror, proof generation
  sdk/                      Safe, Smart Sessions, bundler, deployment clients
deployments/
  46630/                    verified Robinhood testnet records
docs/
  adr/                      architectural decisions
  plans/                    phased implementation plans
  research/                 evidence and rejected alternatives
```

Do not add a custom relayer service, web application, database, or backend until the CLI vertical slice works.

## Deployment model

### Local

Hardhat local network runs deterministic unit and integration tests. External contracts are deployed from pinned source or represented by exact test fixtures.

### Robinhood testnet

Deploy or verify, in dependency order:

1. ERC-4337 EntryPoint availability.
2. Safe and Safe4337 dependencies.
3. Safe7579 and Smart Sessions dependencies.
4. Semaphore verifier and group contracts.
5. AgentVisaAuthorization.
6. AgentVisaCredentialPolicy.
7. Demo target and Smart Account.

Every deployment record includes chain ID, address, bytecode hash, source version, constructor arguments, deployer, transaction hash, explorer URL, and verification status.

### Mainnet

Out of scope until explicitly approved after testnet completion and security review.

## Architecture gates

Current evidence:

| Gate | Status | Evidence |
|---|---|---|
| Native PowerShell and Linux CI | Partial | All root checks pass in native Windows PowerShell. Windows and Linux GitHub Actions are configured but have not run remotely because no commit or push was requested. |
| Robinhood EntryPoint and Safe infrastructure | Partial | Read-only bytecode probes confirm EntryPoint v0.6-v0.8, Safe 1.4.1, Safe4337, and a public Pimlico bundler. Safe7579 and Smart Sessions are absent. |
| Stable Permission Digest and mandatory policy hook | Pending | Do not approximate the Permission Digest or write the AgentVisa policy before Phase 1D and 1E pass. |
| TypeScript and Solidity hashing parity | Passed | Phase 1A normal, boundary, field-conversion, and malformed vectors pass in both languages. |
| Local standard Semaphore proof | Passed | Phase 1B validates message and Scope binding, replay rejection, member removal, and historical-root expiry with Semaphore 4.14.2. |
| Direct Account Owner revocation | Pending | Must be proven without bundler or paymaster dependence. |

The architecture is not accepted until executable spikes prove:

1. Native PowerShell and Linux CI can build and test the project.
2. Required Safe and ERC-4337 infrastructure works on Robinhood testnet.
3. Smart Sessions exposes a stable Permission Digest and mandatory policy hook.
4. AgentVisaCredentialPolicy can check authorization without unsafe initialization callbacks.
5. TypeScript and Solidity produce identical Mandate Digest, Scope Field, and permission identifiers.
6. A Semaphore proof generated from a local group validates against the deployed group.
7. Direct owner revocation works when bundler and paymaster services are unavailable.

If gates 3 or 4 fail, implement a narrow Safe-native module instead of weakening the account authorization model.