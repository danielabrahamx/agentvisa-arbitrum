# World ID Gaming Pivot Brainstorm

**Status:** Living brainstorm, not an accepted architecture or implementation plan  
**Date:** 2026-07-11  
**Primary demo:** Interactive “bot ban burns the identity”  
**Target:** Arbitrum hackathon demonstration using synthetic identities and test assets

## Working Product Sentence

AgentVisa turns a platform-approved uniqueness decision into a privacy-preserving gamer credential. A player can use a pseudonymous account without disclosing civil identity, but switching wallets does not let the same enrolled subject evade a game-level bot ban or claim the same reward twice.

AgentVisa inherits sybil resistance from the platform's accepted uniqueness source. It does not create human uniqueness by issuing a credential.

## Credential Portability Decision

One AgentVisa credential is reusable across games that accept its source, schema, assurance level, and uniqueness domain.

The credential itself does not expose one global gamer identifier. Each game receives a different relying-party-scoped pseudonym and one deterministic game-enrollment nullifier derived from the underlying World ID account. Therefore:

- Issuance happens once rather than once per game.
- Games independently choose which credential sources and schemas they accept.
- The same World ID account cannot open another account in the same game by presenting a different accepted credential.
- Two games cannot correlate the gamer from ordinary credential presentations when they use distinct relying-party identifiers and session material.
- A globally visible credential identifier is explicitly rejected.

## Core Insight

The system does not prove that a human, rather than a bot, performed every gameplay action. The game retains its existing bot-detection system.

The system changes the economics and enforceability of botting:

1. A platform-approved Uniqueness Source authorizes at most one active enrollment per subject within a defined uniqueness domain.
2. AgentVisa consumes that authorization and issues a gamer credential without receiving the underlying verification evidence.
3. A fixed World ID game-enrollment action produces one game-scoped uniqueness nullifier per World ID account.
4. The game consumes that enrollment nullifier once, creates a game account, associates application authentication state, and records bans against that game account.
5. A detected bot can switch wallets and proxies, but the same World ID account cannot complete the same game-enrollment action again while the relying-party scope, OPRF state, and consumed-nullifier state remain stable.
6. The resulting game account is credential-backed. Routine play and reward claims use that authenticated account rather than presenting the credential again for every action.

The scarce resource consumed by a game-local ban is that World ID account's one enrollment slot for the game, not the credential globally and not a disposable wallet.

## Reuse World ID, Do Not Rebuild It

World ID v4 should supply the credential, proof, authenticator, recovery, scoped-nullifier, and session machinery wherever its exact semantics match the product.

AgentVisa should not build:

- A new zero-knowledge circuit or verifier.
- A replacement Merkle tree or nullifier protocol.
- A new authenticator or account-recovery protocol.
- A fork of World ID infrastructure.
- An Orb replacement inside the World Proof of Human issuer.

The proposed product seam is:

- A source-agnostic enrollment-authorization interface.
- World-compatible credential issuance, subject to a production-tooling spike.
- Gaming-specific relying-party scopes.
- Persistent game-ban semantics.
- Reward-claim semantics.
- Arbitrum verification or attestation.
- An integration SDK and demonstrator.

## Important Terminology Correction

We would not technically “replace Orb verification” inside World ID's existing Proof of Human credential.

Instead, a platform selects or operates a Uniqueness Source. That source performs verification outside AgentVisa and sends AgentVisa a signed, privacy-safe Enrollment Authorization. AgentVisa then issues a gamer credential through World ID v4 if supported production tooling permits it.

Third-party issuer registration, issuance, authenticator support, and accepted-schema UX must be proven against a pinned release. The source, schema, assurance level, expiry, uniqueness domain, deduplication policy, and recovery policy must be visible to the game. A game must never confuse a platform-selected credential with World-issued Orb Proof of Human.

## Product Boundary: Uniqueness Before Issuance

The uniqueness source is deliberately pluggable and outside the first AgentVisa integration. It may be World Proof of Human, KYC, passport verification, in-person enrollment, a platform's existing anti-abuse system, or another source accepted by that platform.

