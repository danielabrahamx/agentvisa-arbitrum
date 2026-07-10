# Agent Instructions

## Read first

Before changing code or architecture, read:

1. `CONTEXT.md`
2. `docs/ARCHITECTURE.md`
3. `docs/SECURITY.md`
4. All accepted files in `docs/adr/`
5. The current phase in `docs/plans/BUILD_PLAN.md`

Use the domain terms from `CONTEXT.md`. Do not silently rename concepts.

## Repository state

This repository is greenfield competition work. It is separate from the live AgentVisa service and its paying users.

- Never connect production AgentVisa data, keys, users, payments, liveness media, or credentials without explicit approval.
- Never deploy to mainnet or move real funds without explicit approval.
- Testnet assets and identities must be clearly synthetic.
- Documentation must distinguish implemented, proposed, and future behavior.

## Development rules

- Native Windows PowerShell and Linux CI are both supported environments.
- Do not make WSL2 the only supported workflow.
- Prefer the smallest architecture that completes the current vertical slice.
- Read `docs/BUY_VS_BUILD.md` before implementing any contract, policy, cryptographic primitive, or infrastructure component.
- Search current audited upstream implementations first. Custom code requires a documented semantic gap and an accepted ADR.
- Do not add dependencies until their need, licence, maintenance, release age, and alternatives have been checked.
- Prefer dependency versions published at least seven days ago.
- Pin security-sensitive dependencies and commit the lockfile.
- Keep files under 500 lines. Split by responsibility before crossing the limit.
- Read every existing file before editing it.
- Never commit secrets, private keys, RPC credentials, API keys, `.env` files, proof secrets, or production data.
- Validate all untrusted inputs at their first boundary.
- Do not add upgradeability, governance, cross-chain messaging, or custom cryptography unless an accepted ADR requires it.

## Cryptographic rules

- Use audited Semaphore v4 packages directly. Do not write a Groth16 verifier.
- Do not import the Mina/o1js path from `agentvisa-core`.
- Do not use canonical JSON for on-chain policy commitments.
- Use one typed policy encoder and cross-language golden vectors.
- Domain-separate every digest by product, version, chain, and verifying contract where applicable.
- Convert hashes to BN254 fields using one documented function and test it in TypeScript and Solidity.
- Nullifiers must be scope-specific. Universal nullifiers are forbidden.
- Never put PII, biometric hashes, identity mappings, or credential evidence on-chain.

## Smart-account rules

- The Account Owner's normal authorization remains mandatory.
- A Credential Proof never replaces ownership authorization.
- The Agent receives only a Session Key.
- Session permissions default to deny.
- No wildcards, delegatecall, arbitrary batch execution, fallback authorization, token approvals, permits, or native-value transfers in the first vertical slice.
- Owner revocation must be immediate.
- Policy state must update before external execution.

## Workflow

For every behavioral change:

1. Add or update a failing test.
2. Implement the smallest change that passes.
3. Run relevant unit, integration, adversarial, and encoding-vector tests.
4. Run formatting, lint, type checking, build, and dependency audit.
5. Review the diff for leaked secrets and accidental scope growth.
6. Update an ADR if an architectural decision changed.

Do not claim completion while checks fail.

## Planned commands

The exact toolchain will be installed in the foundation phase. Once scaffolded, root commands must provide:

```text
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm build
pnpm test
pnpm test:integration
pnpm audit
```

The same commands must work from PowerShell and Linux shells. Avoid shell-specific syntax inside package scripts.

## Deployment

- Robinhood Chain testnet, chain ID `46630`, is the primary development network.
- Arbitrum Sepolia, chain ID `421614`, is the fallback.
- Store verified deployment records under `deployments/<chain-id>/`.
- Deployment scripts must be deterministic and idempotent where practical.
- Mainnet deployments require explicit approval, passing CI, verified source, and a security review.

## Commits

Do not commit or push unless explicitly requested. Never rewrite history or bypass hooks.