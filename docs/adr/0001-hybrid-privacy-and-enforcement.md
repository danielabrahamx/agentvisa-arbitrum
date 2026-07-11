# ADR-0001: Keep identity evidence off-chain and enforce mandates on-chain

**Status:** Superseded by ADR-0006

**Date:** 2026-07-10

This decision records the former smart-account MVP. ADR-0006 retains the
off-chain privacy principle but replaces mandate and smart-account enforcement
with application-scoped registration and a narrow reward claim.

## Context

AgentVisa handles human approval, liveness evidence, identity secrets, and potentially regulated credentials. Public chains provide useful atomic enforcement but expose permanent state.

## Decision

Use a hybrid architecture.

Keep identity evidence, liveness media, PII, payment records, private keys, legal documents, and person-to-commitment mappings off-chain.

Put only what contracts need to enforce a mandate on-chain:

- Credential-group state.
- Privacy-preserving proof inputs.
- Scope-specific nullifiers.
- Short-lived Authorization Records.
- Smart-account permissions and policy state.

The Smart Account enforces the Mandate before execution.

## Consequences

- AgentVisa remains a trusted Credential Issuer for its groups.
- Blockchain deployment does not decentralize issuance.
- Public observers can see account actions and proof-related public values.
- The system preserves identity privacy but does not provide transaction-graph privacy.
- The live AgentVisa service does not need to migrate on-chain.

## Rejected alternatives

- Full on-chain identity and liveness storage: unacceptable privacy and deletion risk.
- Public identity NFTs or badges: linkable and do not constrain actions.
- Pure off-chain verification: cannot atomically protect a Smart Account that already delegated authority.