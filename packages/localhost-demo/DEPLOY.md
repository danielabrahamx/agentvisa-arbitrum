# Deploying the AgentVisa static demo

Synthetic competition demo. **Runtime is static files only** — no Node API, no SQLite.
Membership and scoped nullifiers enforce on Arbitrum Sepolia (`421614`) via upstream
Semaphore + `AgentVisaAdmission`.

## Runtime

| Item | Value |
|---|---|
| Start | `pnpm --filter @agentvisa/localhost-demo start` |
| Build | `pnpm install --frozen-lockfile && pnpm --filter @agentvisa/localhost-demo... build` |
| Output | `packages/localhost-demo/dist/public/` |
| Listen | `PORT` (Railway) or `AGENTVISA_DEMO_PORT` (local, default `4173`) |
| Health | `GET /` returns `200` |

## Build-time env (never commit)

| Variable | Purpose |
|---|---|
| `VITE_DEMO_ENROLLMENT_SIGNER_PRIVATE_KEY` | Signs enrollment authorizations in the static bundle (testnet only) |
| `ARBITRUM_SEPOLIA_ENROLLMENT_SIGNER_PRIVATE_KEY` | Fallback for build; must match on-chain `enrollmentSigner` |
| `ARBITRUM_SEPOLIA_DEPLOYER_PRIVATE_KEY` | Deploy contracts + fallback enrollment signer |

Build embeds `deployments/421614/admission.json`. Run
`pnpm --filter @agentvisa/contracts deploy:admission-sepolia` first.

## Railway

`railway.toml` serves `dist/public` via `scripts/serve-static.mjs`. No server secrets
required for the judge path.

```powershell
railway up -d -y --ci
```

## Local

```powershell
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" --filter @agentvisa/contracts deploy:admission-sepolia
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" --filter @agentvisa/localhost-demo build
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" --filter @agentvisa/localhost-demo start
```

Open http://127.0.0.1:4173/ with MetaMask on chain `421614`.

## Security

- Enrollment signer in the static bundle is **testnet demo only**.
- Identity secret stays in the browser; no PII on-chain.
- No World integration; no mainnet.
