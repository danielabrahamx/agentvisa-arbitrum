# Next Agent Prompt: Phase 7 Optional World Staging (or polish)

Work in `C:\Users\danie\agentvisa-arbitrum` using native Windows PowerShell.

## Why you are here

Phase 6b is done: public HTTPS demo + browser MetaMask claim on **real**
Arbitrum Sepolia (`421614`). Identity/enroll/play stay off-chain synthetic by
MVP design. Do **not** reopen the Sepolia claim wiring unless broken.

## Live demo (verify first)

- Public URL (may change if tunnel restarted): see `HANDOFF.md`
- Local: `http://127.0.0.1:4173/enroll` with
  `ARBITRUM_SEPOLIA_AUTHORIZER_PRIVATE_KEY` in workspace `.env`
- Contract: `0x0A93815977f7c8c2fE6126869254506B807C4E58`

## Read first

`AGENTS.md`, `CONTEXT.md`, `HANDOFF.md`, `README.md`, accepted ADRs,
`docs/plans/BUILD_PLAN.md` Phase 7.

## Choose one track (user must confirm)

### A — Optional World staging adapter

Only if staging credentials / Developer Portal access exist:

- configure staging `app_id`, `rp_id`, server-held signing key;
- supported `proofOfHuman` simulator → hosted verification;
- map into existing Enrollment Authorization interface;
- keep identity secret in browser; no World nullifiers on-chain;
- tests for nullifier replay.

### B — Demo polish / reliability

- named Cloudflare tunnel or stable host (quick tunnels rotate hostnames);
- Arbiscan source verification for `GameRewardClaim`;
- clearer UI copy / claim error messages;
- CI smoke for `/api/config` rewardClaim.enabled.

## Scope constraints

- No mainnet, no real funds, no production AgentVisa data.
- Do not put Semaphore/World verifiers on Arbitrum for MVP.
- Do not commit `.env` or authorizer keys.
- Prefer smallest change; do not rewrite the claim path without cause.

## Verification

```powershell
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" format:check
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" lint
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" typecheck
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" build
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" test
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" test:integration
pnpm --dir "C:\Users\danie\agentvisa-arbitrum" audit
git diff --check
```

## Completion protocol

When finishing the active phase: update `HANDOFF.md`, `BUILD_PLAN.md`, rewrite
this file for the next phase, and report remaining work + risks.
