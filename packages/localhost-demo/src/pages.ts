const ROUTE_TITLES = {
  "/": "AgentVisa",
  "/demo": "AgentVisa",
  "/operator/robot-rally": "Robot Rally operator",
  "/audit": "Redacted audit",
} as const;

export type DemoPagePath = keyof typeof ROUTE_TITLES;

const PRIMARY_PATHS = new Set<DemoPagePath>(["/", "/demo"]);

export function renderDemoPage(path: DemoPagePath): string {
  const title = ROUTE_TITLES[path];
  const isPrimary = PRIMARY_PATHS.has(path);
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
      <p class="eyebrow">Post-uniqueness credential demo · reward enforced on Arbitrum Sepolia</p>
      <h1>${isPrimary ? "AgentVisa" : title}</h1>
      <p class="subtitle">${
        isPrimary
          ? "Synthetic upstream uniqueness already decided one human for this demo. AgentVisa issues a reusable credential, binds one service account, blocks a second join, then enforces the reward claim on Arbitrum."
          : "Secondary judge path — not part of the main demo story."
      }</p>
      <nav aria-label="Demo routes">
        <a href="/" class="nav-primary">Demo</a>
        <a href="/operator/robot-rally" class="nav-secondary">Operator</a>
        <a href="/audit" class="nav-secondary">Audit</a>
      </nav>
    </header>
    <main>
      ${isPrimary ? renderGuidedShell() : `<section id="demo-controls" aria-live="polite"></section>`}
      <section class="result-panel">
        <details id="technical-details">
          <summary>Technical details</summary>
          <pre id="result">Ready.</pre>
        </details>
        <p id="claim-link" class="claim-link" hidden></p>
      </section>
      ${
        isPrimary
          ? `<p class="demo-reset"><button type="button" id="start-over-button">Start over</button></p>
      <footer class="how-it-works">
        <details>
          <summary>How this works</summary>
          <ol>
            <li>Uniqueness happened upstream. AgentVisa issues a browser-held credential from a commitment only.</li>
            <li>One Semaphore proof joins Robot Rally and produces a Registration Nullifier the service can trust.</li>
            <li>The same credential cannot open a second account for that service.</li>
            <li>The reward claim is the enforceable Arbitrum outcome — one claim ID, one transaction, replay reverts on-chain.</li>
          </ol>
          <p>Synthetic demo data may reset on redeploy. Identity secret never leaves this browser. No proofs or nullifiers go on-chain.</p>
        </details>
      </footer>`
          : ""
      }
    </main>
    <script type="module" src="/assets/client.js"></script>
  </body>
</html>`;
}

function renderGuidedShell(): string {
  return `
      <ol class="stepper" aria-label="Demo steps">
        <li data-step="1" class="step is-active"><span class="step-index">1</span><span class="step-label">Get credential</span></li>
        <li data-step="2" class="step"><span class="step-index">2</span><span class="step-label">Join service</span></li>
        <li data-step="3" class="step"><span class="step-index">3</span><span class="step-label">Sybil check</span></li>
        <li data-step="4" class="step"><span class="step-index">4</span><span class="step-label">Claim on Arbitrum</span></li>
      </ol>
      <p id="human-status" class="human-status" aria-live="polite">Start with step 1 — get a credential in this browser.</p>
      <section id="demo-controls" aria-live="polite"></section>`;
}

export const DEMO_STYLES = `
:root {
  color-scheme: dark;
  --bg: #07111f;
  --panel: rgba(9, 25, 45, 0.9);
  --line: #244767;
  --text: #e8f1ff;
  --muted: #93c5fd;
  --accent: #7dd3fc;
  --ok: #6ee7b7;
  --warn: #fbbf24;
  --danger: #fca5a5;
  font-family: "Segoe UI", ui-sans-serif, system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
}
* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, #15345c 0, transparent 42%),
    linear-gradient(180deg, #0a1628 0%, var(--bg) 55%);
}
header, main { width: min(920px, calc(100% - 2rem)); margin: auto; }
header { padding: 2.5rem 0 1rem; }
.eyebrow {
  color: var(--accent);
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 0.78rem;
  margin: 0 0 0.5rem;
}
h1 { font-size: clamp(2rem, 5vw, 3.4rem); margin: 0.15rem 0 0.75rem; letter-spacing: -0.03em; }
.subtitle { color: #b6c9e0; max-width: 42rem; line-height: 1.45; margin: 0 0 1.25rem; }
nav { display: flex; flex-wrap: wrap; gap: 0.65rem; align-items: center; }
a, button, select, input { font: inherit; }
a, button {
  border: 1px solid #38577b;
  border-radius: 999px;
  padding: 0.65rem 1rem;
  color: var(--text);
  background: #10243e;
  text-decoration: none;
  cursor: pointer;
}
a:hover, button:hover { background: #173556; }
a.nav-primary, button.primary { background: #1d4f7c; border-color: #3b82c4; }
a.nav-secondary { opacity: 0.72; font-size: 0.92rem; padding: 0.45rem 0.85rem; }
button:disabled { opacity: 0.45; cursor: not-allowed; }
button.is-loading { pointer-events: none; opacity: 0.7; }
button.is-loading::after {
  content: "";
  position: absolute;
  inset: auto;
  width: 0.95rem;
  height: 0.95rem;
  margin-left: 0.35rem;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: var(--accent);
  border-radius: 999px;
  animation: spin 0.75s linear infinite;
  vertical-align: middle;
  display: inline-block;
}
@keyframes spin { to { transform: rotate(360deg); } }
main { padding-bottom: 4rem; }
.stepper {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;
  padding: 0;
  margin: 1.25rem 0;
}
.step {
  display: flex;
  gap: 0.55rem;
  align-items: center;
  padding: 0.75rem;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(8, 20, 36, 0.75);
  color: #9fb4cc;
  min-height: 3.4rem;
}
.step.is-active { border-color: #3b82c4; color: var(--text); box-shadow: inset 0 0 0 1px rgba(125, 211, 252, 0.25); }
.step.is-done { border-color: #2f6b55; color: var(--ok); }
.step-index {
  display: inline-grid;
  place-items: center;
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 999px;
  background: #10243e;
  font-size: 0.85rem;
  flex: 0 0 auto;
}
.step-label { font-size: 0.92rem; line-height: 1.2; }
.human-status {
  margin: 0 0 1rem;
  padding: 0.9rem 1rem;
  border-radius: 12px;
  background: rgba(16, 36, 62, 0.85);
  border: 1px solid var(--line);
  color: #d7e7ff;
}
.human-status.is-ok { border-color: #2f6b55; color: var(--ok); }
.human-status.is-warn { border-color: #8a6a1f; color: var(--warn); }
.human-status.is-error { border-color: #7f3d3d; color: var(--danger); }
#demo-controls, .result-panel, .how-it-works details {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 1rem 1.1rem;
  margin: 1rem 0;
}
.step-card h2 { margin: 0 0 0.4rem; font-size: 1.15rem; color: var(--muted); }
.step-card p { margin: 0.4rem 0 0.9rem; color: #b6c9e0; line-height: 1.45; }
.actions { display: flex; flex-wrap: wrap; gap: 0.65rem; margin: 0.75rem 0; }
label { display: grid; gap: 0.35rem; margin: 0.75rem 0; max-width: 32rem; color: #b6c9e0; }
.helper { font-size: 0.88rem; color: #8eabca; }
input, select {
  padding: 0.7rem;
  border-radius: 8px;
  border: 1px solid #38577b;
  background: #07111f;
  color: var(--text);
}
pre { white-space: pre-wrap; overflow-wrap: anywhere; color: #a7f3d0; margin: 0.75rem 0 0; }
.warning { color: var(--warn); }
.success-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--ok);
  font-weight: 600;
  margin: 0.35rem 0 0.75rem;
}
.claim-link a { display: inline-block; margin-top: 0.5rem; font-size: 1.05rem; }
.claim-link:not([hidden]) { display: block; color: var(--ok); }
details summary { cursor: pointer; color: var(--muted); }
.how-it-works ol { margin: 0.75rem 0; padding-left: 1.2rem; color: #b6c9e0; }
.how-it-works p { color: #8eabca; }
.demo-reset { margin: 0.25rem 0 0.75rem; text-align: right; }
.demo-reset button { font-size: 0.88rem; opacity: 0.9; }
@media (max-width: 760px) {
  .stepper { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 400px) {
  header, main { width: calc(100% - 1rem); }
  header { padding-top: 1.5rem; }
  h1 { font-size: 1.85rem; }
  .subtitle { font-size: 0.95rem; }
  .stepper { grid-template-columns: 1fr; gap: 0.35rem; margin: 0.85rem 0; }
  .step { min-height: auto; padding: 0.55rem 0.65rem; }
  .step-label { font-size: 0.84rem; }
  .actions { flex-direction: column; }
  .actions button { width: 100%; justify-content: center; }
  nav a { font-size: 0.88rem; }
}
`;
