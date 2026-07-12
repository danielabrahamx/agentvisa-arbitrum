# ADR-0007: On-chain Semaphore admission (static demo, no runtime backend)

**Status:** Accepted (2026-07-12)

**Supersedes for demo hosting:** Phase 6 localhost Node + SQLite registration authority.

## Context

The competition demo must show **one account per credential per application** with an
**Arbitrum anchor**. The prior path used off-chain nullifier consumption in SQLite and a
separate `GameRewardClaim` contract, which confused the identity story and required a
runtime backend.

Upstream [Semaphore v4](https://github.com/semaphore-protocol/semaphore) already provides
on-chain group membership, proof verification, and nullifier consumption. The repository
already passes local integration tests deploying upstream contracts.

World ID’s per-app pattern (scoped nullifier after upstream uniqueness) is the product
model; World itself is not integrated.

## Decision

1. Deploy upstream `Semaphore` (+ verifier, Poseidon library) to Arbitrum Sepolia `421614`.
2. Add one thin **`AgentVisaAdmission`** contract that:
   - verifies typed **Enrollment Authorization** signatures from configured upstream sources;
   - consumes enrollment nonce and opaque subject digest;
   - calls `Semaphore.addMember` for the credential group.
3. Application registration is **`Semaphore.validateProof`** called from the browser with
   `scope` and `message` from `deriveApplicationRegistrationV1` (`@agentvisa/policy`).
4. The public demo is a **static SPA** — no Node API or SQLite for membership/nullifiers
   at runtime.
5. **`GameRewardClaim`** is demoted from the judge path (optional historical artifact).
6. Hackathon demo enrollment signing uses a **testnet issuer key** injected at static build
   time; production would use an HSM or source-specific signer off-chain.

## Consequences

- Nullifier replay enforcement is trustless on-chain for registration.
- Identity secrets remain off-chain; commitments and Semaphore public inputs are public
  chain history (expected Semaphore privacy model).
- Judges need MetaMask on `421614` and gas for enroll + register (+ sybil revert demo).
- Enrollment digest must match between Solidity and TypeScript (golden vectors required).
- Play, ban, and reward flows are out of scope unless re-added off-chain later.

## Rejected alternatives

- Continuing SQLite as authoritative nullifier store for the demo.
- Leading with `GameRewardClaim` as the Arbitrum story.
- Custom Groth16 verifier or Semaphore fork.
- Runtime Node backend for enrollment signing (acceptable for production, not hackathon host).
