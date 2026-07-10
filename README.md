# AgentVisa Arbitrum

Private, enforceable mandates for financial agents.

AgentVisa Arbitrum lets an approved human authorize a constrained agent session without publishing the human's identity. The human keeps control of the smart account. The agent receives only a revocable session key, and on-chain policies limit what that key can do.

## Problem

People using AI agents with self-custodial funds currently face two bad choices:

1. Give the agent an unrestricted wallet key and risk losing everything to mistakes, prompt injection, malicious contracts, or key compromise.
2. Approve every transaction manually and lose most of the benefit of automation.

Normal wallets check whether a valid key signed. AgentVisa also checks whether the action falls within the human owner's mandate.

## MVP

The first vertical slice will:

1. Add an approved test identity to an AgentVisa Semaphore group.
2. Create a narrowly scoped smart-account permission.
3. Require both the smart-account owner's normal authorization and an anonymous Semaphore membership proof.
4. Install a short-lived agent session key.
5. Let that key execute one allowed financial action.
6. Reject replay, expiry, revocation, wrong targets, wrong functions, and excessive amounts.

Target network: Robinhood Chain testnet, chain ID `46630`.

## Product direction

The safety mandate is the first product. Later, trusted third-party issuers may provide private attribute credentials. An agent could then prove that its beneficial owner satisfies an eligibility requirement, such as jurisdiction, professional licence, organization role, or verified accredited-investor status, without exposing the underlying identity or documents publicly.

AgentVisa does not perform KYC or independently assert regulated attributes it cannot verify.

## Current status

Research and architecture definition are complete. Phase 0, the Phase 1A typed-hashing tracer bullet, and the Phase 1B local Semaphore tracer bullet pass in native Windows PowerShell. Phase 1C found canonical EntryPoint, Safe, Safe4337, and public bundler infrastructure on Robinhood testnet, but Safe7579, Smart Sessions, and required policies are absent and must be reproduced from pinned audited source. ADR-0003 remains proposed. No AgentVisa authorization contract, AgentVisa credential policy, testnet write, production user, or production credential is connected.

For the exact continuation state, read [HANDOFF.md](HANDOFF.md).

## Documentation

- [Current handoff](HANDOFF.md)
- [Domain model](CONTEXT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security model](docs/SECURITY.md)
- [Buy versus build matrix](docs/BUY_VS_BUILD.md)
- [Build plan](docs/plans/BUILD_PLAN.md)
- [Feasibility and GTM research](docs/research/2026-07-10-agentvisa-arbitrum-feasibility.md)
- [Implementation research](docs/research/2026-07-10-implementation-options.md)
- [Phase 1C infrastructure probe](docs/research/2026-07-10-phase-1c-infrastructure-probe.md)
- [Dependency review](docs/dependencies/phase-0-review.md)
- [Architecture decisions](docs/adr/)

## Non-goals

- Moving identity, liveness media, payment records, or PII on-chain
- Giving an agent the account owner or recovery key
- Replacing legal KYC, AML, suitability, or securities-compliance processes
- Treating an agent as the legal or beneficial owner of an investment
- Launching a token, NFT credential, custom chain, or public identity registry
- Connecting production users during the competition build

## Contributing

Read [AGENTS.md](AGENTS.md), [CONTEXT.md](CONTEXT.md), and all accepted ADRs before changing code. The repository must work in native Windows PowerShell and Linux CI.

Do not deploy to mainnet, handle real funds, or connect production AgentVisa data without explicit approval.