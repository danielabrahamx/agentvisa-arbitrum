# ADR-0002: Use standard Semaphore v4 for MVP credential proofs

**Status:** Superseded by ADR-0006

**Date:** 2026-07-10

ADR-0006 retains standard Semaphore v4 but changes the proof message, scope,
nullifier consumer, and target chain responsibilities for the gaming-platform
MVP.

## Context

Existing AgentVisa work contains both legacy Semaphore BN254 proofs and newer Mina/o1js proofs. Robinhood Chain is EVM-compatible and exposes BN254 verification through standard EVM behavior. Mina proofs are not natively verifiable there.

The MVP needs anonymous approved-operator membership and binding to a session permission. It does not need arbitrary private predicates.

## Decision

Use pinned, audited Semaphore v4 packages and contracts.

- AgentVisa administers a synthetic approved-operator group for the MVP.
- The Semaphore `message` binds a typed Mandate Digest.
- The Semaphore `scope` binds chain, account, authorization contract, group, Permission Digest, and authorization identifier.
- The contract consumes the nullifier during mandate authorization.
- Deploy standard Semaphore contracts on Robinhood Chain when no verified deployment exists.
- Do not modify the circuit or write a verifier.

## Consequences

- Proof generation and verification are EVM-native and established.
- Binary group membership is supported.
- Arbitrary attribute predicates are deferred.
- Group-root history and revocation latency must be tested explicitly.
- Existing installed permissions require their own short expiry or revocation path.

## Rejected alternatives

- Mina proof verification or wrapping: too much protocol for the first product.
- Custom Groth16 circuit: unnecessary audit and proving risk.
- EAS public attestation: linkable and does not provide anonymous membership.
- Ed25519 signed roots in Solidity: duplicates Semaphore group administration.