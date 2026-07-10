# Phase 1C Robinhood Infrastructure Probe

**Date:** 2026-07-10  
**Status:** Read-only probe complete, write tracer bullet pending  
**Network:** Robinhood Chain testnet, chain ID `46630`

## Result

The public RPC is live and returns chain ID `46630`. Canonical ERC-4337 and Safe infrastructure is present. Safe7579, Smart Sessions, and the required policies are not present at their published deterministic addresses, and Robinhood testnet is not listed in Rhinestone's supported Smart Account Infra chains.

The machine-readable observation is in `deployments/46630/infrastructure-probe.json`.

## Verified infrastructure

- EntryPoint v0.6, v0.7, and v0.8 have bytecode on Robinhood testnet.
- The Pimlico public bundler reports support for those EntryPoints.
- Safe 1.4.1 singleton and proxy-factory bytecode hashes exactly match `safe-global/safe-deployments`.
- Safe module setup v0.3.0 and Safe4337 module v0.3.0 have bytecode at the addresses published by Robinhood.
- The public Robinhood RPC is sufficient for read-only probes without an API key.

## Missing infrastructure

No bytecode was present at the published addresses for:

- Safe7579 adapter.
- Safe7579 launchpad.
- Smart Sessions.
- Smart Sessions compatibility fallback.
- The standard Smart Sessions target, usage, time, and value policies probed from Rhinestone's address book.

This means ADR-0003 remains proposed. Generic EVM compatibility and working EntryPoints do not prove that Safe7579 plus Smart Sessions works on Robinhood testnet.

## Sources

- Robinhood Chain connecting and account-abstraction documentation.
- `safe-global/safe-deployments` v1.4.1 registry.
- Pimlico supported chains and public bundler endpoint.
- Rhinestone supported-chains and address-book documentation.
- `rhinestonewtf/safe7579` deployment configuration.
- `erc7579/smartsessions` and `rhinestonewtf/module-sdk` source.

## Next executable steps

1. Pin reviewed Safe7579 and Smart Sessions source revisions, licences, audit provenance, and transitive dependencies. Do not use floating Git dependencies from the current Smart Sessions package manifest.
2. Reproduce Safe7579, Smart Sessions, and only the required policies on a local Hardhat network.
3. Prove an owner-authorized Safe UserOperation locally before any testnet write.
4. Reproduce and record the exact Smart Sessions Permission Digest.
5. Prove direct Account Owner execution and revocation without a bundler or paymaster.
6. Obtain an explicitly synthetic Robinhood testnet deployer and test ETH before deploying missing infrastructure.
7. Deploy deterministically where upstream semantics allow it, then record source revision, constructor arguments, transaction hash, explorer URL, and bytecode hash.

Do not write `AgentVisaAuthorization` or `AgentVisaCredentialPolicy` yet. Phase 1D and 1E must pass first.
