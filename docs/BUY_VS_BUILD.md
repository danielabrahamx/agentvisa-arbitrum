# Buy Versus Build Matrix

**Status:** Mandatory implementation constraint  
**Rule:** Reuse audited standards and modules unless an accepted ADR proves they cannot satisfy the requirement.

## Reuse directly

| Capability | Reuse | Project responsibility |
|---|---|---|
| Smart Account ownership and recovery | Safe | Configure owners and test emergency revocation |
| ERC-4337 execution | Canonical EntryPoint and Safe4337 integration | Verify exact Robinhood deployment and bytecode |
| Modular account adapter | Safe7579, if Phase 1 gates pass | Deploy or reference pinned audited source |
| Session Key lifecycle | Smart Sessions, if Phase 1 gates pass | Configure permission and require AgentVisa policy |
| Target and selector enforcement | Existing audited Smart Sessions policies where semantics match | Prove default-deny behavior with adversarial tests |
| Amount, cumulative, and time constraints | Existing audited policies where semantics match | Do not create parallel policies without a documented gap |
| Anonymous group membership | Semaphore v4 contracts and SDK | Create AgentVisa group and bind message and scope |
| Groth16 verification | Semaphore verifier | Never write or modify a verifier |
| Merkle group and root history | Semaphore group contracts | Configure and test root duration |
| Nullifier replay protection | Semaphore contract storage | Define a narrow Scope and test replay |
| EVM interaction | Viem | Pin version and centralize chain configuration |
| UserOperation transport | permissionless.js plus an existing bundler | Verify Robinhood behavior and preserve direct owner fallback |
| Gas sponsorship | Existing paymaster provider, optional | Do not make safety or revocation depend on sponsorship |
| Contract build and tests | Hardhat 3 and official Viem toolbox | Add project-specific tests and CI |
| Common Solidity primitives | OpenZeppelin where required | Pin exact version and use the smallest primitive |
| Source verification | Robinhood Blockscout | Record verified addresses and bytecode hashes |

## Build only the AgentVisa-specific seam

### MandateV1 encoder

Why custom:

No external standard defines the exact binding between an AgentVisa Credential Proof, account, Semaphore group, and Smart Sessions Permission Digest.

Build:

- Fixed typed `MandateV1`.
- Domain-separated Mandate and Scope hashing.
- BN254 field conversion.
- TypeScript and Solidity golden vectors.

Do not build a generic policy language.

### AgentVisaAuthorization

Why custom:

Semaphore validates anonymous membership, while Smart Sessions validates account permissions. No reviewed off-the-shelf module was found that requires both for the same Permission Digest.

Build only:

- Validate standard Semaphore proof.
- Bind proof to account and Permission Digest.
- Store short-lived Authorization Record.
- Expose active and revoked status.

Do not duplicate group, verifier, nullifier, owner, session, or execution logic.

### AgentVisaCredentialPolicy

Why potentially custom:

Smart Sessions needs a mandatory policy that checks the matching AgentVisa Authorization Record.

Before building:

1. Search current Smart Sessions and Rhinestone policies for an exact external-attestation or registry policy.
2. Confirm its security semantics and audits.
3. Reuse it if it can bind account and Permission Digest and fail closed.
4. Build a minimal custom policy only if the Phase 1 spike documents the missing behavior.

### Integration SDK and demo CLI

Why custom:

The product needs orchestration across existing components and clear reproducible test flows.

Build only typed integration code. Do not build a wallet, bundler, paymaster, RPC node, proof system, or general automation framework.

## Do not build in the MVP

- Smart Account implementation
- Ownership or social-recovery system
- ERC-4337 EntryPoint
- Session Key framework
- Generic policy engine
- Bundler
- Paymaster
- Relayer service
- ZK circuit
- Groth16 verifier
- Merkle tree contract
- Public identity registry
- KYC or accredited-investor verification service
- Verifiable Credential framework
- Oracle or price service
- Bridge or cross-chain messaging
- Custom Arbitrum chain
- Governance or upgradeability framework

## Existing AgentVisa reuse

Use existing repositories as behavioral references, not dependency bundles.

Potential reuse:

- Semaphore identity and proof-generation patterns.
- LeanIMT group behavior.
- Test-vector discipline.
- Privacy and failure-mode lessons.

Do not import:

- Mina/o1js proof code.
- Ed25519 root-signing path for on-chain trust.
- Canonical JSON policy hashing.
- Browser localStorage keys.
- Incomplete production enrollment routes.
- File or Redis nullifier stores for on-chain replay.

Prefer direct pinned upstream packages over copied AgentVisa source.

## Current implementation checks

- `MandateV1`, `ScopeV1`, and BN254 field conversion implement only the AgentVisa-specific semantic gap accepted in ADR-0005. Viem provides ABI encoding and Keccak; no custom cryptography was added.
- Phase 1B reuses Semaphore 4.14.2 contracts, SDK packages, verifier, LeanIMT behavior, nullifier storage, and trusted-setup artifacts unchanged.
- The official Semaphore Hardhat plugin was rejected because its peer range supports Hardhat 2, not the repository's accepted Hardhat 3 toolchain. Hardhat 3 compiles the pinned npm contracts through `npmFilesToBuild` instead.
- Phase 1C confirmed Safe and Safe4337 infrastructure but found no Safe7579 or Smart Sessions deployment on Robinhood testnet. Absence does not justify custom account or session code. Reproduce pinned audited upstream source locally before reconsidering ADR-0003.
- The current Smart Sessions repository package manifest contains floating Git dependencies. Do not install it until exact revisions, licences, audits, and reproducibility are recorded.

## Required pre-implementation check

Before adding any contract, package, policy, cryptographic primitive, or infrastructure component:

1. Search accepted upstream standards and audited implementations.
2. Record candidates, versions, licences, audits, and deployment availability.
3. Compare exact semantics, not feature names.
4. Reuse when behavior matches.
5. If behavior does not match, document the smallest gap.
6. Add or amend an ADR before writing a replacement.

A custom implementation without this check is incomplete.