AgentVisa does not evaluate the source's raw evidence. It only:

- Verifies that the Enrollment Authorization came from a source trusted by the platform.
- Verifies its domain, schema, validity, nonce, and intended credential subject.
- Prevents replay of the same authorization.
- Issues the corresponding gamer credential.
- Preserves the source and assurance semantics so the game can enforce its acceptance policy.

The platform remains responsible for deciding whether its source establishes one-human uniqueness, document uniqueness, account uniqueness, or only increased abuse resistance.

No PII, document data, liveness media, biometric template, or person-to-credential mapping may be stored on-chain.

## Enrollment Authorization

The source-to-AgentVisa boundary should be one signed, typed object containing only the information required for issuance:

```text
version
sourceId
uniquenessDomain
credentialScope
opaqueSubjectId
credentialSubject
credentialSchema
assuranceLevel
issuedAt
expiresAt
nonce
recoveryReference
```

- `opaqueSubjectId` is stable only inside the source's stated uniqueness domain. It contains no PII.
- `credentialScope` states whether the issued credential is portable across relying parties or restricted to a named ecosystem.
- `credentialSubject` binds the authorization to the gamer-controlled World account or blinded credential subject.
- `nonce` makes the authorization single-use.
- `recoveryReference` is optional and supports controlled reissuance without creating another subject.
- The source signs the complete typed object.

The exact World ID credential-subject representation and issuer request must come from pinned upstream specifications. AgentVisa must not invent an approximation.

If a game accepts several uniqueness sources as alternatives, a person may obtain credentials through each source unless the sources perform cross-source deduplication. World ID's game nullifier still prevents multiple game accounts when those credentials belong to the same World ID account, but it cannot detect a person who obtained credentials on separate World ID accounts. AgentVisa cannot solve that from unrelated opaque identifiers.

## Proposed Roles

- **Operator:** The gamer who controls the private World ID authenticator.
- **Uniqueness Source:** A platform-approved external system that performs verification and deduplication, then signs an Enrollment Authorization.
- **Credential Issuer:** AgentVisa or another World-compatible issuer that consumes an Enrollment Authorization and issues the gamer credential.
- **Relying Party:** The game or tournament accepting the credential.
- **Agent:** Optional game client automation. This is not required for the first gaming demo.
- **Account Owner:** The gamer controlling the payout wallet or Smart Account.

## Protocol Terms Kept Separate

- **World ID account:** The recoverable protocol account from which uniqueness proofs are derived.
- **Credential:** An issuer-signed claim accepted by the game. Credential acceptance and human uniqueness are separate checks.
- **Game-enrollment nullifier:** A deterministic, game-scoped value for one fixed enrollment action. The game consumes it once.
- **World session ID:** A reusable, intentionally linkable identifier presented after enrollment. It does not automatically cause a fresh registration to resolve to an old session, and raw session IDs must remain confidential relying-party state.
- **Credential-backed game account:** The game's record created by a successful enrollment proof. It carries the fact that admission requirements were satisfied without storing the credential or civil identity in public state.
- **Game session token or key:** The application's routine authentication mechanism after registration. It is not interchangeable with a World session ID.
- **Reward claim identifier:** A game-issued, single-use identifier for one recorded win or payout. It prevents transaction replay but does not establish personhood.

## Proposed Player Lifecycle

### 1. Enrollment

1. The gamer creates or uses a World ID v4 account.
2. The platform-selected Uniqueness Source performs its verification and deduplication process.
3. The source signs one Enrollment Authorization for its uniqueness domain, credential scope, and gamer-controlled credential subject.
4. AgentVisa validates the source, signature, schema, domain, validity, subject binding, and nonce.
5. AgentVisa consumes the authorization and issues a credential carrying the source and assurance semantics.

For the hackathon demo, the platform provides a synthetic signed Enrollment Authorization. The interface must say “Synthetic platform authorization” and must not imply that AgentVisa performed KYC or personhood verification.

### 2. Game registration

