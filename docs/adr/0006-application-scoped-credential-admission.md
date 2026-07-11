# ADR-0006: Use application-scoped Credential admission for the MVP

**Status:** Accepted

**Date:** 2026-07-11

## Context

The first design targeted constrained financial-agent sessions on Robinhood
testnet. The current MVP is for a gaming platform that needs one pseudonymous
account per accepted Credential, wallet-independent ban continuity, and a
narrow synthetic reward.

Research found that current supported World tooling can verify World-owned
credentials but does not provide a supported end-to-end path for AgentVisa to
issue an arbitrary reusable credential into production World App. The
repository already has working pinned Semaphore v4 proof infrastructure.

The product should serve gaming first without making its Credential,
registration, account, or reward interfaces specific to one platform.

## Decision

1. A Uniqueness Source adapter issues a signed Enrollment Authorization bound
   to a browser-generated Semaphore identity commitment.
2. AgentVisa consumes the authorization and issues a reusable Credential by
   admitting the commitment to an AgentVisa Semaphore group.
3. A Relying Party requests one standard Semaphore proof when creating an
   Application Account.
4. Proof scope binds a Stable Application ID. Proof message binds that ID and
   the application Login Key.
5. Proof verification, Registration Nullifier consumption, and account creation
   are atomic under a durable uniqueness constraint.
6. Routine application activity uses the Application Account and requests no
   further personhood or membership proof.
7. Moderation is application-local. Wallet and username changes do not create
   another account.
8. A narrow EIP-712 Reward Authorization may be claimed once on Arbitrum
   Sepolia. The contract handles no identity or proof data.
9. The first adapter and UI model a gaming platform, but core domain and service
   interfaces remain platform-agnostic.
10. The synthetic source is the required MVP path. World staging is an optional
    adapter and is not represented as World-native third-party issuance.

## Consequences

- AgentVisa remains a trusted Credential Issuer.
- Games receive an application-scoped pseudonym rather than enrollment or
  global identity data.
- One Credential can be reused across applications without a universal
  nullifier.
- The Relying Party remains trusted for accounts, moderation, results, and
  reward eligibility.
- Public reward recipients can correlate themselves with a game result.
- Lost Semaphore identities cannot be reissued safely until recovery preserves
  existing Application Account and ban continuity.
- Existing smart-account, Safe4337, MandateV1, and Robinhood work is historical
  repository material, not the active MVP.

## Superseded decisions

- ADR-0001 is superseded for on-chain mandate enforcement; its privacy principle
  is retained.
- ADR-0002 is superseded for proof binding and chain deployment; standard
  Semaphore v4 is retained.
- ADR-0003 is rejected for the active MVP.
- ADR-0005 is superseded for active product semantics; its fixed typed-encoding
  discipline is retained.
- ADR-0004 remains accepted.

## Rejected alternatives

- Direct World verification as the only product: smaller, but removes the
  reusable AgentVisa-issued Credential required by this MVP.
- World-native AgentVisa credential issuance: unsupported end-to-end by current
  stable World App and IDKit tooling.
- Direct World verification on Arbitrum: no supported official World v4
  deployment was found for Arbitrum Sepolia.
- Global gamer identifier or global blacklist: creates unnecessary correlation
  and cross-platform governance.
- Repeated personhood proofs for play or claim: unnecessary after account
  creation.
- Continuing Safe, Smart Sessions, or financial-agent work: outside the current
  gaming-platform product boundary.
