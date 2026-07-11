# Domain Context

This file defines canonical product language for code, tests, and documentation.

## Product boundary

AgentVisa issues a reusable, privacy-preserving Credential after a configured
Uniqueness Source authorizes enrollment. A Relying Party presents one
application-specific registration challenge, verifies one Credential Proof,
and creates its own application account.

The first Relying Party is a gaming platform. The interfaces remain
platform-agnostic: no credential, scope, account, or reward primitive is tied
to one game vendor.

## Core concepts

### Credential Holder

The person controlling a local Semaphore identity. The holder is not
automatically KYC-approved, legally identified, or free from automation. The
Credential means only what its source, schema, assurance, and issuance policy
state.

### Uniqueness Source

An external system accepted by a Credential Issuer for enrollment. The MVP
uses a clearly synthetic source and may add World ID staging through an
adapter. A source defines its uniqueness domain; it does not prove every
possible meaning of “one human.”

### Enrollment Authorization

A short-lived, signed authorization binding source, uniqueness domain, opaque
subject, Credential schema, assurance, identity commitment, nonce, and expiry.
It is consumed exactly once. It is not itself a reusable Credential.

### Credential Issuer

The service that validates an Enrollment Authorization and admits the bound
identity commitment to a Semaphore group. AgentVisa is the synthetic MVP
issuer. Issuance remains trusted and does not become decentralized merely
because proofs or rewards use a blockchain.

### Credential

Anonymous membership in a configured AgentVisa Semaphore group. The identity
secret remains in the holder's browser. Games and other Relying Parties never
receive the enrollment authorization or source nullifier.

### Relying Party

An application that accepts a Credential Proof under an explicit policy. The
first Relying Party is a gaming platform; each game is a separate application
scope.

### Stable Application ID

An immutable identifier assigned by the Relying Party. For gaming, this is the
Stable Game ID. It must not include wallet, username, season, or registration
attempt.

### Credential Proof

A standard Semaphore v4 membership proof whose message binds the application
login key and whose scope binds the Stable Application ID.

### Registration Nullifier

The application-scoped Semaphore nullifier. It allows one application account
per Credential while preventing cross-application correlation. Universal
nullifiers are forbidden.

### Application Account

The Relying Party's pseudonymous account created after successful proof
verification and atomic nullifier consumption. For gaming this is the Game
Account. Routine login, play, moderation, and reward eligibility use this
account and do not require repeated personhood proofs.

### Login Key

A holder-controlled application authentication key bound by the registration
proof. It is distinct from the Semaphore identity secret and payout wallet.

### Payout Address

An address selected to receive a public reward claim. It is not evidence of
personhood and may change without creating another Application Account.

### Reward Authorization

A short-lived EIP-712 authorization issued for an eligible application result.
It binds chain, contract, application, result, claim ID, recipient, amount, and
expiry. The claim contract consumes each claim ID once.

## MVP trust statements

The MVP proves:

- an accepted source authorized one enrollment under its stated uniqueness
  domain;
- AgentVisa issued one Semaphore Credential for the bound commitment;
- a current group member registered once for a Stable Application ID;
- the registration proof binds the application's Login Key;
- a trusted application authorizer approved a narrow synthetic reward claim.

The MVP does not prove:

- a World-native third-party credential was issued;
- the holder is legally identified, KYC-approved, or not using automation;
- credentials cannot be lent or multiple accepted source identities obtained;
- recovery or reissuance preserves bans;
- the payout wallet identifies the Credential Holder;
- issuance, moderation, game results, or reward authorization are decentralized.

## Product sentence

AgentVisa lets platforms admit one pseudonymous account per accepted
credential, enforce application-local continuity, and issue narrow rewards
without exposing a global identity across applications.