1. The game defines a stable relying-party identifier for the lifetime of the game.
2. The game defines one fixed enrollment action that is not varied by wallet, username, season, or registration attempt.
3. The gamer creates a World uniqueness proof for that relying party and action while presenting an accepted issuer and schema.
4. The game atomically consumes the resulting game-enrollment nullifier under a unique constraint and creates one game account.
5. The game associates an application login key or session with that account as trusted application state.
6. A protocol spike must determine whether World v4 can cryptographically prove that a separate session and application key belong to the same World ID account without defeating unlinkability. The demo must not claim this binding unless proven.
7. The nullifier for a repeated enrollment is deterministically the same. Rejection may occur in the authenticator before proof delivery or at the relying party's consumed-nullifier check; exact production UX is spike-dependent.
8. The game stores gameplay state against the game account rather than the wallet.

The relying-party identifier and enrollment action must not change between seasons merely to let players escape bans. Versioning and migrations need an explicit continuity rule.

### 3. Routine login and play

The gamer uses the application's accepted authentication state. If the session-binding spike succeeds, this may include an existing World session ID and bound application login key. Routine gameplay should not require a new zero-knowledge proof for every action. A fresh session is not a substitute for the consumed enrollment proof.

Raw World session IDs must never be displayed publicly, written on-chain, included in analytics, or emitted in ordinary logs.

Bot detection remains an input from the game. The first demo uses a manual “Flag bot activity” control so it does not pretend to solve bot detection.

### 4. Ban

1. The game changes the game-scoped identifier's status to banned.
2. The game stops accepting existing application session tokens and login keys for that game account.
3. A new wallet or username cannot re-enroll the same World ID account while the same relying-party and action encoding, OPRF key/state, authenticator semantics, and durable consumed-nullifier store remain in force.
4. The credential remains unlinkable to unrelated games only when each game uses a distinct relying-party identifier and the client never reuses World session IDs, application keys, or identifiers across games.

A game-local ban should not silently become a universal ban. Cross-game ban sharing requires a separate policy, user notice, appeal model, and privacy analysis.

Ban continuity survives authenticator recovery only when recovery preserves the same World ID account. A second World ID account bypasses the ban unless the accepted Credential Issuer prevents duplicate-human issuance. Credential replacement and reissuance semantics remain issuer-specific.

## Simplified MVP Decision

Bot bans are game-scoped. A ban consumes that credential holder's one account slot in the affected game, but it does not revoke the reusable credential or affect unrelated games.

Issuer-level credential revocation is reserved for credential fraud, compromise, expiry, or failure of the underlying uniqueness claim. A global gaming blacklist is deferred because it requires targeted anonymous revocation, shared adjudication, and appeals that the first product does not need.

The MVP therefore needs only:

1. One reusable credential issued after an external uniqueness decision.
2. One game-scoped pseudonym and enrollment nullifier.
3. One credential-backed game account.
4. Normal game authentication, banning, winning, and payout after registration.

### 5. Reward claim

The credential is an admission prerequisite, not a prize credential. The game does not need another personhood proof when a credential-backed game account claims a win.

The game:

1. Authenticates the existing game account.
2. Confirms that the account is credential-backed, active, unbanned, and recorded as the winner.
3. Applies its policy for credential expiry or revocation at claim time.
4. Binds one reward claim identifier to the payout wallet and amount.
5. Signs or submits the claim to the Arbitrum reward contract.

The contract consumes the reward claim identifier once. A second zero-knowledge proof is optional and justified only if the payout contract cannot trust the game's winner authorization.

This keeps responsibilities separate:

- The credential and game-enrollment nullifier enforce one admitted account per source-approved subject.
- The game account proves continuity between registration, play, bot enforcement, and winning.
- The game-issued reward authorization proves that this account won.
- The reward claim identifier prevents payout replay.

## Arbitrum Integration Options

World ID v4 currently has no verified official deployment for the repository's target Arbitrum networks. The living options are:

### A. Off-chain World verification with Arbitrum authorization

The game or AgentVisa verifies the World proof during account registration. When that credential-backed game account wins, the game signs a narrowly scoped reward authorization consumed by an Arbitrum contract.

This is the fastest demo path. It introduces an attestation signer and must not be presented as fully trustless verification.

