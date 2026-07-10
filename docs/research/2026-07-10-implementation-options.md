# Implementation Options Research

**Date:** 2026-07-10  
**Status:** Synthesis complete, architecture decisions proposed  
**Purpose:** Record the evidence used to choose the first AgentVisa Arbitrum implementation.

## Decision summary

The recommended first implementation is:

- Robinhood Chain testnet as the primary network.
- Safe as the Smart Account ownership and recovery layer.
- Safe7579 and Smart Sessions as the leading session-permission stack, subject to an integration spike.
- Standard Semaphore v4 for anonymous approved-operator membership.
- A narrow AgentVisa authorization adapter that requires both a valid Semaphore proof and normal Safe owner approval of the same Permission Digest.
- Hardhat 3 and TypeScript as the native-Windows-compatible primary toolchain.
- pnpm workspaces without Turborepo until repository scale justifies it.
- Viem and permissionless.js for EVM and ERC-4337 interaction unless the spike shows an SDK incompatibility.
- No custom ZK circuit, Groth16 verifier, smart account, bundler, paymaster, relayer service, or credential format in the first vertical slice.

## Evidence and corrections

### Semaphore v4

Current research found Semaphore v4 packages and audited contracts suitable for BN254 Groth16 verification on EVM chains. Robinhood Chain does not have a known Semaphore deployment, so the project must deploy and verify its own instance.

The standard circuit exposes public `message` and `scope` fields. The message can commit to a Permission Digest, and the scope can create a one-time installation nullifier. A custom circuit is unnecessary.

The group contract maintains historical Merkle roots for a configurable duration. Removing a member does not automatically invalidate an already installed smart-account session. Credential authorizations therefore need short expiries or an explicit authorization-revocation path.

Corrections to external suggestions:

- Do not write a new verifier contract.
- Do not copy Ed25519 signed-root infrastructure into the on-chain path.
- Do not import the Mina/o1js stack.
- Do not assume a Keccak digest is automatically a valid BN254 field.
- Do not use packed dynamic-array encoding for policy commitments.

Primary sources:

- https://docs.semaphore.pse.dev/
- https://github.com/semaphore-protocol/semaphore
- https://docs.semaphore.pse.dev/technical-reference/contracts

### Smart accounts and sessions

Safe is the preferred ownership layer because it has a mature security model and registered deployments on Robinhood Chain mainnet. Exact testnet deployments must be verified before relying on them.

Safe7579 adapts Safe to ERC-7579 modules. Smart Sessions provides granular session validators and policies. Its Enable Mode requires an owner-authorized EIP-712 permission object verified through the account's normal signature path.

A Semaphore proof is not an EIP-712 owner signature. Replacing the owner signature with a proof would weaken the ownership model and allow any approved group member to target an account they do not own.

The proposed combination is:

1. Compute one canonical Permission Digest.
2. The approved Operator creates a Semaphore proof binding the account and digest.
3. An AgentVisa adapter validates the proof and records a short-lived credential authorization.
4. The Account Owner enables the same Smart Sessions permission using the normal Safe signature path.
5. A mandatory AgentVisa policy checks the credential authorization while standard Smart Sessions policies enforce actions.

The exact adapter point must be proven in a local integration spike. If Smart Sessions cannot enforce the AgentVisa policy without unsafe hooks or duplicated state, use a smaller Safe module rather than forcing the abstraction.

Primary sources:

- https://docs.safe.global/advanced/erc-7579/7579-safe
- https://github.com/rhinestonewtf/safe7579
- https://github.com/erc7579/smartsessions
- https://eips.ethereum.org/EIPS/eip-7579
- https://eips.ethereum.org/EIPS/eip-4337

### Robinhood Chain

Verified network facts:

| Property | Mainnet | Testnet |
|---|---:|---:|
| Chain ID | 4663 | 46630 |
| Gas token | ETH | Test ETH |
| Explorer | `robinhoodchain.blockscout.com` | `explorer.testnet.chain.robinhood.com` |

The chain is EVM-compatible and supports standard Solidity tooling. Safe deployments are registered for mainnet. Semaphore must be self-deployed. ERC-4337 EntryPoint, bundler, paymaster, Safe7579, and Smart Sessions availability must be checked on both networks rather than inferred from generic EVM compatibility.

Pimlico lists Robinhood Chain support, but the project must run a real UserOperation tracer bullet before choosing it as an operational dependency. A direct transaction path should remain available for mandate authorization and emergency revocation.

Use `block.timestamp`, not assumptions based on `block.number`, for validity windows. Do not make bridge or L1-to-L2 messaging part of the MVP.

Primary sources:

- https://docs.robinhood.com/chain/
- https://docs.robinhood.com/chain/connecting/
- https://docs.robinhood.com/chain/deploy-smart-contracts/
- https://docs.pimlico.io/guides/supported-chains

### Toolchain

Foundry is strong for Solidity fuzzing and invariant tests, but the official installer does not support PowerShell or Command Prompt. The project requirement is native Windows plus Linux CI, so Foundry cannot be the only development path.

Hardhat 3 supports TypeScript and Solidity tests and is the proposed primary contract tool. Linux CI may add Foundry, Echidna, or Medusa later for independent invariant testing, but normal build and test commands must work in PowerShell.

