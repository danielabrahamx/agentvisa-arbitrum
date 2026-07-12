export const STATIC_DEMO_STYLES = `
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
a, button { font: inherit; }
button {
  border: 1px solid #38577b;
  border-radius: 999px;
  padding: 0.65rem 1rem;
  color: var(--text);
  background: #10243e;
  cursor: pointer;
}
button:hover { background: #173556; }
button.primary { background: #1d4f7c; border-color: #3b82c4; }
button:disabled { opacity: 0.45; cursor: not-allowed; }
button.is-loading { pointer-events: none; opacity: 0.7; }
main { padding-bottom: 4rem; }
.stepper {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
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
.step.is-active { border-color: #3b82c4; color: var(--text); }
.step.is-done { border-color: #2f6b55; color: var(--ok); }
.step-index {
  display: inline-grid;
  place-items: center;
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 999px;
  background: #10243e;
  font-size: 0.85rem;
}
.human-status {
  margin: 0 0 1rem;
  padding: 0.9rem 1rem;
  border-radius: 12px;
  background: rgba(16, 36, 62, 0.85);
  border: 1px solid var(--line);
}
.human-status.is-ok { border-color: #2f6b55; color: var(--ok); }
.human-status.is-error { border-color: #7f3d3d; color: var(--danger); }
#demo-controls, .result-panel, .how-it-works details {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 1rem 1.1rem;
  margin: 1rem 0;
}
.step-card p { color: #b6c9e0; line-height: 1.45; }
.actions { display: flex; flex-wrap: wrap; gap: 0.65rem; margin: 0.75rem 0; }
.warning { color: var(--warn); }
pre { white-space: pre-wrap; overflow-wrap: anywhere; color: #a7f3d0; margin: 0.75rem 0 0; }
details summary { cursor: pointer; color: var(--muted); }
.how-it-works ol { margin: 0.75rem 0; padding-left: 1.2rem; color: #b6c9e0; }
.demo-reset { margin: 0.25rem 0 0.75rem; text-align: right; }
.demo-reset button { font-size: 0.88rem; opacity: 0.9; }
@media (max-width: 760px) { .stepper { grid-template-columns: 1fr; } }
`;

export function renderStaticIndexHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>AgentVisa · Arbitrum Sepolia demo</title>
    <style>${STATIC_DEMO_STYLES}</style>
  </head>
  <body data-page="/">
    <header>
      <p class="eyebrow">Static demo · membership and nullifiers on Arbitrum Sepolia</p>
      <h1>AgentVisa</h1>
      <p class="subtitle">Upstream uniqueness is pluggable; membership and scoped nullifiers are on Arbitrum. No identity secret on-chain.</p>
    </header>
    <main>
      <ol class="stepper" aria-label="Demo steps">
        <li data-step="1" class="step is-active"><span class="step-index">1</span><span class="step-label">Get credential</span></li>
        <li data-step="2" class="step"><span class="step-index">2</span><span class="step-label">Join Robot Rally</span></li>
        <li data-step="3" class="step"><span class="step-index">3</span><span class="step-label">Sybil check</span></li>
      </ol>
      <p id="human-status" class="human-status" aria-live="polite">Loading demo…</p>
      <section id="demo-controls" aria-live="polite">
        <div class="step-card">
          <h2>Step 1 · Get credential</h2>
          <p>Create a browser Semaphore identity, sign a synthetic enrollment authorization, and submit <code>enroll</code> on Arbitrum Sepolia.</p>
          <div class="actions"><button type="button" class="primary" disabled aria-busy="true">Loading…</button></div>
        </div>
      </section>
      <section class="result-panel">
        <details id="technical-details">
          <summary>Technical details</summary>
          <pre id="result">Ready.</pre>
        </details>
      </section>
      <p class="demo-reset"><button type="button" id="start-over-button">Start over</button></p>
      <footer class="how-it-works">
        <details>
          <summary>How this works</summary>
          <ol>
            <li>Browser-held Semaphore identity + synthetic enrollment authorization → <code>AgentVisaAdmission.enroll</code> on Sepolia.</li>
            <li>One scoped proof → <code>Semaphore.validateProof</code> with Stable Application ID scope and Login Key message.</li>
            <li>Same identity, new Login Key → same nullifier → second <code>validateProof</code> reverts on-chain.</li>
          </ol>
          <p class="warning">Testnet demo only. Enrollment signer key is bundled in this static build for hackathon convenience.</p>
        </details>
      </footer>
    </main>
    <script type="module" src="/client.js"></script>
    <script>
      window.addEventListener("error", function (event) {
        if (!event.filename || !event.filename.includes("client.js")) return;
        var status = document.getElementById("human-status");
        var result = document.getElementById("result");
        if (status) {
          status.textContent = "Demo script failed to load. Rebuild with pnpm --filter @agentvisa/localhost-demo build and reload.";
          status.classList.add("is-error");
        }
        if (result) {
          result.textContent = JSON.stringify({ status: "boot_error", detail: event.message || "client.js failed" }, null, 2);
        }
      });
    </script>
  </body>
</html>`;
}