### B. World-gated enrollment into the existing Semaphore group

A one-time World proof authorizes admission of a locally generated Semaphore commitment. Game registration verifies the anonymous membership proof through Semaphore on Arbitrum; later rewards rely on the credential-backed game account and game winner authorization.

This reuses the repository's working Semaphore integration and avoids custom cryptography, but adds a second credential layer and creates an enrollment-linkage boundary that requires privacy analysis. If an off-chain operator controls admission, that operator is a trusted enrollment signer and must be disclosed just as in option A.

### C. Direct World ID verification on Arbitrum

Use an official verifier and state path if World deploys one. Otherwise this requires bridge, verifier, upgrade, and monitoring responsibilities that are outside the hackathon scope.

## Chosen Demo Story

### Title

**One Human, One Game Identity**

### Three-minute narrative

#### Act 1: Anonymous enrollment

1. The `Robot Rally` platform supplies a clearly labelled synthetic, signed Enrollment Authorization for “Alex.”
2. The demo displays the authorization's source, platform, schema, assurance label, expiry, and opaque subject, with no verification evidence or PII.
3. AgentVisa verifies and consumes the authorization.
4. A disclosed mock World-compatible issuer returns an accepted gamer credential unless the third-party issuer tooling spike has passed.
5. Alex joins `Robot Rally` with Wallet A.
6. The game consumes Alex's fixed game-enrollment nullifier, creates a game account, and establishes application authentication state.
7. The game displays a game-scoped pseudonym, not Alex's identity.

Audience takeaway: the platform chose the uniqueness source; AgentVisa converted its approval into one private, enforceable gamer slot.

#### Act 2: Bot detection and ban

1. Alex's account starts playing.
2. The presenter opens the game operator panel and selects “Flag bot activity.”
3. The account is banned and its session immediately stops working.

Audience takeaway: AgentVisa consumes the game's bot-detection decision; it does not claim to detect the bot.

#### Act 3: Wallet switching fails

1. Alex creates or selects Wallet B and a fresh game username.
2. Alex attempts the same fixed game-enrollment action from the same World ID account.
3. The deterministic nullifier is already consumed. Depending on the pinned implementation, rejection occurs in the authenticator or at the game verifier.
4. The demo normalizes either result to: “This World ID account's game slot is already registered and banned.”

This is the primary “whoa” moment. Wallets, usernames, IP addresses, and proxies were disposable; the synthetic accepted-player slot was not.

#### Act 4: Honest player receives the reward

1. “Blair,” a separate synthetic gamer, joins successfully.
2. Blair completes or is assigned the winning result.
3. The game authenticates Blair's enrolled account, checks the win and ban state, and creates a visibly disclosed trusted game authorization.
4. The authorization binds one reward claim identifier, test recipient, amount, game, and result.
5. The synthetic Arbitrum claim succeeds once.
6. Reusing that claim or substituting another recipient wallet fails.

Audience takeaway: the credential was checked at admission; the game account carries that status through play, enforcement, and payout.

## Proposed Demo Surfaces

### Gamer view

- Synthetic platform-authorization status.
- Credential issuer and assurance label.
- Game-scoped pseudonym.
- Connected payout wallet.
- Join, play, and claim controls.
- Clear rejection reason without exposing a civil identity.

### Game operator view

- Active pseudonymous players.
- Simulated bot-risk event.
- Ban action and transaction or signed-attestation status.
- Re-entry attempt tied to the same game identity.
- No PII or cross-game identity.

### AgentVisa issuer view

- Accepted platform and Uniqueness Source.
- Enrollment Authorization signature, schema, domain, expiry, and nonce checks.
- Credential-subject binding status.
- Authorization consumed and credential issued.
- Replayed authorization rejected.
- Raw verification evidence deliberately absent.

### Arbitrum view

- Testnet transaction links.
- Accepted reward authorization.
- Consumed reward claim identifier.
- Replayed claim rejection.
- No production funds or identity evidence.

## Issuance-Focused Demo Architecture

The demo begins after the platform has made its uniqueness decision.