Use pnpm workspaces directly. Turborepo adds little value before the repository contains several independently built packages.

Viem aligns with permissionless.js and current account-abstraction tooling. The previous recommendation to prefer ethers solely because older Semaphore examples use it is not strong enough to justify two EVM client libraries.

Dependencies must be pinned during bootstrap after confirming publication dates and compatibility. Registry checks on 2026-07-10 returned:

- `hardhat`: 3.9.1
- `@semaphore-protocol/core`: 4.14.3
- `@semaphore-protocol/contracts`: 4.14.3
- `permissionless`: 0.3.7
- `viem`: 2.55.0

These are observations, not automatic selections. Versions published less than seven days before installation are excluded.

### Policy security

The initial policy must be much smaller than a general wallet firewall.

First vertical slice:

- One Smart Account.
- One Session Key.
- One target contract.
- One function selector.
- One input asset or action class.
- One per-action amount limit.
- One cumulative amount limit.
- One validity window.
- No native value.
- No wildcard target or selector.
- No arbitrary batch.
- No delegatecall.
- No fallback authorization.
- No token `approve`, Permit, Permit2, or arbitrary transfer.
- No oracle-priced USD limits.
- No calendar-period reset.

This removes dynamic calldata parsing, token-decimal normalization, oracle freshness, sequencer feeds, rebasing tokens, fee-on-transfer tokens, and nested execution from the critical path.

Future policies require separate ADRs and adversarial tests.

### Existing AgentVisa reuse

Reuse concepts and tests, not entire modules.

Potentially reusable:

- Semaphore identity creation patterns from `agentvisa-core/src/identity.ts`.
- Group and proof-generation behavior from `agentvisa-core/src/tree.ts` and `src/proof.ts`.
- The test-vector discipline from existing core tests.

Do not reuse:

- Mina/o1js programs or signatures.
- Ed25519 root signing for on-chain trust.
- Canonical JSON for policy hashing.
- Browser localStorage key handling.
- Incomplete production enrollment routes.
- File or Redis replay stores for on-chain nullifiers.

Prefer direct pinned dependencies over source copying. Any copied code requires provenance and focused tests.

### Private attribute credentials

Semaphore is appropriate for binary anonymous membership. It does not prove arbitrary predicates.

Long-term attribute credentials should be issuer-owned and schema-specific. Candidate technologies include W3C VC 2.0, SD-JWT VC, AnonCreds, Privado ID, zkPassport, Self, or issuer-specific circuits. No single credential stack should be selected before a real issuer and relying party define the claim and acceptance requirements.

The repository should preserve an abstract future interface:

```text
CredentialProof -> issuer + schema + predicate + subject authorization + validity + scope
```

It should not implement SD-JWT, EAS, DIDs, custom circuits, or passport proofs in the MVP.

Primary sources:

- https://www.w3.org/TR/vc-data-model-2.0/
- https://www.rfc-editor.org/rfc/rfc9901.html
- https://anoncreds.github.io/anoncreds-spec/
- https://docs.zkpassport.id/intro
- https://docs.self.xyz/

### Accredited-investor example

Accredited-investor verification and KYC are separate processes. Rule 506(b) and Rule 506(c) impose different issuer obligations. Broker-dealers have customer-identification duties that ZK does not remove.

Portable verification is not automatically accepted across offerings or platforms. Evidence freshness, issuer policy, offering exemption, jurisdiction, transfer restrictions, beneficial ownership, and signed agreements remain relevant.

For a future integration:

- A qualified verification provider or platform issues the credential.
- AgentVisa binds a private presentation to the beneficial owner's agent mandate.
- The regulated intermediary may still know the owner.
- The Agent acts as an authorized delegate, not the legal owner, custodian, or anonymous nominee.
- The relying party decides whether the credential is acceptable for that offering.

AgentVisa must not claim to perform KYC, verify accreditation independently, execute securities trades, or provide investment advice.

Primary sources:

- https://www.sec.gov/files/accred-invest-assess-reg-d.pdf
- https://www.sec.gov/reports/rule-144-selling-restricted-control-securities
- https://www.sec.gov/resources-small-businesses/capital-raising-building-blocks/private-secondary-markets
- https://republic.com/help/how-do-i-verify-that-i-am-an-accredited-investor-2680bf4e-8c69-40e8-95b7-f63b4dc8c2fd

## Open architecture gates

The foundation phase must answer these with executable spikes:

1. Are Safe, Safe4337, EntryPoint, Safe7579, and Smart Sessions deployed and usable on Robinhood testnet?
2. Can a mandatory custom Smart Sessions policy query an AgentVisa authorization without creating an unsafe initialization callback?
3. What exact digest does Smart Sessions treat as the owner-approved Permission Digest?
4. Can the same digest be reproduced in TypeScript and Solidity with public test vectors?
5. What hash-to-BN254-field conversion will be used for Semaphore message and scope?
6. What is the maximum acceptable credential-authorization lifetime after group revocation?
7. Can emergency owner revocation work through a direct Safe transaction when bundler or paymaster infrastructure is unavailable?

No production architecture claim is final until these gates pass.