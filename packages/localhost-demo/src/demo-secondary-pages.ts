import {
  getJson,
  isRecord,
  postJson,
  requireElement,
  safeJson,
  show,
} from "./demo-client-shared.js";

export async function renderOperatorPage(
  controls: HTMLElement,
  result: HTMLElement,
): Promise<void> {
  controls.innerHTML = `<h2>Application-local moderation</h2><div id="accounts"></div>`;
  const response = await getJson("/api/operator/accounts");
  const accounts = Array.isArray(response.accounts) ? response.accounts : [];
  const container = requireElement("accounts");
  if (accounts.length === 0) {
    container.textContent = "No Robot Rally accounts yet.";
    show(result, response);
    return;
  }
  for (const value of accounts) {
    if (!isRecord(value) || typeof value.accountId !== "string") continue;
    const accountId = value.accountId;
    const row = document.createElement("article");
    const details = document.createElement("pre");
    details.textContent = safeJson(value);
    const flag = document.createElement("button");
    flag.textContent = "Manual bot flag";
    flag.addEventListener("click", () => {
      void postJson("/api/operator/flag", { accountId }).then(async (body) => {
        show(result, body);
        await renderOperatorPage(controls, result);
      });
    });
    const ban = document.createElement("button");
    ban.textContent = "Ban and invalidate sessions";
    ban.addEventListener("click", () => {
      void postJson("/api/operator/ban", { accountId }).then(async (body) => {
        show(result, body);
        await renderOperatorPage(controls, result);
      });
    });
    row.append(details, flag, ban);
    container.append(row);
  }
  show(result, response);
}

export async function renderAuditPage(controls: HTMLElement, result: HTMLElement): Promise<void> {
  controls.innerHTML = `<h2>Ordered application events</h2><p>This projection excludes raw proofs, source subjects, identity commitments, session tokens, and cross-application mappings.</p>`;
  show(result, await getJson("/api/audit"));
}
