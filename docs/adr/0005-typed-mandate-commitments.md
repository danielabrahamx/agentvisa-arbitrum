# ADR-0005: Use fixed typed Mandate commitments and golden vectors

**Status:** Superseded by ADR-0006

**Date:** 2026-07-10

The implemented vectors remain valid historical test material, but MandateV1
and the Smart Sessions Permission Digest are not part of the active
gaming-platform MVP.

## Context

A policy-encoding mismatch can authorize a different session from the one an Operator intended. JSON canonicalization, packed dynamic values, implicit number conversion, and inconsistent field reduction are unacceptable at this security boundary.

Semaphore requires public message and scope values inside the BN254 scalar field. Smart Sessions has its own canonical Permission Digest.

## Decision

- Define a versioned, fixed-size `MandateV1` type.
- Bind the exact Smart Sessions Permission Digest rather than reconstructing its meaning.
- Hash the Mandate with a domain-separated type hash and ABI encoding.
- Map digest to BN254 field with one documented modulo-reduction function.
- Define Scope with a separate domain and fixed fields.
- Implement identical TypeScript and Solidity functions.
- Publish golden vectors covering normal, boundary, and malformed cases.
- Treat any digest change as a protocol version change.

Version 1 contains no dynamic arrays. It supports one account, permission, Session Key, validity window, group, and authorization identifier.

## Consequences

- Multi-target mandates require a future protocol version or separately hashed collections.
- TypeScript and Solidity compatibility becomes a release gate.
- Policy semantics remain in Smart Sessions, while the Credential Proof binds its exact digest.

## Rejected alternatives

- Canonical JSON: poor fit for Solidity and numeric types.
- `abi.encodePacked` with dynamic collections: ambiguous composition risk.
- Raw Keccak digest without field conversion: may exceed the circuit field.
- Truncating strings or hashes: weakens collision resistance.