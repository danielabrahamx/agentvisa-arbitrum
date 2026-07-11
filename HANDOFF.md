# AgentVisa Gaming Platform MVP Handoff

**Saved:** 2026-07-11

**Status:** Phase 6b complete. Public HTTPS demo claims on real Arbitrum
Sepolia. Active work is optional Phase 7 (World staging) or polish.

**Active phase:** Phase 7 — Optional World staging adapter (deferred / optional)

## Live demo (keep processes running)

| Item | Value |
|---|---|
| Public HTTPS | https://lincoln-attacks-withdrawal-prompt.trycloudflare.com/enroll |
| Local | http://127.0.0.1:4173/enroll |
| Contract | [`0x0A93815977f7c8c2fE6126869254506B807C4E58`](https://sepolia.arbiscan.io/address/0x0A93815977f7c8c2fE6126869254506B807C4E58) |
| Chain | Arbitrum Sepolia `421614` |

**Restart if the quick tunnel dies:**

```powershell
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" --filter @agentvisa/localhost-demo build
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" --filter @agentvisa/localhost-demo start
# second terminal:
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" dlx cloudflared tunnel --url http://127.0.0.1:4173
```

Requires workspace `.env` with `ARBITRUM_SEPOLIA_AUTHORIZER_PRIVATE_KEY` (never
commit). Quick tunnels get a new hostname each restart.

## Demo path for judges

1. Open the public HTTPS URL (Chrome/Brave + MetaMask).
2. Enroll (Alex or Blair) — off-chain synthetic Credential.
3. Robot Rally → Register → Authenticate Login Key → Play → Record win.
4. **Claim on Arbitrum Sepolia** — MetaMask on chain `421614`, wallet pays gas,
   server signs EIP-712 only; show Arbiscan tx link.
5. Replay of the same claim ID fails on-chain.

**Wallet requirements:** Arbitrum Sepolia ETH (not Ethereum Sepolia). RPC
`https://sepolia-rollup.arbitrum.io/rpc`. Bridge via
[bridge.arbitrum.io](https://bridge.arbitrum.io/) if needed.

## What is real testnet vs off-chain

| Step | Where |
|---|---|
| Enroll / Credential / register / play / ban / win counters | Off-chain SQLite + synthetic uniqueness (MVP trusted issuer) |
| Reward claim | **Real** Arbitrum Sepolia `GameRewardClaim.claim` via browser wallet |
| Claim / result IDs | Protocol-derived keccak hashes (not the spent `blair-claim-sepolia-1`) |

Authorizer (server-only): `0x6ef4Ac0bdb72faB3c538aA2AacFf54376CabB538`

## Start here (next agent)

1. `AGENTS.md`
2. `CONTEXT.md`
3. `README.md`
4. `docs/plans/BUILD_PLAN.md`
5. `docs/plans/NEXT_AGENT_PROMPT.md`
6. This file

Do not redeploy `GameRewardClaim` unless broken. Do not start World staging
unless the user asks for Phase 7.

## Security boundaries

- synthetic identities and synthetic points only;
- identity secret stays in the browser;
- authorizer private key never in client bundle;
- claim IDs consumed once; no PII / proofs on-chain;
- no production data, mainnet, or real funds.

## Working tree caution

Uncommitted historical Safe4337 / research material may still be present.
Preserve unrelated user changes. No commit or push unless explicitly
requested. Never commit `.env`.

## Root commands

```powershell
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" install --frozen-lockfile
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" format:check
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" lint
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" typecheck
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" build
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" test
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" test:integration
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" audit
```
