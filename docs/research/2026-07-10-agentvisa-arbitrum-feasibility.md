# AgentVisa on Arbitrum: Feasibility, Product, and GTM

**Date:** 2026-07-10  
**Verdict:** Build a narrow hybrid product on Robinhood Chain. Do not migrate AgentVisa itself on-chain.  
**Confidence:** High on architecture, medium on GTM until a design partner commits.

## Executive decision

AgentVisa should become private authorization infrastructure for financial agents.

The product claim is:

> A financial agent can prove that it is backed by an approved human and authorized for a constrained action, without revealing which human. A smart contract checks the proof before funds move.

The competition build should implement one complete vertical slice:

1. An approved human creates a private identity commitment.
2. AgentVisa adds that commitment to an approved-operator Semaphore group.
3. The human defines a bounded mandate for an agent session key.
4. The human generates a BN254 Groth16 proof that binds the session key and mandate.
5. A relayer submits the proof to an immutable smart-account policy module.
6. The module verifies the proof once, consumes a scoped nullifier, and installs the session policy.
7. The agent signs routine actions with only its constrained session key.
8. The module enforces transaction, cumulative, asset, contract, function, slippage, chain, and expiry limits before execution.
9. Replays, expired mandates, revoked sessions, and policy violations fail on-chain.

Build on Robinhood Chain testnet, chain ID 46630. Deploy the final tested contracts to Robinhood Chain mainnet, chain ID 4663, only after explicit approval and a security review. Arbitrum Sepolia, chain ID 421614, is the fallback test environment.

## Why this belongs on-chain

The blockchain earns its place only when a contract must decide whether to execute an irreversible financial action.

An HTTP credential is enough for websites and APIs. It cannot stop an agent that already holds an unrestricted wallet key. An on-chain smart-account module can enforce the human's mandate at the point where transactions execute.

The useful on-chain properties are:

- Atomic enforcement before an action executes.
- The owner retains recovery authority while the agent receives only a session key.
- Shared credential-group state across relying accounts on one chain.
- Scope-specific replay prevention when a mandate is installed.
- Portable verification without an AgentVisa API callback.
- Publicly auditable enforcement logic without public human identity data.

Publishing badges, certificates, liveness hashes, or NFTs does not create this leverage.

## Current system reality

AgentVisa is not currently one coherent production ZK system.

### Production AgentVisa repository

The live Python application implements application, payment, liveness review, approval, SQLite storage, sessions, and partial v3 enrollment. The enrollment route stores a public key but does not complete certificate issuance or on-chain verification.

Relevant files:

- `app/routes/public.py`
- `app/routes/liveness.py`
- `app/routes/v3_enroll.py`
- `app/routes/agent.py`
- `app/routes/proofs.py`
- `app/services/roots.py`
- `static/js/dashboard-v3.js`

Some documented v3 endpoints and certificate services are not implemented. Documentation must not be treated as evidence that the production credential loop works.

### agentvisa-core

`C:/Users/danie/agentvisa-core` contains two cryptographic generations:

- Legacy Semaphore BN254 identity, Merkle tree, and Groth16 proof code.
- New Mina/o1js v3 delegation circuits, session keys, challenge binding, verifier policy, and proof types.

The Mina design is richer but not EVM-native. Verifying it on Arbitrum would require a new verifier, proof wrapping, or an oracle. That is poor competition scope.

Relevant files:

- `src/identity.ts`
- `src/tree.ts`
- `src/roots.ts`
- `src/proof.ts`
- `src/v3/program.ts`
- `src/v3/challenge.ts`
- `src/v3/session.ts`
- `src/v3/verifier-policy.ts`

### agentvisa-verifier and Abra

`agentvisa-verifier` implements a serious Mina verification pipeline. Abra integrates it as reference middleware with challenge and replay stores. This is useful for web integrations, but it does not solve EVM verification.

The verifier and production issuer are ahead in different places. The competition build must not claim a finished production path that does not exist.

## Recommended product

### Main problem

People using AI agents to manage self-custodial funds face a bad choice: give the agent an unrestricted wallet key, or manually approve every transaction and lose most of the benefit of automation.