```text
Synthetic Platform Adapter
  -> signs Enrollment Authorization

AgentVisa Issuer
  -> validates trusted source and typed fields
  -> consumes authorization nonce
  -> issues World-compatible gamer credential

Gamer Authenticator
  -> stores credential and creates scoped proofs

Game Registration Verifier
  -> checks credential and fixed enrollment action
  -> consumes game-enrollment nullifier
  -> creates pseudonymous game account

Game Operator
  -> supplies bot decision
  -> bans game account

Reward Authorizer
  -> checks authenticated winner and ban status
  -> binds recipient, amount, result, and reward claim identifier

Arbitrum Reward Contract
  -> checks trusted game authorization
  -> consumes reward claim identifier
  -> emits or transfers synthetic reward
```

The exact World-compatible issuance and proof calls remain adapter interfaces until the pinned upstream integration spike passes. The fallback demo adapter must preserve the same typed inputs, outputs, and failure states without claiming production World compatibility.

## Issuance State Machine

```text
UNSEEN
  -> AUTHORIZATION_ACCEPTED
  -> ISSUING
  -> ISSUED

AUTHORIZATION_ACCEPTED
  -> REJECTED_EXPIRED
  -> REJECTED_SOURCE
  -> REJECTED_SCHEMA
  -> REJECTED_DOMAIN
  -> REJECTED_SUBJECT
  -> REJECTED_REPLAY

ISSUED
  -> EXPIRED
  -> REVOKED
  -> RECOVERY_PENDING
  -> REISSUED
```

State changes must be deterministic and inspectable. Concurrent submissions of the same authorization must result in one issuance and one replay rejection, never two credentials.

## Demo Failure Cases

The prepared demo should include buttons or scripted steps for:

1. Valid platform authorization issues one credential.
2. The same signed authorization replay is rejected.
3. An authorization signed by an untrusted source is rejected.
4. A valid authorization for an unsupported uniqueness domain or credential scope is rejected.
5. A valid authorization with a substituted credential subject is rejected.
6. An expired authorization is rejected.
7. A second wallet cannot escape the consumed game enrollment and ban.
8. A replayed reward authorization or substituted recipient wallet is rejected.

The first six cases demonstrate AgentVisa's actual issuance responsibility. The last two demonstrate why issuance matters to the game.

## Demo Shortcuts That Must Be Disclosed

- Human verification is synthetic.
- The demo begins from a platform-signed Enrollment Authorization and does not integrate a real uniqueness source.
- Bot detection is manual or simulated.
- Rewards are test assets only.
- Off-chain World proof verification is trusted if option A is used.
- Production custom-issuer support in the current World application tooling is not yet proven; the demo must retain a disclosed mock-issuer fallback.
- Cryptographic binding between enrollment, World sessions, application keys, game accounts, and payout wallets is unproven until the protocol spikes pass.
- The demo does not prove resistance to credential lending, coercion, or collusion.
- A production issuer needs deduplication, recovery, appeals, incident response, and data-protection controls.

## Success Criteria

- Under the pinned OPRF and authenticator semantics, the same World ID account cannot consume the fixed game-enrollment action twice using another wallet.
- A banned game identity cannot re-register.
- A different eligible World ID account can register.
- Changing credentials on the same World ID account does not restore its consumed game slot.
- The same credential is not publicly linkable across two games that use distinct relying-party identifiers, session IDs, and application keys.
- An eligible credential-backed game account can claim its recorded reward without presenting another personhood proof.
- A duplicate reward authorization and recipient substitution both fail.
- No PII or biometric data appears in logs, contracts, screenshots, or repository fixtures.
- The entire demonstration completes in under three minutes from a prepared state.
- Every synthetic or trusted step is visibly labelled.

## Approaches Considered

### Minimal prize claim

Proves one accepted credential can create one game account and that account can receive one recorded reward. This is the lowest-risk implementation but does not demonstrate persistent ban resistance.

### Interactive burned identity

Shows enrollment, pseudonymous play, a bot ban, failed re-entry with a new wallet, and a reward claimed by the already credential-backed winning account. This is the selected approach because it demonstrates the distinctive gaming behavior without requiring a real bot detector or redundant proof at payout.

