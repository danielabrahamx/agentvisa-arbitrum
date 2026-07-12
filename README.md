# AgentVisa Gaming Platform MVP

Privacy-preserving, application-scoped admission for pseudonymous accounts.

AgentVisa issues a reusable Semaphore Credential after an approved enrollment.
A platform verifies one application-scoped proof when creating an account, then
uses its normal account authentication for routine activity. The first demo is
a gaming platform, while the enrollment, Credential, registration, account,
and reward boundaries remain platform-agnostic.

## MVP journey

Full platform story (Phases 0–5):

1. A synthetic Uniqueness Source authorizes enrollment for a
   browser-generated Semaphore commitment.
2. AgentVisa consumes the authorization and issues an AgentVisa Semaphore
   Credential.
3. A holder registers once for Robot Rally with a game-scoped proof.
4. The game creates a pseudonymous Game Account bound to a Login Key.
5. Changing wallet or username cannot create another account or evade a
   game-local ban.
6. Another holder wins and receives one narrow Reward Authorization.
7. A minimal Arbitrum Sepolia contract consumes the claim once and records
   synthetic points (historical `GameRewardClaim`; not the competition judge path).

**Competition demo (Phase 6e):** steps 1–3 only, enforced on Arbitrum Sepolia via
`AgentVisaAdmission.enroll` and `Semaphore.validateProof`, plus an on-chain sybil
revert demo. Static SPA — no backend.

## Product boundary

This MVP:

- uses standard pinned Semaphore v4 components;
- keeps the identity secret in the browser;
- exposes only application-scoped nullifiers to Relying Parties;
- separates Credential issuance from game moderation;
- enforces membership and scoped nullifiers on Arbitrum Sepolia via upstream Semaphore.

It does not:

- integrate World ID (Phase 7 cancelled for this competition repo);
- run a Node API or SQLite at demo runtime;
- issue a World-native third-party credential;
- claim the holder is legally identified, KYC-approved, or not using
  automation;
- put identity evidence, PII, World nullifiers, or Semaphore commitments
  on-chain;
- solve Credential recovery, lending, multiple source identities, or
  cross-platform bans;
- use real funds, mainnet, or production AgentVisa data.

## Current status

Hackathon static SPA + on-chain Semaphore admission on Arbitrum Sepolia.

**Public demo:** https://demo-production-bb21.up.railway.app/
**Local:** http://127.0.0.1:4173/
See `HANDOFF.md` and `packages/localhost-demo/DEPLOY.md`.

Judge path (3 MetaMask steps on chain `421614`):

1. **Get credential** — `AgentVisaAdmission.enroll`
2. **Join Robot Rally** — `Semaphore.validateProof`
3. **Sybil check** — second `validateProof` reverts (nullifier replay)

No runtime backend. Demo enrollment signer is bundled at build time (testnet only).

**Public smoke:** `pnpm smoke:demo` (scripted; no wallet).

## Local vs testnet

| Step | Where it runs |
|---|---|
| Enroll, register, sybil | **Real** MetaMask txs on Arbitrum Sepolia `421614` |
| Identity secret | Browser localStorage only |
| World personhood | **Not implemented** — synthetic off-chain uniqueness only |

**Wallet / browser**

- Browser: desktop Chrome or Brave (Edge OK)
- Extension: MetaMask (preferred) or Rabby
- Network: **Arbitrum Sepolia** (chain ID `421614`), **not** Ethereum Sepolia (`11155111`)
- RPC: `https://sepolia-rollup.arbitrum.io/rpc`
- Explorer: `https://sepolia.arbiscan.io`
- Gas: Sepolia ETH for enroll + register (+ sybil revert demo)

Contracts:

- Semaphore: [`0x846Edd64717990ccb6a8DB9790f8839C4b2054cE`](https://sepolia.arbiscan.io/address/0x846Edd64717990ccb6a8DB9790f8839C4b2054cE)
- AgentVisaAdmission: [`0x1f43262ebcF988b06315777d6e90bAA593DA4442`](https://sepolia.arbiscan.io/address/0x1f43262ebcF988b06315777d6e90bAA593DA4442)

### Run the demo locally

```powershell
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" --filter @agentvisa/contracts deploy:admission-sepolia
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" --filter @agentvisa/localhost-demo build
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" --filter @agentvisa/localhost-demo start
```

Open `http://127.0.0.1:4173/`. Path: Get credential → Join Robot Rally → Sybil check (all on Arbitrum Sepolia).

### Stable public host (Railway)

Production deploy uses `railway.toml` at the repo root. Redeploy:

```powershell
railway up -d -y --ci
```

Details: `packages/localhost-demo/DEPLOY.md`. Do not rely on Cloudflare quick
tunnels for shared judge links.

## Documentation

- [Domain model](CONTEXT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security model](docs/SECURITY.md)
- [Buy versus build](docs/BUY_VS_BUILD.md)
- [Active build plan](docs/plans/BUILD_PLAN.md)
- [Current handoff](HANDOFF.md)
- [On-chain admission ADR](docs/adr/0007-on-chain-semaphore-admission.md)
- [Architecture decisions](docs/adr/)
- [World ID gaming recommendation](docs/research/2026-07-11-world-id-gaming-demo-recommendation.md) — research only; not implemented for competition MVP

## Development

The repository uses pnpm, TypeScript, Hardhat 3, Viem, and pinned Semaphore v4
packages. Root commands must work in native Windows PowerShell and Linux CI:

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

Read `AGENTS.md`, `CONTEXT.md`, the accepted ADRs, and the active build plan
before changing behavior. Do not commit, push, deploy to mainnet, move real
funds, or connect production data without explicit approval.