If an unrestricted agent makes a reasoning error, follows a malicious prompt, interacts with the wrong contract, or has its key compromised, it can lose everything the wallet controls. Normal wallets prove that a valid key signed a transaction. They do not prove that the transaction falls within the human owner's intended mandate.

### Primary user

A person or team using an AI agent to trade, manage a treasury, make payments, or interact with tokenized assets from a self-custodial smart account.

### Initial buyer and integration partner

Smart-account wallets, agent-wallet infrastructure, vaults, and financial applications that want to support agent automation without giving agents unrestricted authority.

### Job to be done

Let the human retain custody while giving the agent enough authority to operate autonomously within explicit limits. Those limits must remain enforceable even when the agent is mistaken, manipulated, or compromised.

### Product category

Private, enforceable mandates for financial agents.

### Product

AgentVisa lets an approved human privately authorize an agent session key with a bounded mandate. The mandate can specify transaction limits, cumulative limits, approved assets, approved contracts, allowed functions, slippage limits, chain, and expiry. A smart account module enforces it before every action.

The ZK proof establishes that an approved human authorized the mandate without revealing which human. The proof does not enforce the limits by itself. Enforcement belongs in the smart account or relying contract. The agent must never receive the unrestricted owner or recovery key.

This is not KYC on-chain. Current AgentVisa liveness review does not establish legal identity, sanctions status, residence, or source of funds. It is not a public identity registry and does not prove that an AI model is safe.

### Secondary value and credential expansion

- Near term: wallets and protocols can distinguish an agent operating under a human-authorized, revocable mandate from an address with unconstrained authority.
- Long term: approved third-party issuers can provide privacy-preserving attribute credentials, such as a currently valid accredited-investor, jurisdiction, professional-license, organization-role, sanctions-screening, or suitability claim. An agent can prove that its beneficial owner satisfies the required predicate without publishing the owner's identity on-chain.
- Compliance boundary: AgentVisa must not assert regulated attributes it cannot verify. For a hypothetical Republic integration, Republic or its authorized verification provider would issue or attest the eligibility claim. The proof must bind the issuer, schema, validity period, chain, offering, account, action, and nonce. The regulated intermediary may still need to know and retain the beneficial owner's identity, signed agreements, and KYC records. ZK provides privacy from the public chain and unrelated counterparties, not anonymity from legally responsible intermediaries.

### Demo action

Use a purpose-built demo vault, not a live third-party protocol.

The vault can hold test assets and expose one action such as:

```text
executeSwap(assetIn, assetOut, amount, minOut)
```

Do not build a new delegation circuit for the MVP. Use a standard Semaphore proof whose public message is the hash of a canonical authorization policy. The policy binds:

- Chain ID.
- Smart account address.
- Policy module address.
- Approved target contracts.
- Allowed function selectors.
- Approved assets or asset categories.
- Maximum amount per transaction.
- Cumulative amount per period.
- Maximum slippage where applicable.
- Valid-after and valid-until times.
- Delegated session address.
- A unique authorization identifier.

The delegated session key signs each concrete action. The smart account recovers that address and checks the stored policy before execution. A relayer may pay gas without gaining authority.

The installation nullifier is derived from the identity secret and a narrow scope containing the chain, account, policy module, and authorization identifier. It must not be universal across applications. Installing a replacement mandate requires a new authorization identifier.

## Contract architecture

### AgentVisaPolicyModule

Deploy the standard Semaphore v4 contracts on Robinhood Chain if no trusted deployment exists there. Keep AgentVisaPolicyModule as a thin smart-account adapter rather than copying proof-verifier logic.

The module should separate one-time authorization from routine execution:

```text
installSession(semaphoreProof, policy)
executeWithSession(policyId, actionData, sessionSignature)
revokeSession(policyId)
getRemainingAllowance(policyId, asset)
```

Checks inside `installSession`:

