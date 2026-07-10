# ADR-0004: Support native PowerShell with Hardhat as the primary toolchain

**Status:** Accepted  
**Date:** 2026-07-10

## Context

Development occurs on Windows. Repository rules require verification in native PowerShell before shipping. Foundry's official installer requires Git Bash or WSL and does not support PowerShell or Command Prompt.

The project also needs TypeScript for Semaphore, account-abstraction SDKs, policy encoding, and the demo CLI.

## Decision

- Use Hardhat 3 as the primary Solidity build and test tool.
- Use TypeScript strict mode.
- Use pnpm workspaces without Turborepo initially.
- Use root scripts that work unchanged in PowerShell and Linux CI.
- Use Viem and permissionless.js where compatible with selected account modules.
- Pin Node and pnpm versions during foundation bootstrap.
- Add Linux-only Foundry, Echidna, Medusa, or Slither checks later only as supplemental security jobs.

## Consequences

- Every contributor can run the main workflow in native Windows or Linux.
- Solidity fuzz and invariant depth may require supplemental Linux CI tooling.
- The repository avoids two mandatory build systems during early development.
- Package scripts cannot rely on Bash-specific operators or utilities.

## Rejected alternatives

- WSL2-only Foundry workflow: violates native PowerShell support.
- Hardhat plus Foundry as equal primary systems: unnecessary initial duplication.
- Turborepo from day one: no demonstrated need at current package scale.