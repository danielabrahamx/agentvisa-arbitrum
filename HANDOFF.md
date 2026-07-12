# AgentVisa Gaming Platform MVP Handoff

**Saved:** 2026-07-12

**Status:** Hackathon static SPA + on-chain Semaphore admission on Arbitrum Sepolia.

**Active phase:** Maintenance / judge demo. See `docs/adr/0007-on-chain-semaphore-admission.md`.

## Product boundary (important)

**World is not our authenticator.** The demo uses a **synthetic off-chain
uniqueness source** only. Upstream uniqueness is pluggable narrative for
judges — not a World dependency. Do not add World SDK, staging, or verification.

## Live demo (static SPA)

| Item | Value |
|---|---|
| **Public** | https://demo-production-bb21.up.railway.app/ |
| Local | http://127.0.0.1:4173/ |
| **Semaphore** | [`0x846Edd64717990ccb6a8DB9790f8839C4b2054cE`](https://sepolia.arbiscan.io/address/0x846Edd64717990ccb6a8DB9790f8839C4b2054cE) |
| **AgentVisaAdmission** | [`0x1f43262ebcF988b06315777d6e90bAA593DA4442`](https://sepolia.arbiscan.io/address/0x1f43262ebcF988b06315777d6e90bAA593DA4442) |
| Chain | Arbitrum Sepolia `421614` |
| Host | Railway static file server (`railway.toml`) |

Judge path (3 steps, MetaMask on `421614`):

1. **Get credential** — browser identity → synthetic enrollment auth → `AgentVisaAdmission.enroll`
2. **Join Robot Rally** — scoped proof → `Semaphore.validateProof`
3. **Sybil check** — same identity, new Login Key → `validateProof` **reverts** (nullifier replay)

No Node API or SQLite at runtime. Technical JSON under **Technical details**.

## Restart

**Local:**

```powershell
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" --filter @agentvisa/localhost-demo build
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" --filter @agentvisa/localhost-demo start
```

**Redeploy contracts (if needed):**

```powershell
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" --filter @agentvisa/contracts deploy:admission-sepolia
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" --filter @agentvisa/localhost-demo build
```

**Railway redeploy:**

```powershell
railway up -d -y --ci
```

## What is on-chain vs browser-only

| Data | Location |
|---|---|
| Identity **secret** | Browser localStorage only |
| Identity **commitment** | Semaphore group member on-chain |
| Enrollment nonce / opaque subject | Consumed in `AgentVisaAdmission` |
| **scope** / **message** / **nullifier** | Semaphore proof public inputs on-chain |
| Demo enrollment signing | Testnet key injected at static build (not production) |

Historical `GameRewardClaim` at `0x0A93815977f7c8c2fE6126869254506B807C4E58` remains deployed but is **not** on the judge path.

## Security boundaries

- Synthetic identities only; testnet Sepolia ETH for gas.
- Identity secret stays in the browser.
- Demo enrollment signer is bundled in the static build — **testnet only**.
- No PII on-chain; no World integration; no mainnet.

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

## Canonical references

1. `docs/adr/0007-on-chain-semaphore-admission.md`
2. `deployments/421614/admission.json`
3. `packages/contracts/test/integration/local-semaphore.integration.test.ts`
4. `packages/localhost-demo/src/static-client.ts`