1. Semaphore accepts the group root and verifies the BN254 Groth16 proof.
2. The proof message equals the canonical hash of `policy`.
3. Policy chain ID, smart account, and module equal the current execution context.
4. Authorization has started and has not expired.
5. The installation nullifier is unused and is consumed by the Semaphore integration.
6. The session address and policy limits are stored for the smart account.

Checks inside `executeWithSession`:

1. The session signature recovers the installed session address.
2. The session is active, unexpired, and not revoked.
3. Target, function, asset, amount, cumulative allowance, and slippage satisfy the stored policy.
4. Allowance state is updated before the external call.
5. The smart account executes the action or the entire transaction reverts.

The account owner or recovery authority can revoke a session at any time. The agent never receives that owner or recovery key.

### Group authority

For the competition build, AgentVisa controls the Semaphore group administrator through a Safe or an explicit deployment owner. The administrator can add approved commitments and remove revoked commitments. Do not implement DAO governance, timelocks, or proxies before the core loop works.

AgentVisaPolicyModule should be immutable. If a flaw is found, deploy a new version and point integrations to it.

### Relayer

The verified human should not need to fund or publicly link a normal wallet when installing the mandate. A relayer can submit installation and routine transactions.

The relayer is not trusted for authorization because it cannot alter proof-bound policies or session-signed actions. It can censor or delay, so users should be able to use another relayer.

### Revocation

Use valid-membership group updates:

- Issuance adds a commitment and produces a new Semaphore group root.
- Revocation removes the commitment and produces a new group root.
- The accepted-root policy must define whether prior roots remain usable and for how long.

Do not publish a separate per-person revocation identifier. It creates an unnecessary correlation surface. The commitment is already visible if group membership is managed on-chain.

The old-root window is a product and risk decision. A demo should make it short and explicit. High-value production integrations need emergency group administration and clear failure behavior.

## What stays off-chain

Always keep these off-chain:

- Names and emails.
- Liveness videos and biometric artifacts.
- Stripe records.
- Admin review evidence.
- Master identity secrets.
- Private session keys.
- The mapping from a person to an identity commitment.
- Internal risk notes.

Do not put biometric hashes or IPFS references on-chain. A hash can still become personal data and creates a permanent correlation handle.

## Chain decision

| Chain | Use | Decision |
|---|---|---|
| Robinhood Chain testnet | Development and public demo | Primary |
| Robinhood Chain mainnet | Final deployed proof of execution | Deploy only after tests and approval |
| Arbitrum Sepolia | Fallback development environment | Secondary |
| Arbitrum One | Later general-purpose production deployment | Not needed for MVP |
| Custom Orbit chain | Dedicated infrastructure | Reject |

Robinhood Chain has the strongest competition fit because it combines the Agentic AI track with tokenized finance and reserved Robinhood awards. Its EVM compatibility allows standard Solidity and Groth16 verifier contracts.

A custom Orbit chain has no current justification. AgentVisa does not need custom gas, throughput, sequencing, or data availability.

## Solidity versus Stylus

Start with Solidity and a generated Groth16 verifier.

Use Stylus only if measurement shows a real benefit for a compute-heavy module that is not already handled efficiently by EVM BN254 precompiles. A custom Rust verifier adds implementation and audit risk. Stylus should not be included merely for judging points.

A valid optional experiment is to benchmark proof-related preprocessing in Stylus against Solidity. It is not on the critical path.

## Why not Mina v3 on Arbitrum

The Mina circuit uses o1js and the Pallas curve. Arbitrum's EVM does not natively verify that proof. The choices are:

- Write or integrate an expensive custom verifier.
- Recursively wrap Mina proofs in an EVM-friendly SNARK.
- Trust an oracle that attests that Mina verification passed.
- Run a separate Mina application and bridge its state.

All four add more protocol than product. Keep the Mina work for offline and web verification research. Use Semaphore-compatible BN254 Groth16 for the Arbitrum vertical slice.

## Standards and dependencies

### Semaphore

Use Semaphore primitives or contracts where they reduce implementation risk. Confirm current v4 deployment support on Robinhood Chain. A direct deployment may be required because Robinhood Chain is new.

Primary sources:

