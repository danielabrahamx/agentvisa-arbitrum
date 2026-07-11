# AgentVisa Gaming Platform MVP

Privacy-preserving, application-scoped admission for pseudonymous accounts.

AgentVisa issues a reusable Semaphore Credential after an approved enrollment.
A platform verifies one application-scoped proof when creating an account, then
uses its normal account authentication for routine activity. The first demo is
a gaming platform, while the enrollment, Credential, registration, account,
and reward boundaries remain platform-agnostic.

## MVP journey

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
   synthetic points.

## Product boundary

This MVP:

- uses standard pinned Semaphore v4 components;
- keeps the identity secret in the browser;
- exposes only application-scoped nullifiers to Relying Parties;
- separates Credential issuance from game moderation;
- uses Arbitrum Sepolia only for a synthetic reward claim;
- can add World staging through a Uniqueness Source adapter.

It does not:

- issue a World-native third-party credential;
- claim the holder is legally identified, KYC-approved, or not using
  automation;
- put identity evidence, PII, World nullifiers, or Semaphore commitments
  on-chain;
- solve Credential recovery, lending, multiple source identities, or
  cross-platform bans;
- use real funds, mainnet, or production AgentVisa data.

## Current status

Phases 0–6b are complete. **Live public demo (Cloudflare quick tunnel):**

**https://lincoln-attacks-withdrawal-prompt.trycloudflare.com/enroll**

Keep the local demo server + `cloudflared` process running (see below). Quick
tunnel hostnames change if you restart the tunnel — check `HANDOFF.md`.

Identity/enrollment/play remain trusted off-chain (synthetic uniqueness +
SQLite). After a win, **Claim on Arbitrum Sepolia** asks the server for an
EIP-712 Reward Authorization and submits a **real** `claim` tx from MetaMask
on chain `421614`.

World staging remains optional (Phase 7).

## Local vs testnet

| Step | Where it runs |
|---|---|
| Enroll, Credential, register, play, ban, win counters | Demo process + SQLite (synthetic uniqueness source), on localhost or public HTTPS |
| Reward claim | **Real** browser MetaMask/Rabby tx on Arbitrum Sepolia `421614` |
| World personhood | Not in demo (optional Phase 7) |

**Wallet / browser for testnet claims**

- Browser: desktop Chrome or Brave (Edge OK)
- Extension: MetaMask (preferred) or Rabby
- Network: **Arbitrum Sepolia** (chain ID `421614`), **not** Ethereum Sepolia (`11155111`)
- RPC: `https://sepolia-rollup.arbitrum.io/rpc`
- Explorer: `https://sepolia.arbiscan.io`
- Gas: small amount of **Arbitrum Sepolia** ETH in the connected wallet
  (bridge from L1 Sepolia via [bridge.arbitrum.io](https://bridge.arbitrum.io/) if needed)
- **Server** keeps `ARBITRUM_SEPOLIA_AUTHORIZER_PRIVATE_KEY` and signs EIP-712 only
- **Browser wallet** is the claim recipient and pays gas for `claim`

Contract:
[`0x0A93815977f7c8c2fE6126869254506B807C4E58`](https://sepolia.arbiscan.io/address/0x0A93815977f7c8c2fE6126869254506B807C4E58)

### Run the demo locally

```powershell
# Requires workspace `.env` with ARBITRUM_SEPOLIA_AUTHORIZER_PRIVATE_KEY
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" --filter @agentvisa/localhost-demo build
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" --filter @agentvisa/localhost-demo start
```

Open `http://127.0.0.1:4173/enroll`. Path: enroll → Robot Rally register →
login → play → win → **Claim on Arbitrum Sepolia**.

### Public HTTPS URL (Cloudflare quick tunnel)

Keep the demo server running, then in a second PowerShell:

```powershell
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" dlx cloudflared tunnel --url http://127.0.0.1:4173
```

Use the printed `https://*.trycloudflare.com` URL. Do not expose `.env` or the
demo SQLite data directory through the tunnel beyond the HTTP app itself.

## Documentation

- [Domain model](CONTEXT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Security model](docs/SECURITY.md)
- [Buy versus build](docs/BUY_VS_BUILD.md)
- [Active build plan](docs/plans/BUILD_PLAN.md)
- [Current handoff](HANDOFF.md)
- [Architecture decisions](docs/adr/)
- [World ID gaming recommendation](docs/research/2026-07-11-world-id-gaming-demo-recommendation.md)

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
