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
- Do not use canonical JSON for signed or on-chain commitments.
- Use one typed encoder per versioned authorization and publish golden vectors.
- Domain-separate every digest by product, version, chain, and verifying contract where applicable.
- Convert hashes to BN254 fields using one documented function and test it in each runtime that consumes it.
- Nullifiers must be scope-specific. Universal nullifiers are forbidden.
- Never put PII, biometric hashes, identity mappings, or credential evidence on-chain.

## Credential and application rules

- The Semaphore identity secret remains in the Credential Holder's browser.
- Enrollment Authorization consumption and Credential issuance must be atomic or idempotent.
- Proof verification, Registration Nullifier consumption, and Application Account creation must be atomic.
- Stable Application ID scope must exclude wallet, username, season, and attempt.
- Routine application activity must not request another personhood or Credential Proof.
- Moderation is application-local; do not create global bans or identifiers.
- A payout address is not identity or personhood evidence.
- Reward claims must bind all context, consume claim IDs once, and update state before external interaction.

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

- Arbitrum Sepolia, chain ID `421614`, is the only active MVP deployment target.
- Use it only for the narrow synthetic reward claim.
- Do not deploy World or Semaphore verification infrastructure for the MVP.
- Store verified deployment records under `deployments/<chain-id>/`.
- Deployment scripts must be deterministic and idempotent where practical.
- Mainnet deployments require explicit approval, passing CI, verified source, and a security review.

## Phase completion

When finishing an active build-plan phase, do the following without waiting for
the user to ask:

1. Update `HANDOFF.md` and `docs/plans/BUILD_PLAN.md` for the completed phase
   and the next active phase.
2. Rewrite `docs/plans/NEXT_AGENT_PROMPT.md` as a ready-to-run prompt for the
   next phase, including gaps, required work, tests, constraints, verification,
   and this completion protocol.
3. In the completion report, include what remains, a size estimate for that
   remaining work, and the main risks or seams the next agent must close.

## Commits

Do not commit or push unless explicitly requested. Never rewrite history or bypass hooks.