- https://docs.semaphore.pse.dev/
- https://docs.semaphore.pse.dev/technical-reference/contracts
- https://github.com/semaphore-protocol/semaphore

### ERC-8004

ERC-8004 is relevant for public agent discovery and reputation. It is not a substitute for AgentVisa authorization.

An agent may later have an ERC-8004 identity while presenting an AgentVisa proof that an approved human delegated a specific action. Keep those claims separate.

Do not make ERC-8004 a competition dependency unless it directly improves the demo.

Primary source:

- https://eips.ethereum.org/EIPS/eip-8004

### EAS

EAS is useful for public attestations. AgentVisa's core claim is private membership and delegation. Adding EAS now would duplicate state and weaken the story.

Do not use EAS in the MVP.

Primary sources:

- https://github.com/ethereum-attestation-service/eas-contracts
- https://arbitrum.easscan.org/

## Ideas to reject

### Full AgentVisa migration

Reject. Identity review, payments, liveness evidence, and secret handling gain nothing from a public chain.

### Public verified-human NFT

Reject. It creates wallet linkability and proves less than the authorization product needs.

### Universal agent badge

Reject. A static badge does not constrain actions and becomes a bearer reputation token.

### Global nullifier

Reject. It permits cross-application correlation. Nullifiers must be scope-specific.

### Public per-identity revocation list

Reject. It creates persistent handles for anonymous members.

### Mina verification-key registry

Reject. Publishing a key does not make Mina verification possible in the EVM.

### EAS plus ERC-8004 plus Semaphore stack

Reject for MVP. Each module can be valid independently, but combining all three creates three registries before one customer workflow exists.

### DAO delegate identity as primary product

Reject. Existing proof-of-personhood products occupy the category, adoption requires a political DAO process, and it misses the Robinhood financial-agent wedge.

### Orbit chain

Reject. It adds operations, bridging, and security assumptions without user value.

## GTM

### Positioning

Do not lead with ZK, identity, or certification.

Lead with:

> Give financial agents narrow, enforceable permissions without exposing their human operators.

### Beachhead

Target builders of agent-controlled vaults and RWA workflows on Robinhood Chain and Arbitrum.

The first design partner should have:

- An agent that can initiate an on-chain action.
- A reason not to grant that agent an unrestricted wallet key.
- A concrete action policy that can be expressed as public proof inputs.
- Test assets and a willingness to integrate an experimental gate.

### Distribution

1. Ship the open-source gated demo vault.
2. Publish an integration package with one contract interface and one proof-generation flow.
3. Recruit three design partners from the Open House, Robinhood Chain, Safe, ERC-4337, RWA, and agent-builder communities.
4. Convert one demo into a co-authored case study.
5. Keep Abra as evidence of the off-chain verifier pattern, not as the financial use case.

### Revenue

Start with:

- Annual platform subscription for issuer, policy, relayer, and monitoring access.
- Per-active-agent or per-credential pricing.
- Enterprise integration and support fees.

Do not charge a percentage of trading volume. It complicates procurement, regulation, and incentives before value is proven.

### Moat

The circuit is not the moat. The moat is:

- Issuer trust and operating history.
- Integrations into agent wallets, vaults, and policy systems.
- A reusable policy language for constrained delegation.
- Revocation and incident response.
- A network of relying parties and approved issuers.

## Competition demo script

1. Show an uncredentialed agent attempting a smart-account action. The module rejects it.
2. Show an approved operator defining a constrained session mandate.
3. Generate the Semaphore proof locally without sending identity data to the chain.
4. Relay `installSession` on Robinhood Chain and show proof verification and nullifier consumption.
5. Let the agent execute an allowed swap using only its session key.
6. Replay the installation proof. The module rejects it.
7. Attempt an excessive amount, wrong asset, unlimited approval, and unapproved contract call. Each fails.
8. Revoke the session or let it expire. Subsequent actions fail.
9. Show the explorer. No name, email, ordinary human wallet, or liveness artifact appears.

## Build scope

### Required

