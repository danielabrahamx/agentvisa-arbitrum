const ROUTE_TITLES = {
  "/enroll": "Enroll a synthetic Credential Holder",
  "/games/robot-rally": "Robot Rally",
  "/operator/robot-rally": "Robot Rally operator",
  "/audit": "Redacted audit",
} as const;

export type DemoPagePath = keyof typeof ROUTE_TITLES;

export function renderDemoPage(path: DemoPagePath): string {
  const title = ROUTE_TITLES[path];
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${title} · AgentVisa</title>
    <link rel="stylesheet" href="/assets/styles.css">
  </head>
  <body data-page="${path}">
    <header>
      <p class="eyebrow">Synthetic demo · identity off-chain · reward on Arbitrum Sepolia</p>
      <h1>${title}</h1>
      <nav aria-label="Demo routes">
        <a href="/enroll">Enroll</a>
        <a href="/games/robot-rally">Robot Rally</a>
        <a href="/operator/robot-rally">Operator</a>
        <a href="/audit">Audit</a>
      </nav>
    </header>
    <main>
      <section class="labels" aria-label="Trust and privacy labels">
        <article><h2>Trusted component</h2><p>AgentVisa issuance and Robot Rally account, moderation, and result decisions are trusted off-chain services.</p></article>
        <article><h2>Privacy</h2><p>The Semaphore identity secret stays in this browser. Robot Rally receives one application-scoped nullifier, never an enrollment subject.</p></article>
        <article><h2>On-chain reward</h2><p>After a win, MetaMask on Arbitrum Sepolia (421614) submits GameRewardClaim. The server signs EIP-712 only; the authorizer key never enters this page.</p></article>
        <article><h2>Does not prove</h2><p>This synthetic Credential does not prove legal identity, KYC, or that the holder never automates play.</p></article>
      </section>
      <section id="demo-controls" aria-live="polite"></section>
      <section>
        <h2>Result</h2>
        <pre id="result">Ready.</pre>
        <p id="claim-link" class="claim-link" hidden></p>
      </section>
    </main>
    <script type="module" src="/assets/client.js"></script>
  </body>
</html>`;
}

export const DEMO_STYLES = `
:root { color-scheme: dark; font-family: "Segoe UI", ui-sans-serif, system-ui, sans-serif; background:#07111f; color:#e8f1ff; }
* { box-sizing:border-box; }
body { margin:0; min-height:100vh; background:radial-gradient(circle at top left,#15345c 0,#07111f 45%); }
header,main { width:min(1100px,calc(100% - 2rem)); margin:auto; }
header { padding:3rem 0 1.5rem; }
.eyebrow { color:#7dd3fc; text-transform:uppercase; letter-spacing:.12em; font-size:.78rem; }
h1 { font-size:clamp(2rem,6vw,4.5rem); margin:.2rem 0 1rem; }
nav { display:flex; flex-wrap:wrap; gap:.65rem; }
a,button,select,input { font:inherit; }
a,button { border:1px solid #38577b; border-radius:999px; padding:.65rem 1rem; color:#e8f1ff; background:#10243e; text-decoration:none; cursor:pointer; }
a:hover,button:hover { background:#173556; }
main { padding-bottom:4rem; }
.labels { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:1rem; }
article,#demo-controls,main>section:last-child { background:rgba(9,25,45,.86); border:1px solid #244767; border-radius:16px; padding:1rem; margin:1rem 0; }
h2 { font-size:1rem; color:#93c5fd; }
.actions { display:flex; flex-wrap:wrap; gap:.65rem; margin:.75rem 0; }
label { display:grid; gap:.35rem; margin:.75rem 0; max-width:32rem; }
input,select { padding:.7rem; border-radius:8px; border:1px solid #38577b; background:#07111f; color:#e8f1ff; }
pre { white-space:pre-wrap; overflow-wrap:anywhere; color:#a7f3d0; }
.warning { color:#fbbf24; }
.claim-link a { display:inline-block; margin-top:.5rem; }
.claim-link:not([hidden]) { display:block; color:#a7f3d0; }
`;