## Existing Repository Impact

This brainstorm conflicts with the current financial-agent product objective and cannot silently replace it.

Likely reusable components:

- Pinned Semaphore v4 integration if Arbitrum-local proofs remain necessary.
- Typed and domain-separated hashing patterns.
- Golden-vector discipline.
- Nullifier replay tests.
- Safe and Session Key work if gasless delegated claims or automated game clients become part of the product.

Likely unnecessary for the first gaming demo:

- A Safe Smart Account for every player.
- Smart Sessions mandate installation.
- Financial amount and cumulative-spend policies.
- The current `MandateV1` flow.

Before implementation, this pivot requires:

1. A decision on Arbitrum integration option A, B, or C.
2. A dependency, licence, audit, release-age, and deployment review for the exact World ID packages.
3. A new accepted ADR defining issuer trust, game identity, ban continuity, recovery, and nullifier scopes.
4. Updates to `CONTEXT.md`, `ARCHITECTURE.md`, `SECURITY.md`, `BUY_VS_BUILD.md`, and `BUILD_PLAN.md`.

## Open Questions

1. Is the initial product tied to World accounts, or merely compatible with World-issued and third-party credentials?
2. Should a ban survive World account recovery and credential replacement? The expected answer is yes, but the exact stable identifier must be verified.
3. Who operates appeals and can reverse a false-positive game ban?
4. Does a game ban expire, or is it permanent?
5. Are bans game-local, publisher-wide, or shared across participating games?
6. Which Arbitrum network will host the demonstration?
7. Is the reward an on-chain test token, an NFT/badge, or a recorded payout authorization?
8. Can World ID v4's current session semantics directly support the required stable game identity?
9. Does the hackathon require direct on-chain World proof verification, or is a disclosed off-chain verifier acceptable?
10. Can a third-party issuer currently complete registration and issuance through supported production World tooling, or only through protocol-level components?
11. What exact signed request format does World ID v4 expect from a third-party Credential Issuer?
12. Must each platform use one uniqueness source, or will it define a cross-source deduplication authority?

## Evidence To Verify Before Implementation

- World ID v4 announcement and design: <https://world.org/blog/engineering/introducing-world-id-4.0>
- Protocol repository and current implementation status: <https://github.com/worldcoin/world-id-protocol>
- Documentation authority warning: <https://github.com/worldcoin/world-id-protocol/blob/main/docs/README.md>
- Point-in-time v4 technical specification: <https://github.com/worldcoin/world-id-protocol/blob/main/docs/world-id-4-specs/README.md>
- Current on-chain verification support: <https://docs.world.org/world-id/idkit/onchain-verification>

Before coding, verify against the exact pinned release:

1. Fixed-action uniqueness-nullifier derivation and replay behavior.
2. Session creation, presentation, confidentiality, invalidation, and recovery behavior.
3. Whether uniqueness nullifiers remain account-derived and credential-independent.
4. Third-party issuer registration and end-user issuance tooling.
5. Official verifier and state availability on the selected Arbitrum network.
6. Licence, audit, trusted setup, upgrade authority, and hosted-service dependencies.
7. Cryptographic binding, if any, between a uniqueness proof, World session, and application login key.
8. Binding between the credential-backed game account, winner authorization, reward claim identifier, and recipient wallet.
9. Nullifier behavior across OPRF key rotation, loss, migration, and protocol upgrades.
10. Atomic and durable consumed-nullifier storage under concurrent registration attempts.
11. Relying-party-specific session derivation and enforcement against cross-game session or application-key reuse.
12. Credential expiry and revocation policy between game registration and reward claim.

## Current Recommendation

Build the interactive burned-identity demo around World ID v4 semantics, but start at the issuance boundary with a synthetic platform-signed Enrollment Authorization. Keep the bot detector manual. Verify the credential once when creating the game account; routine play and payout use that account without another personhood proof.

Do not implement a uniqueness source or a new proof system. Spend the project effort on typed issuance, source-policy preservation, the game-scoped identity lifecycle, ban continuity, reward semantics, and a demo that makes wallet switching visibly useless.
