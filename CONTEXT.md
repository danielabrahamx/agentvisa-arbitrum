# Domain Context

This file defines the product language. Use these terms consistently in code, tests, documentation, and discussion.

## Core concepts

### Operator

The human or organization responsible for an agent. An Operator may hold credentials issued after an external verification process.

An Operator is not automatically a legally identified or KYC-approved person. The meaning depends on the credential issuer and schema.

### Account Owner

A signer or owner set that retains ultimate control and recovery authority over a Smart Account.

The Account Owner authorizes installation and revocation of Agent Sessions. The Agent never receives the owner or recovery key.

### Agent

Software that proposes or submits actions autonomously. An Agent is not assumed to be safe, correct, legally responsible, or independent from its Operator.

### Session Key

A dedicated key held by an Agent. It can act only through an installed Mandate and expires or can be revoked independently of the Account Owner.

### Smart Account

The on-chain account that holds assets and enforces Mandates. The MVP targets a Safe-compatible modular account rather than an externally owned account.

### Mandate

A typed, owner-approved authorization for one Session Key. A Mandate defines the account, permission identifier, target, function, asset or action class, amount limits, validity window, and unique authorization identifier.

A proof can bind a Mandate. Enforcement is performed by smart-account policies, not by the proof itself.

### Permission Digest

The canonical EIP-712 or module-native digest of the exact permission the Account Owner approves. The Operator proof must bind this digest so the credential and wallet authorization cannot be substituted independently.

### Credential

A claim issued by a trusted Credential Issuer to an Operator. The MVP credential is anonymous membership in an AgentVisa-approved Semaphore group.

Future credentials may represent specific attributes, but only according to the issuer's schema and verification process.

### Credential Issuer

The party responsible for verifying and issuing a Credential. AgentVisa is the initial issuer for approved-operator membership. AgentVisa must not claim regulated attributes that require another authorized verifier.

### Credential Proof

A privacy-preserving presentation showing that an Operator holds an acceptable Credential and authorized a particular Mandate. The MVP uses a Semaphore BN254 Groth16 membership proof.

### Authorization Record

Short-lived on-chain state showing that a Credential Proof was validated for a specific account and Permission Digest. It does not replace the Account Owner's signature.

### Policy

An on-chain rule applied to Session Key actions. Policies enforce targets, function selectors, amounts, cumulative usage, time windows, and other constraints.

### Beneficial Owner

The person or entity legally entitled to an asset or investment. An Agent is not the Beneficial Owner. A regulated intermediary may still need to identify and retain records about the Beneficial Owner.

### Eligibility Credential

A future Credential asserting that an Operator satisfies a specific predicate, such as a jurisdiction, licence, organization role, or accredited-investor status.

Eligibility is issuer-specific, schema-specific, time-sensitive, and often offering-specific. Portability is never assumed.

### Relying Party

A wallet, protocol, issuer, broker, platform, or contract that decides whether to accept a Credential Proof or permit an action.

### Scope

The public Semaphore context used to derive a one-time nullifier. MVP Scope includes the chain, account, AgentVisa authorization contract, Permission Digest, and unique authorization identifier.

### Nullifier

A scope-specific public value produced by Semaphore. It prevents reuse within that Scope without revealing the Operator. A universal or cross-application nullifier is forbidden.

## Trust statements

The MVP proves all of the following:

- Some current member of an accepted AgentVisa group created the Credential Proof.
- The proof binds a specific account and Permission Digest.
- The Account Owner separately approved the same permission through the smart-account authorization flow.
- The Session Key action satisfies installed policies.

The MVP does not prove:

- The Agent is safe or competent.
- The Operator and Account Owner cannot collude with another credential holder.
- The Operator completed legal KYC unless a qualified issuer explicitly says so.
- The Agent is the legal or beneficial owner of assets.
- A regulated intermediary can avoid its own recordkeeping duties.
- The entire transaction graph is private.

## Product sentence

AgentVisa lets people automate self-custodial accounts without giving AI agents unrestricted authority, then lets those agents privately prove owner attributes when a trusted issuer and relying party support them.