- Standard Semaphore v4 proof generation and contracts, deployed on Robinhood Chain if necessary.
- Canonical authorization-policy encoding in the proof message.
- Deterministic scope specification.
- Test-only group administration isolated from production.
- Immutable Solidity smart-account policy module.
- Purpose-built demo smart account and vault.
- Relayer.
- Browser or CLI proof generation.
- Tests for valid installation, bad root, replay, expiry, revocation, wrong chain, wrong session key, wrong target, wrong function, wrong asset, over-limit action, and cumulative-limit exhaustion.
- Deployment on Robinhood testnet.
- Explorer links and reproducible demo.

### Optional

- Mainnet deployment after approval.
- ERC-4337 smart account integration.
- ERC-8004 identity link for the public agent, separate from the private operator proof.
- Stylus benchmark.

### Explicitly out of scope

- Production user migration.
- Changes to Stripe, liveness, email, or production approval logic.
- Production credential issuance.
- Cross-chain roots or bridges.
- DAO governance.
- Upgradeable contracts.
- Public identity or reputation registry.

## Acceptance criteria

The product is functional only if:

- A fresh approved test identity can complete the full loop.
- The installation proof is verified by a deployed Robinhood Chain contract.
- The installed session key can execute allowed actions without the owner key.
- The module gates real account state transitions, not a badge mint.
- No human PII or stable cross-application identifier is published.
- Replay, revocation, expiry, and policy violation tests fail on-chain.
- Removing a test member or rejecting its prior root has a demonstrated effect.
- The repository and demo accurately distinguish production code, competition code, and future plans.

## Main risks

### Product risk

Protocols may prefer Safe modules, ordinary allowlists, or scoped session keys without proof of an approved human. A design partner must confirm that accountable-human membership changes their willingness to permit agents.

### Privacy risk

Transaction timing, relayer behavior, uncommon scopes, and repeated action patterns can still correlate users. ZK does not hide the entire transaction graph.

### Issuer risk

AgentVisa remains trusted to approve humans and publish correct roots. Blockchain verification does not decentralize issuance.

### Verification and policy risk

A policy-encoding mismatch can authorize unintended actions even when the Semaphore proof is valid. Use one canonical encoder across the prover and contract, keep proof-bound fields explicit, avoid a custom circuit, and test adversarially.

### Revocation risk

If prior roots remain valid, a removed member may continue using proofs until those roots expire. Rejecting every prior root immediately can break in-flight actions. This policy requires a clear risk model and tests against the exact Semaphore root-history behavior.

### GTM risk

The original platform-adoption plan targeted web and MCP operators. Financial on-chain authorization is a sharper product but a different buyer. Do not assume existing outreach transfers.

## Sources

Official chain and competition sources:

- https://docs.arbitrum.io/build-decentralized-apps/public-chains
- https://docs.arbitrum.io/for-devs/dev-tools-and-resources/chain-info
- https://docs.arbitrum.io/stylus/stylus-gentle-introduction
- https://docs.robinhood.com/chain/
- https://docs.robinhood.com/chain/connecting/
- https://docs.robinhood.com/chain/deploy-smart-contracts/
- https://blog.arbitrum.io/robinhood-chain-mainnet/
- https://forum.arbitrum.foundation/t/arbitrum-open-house-london-2026/30975
- https://blog.arbitrum.foundation/open-house-london-registration-is-now-open/
- https://luma.com/openhouse-london

Protocol sources:

- https://docs.semaphore.pse.dev/
- https://github.com/semaphore-protocol/semaphore
- https://eips.ethereum.org/EIPS/eip-8004
- https://github.com/ethereum-attestation-service/eas-contracts

## Bottom line

AgentVisa makes sense on Arbitrum only as a hybrid authorization layer for contracts. The chain should verify a narrow proof and enforce an action. It should not store identity.

Robinhood Chain is the best competition deployment because the product becomes concrete: private, accountable authorization for AI agents acting in tokenized financial markets.

The next decision is not technical. It is whether one financial-agent or vault team will say: "We would grant an agent access if this proof and policy gate existed." Secure that answer while building the vertical slice.
