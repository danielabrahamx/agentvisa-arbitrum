# ADR-0003: Evaluate Safe, ERC-7579, and Smart Sessions before custom account code

**Status:** Proposed  
**Date:** 2026-07-10

## Context

The product needs mature account ownership and recovery, constrained Session Keys, immediate owner revocation, and compatibility with Robinhood Chain.

Safe provides established ownership. Safe7579 adapts Safe to ERC-7579 modules. Smart Sessions provides Session Key validators and action policies. Their exact deployment and integration behavior on Robinhood testnet is not yet proven.

Smart Sessions Enable Mode requires normal Account Owner authorization. A Semaphore proof is not an owner signature and must not replace it.

## Proposed decision

Prefer this composition if Phase 1 tracer bullets pass:

- Safe for account ownership and recovery.
- Safe7579 for ERC-7579 compatibility.
- Smart Sessions for Session Key and action policies.
- AgentVisaAuthorization for one-time Semaphore validation.
- AgentVisaCredentialPolicy as a mandatory check against active Authorization Records.

Both the Account Owner signature and Credential Proof bind the same Permission Digest.

## Acceptance gates

- Required contracts and EntryPoint work on Robinhood testnet.
- The exact Permission Digest is reproducible.
- A mandatory custom policy can check AgentVisa authorization safely.
- Owner revocation works without a bundler or paymaster.
- No proof path can change owners, recovery, or administrative modules.

## Consequences if accepted

- AgentVisa avoids building a Smart Account and generic policy engine.
- The system inherits multiple dependencies and their deployment assumptions.
- Exact source versions and bytecode must be pinned and recorded.

## Fallback

If mandatory policy integration is unsafe or unreliable, design a narrow Safe-native module. Do not replace owner authorization, fork Smart Sessions casually, or build a new ERC-4337 account.